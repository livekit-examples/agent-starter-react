import * as React from "react";
import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
    LocalParticipant,
  Participant,
  ParticipantEvent,
  Track,
  // TextStreamInfo,
} from "livekit-client";
import { TrackReference, trackSourceToProtocol } from "@/agent-sdk/external-deps/components-js";
import { ParticipantEventCallbacks } from "../node_modules/livekit-client/src/room/participant/Participant";
import { AgentSession, AgentSessionCallbacks, AgentSessionEvent } from "./agent-session/AgentSession";
import { ReceivedMessage, ReceivedMessageAggregator, ReceivedMessageAggregatorEvent, SentMessage } from "./agent-session/message";
import { AgentParticipantCallbacks, AgentParticipantEvent } from "./agent-session/AgentParticipant";
import { ParticipantPermission } from "livekit-server-sdk";

// ---------------------
// REACT
// ---------------------

const AgentSessionContext = React.createContext<AgentSession | null>(null);
export const AgentSessionProvider: React.FunctionComponent<React.PropsWithChildren<{ agentSession: AgentSession }>> = ({ agentSession, children }) => (
  <AgentSessionContext.Provider value={agentSession}>
    {children}
  </AgentSessionContext.Provider>
);

export function useAgentSession() {
  const agentSession = useContext(AgentSessionContext);
  if (!agentSession) {
    throw new Error('useAgentSession not used within AgentSessionContext!');
  }
  return agentSession;
}

export function useAgentMessages() {
  const agentSession = useAgentSession();

  const [messages, setMessages] = useState<
    Array<ReceivedMessage | SentMessage>
  >(agentSession.messages);
  useEffect(() => {
    let aggregator: ReceivedMessageAggregator | null = null;

    const handleUpdated = () => {
      if (!aggregator) {
        return;
      }
      setMessages(aggregator.toArray())
    };

    agentSession.createMessageAggregator({ startsAt: 'beginning' }).then(agg => {
      aggregator = agg;
      aggregator.on(ReceivedMessageAggregatorEvent.Updated, handleUpdated);
    }).catch(err => {
      // FIXME: how should this error be handled?
      console.error('Error creating message aggregator:', err);
    });

    return () => {
      aggregator?.off(ReceivedMessageAggregatorEvent.Updated, handleUpdated);
    };
  }, [agentSession]);

  const send = useCallback(async (message: SentMessage) => {
    return agentSession.sendMessage(message);
  }, [agentSession]);

  return { messages, send };
}

export function useAgentSessionEvent<EventName extends keyof AgentSessionCallbacks>(
  eventName: EventName,
  callback: AgentSessionCallbacks[EventName],
  dependencies: React.DependencyList,
) {
  const agentSession = useAgentSession();

  // FIXME: is doing this memoiztion here a good idea? Maybe useAgentSessionEvent(..., useCallback(...)) is preferrable?
  const memoizedCallback = useCallback(callback, dependencies);

  useEffect(() => {
    agentSession.on(eventName, memoizedCallback);
    return () => {
      agentSession.off(eventName, memoizedCallback);
    };
  }, [eventName, memoizedCallback]);
}

export function useAgentParticipantEvent<EventName extends keyof AgentParticipantCallbacks>(
  eventName: EventName,
  callback: AgentParticipantCallbacks[EventName],
  dependencies: React.DependencyList,
) {
  const agentSession = useAgentSession();

  // FIXME: is doing this memoiztion here a good idea? Maybe useAgentSessionEvent(..., useCallback(...)) is preferrable?
  const memoizedCallback = useCallback(callback, dependencies);

  useEffect(() => {
    if (!agentSession.agentParticipant) {
      return;
    }

    const agentParticipant = agentSession.agentParticipant;
    agentParticipant.on(eventName, memoizedCallback);
    return () => {
      agentParticipant.off(eventName, memoizedCallback);
    };
  }, [agentSession.agentParticipant, eventName, memoizedCallback]);
}

export function useAgentState() {
  const agentSession = useAgentSession();
  const [agentState, setAgentState] = useState(agentSession.state);
  const [isAvailable, setIsAvailable] = useState(agentSession.isAvailable);

  useAgentSessionEvent(AgentSessionEvent.AgentStateChanged, (newAgentState) => {
    setAgentState(newAgentState);
    setIsAvailable(agentSession.isAvailable);
  }, []);

  return { state: agentState, isAvailable };
}

export function useAgentTracks() {
  const agentSession = useAgentSession();

  const [audioTrack, setAudioTrack] = useState(agentSession.agentParticipant?.audioTrack ?? null);
  useAgentParticipantEvent(AgentParticipantEvent.AudioTrackChanged, setAudioTrack, []);
  const [videoTrack, setVideoTrack] = useState(agentSession.agentParticipant?.videoTrack ?? null);
  useAgentParticipantEvent(AgentParticipantEvent.VideoTrackChanged, setVideoTrack, []);

  return { audioTrack, videoTrack };
}

function useParticipantEvents<P extends Participant, EventName extends keyof ParticipantEventCallbacks>(
  participant: P,
  eventNames: Array<EventName>,
  callback: ParticipantEventCallbacks[EventName],
  dependencies: React.DependencyList,
) {
  // FIXME: is doing this memoiztion here a good idea? Maybe useAgentSessionEvent(..., useCallback(...)) is preferrable?
  const memoizedCallback = useCallback(callback, dependencies);

  useEffect(() => {
    for (const eventName of eventNames) {
      participant.on(eventName, memoizedCallback);
    }
    return () => {
      for (const eventName of eventNames) {
        participant.off(eventName, memoizedCallback);
      }
    };
  }, [participant, eventNames, memoizedCallback]);
}

export function useAgentLocalParticipant() {
  const agentSession = useAgentSession();

  const [localParticipant, setLocalParticipant] = React.useState(agentSession.localParticipant);
  const [microphoneTrack, setMicrophoneTrack] = React.useState<TrackReference | null>(null);
  const [cameraTrack, setCameraTrack] = React.useState<TrackReference | null>(null);
  const [permissions, setPermissions] = React.useState<ParticipantPermission | null>(null);

  useParticipantEvents(agentSession.localParticipant, [
    ParticipantEvent.TrackMuted,
    ParticipantEvent.TrackUnmuted,
    ParticipantEvent.ParticipantPermissionsChanged,
    // ParticipantEvent.IsSpeakingChanged,
    ParticipantEvent.TrackPublished,
    ParticipantEvent.TrackUnpublished,
    ParticipantEvent.LocalTrackPublished,
    ParticipantEvent.LocalTrackUnpublished,
    ParticipantEvent.MediaDevicesError,
    ParticipantEvent.TrackSubscriptionStatusChanged,
    // ParticipantEvent.ConnectionQualityChanged,
  ], () => {
    setLocalParticipant(agentSession.localParticipant);
    setPermissions(agentSession.localParticipant.permissions ?? null);

    // FIXME: is the rest of this stuff needed?
    // const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = p;
    const microphoneTrack = agentSession.localParticipant.getTrackPublication(Track.Source.Microphone);
    setMicrophoneTrack(microphoneTrack ? {
      source: Track.Source.Microphone,
      participant: localParticipant,
      publication: microphoneTrack,
    } : null);
    const cameraTrack = agentSession.localParticipant.getTrackPublication(Track.Source.Camera);
    setCameraTrack(cameraTrack ? {
      source: Track.Source.Camera,
      participant: localParticipant,
      publication: cameraTrack,
    } : null);
    // const participantMedia: ParticipantMedia<T> = {
    //   isCameraEnabled,
    //   isMicrophoneEnabled,
    //   isScreenShareEnabled,
    //   cameraTrack,
    //   microphoneTrack,
    //   participant: p,
    // };
    // return participantMedia;
  }, []);

  const publishPermissions = useMemo(() => {
    const canPublishSource = (source: Track.Source) => {
      return (
        permissions?.canPublish &&
        (permissions.canPublishSources.length === 0 ||
          permissions.canPublishSources.includes(trackSourceToProtocol(source)))
      );
    };

    return {
      camera: canPublishSource(Track.Source.Camera),
      microphone: canPublishSource(Track.Source.Microphone),
      screenShare: canPublishSource(Track.Source.ScreenShare),
      data: permissions?.canPublishData ?? false,
    };
  }, [permissions]);

  return {
    localParticipant,
    microphoneTrack,
    cameraTrack,
    publishPermissions,
  };
}

// hook ideas:
// useAgentTracks? (video)
// useAgentControls? (control bar stuff)

export {
  AgentSession,
  AgentSessionEvent,
};
