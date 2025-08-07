import * as React from "react";
import { useContext, useEffect, useState, useCallback } from "react";
import { parallelMerge } from 'streaming-iterables';
import {
  ConnectionState,
  LocalParticipant,
  Participant,
  ParticipantEvent,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  TrackPublication,
  TranscriptionSegment,
  ParticipantKind,
  TextStreamReader,
  // TextStreamInfo,
} from "livekit-client";
import { EventEmitter } from "events";
// import { addMediaTimestampToTranscription, dedupeSegments, ReceivedTranscriptionSegment } from '@livekit/components-core';
// import { getParticipantTrackRefs } from '@livekit/components/src/observables/track';
import { ParticipantEventCallbacks } from "../node_modules/livekit-client/src/room/participant/Participant";
// import { DataTopic /* , ParticipantTrackIdentifier */ } from "@livekit/components-core";
// import { TRACK_TRANSCRIPTION_DEFAULTS } from "../hooks";
// import { Future } from "../node_modules/livekit-client/src/room/utils";

/* FROM LIVEKIT-CLIENT */
class Future<T> {
  promise: Promise<T>;

  resolve?: (arg: T) => void;

  reject?: (e: any) => void;

  onFinally?: () => void;

  get isResolved(): boolean {
    return this._isResolved;
  }

  private _isResolved: boolean = false;

  constructor(
    futureBase?: (resolve: (arg: T) => void, reject: (e: any) => void) => void,
    onFinally?: () => void,
  ) {
    this.onFinally = onFinally;
    this.promise = new Promise<T>(async (resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      if (futureBase) {
        await futureBase(resolve, reject);
      }
    }).finally(() => {
      this._isResolved = true;
      this.onFinally?.();
    });
  }
}

interface BaseStreamInfo {
  id: string;
  mimeType: string;
  topic: string;
  timestamp: number;
  /** total size in bytes for finite streams and undefined for streams of unknown size */
  size?: number;
  attributes?: Record<string, string>;
}
interface ByteStreamInfo extends BaseStreamInfo {
  name: string;
}

interface TextStreamInfo extends BaseStreamInfo {}
/* END FROM LIVEKIT CLIENT */

/* FROM COMPONENTS JS: */
/** @public */
type TrackReference = {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
};

const participantTrackEvents = [
  ParticipantEvent.TrackPublished,
  ParticipantEvent.TrackUnpublished,
  ParticipantEvent.TrackMuted,
  ParticipantEvent.TrackUnmuted,
  ParticipantEvent.TrackStreamStateChanged,
  ParticipantEvent.TrackSubscribed,
  ParticipantEvent.TrackUnsubscribed,
  ParticipantEvent.TrackSubscriptionPermissionChanged,
  ParticipantEvent.TrackSubscriptionFailed,
  ParticipantEvent.LocalTrackPublished,
  ParticipantEvent.LocalTrackUnpublished,
];

type ReceivedTranscriptionSegment = TranscriptionSegment & {
  receivedAtMediaTimestamp: number;
  receivedAt: number;
};

function addMediaTimestampToTranscription(
  segment: TranscriptionSegment,
  timestamps: { timestamp: number; rtpTimestamp?: number },
): ReceivedTranscriptionSegment {
  return {
    ...segment,
    receivedAtMediaTimestamp: timestamps.rtpTimestamp ?? 0,
    receivedAt: timestamps.timestamp,
  };
}

/**
 * @returns An array of unique (by id) `TranscriptionSegment`s. Latest wins. If the resulting array would be longer than `windowSize`, the array will be reduced to `windowSize` length
 */
function dedupeSegments<T extends TranscriptionSegment>(
  prevSegments: T[],
  newSegments: T[],
  windowSize: number,
) {
  return [...prevSegments, ...newSegments]
    .reduceRight((acc, segment) => {
      if (!acc.find((val) => val.id === segment.id)) {
        acc.unshift(segment);
      }
      return acc;
    }, [] as Array<T>)
    .slice(0 - windowSize);
}

/**
 * Create `TrackReferences` for all tracks that are included in the sources property.
 *  */
function getParticipantTrackRefs(
  participant: Participant,
  identifier: any/* ParticipantTrackIdentifier */,
  onlySubscribedTracks = false,
): TrackReference[] {
  const { sources, kind, name } = identifier;
  const sourceReferences = Array.from(participant.trackPublications.values())
    .filter(
      (pub) =>
        (!sources || sources.includes(pub.source)) &&
        (!kind || pub.kind === kind) &&
        (!name || pub.trackName === name) &&
        // either return all or only the ones that are subscribed
        (!onlySubscribedTracks || pub.track),
    )
    .map((track): TrackReference => {
      return {
        participant: participant,
        publication: track,
        source: track.source,
      };
    });

  return sourceReferences;
}

interface TextStreamData {
  text: string;
  participantInfo: { identity: string }; // Replace with the correct type from livekit-client
  streamInfo: any /* TextStreamInfo */;
}

const DataTopic = {
  CHAT: 'lk.chat',
  TRANSCRIPTION: 'lk.transcription',
} as const;
/* END FROM COMPONENTS JS: */

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
    agentSession.on(AgentSessionEvent.MessagesChanged, setMessages);
    return () => {
      agentSession.off(AgentSessionEvent.MessagesChanged, setMessages);
    };
  }, [agentSession]);

  const send = useCallback(async (message: SentMessage) => {
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
      participant.on(eventName as keyof ParticipantEventCallbacks, memoizedCallback);
    }
    return () => {
      for (const eventName of eventNames) {
        participant.off(eventName as keyof ParticipantEventCallbacks, memoizedCallback);
      }
    };
  }, [participant, eventNames, memoizedCallback]);
}

export function useAgentLocalParticipant() {
  const agentSession = useAgentSession();

  const [localParticipant, setLocalParticipant] = React.useState(agentSession.localParticipant);
  const [microphoneTrack, setMicrophoneTrack] = React.useState<TrackPublication | null>(null);

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

    const oldAgentParticipant = this.agentParticipant;
    const oldWorkerParticipant = this.workerParticipant;
    this.agentParticipant = newAgentParticipant;
    this.workerParticipant = newWorkerParticipant;

    // 1. Listen for attribute changes
    if (oldAgentParticipant !== this.agentParticipant) {
      oldAgentParticipant?.off(ParticipantEvent.AttributesChanged, this.handleAttributesChanged);

      if (this.agentParticipant) {
        this.agentParticipant.on(ParticipantEvent.AttributesChanged, this.handleAttributesChanged);
        this.handleAttributesChanged(this.agentParticipant.attributes);
      }
    }

    // 2. Listen for track updates
    for (const event of participantTrackEvents) {
      if (oldAgentParticipant !== this.agentParticipant) {
        oldAgentParticipant?.off(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        if (this.agentParticipant) {
          this.agentParticipant.on(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
          this.handleUpdateTracks();
        }
      }
      if (oldWorkerParticipant !== this.workerParticipant) {
        oldWorkerParticipant?.off(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        if (this.workerParticipant) {
          this.workerParticipant.on(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
          this.handleUpdateTracks();
        }
      }
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
      // console.log('!! audio track changed', this.audioTrack?.publication);
      // this.audioTrack?.publication.off(TrackEvent.TranscriptionReceived, this.handleTranscriptionReceived);
      this.audioTrack = newAudioTrack;
      // this.audioTrack?.publication.on(TrackEvent.TranscriptionReceived, this.handleTranscriptionReceived);

      // this.audioTrackSyncTime = {
      //   timestamp: Date.now(),
      //   rtpTimestamp: this.audioTrack?.publication.track?.rtpTimestamp,
      // };
      // this.audioTrack?.publication.track?.on(TrackEvent.TimeSyncUpdate, this.handleTimeSyncUpdate);

      this.emit(AgentParticipantEvent.AudioTrackChanged, newAudioTrack);
    }
  };

  private handleAttributesChanged = (attributes: Record<string, string>) => {
    this.attributes = attributes;
    this.emit(AgentParticipantEvent.AgentAttributesChanged, attributes);
  };

  // private handleTranscriptionReceived = (segments: Array<TranscriptionSegment>) => {
  //   console.log('!! TRANSCRIPTION', segments, this.audioTrackSyncTime);
  //   if (!this.audioTrackSyncTime) {
  //     throw new Error('AgentParticipant - audioTrackSyncTime missing');
  //   }
  //   const audioTrackSyncTime = this.audioTrackSyncTime;

  //   this.transcriptions = dedupeSegments(
  //     this.transcriptions,
  //     // when first receiving a segment, add the current media timestamp to it
  //     segments.map((s) => addMediaTimestampToTranscription(s, audioTrackSyncTime)),
  //     this.transcriptionBufferSize,
  //   );
  //   this.emit(AgentParticipantEvent.AgentTranscriptionsChanged, this.transcriptions);
  // }

  // private handleTimeSyncUpdate = (update: { timestamp: number; rtpTimestamp: number }) => {
  //   console.log('!! TIME SYNC UPDATE', update);
  //   this.audioTrackSyncTime = update;
  // };

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




type BaseMessageId = string;
type BaseMessage<Direction extends 'inbound' | 'outbound', Content> = {
  id: BaseMessageId;
  direction: Direction;
  timestamp: Date;
  content: Content;
};

type ReceivedTranscriptionMessage = BaseMessage<'inbound', {
  type: 'transcription';
  text: string;
  participantInfo: { identity: string };
  streamInfo: TextStreamInfo;
}>;

type ReceivedChatLoopbackMessage = BaseMessage<'inbound', { type: 'chat'; text: string }>;

export type ReceivedMessage =
  | ReceivedTranscriptionMessage
  | ReceivedChatLoopbackMessage;
  // TODO: images? attachments? rpc?

type SentChatMessage = BaseMessage<'outbound', | { type: 'chat', text: string }>;
export type SentMessage =
  | SentChatMessage;



class MessageReceiverTerminationError extends Error {}

abstract class MessageReceiver<Message extends ReceivedMessage = ReceivedMessage> {
  private signallingFuture = new Future<null>();
  private queue: Array<Message> = [];

  // This returns cleanup function like useEffect maybe? That could be a good pattern?
  abstract start(): Promise<undefined | (() => void)>;

  /** Submit new IncomingMessages to be received by anybody reading from messages() */
  protected enqueue(...messages: Array<Message>) {
    for (const message of messages) {
      this.queue.push(message);
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

  closeWithError(error: Error) {
    this.signallingFuture.reject?.(error);
  }

  /** A stream of newly generated `IncomingMessage`s */
  async *messages(): AsyncGenerator<Message> {
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

abstract class MessageSender<Message extends SentMessage = SentMessage> {
  /** Can this MessageSender handle sending the given message? */
  abstract canSend(message: SentMessage): message is Message
  abstract send(message: Message): Promise<void>;
}

class ChatMessageSender extends MessageSender<SentChatMessage> {
  private localParticipant: LocalParticipant;
  private loopbackReceiverCallbacks: Set<(incomingMessage: SentChatMessage) => void> = new Set();

  constructor(localParticipant: LocalParticipant) {
    super();
    this.localParticipant = localParticipant;
  }

  canSend(message: SentMessage): message is SentChatMessage {
    return message.content.type === 'chat';
  }

  async send(message: SentChatMessage) {
    for (const callback of this.loopbackReceiverCallbacks) {
      callback(message);
    }

    await this.localParticipant.sendText(message.content.text, /* FIXME: options here? */);

    // const legacyChatMsg: LegacyChatMessage = {
    //   id: message.id,
    //   timestamp: message.timestamp.getTime(),
    //   message: message.content.text,
    // };
    // const encodeLegacyMsg = (message: LegacyChatMessage) => new TextEncoder().encode(JSON.stringify(message));
    // await this.localParticipant.publishData(encodeLegacyMsg(legacyChatMsg), {
    //   topic: "lk-chat-topic",//LegacyDataTopic.CHAT,
    //   reliable: true,
    // });
  }

  /**
    * Generates a corresponding MessageReceiver which will emit "received" versions of each chat
    * message, that can be correspondingly merged into the message list.
    *
    * FIXME: should this be on the MessageSender instead, so this can be done for any sender?
    */
  generateLoopbackMessageReceiver() {
    const chatMessageSender = this;
    class ChatMessageLoopbackReceiver extends MessageReceiver<ReceivedChatLoopbackMessage> {
      async start() {
        const callback = (incomingMessage: SentChatMessage) => {
          const outgoingMessage: ReceivedChatLoopbackMessage = {
            id: incomingMessage.id,
            direction: 'inbound',
            timestamp: incomingMessage.timestamp,
            content: { type: 'chat', text: incomingMessage.content.text },
          };
          this.enqueue(outgoingMessage);
        };

        chatMessageSender.loopbackReceiverCallbacks.add(callback);
        return () => {
          chatMessageSender.loopbackReceiverCallbacks.delete(callback);
        };
      }
    }

    return new ChatMessageLoopbackReceiver();
  }
}

class CombinedMessageSender extends MessageSender {
  private messageSenders: Array<MessageSender>;

  constructor(...messageSenders: Array<MessageSender>) {
    super();
    this.messageSenders = messageSenders;
  }

  canSend(message: SentMessage): message is SentMessage {
    return true;
  }

  async send(message: SentMessage) {
    for (const sender of this.messageSenders) {
      // FIXME: an open question - should this only ever send with one MessageSender or potentially
      // multiple? It doesn't matter now given there is only one MessageSender (ChatMessageSender)
      // but I'm not sure the right long term call.
      if (sender.canSend(message)) {
        await sender.send(message);
        return;
      }
    }

    throw new Error(`CombinedMessageSender - cannot find a MessageSender to send message ${JSON.stringify(message)}`);
  }
}

enum TranscriptionAttributes {
  Final = "lk.transcription_final",
  Segment = "lk.segment_id",
  TrackId = "lk.transcribed_track_id",
}

/**
  * Processes new `lk.transcription` data stream events generated by the agent for both user and
  * LLM generated speach and generates corresponding `TranscriptionReceivedMessage`s.
  *
  * For agent messages, a new text stream is emitted for each message, and the stream is closed when the message is finalized.
  * Each agent message is delivered in chunks which must be accumulated and published into the message stream.
  *
  * For user messages, the full transcription is sent each time, but may be updated until finalized.
  *
  * The `lk.segment_id` attribute is stable and unique across the lifetime of the message.
  *
  * Example agent generated transcriptions:
  * ```
  * { segment_id: "1", content: "Hello" }
  * { segment_id: "1", content: " world" }
  * { segment_id: "1", content: "!" }
  * { segment_id: "2", content: "Hello" }
  * { segment_id: "2", content: " Apple" }
  * { segment_id: "2", content: "!" }
  * ```
  *
  * Example user generated transcriptions:
  * ```
  * { segment_id: "3", content: "Hello" }
  * { segment_id: "3", content: "Hello world!" }
  * { segment_id: "4", content: "Hello" }
  * { segment_id: "4", content: "Hello Apple!" }
  * ```
  */
class TranscriptionMessageReceiver extends MessageReceiver {
  room: Room;
  inFlightMessages: Array<ReceivedTranscriptionMessage> = [];

  constructor(room: Room) {
    super();
    this.room = room;
  }

  async start() {
    const textStreamHandler = async (reader: TextStreamReader, participantInfo: { identity: string }) => {
      const transcriptionSegmentId = reader.info.attributes?.[TranscriptionAttributes.Segment];
      const isTranscription = Boolean(transcriptionSegmentId);
      const isFinal = reader.info.attributes?.[TranscriptionAttributes.Final] === 'true';

      let currentStreamId = reader.info.id;

      // Find and update the stream in our array
      let messageIndex = this.inFlightMessages.findIndex((message) => {
        if (message.content.streamInfo.id === reader.info.id) {
          return true;
        }
        if (isTranscription && transcriptionSegmentId === message.content.streamInfo.attributes?.[TranscriptionAttributes.Segment]) {
          return true;
        }
        return false;
      });

      // FIXME: I think there may need to be some error handling logic to ensure the below for await
      // properly exposes errors via `this.closeWithError`
      for await (const chunk of reader) {
        const existingMessage = this.inFlightMessages[messageIndex];
        if (existingMessage) {
          if (existingMessage.content.streamInfo.id === currentStreamId) {
            // Stream hasn't changed, just append content
            const updatedMessage = this.appendInFlightMessageText(messageIndex, chunk, reader.info);
            this.enqueue(updatedMessage);
          } else {
            // Stream has changed, so fully replace content
            const updatedMessage = this.replaceInFlightMessageText(messageIndex, chunk, reader.info);
            this.enqueue(updatedMessage);
          }

        } else {
          // Handle case where stream ID wasn't found (new message)
          const message: ReceivedMessage = {
            id: reader.info.id,
            direction: 'inbound',
            timestamp: new Date(reader.info.timestamp),
            content: {
              type: 'transcription',
              text: chunk,
              participantInfo,
              streamInfo: reader.info,
            },
          };
          this.inFlightMessages.push(message);
          messageIndex = this.inFlightMessages.length-1;
          this.enqueue(message);
        }
      }

      if (isFinal) {
        this.inFlightMessages.splice(messageIndex, 1);
        console.log('!! MESSAGE DONE!', this.inFlightMessages);
      }
    };
    this.room.registerTextStreamHandler(DataTopic.TRANSCRIPTION, textStreamHandler);

    return () => {
      this.room.unregisterTextStreamHandler(DataTopic.TRANSCRIPTION);
    };
  }

  private replaceInFlightMessageText(messageIndex: number, text: string, streamInfo: TextStreamInfo) {
    this.inFlightMessages[messageIndex] = {
      ...this.inFlightMessages[messageIndex],
      content: {
        ...this.inFlightMessages[messageIndex].content,
        text,
        streamInfo,
      },
    };
    return this.inFlightMessages[messageIndex];
  }
  private appendInFlightMessageText(messageIndex: number, text: string, streamInfo: TextStreamInfo) {
    this.inFlightMessages[messageIndex] = {
      ...this.inFlightMessages[messageIndex],
      content: {
        ...this.inFlightMessages[messageIndex].content,
        text: this.inFlightMessages[messageIndex].content.text + text,
        streamInfo,
      },
    };
    return this.inFlightMessages[messageIndex];
  }
}




/**
  * A `MessageReceiver` which takes a list of other `MessageReceiver`s and forwards along their `InboundMessage`s
  * Conceptually, think `Promise.race` being run across all passed `MessageReceiver`s on each async iterator iteration.
  */
class CombinedMessageReceiver extends MessageReceiver {
  private messageReceivers: Array<MessageReceiver>;

  constructor(...messageReceivers: Array<MessageReceiver>) {
    super();
    this.messageReceivers = messageReceivers;
  }

  async start() {
    const messagesAsyncIterators = this.messageReceivers.map(mr => mr.messages());
    (async () => {
      for await (const inboundMessage of parallelMerge(...messagesAsyncIterators)) {
        this.enqueue(inboundMessage);
      }
    })().catch(err => {
      this.closeWithError(err);
    });

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
  messageSender: MessageSender | null = null;
  messageReceiver: MessageReceiver | null = null;

  // FIXME: maybe make an OrderedMessageList with these two fields in it?
  messageById: Map<BaseMessageId, SentMessage | ReceivedMessage> = new Map();
  messageIds: Array<BaseMessageId> = [];

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
    console.log('!! CONNECTED');
    this.agentParticipant = new AgentParticipant(this.room);
    this.agentParticipant.on(AgentParticipantEvent.AgentAttributesChanged, this.handleAgentAttributesChanged);
    this.updateAgentState();

    const chatMessageSender = new ChatMessageSender(this.localParticipant);
    this.messageSender = new CombinedMessageSender(
      chatMessageSender,
      // TODO: other types of messages that can be sent
    );

    this.messageReceiver = new CombinedMessageReceiver(
      new TranscriptionMessageReceiver(this.room),
      chatMessageSender.generateLoopbackMessageReceiver(),
      // TODO: images? attachments? rpc?
    );
    (async () => {
      // FIXME: is this sort of pattern a better idea than just making MessageReceiver an EventEmitter?
      for await (const message of this.messageReceiver!.messages()) {
        this.handleIncomingMessage(message);
      }
    })();

    this.startAgentConnectedTimeout();
  }

  private handleRoomDisconnected = () => {
    console.log('!! DISCONNECTED');
    this.agentParticipant?.off(AgentParticipantEvent.AgentAttributesChanged, this.handleAgentAttributesChanged);
    this.agentParticipant?.teardown();
    this.agentParticipant = null;
    this.updateAgentState();

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
    console.log('!! ATTRIB CHANGED:', this.agentParticipant?.attributes)
    this.updateAgentState();
  }

  private handleIncomingMessage = (incomingMessage: ReceivedMessage) => {
      // Upsert the message into the list
    this.messageById.set(incomingMessage.id, incomingMessage);
    if (!this.messageIds.includes(incomingMessage.id)) {
      this.messageIds.push(incomingMessage.id);
    }

    this.emit(AgentSessionEvent.MessagesChanged, this.messages);
  }

  private updateAgentState = () => {
    let newAgentState: AgentState | null = null;
    if (!this.agentParticipant) {
      // throw new Error('AgentSession.agentParticipant is unset');
      newAgentState = 'disconnected';
    } else {
      const agentParticipantAttributes = this.agentParticipant.attributes;
      const connectionState = this.room.state;

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
    }
    console.log('!! STATE:', newAgentState, this.agentParticipant?.attributes);

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

  get messages() {
    return (
      this.messageIds
        .map(id => this.messageById.get(id))
        // FIXME: can I get rid of the filter somehow?
        .filter((message): message is SentMessage | ReceivedMessage => typeof message !== 'undefined')
    );
  }

  // FIXME: maybe there should be a special case where if message is `string` it is converted into
  // a `SentChatMessage`?
  async sendMessage(message: SentMessage) {
    if (!this.messageSender) {
      throw new Error('AgentSession.sendMessage - cannot send message until room is connected and MessageSender initialized!');
    }
    await this.messageSender.send(message);
  }
}


// Proposal:
// Copy of LiveKitRoom, but for agents (LiveKitAgentSession?)
//   - This exposes a context like RoomContext
// Hooks that replicate a lot of useVoiceAssistant functionality which tap into agent context:
//   - useAgent gets raw AgentSession
//   - useAgentMessages?
//   - useAgentSend
