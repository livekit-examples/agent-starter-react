import * as React from "react";
import { useContext, useEffect, useState, useCallback } from "react";
import { parallelMerge } from 'streaming-iterables';
import { ConnectionState, LocalParticipant, Participant, ParticipantEvent, RemoteParticipant, Room, RoomEvent, Track, TrackEvent, TrackPublication, TranscriptionSegment } from "livekit-client";
import { EventEmitter } from "stream";
import { addMediaTimestampToTranscription, dedupeSegments, participantTrackEvents, TrackReference } from '@livekit/components-core';
import { getParticipantTrackRefs } from '@livekit/components/src/observables/track';
import { ParticipantEventCallbacks, ParticipantKind } from "../node_modules/livekit-client/src/room/participant/Participant";
// import { TRACK_TRANSCRIPTION_DEFAULTS } from "../hooks";
import { Future } from "../node_modules/livekit-client/src/room/utils";

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
    Array<InboundMessage | OutboundMessage>
  >(agentSession.messages);
  useEffect(() => {
    agentSession.on(AgentSessionEvent.MessagesChanged, setMessages);
  }, [agentSession]);

  const send = useCallback(async (message: OutboundMessage) => {
    return agentSession.sendMessage(message);
  }, [agentSession]);

  return { messages, send };
}

export function useAgentSessionEvent(
  eventName: AgentSessionEvent,
  callback: (data: any /* FIXME: types */) => void,
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

export function useAgentState() {
  const agentSession = useAgentSession();
  const [agentState, setAgentState] = useState(agentSession.state);
  const [isAvailable, setIsAvailable] = useState(agentSession.isAvailable);

  useAgentSessionEvent(AgentSessionEvent.AgentStateChanged, (newAgentState: AgentState) => {
    setAgentState(newAgentState);
    setIsAvailable(agentSession.isAvailable);
  }, []);

  return { state: agentState, isAvailable };
}

function useParticipantEvents<P extends Participant>(
  participant: P,
  eventNames: Array<ParticipantEvent>,
  callback: (data: any /* FIXME: types */) => void,
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
  const [microphoneTrack, setMicrophoneTrack] = React.useState<TrackPublication | null>(null);

  const participantObserver = useParticipantEvents(agentSession.localParticipant, [
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
  ], (p: LocalParticipant) => {
    setLocalParticipant(p);
    // FIXME: is the rest of this stuff needed?
    // const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = p;
    const microphoneTrack = p.getTrackPublication(Track.Source.Microphone);
    setMicrophoneTrack(microphoneTrack ?? null);
    // const cameraTrack = p.getTrackPublication(Track.Source.Camera);
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

  return { localParticipant, microphoneTrack };
}

// hook ideas:
// useAgentTracks? (video)
// useAgentControls? (control bar stuff)

// ---------------------
// BASE
// ---------------------

const stateAttribute = 'lk.agent.state';

export type AgentState =
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'listening'
  | 'thinking'
  | 'speaking';

enum AgentParticipantEvent {
  VideoTrackChanged = 'videoTrackChanged',
  AudioTrackChanged = 'videoTrackChanged',
  AgentAttributesChanged = 'agentAttributesChanged',
  AgentTranscriptionsChanged = 'agentTranscriptionsChanged',
}

// Goal: some sort of abstraction layer to provide information specific to the agent's interactions
// like video stream / audio stream / transcriptions / underlying participant attributes / etc,
// since it doesn't just come from one RemoteParticipant
// FIXME: maybe this could be named better? ...
class AgentParticipant extends EventEmitter {
  private room: Room;

  private agentParticipant: RemoteParticipant | null = null;
  private workerParticipant: RemoteParticipant | null = null;
  audioTrack: TrackReference | null = null;
  videoTrack: TrackReference | null = null;

  audioTrackSyncTime: { timestamp: number, rtpTimestamp?: number } | null = null;

  attributes: Record<string, string> = {};

  transcriptions: Array<TranscriptionSegment> = [];
  transcriptionBufferSize: number = 100//TRACK_TRANSCRIPTION_DEFAULTS.bufferSize;

  constructor(room: Room) {
    super();
    this.room = room;

    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
  }

  teardown() {
    this.room.off(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.off(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
  }

  private handleParticipantConnected = () => {
    this.updateParticipants();
  }
  private handleParticipantDisconnected = () => {
    this.updateParticipants();
  }

  private updateParticipants() {
    const newAgentParticipant = this.roomRemoteParticipants.find(
      (p) => p.kind === ParticipantKind.AGENT && !('lk.publish_on_behalf' in p.attributes),
    ) ?? null;
    const newWorkerParticipant = newAgentParticipant ? (
      this.roomRemoteParticipants.find(
        (p) =>
          p.kind === ParticipantKind.AGENT && p.attributes['lk.publish_on_behalf'] === newAgentParticipant.identity,
      ) ?? null
    ) : null;

    // Keep this.agentParticipant / this.workerParticipant up to date
    for (const event of participantTrackEvents) {
      if (this.agentParticipant !== newAgentParticipant) {
        this.agentParticipant?.off(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        // FIXME: emit AgentParticipantChanged?
        newAgentParticipant?.on(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        this.agentParticipant = newAgentParticipant;
      }
      if (this.workerParticipant !== newWorkerParticipant) {
        this.workerParticipant?.off(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        // FIXME: emit WorkerParticipantChanged?
        newWorkerParticipant?.on(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        this.workerParticipant = newWorkerParticipant;
      }
    }

    if (this.agentParticipant !== newAgentParticipant) {
      this.agentParticipant?.off(ParticipantEvent.AttributesChanged, this.handleAttributesChanged);
      // FIXME: emit AgentAttributesChanged?
      newAgentParticipant?.on(ParticipantEvent.AttributesChanged, this.handleAttributesChanged);
      this.agentParticipant = newAgentParticipant;
    }
  }

  private handleUpdateTracks = () => {
    const newVideoTrack = (
      this.agentTracks.find((t) => t.source === Track.Source.Camera) ??
      this.workerTracks.find((t) => t.source === Track.Source.Camera) ?? null
    );
    if (this.videoTrack !== newVideoTrack) {
      this.videoTrack = newVideoTrack;
      this.emit(AgentParticipantEvent.VideoTrackChanged, newVideoTrack);
    }

    const newAudioTrack = (
      this.agentTracks.find((t) => t.source === Track.Source.Microphone) ??
      this.workerTracks.find((t) => t.source === Track.Source.Microphone) ?? null
    );
    if (this.audioTrack !== newAudioTrack) {
      this.audioTrack = newAudioTrack;
      this.audioTrack?.on(TrackEvent.TranscriptionReceived, this.handleTranscriptionReceived);

      this.audioTrackSyncTime = {
        timestamp: Date.now(),
        rtpTimestamp: this.audioTrack?.publication.track?.rtpTimestamp,
      };
      this.audioTrack?.publication.track?.on(TrackEvent.TimeSyncUpdate, this.handleTimeSyncUpdate);

      this.emit(AgentParticipantEvent.AudioTrackChanged, newAudioTrack);
    }
  };

  private handleAttributesChanged = (attributes: Record<string, string>) => {
    this.attributes = attributes;
    this.emit(AgentParticipantEvent.AgentAttributesChanged, attributes);
  };

  private handleTranscriptionReceived = (event: Array<Array<TranscriptionSegment>>) => {
    const segments = event[0];
    if (!segments) {
      return;
    }
    if (!this.audioTrackSyncTime) {
      throw new Error('AgentParticipant - audioTrackSyncTime missing');
    }
    const audioTrackSyncTime = this.audioTrackSyncTime;

    this.transcriptions = dedupeSegments(
      this.transcriptions,
      // when first receiving a segment, add the current media timestamp to it
      segments.map((s) => addMediaTimestampToTranscription(s, audioTrackSyncTime)),
      this.transcriptionBufferSize,
    );
    this.emit(AgentParticipantEvent.AgentTranscriptionsChanged, this.transcriptions);
  }

  private handleTimeSyncUpdate = (update: { timestamp: number; rtpTimestamp: number }) => {
    this.audioTrackSyncTime = update;
  };

  private get roomRemoteParticipants() {
    return Array.from(this.room.remoteParticipants.values());
  }

  private get agentTracks() {
    if (!this.agentParticipant) {
      return [];
    }
    return getParticipantTrackRefs(
      this.agentParticipant,
      { sources: [Track.Source.Microphone, Track.Source.Camera] }
    );
  }

  private get workerTracks() {
    if (!this.workerParticipant) {
      return [];
    }
    return getParticipantTrackRefs(
      this.workerParticipant,
      { sources: [Track.Source.Microphone, Track.Source.Camera] }
    );
  }
}

abstract class BaseContent {
  complete: boolean = false;
}

export class TextContent extends BaseContent {
  // TODO: some sort of id / `key`able field?
  data: string;

  constructor(data: string) {
    super();
    this.data = data;
    this.complete = true;
  }
}

class TranscriptionContent extends BaseContent {
  // TODO: some sort of id / `key`able field? How does this get generated / where does this come
  // from?
  data: string;
  segmentId: TranscriptionSegment['id'];

  constructor(segment: TranscriptionSegment) {
    super();
    this.segmentId = segment.id;
    this.data = segment.text;
  }
}





abstract class BaseMessage {
  id: string;
  timestamp: Date;
  metadata: Record<string, string> = {};

  constructor(id: string, timestamp: Date) {
    this.id = id;
    this.timestamp = timestamp;
  }
}

// TODO: images? attachments? rpc?
type InboundMessageContent = TranscriptionContent;

export class InboundMessage extends BaseMessage {
  contents: Array<InboundMessageContent> = [];

  constructor(
    contents: Array<InboundMessageContent>,
    id: string,
    timestamp: Date = new Date(),
  ) {
    super(id, timestamp);
    this.contents = contents;
  }

  get complete() {
    return this.contents.every(c => c.complete);
  }
}

type OutboundMessageContent = TextContent;
export class OutboundMessage extends BaseMessage {
  contents: Array<OutboundMessageContent> = [];

  constructor(
    contents: Array<OutboundMessageContent>,
    id: string,
    timestamp: Date = new Date()
  ) {
    super(id, timestamp);
    this.contents = contents;
  }
}



enum MessageReceiverEvents {
  NewIncomingMessage = 'newIncomingMessage'
}

class MessageReceiverTerminationError extends Error {}

abstract class MessageReceiver extends EventEmitter {
  private signallingFuture = new Future<null>();
  private queue: Array<InboundMessage> = [];

  // This returns cleanup function like useEffect maybe? That could be a good pattern?
  abstract start(): Promise<undefined | (() => void)>;

  /** Submit new IncomingMessages to be received by anybody reading from messages() */
  protected enqueue(...messages: Array<InboundMessage>) {
    for (const message of messages) {
      this.queue.push(message);
      this.emit(MessageReceiverEvents.NewIncomingMessage, message);
    }
    const oldSignallingFuture = this.signallingFuture;
    this.signallingFuture = new Future<null>();
    oldSignallingFuture.resolve?.(null);
  }

  /** Terminate the messages() iteration from out of band */
  close() {
    const name: string = (this as any).constructor.name ?? 'MessageReceiver';
    this.signallingFuture.reject?.(
      new MessageReceiverTerminationError(`${name} terminated messages() iteration`)
    );
  }

  /** A stream of newly generated `IncomingMessage`s */
  async *messages(): AsyncGenerator<InboundMessage> {
    const cleanup = await this.start();
    try {
      while (true) {
        await this.signallingFuture.promise;
        yield* this.queue;
        this.queue = [];
      }
    } catch (err) {
      if (err instanceof MessageReceiverTerminationError) {
        cleanup?.();
        return;
      }
    } finally {
      cleanup?.();
    }
  }
}

abstract class MessageSender {
  abstract send(message: OutboundMessage): Promise<void>;
}

class TranscriptionMessageReceiver extends MessageReceiver {
  agentParticipant: AgentParticipant;

  constructor(agentParticipant: AgentParticipant) {
    super();
    this.agentParticipant = agentParticipant;
  }

  async start() {
    const handleAgentTranscriptionsChanged = (newTranscriptionSegments: Array<TranscriptionSegment>) => {
      for (const segment of newTranscriptionSegments) {
        this.enqueue(new InboundMessage([
          new TranscriptionContent(segment),
        ], new Date(segment.startTime)));
      }
    };

    this.agentParticipant.on(
      AgentParticipantEvent.AgentTranscriptionsChanged,
      handleAgentTranscriptionsChanged,
    );
    return () => {
      this.agentParticipant.off(
        AgentParticipantEvent.AgentTranscriptionsChanged,
        handleAgentTranscriptionsChanged,
      );
    };
  }
}




/**
  * A `MessageReceiver` which takes a list of other `MessageReceiver`s and forwards along their `InboundMessage`s
  * Conceptually, think `Promise.race` being run across each async iterator iteration.
  */
class CombinedMessageReceiver extends MessageReceiver {
  private messageReceivers: Array<MessageReceiver>;

  constructor(...messageReceivers: Array<MessageReceiver>) {
    super();
    this.messageReceivers = messageReceivers;
  }

  async start() {
    for await (const inboundMessage of parallelMerge(...this.messageReceivers.map(mr => mr.messages()))) {
      this.enqueue(inboundMessage);
    }

    return () => {
      for (const messageReceiver of this.messageReceivers) {
        messageReceiver.close();
      }
    };
  }
}


export enum AgentSessionEvent {
  AgentStateChanged = 'agentStateChanged',
  AudioTrackChanged = 'audioTrackChanged',
  VideoTrackChanged = 'videoTrackChanged',
  AgentAttributesChanged = 'agentAttributesChanged',
  MessagesChanged = 'messagesChanged',
  AgentConnectionFailure = 'AgentConnectionFailure',
}

export class AgentSession extends EventEmitter {
  room: Room; // FIXME: should this be private?
  state: AgentState = 'disconnected';

  agentParticipant: AgentParticipant | null = null;
  messageReceiver: MessageReceiver | null = null;
  messages: Array<InboundMessage | OutboundMessage> = [];
  // private transcriptionMessageReceiver: TranscriptionMessageReceiver;
    // this.transcriptionMessageReceiver = new TranscriptionMessageReceiver(agentParticipant);
      // this.transcriptionMessageReceiver.messages(),
      // /* more `MessageReceiver`s here later */

  constructor() {
    super();

    this.room = new Room();
    this.room.on(RoomEvent.Connected, this.handleRoomConnected);
    this.room.on(RoomEvent.Disconnected, this.handleRoomDisconnected);
    this.room.on(RoomEvent.ConnectionStateChanged, this.handleConnectionStateChanged);
  }

  async connect(url: string, token: string) {
    // FIXME: catch connection errors here and reraise? idk
    await Promise.all([
      this.room.connect(url, token),
      // FIXME: make it so the preconenct buffer thing can be disabled?
      this.room.localParticipant.setMicrophoneEnabled(true, undefined, { preConnectBuffer: true }),
    ]);
  }
  async disconnect() {
    await this.room.disconnect();
  }

  private handleRoomConnected = () => {
    this.agentParticipant = new AgentParticipant(this.room);
    this.agentParticipant.on(AgentParticipantEvent.AgentAttributesChanged, this.handleAgentAttributesChanged);

    this.messageReceiver = new CombinedMessageReceiver(
      new TranscriptionMessageReceiver(this.agentParticipant),
    );
    this.messageReceiver.on(MessageReceiverEvents.NewIncomingMessage, this.handleIncomingMessage);

    this.startAgentConnectedTimeout();
  }

  private handleRoomDisconnected = () => {
    this.agentParticipant?.teardown();
    this.agentParticipant = null;

    this.messageReceiver?.off(MessageReceiverEvents.NewIncomingMessage, this.handleIncomingMessage);
    this.messageReceiver?.close();
    this.messageReceiver = null;

    if (this.agentConnectedTimeout) {
      clearTimeout(this.agentConnectedTimeout);
      this.agentConnectedTimeout = null;
    }
  }

  private agentConnectedTimeout: NodeJS.Timeout | null = null;
  private startAgentConnectedTimeout = () => {
    this.agentConnectedTimeout = setTimeout(() => {
      if (!this.isAvailable) {
        const reason =
          this.state === 'connecting'
            ? 'Agent did not join the room. '
            : 'Agent connected but did not complete initializing. ';

        this.emit(AgentSessionEvent.AgentConnectionFailure, reason);
        this.room.disconnect();
      }
    }, 10_000);
  }

  private handleConnectionStateChanged = async () => {
    this.updateAgentState();
  }

  private handleAgentAttributesChanged = () => {
    this.updateAgentState();
  }

  private handleIncomingMessage = (incomingMessage: InboundMessage) => {
    // FIXME: Do message accumulation here? Or maybe add some other entity to handle it?
    this.messages.push(incomingMessage);
    this.emit(AgentSessionEvent.MessagesChanged, this.messages);
  }

  private updateAgentState = () => {
    if (!this.agentParticipant) {
      throw new Error('AgentSession.agentParticipant is unset');
    }
    const agentParticipantAttributes = this.agentParticipant.attributes;
    const connectionState = this.room.state;

    let newAgentState: AgentState | null = null;
    if (connectionState === ConnectionState.Disconnected) {
      newAgentState = 'disconnected';
    } else if (
      connectionState === ConnectionState.Connecting ||
      !this.agentParticipant ||
      !agentParticipantAttributes?.[stateAttribute]
    ) {
      newAgentState = 'connecting';
    } else {
      newAgentState = agentParticipantAttributes[stateAttribute] as AgentState;
    }

    if (this.state !== newAgentState) {
      this.state = newAgentState;
      this.emit(AgentSessionEvent.AgentStateChanged, newAgentState);
    }
  }

  get isAvailable() {
    return this.state == 'listening' || this.state == 'thinking' || this.state == 'speaking';
  }

  get localParticipant() {
    return this.room?.localParticipant ?? null;
  }

  // Mesasges:
  // - transcriptions are probably how agent generated messages come into being?
  // - lk.chat data channel messages also exist
  async sendMessage(message: OutboundMessage) {
    /* TODO */
  }

  generateReply() {}
}


// Proposal:
// Copy of LiveKitRoom, but for agents (LiveKitAgentSession?)
//   - This exposes a context like RoomContext
// Hooks that replicate a lot of useVoiceAssistant functionality which tap into agent context:
//   - useAgent gets raw AgentSession
//   - useAgentMessages?
//   - useAgentSend
