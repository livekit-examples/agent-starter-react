import type TypedEventEmitter from 'typed-emitter';
import { EventEmitter } from "events";
import { Room, RoomEvent, ConnectionState } from 'livekit-client';

import {
  type ReceivedMessage,
  type SentMessage,
  MessageSender,
  MessageReceiver,
  ChatMessageSender,
  CombinedMessageSender,
  CombinedMessageReceiver,
  TranscriptionMessageReceiver,
  ReceivedMessageAggregator,
  type ReceivedMessageAggregatorOptions,
  ReceivedMessageAggregatorEvent,
} from "./message";
import AgentParticipant, { AgentParticipantEvent } from './AgentParticipant';


export enum AgentSessionEvent {
  AgentStateChanged = 'agentStateChanged',
  AgentAttributesChanged = 'agentAttributesChanged',
  MessagesChanged = 'messagesChanged',
  AgentConnectionFailure = 'agentConnectionFailure',
  AudioPlaybackStatusChanged = 'AudioPlaybackStatusChanged',
}

export type AgentSessionCallbacks = {
  [AgentSessionEvent.AgentStateChanged]: (newAgentState: AgentState) => void;
  [AgentSessionEvent.MessagesChanged]: (newMessages: Array<SentMessage | ReceivedMessage>) => void;
  [AgentSessionEvent.AgentConnectionFailure]: (reason: string) => void;
  [AgentSessionEvent.AudioPlaybackStatusChanged]: (audioPlaybackPermitted: boolean) => void;
};

const stateAttribute = 'lk.agent.state';

export type AgentState =
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'listening'
  | 'thinking'
  | 'speaking';

/**
  * AgentSession represents a connection to a LiveKit Agent, providing abstractions to make 1:1
  * agent/participant rooms easier to work with.
  */
export class AgentSession extends (EventEmitter as new () => TypedEventEmitter<AgentSessionCallbacks>) {
  room: Room; // FIXME: should this be private?
  state: AgentState = 'disconnected';

  agentParticipant: AgentParticipant | null = null;
  messageSender: MessageSender | null = null;
  messageReceiver: MessageReceiver | null = null;
  defaultAggregator: ReceivedMessageAggregator<ReceivedMessage> | null = null;
  aggregators: Array<ReceivedMessageAggregator<ReceivedMessage>> | null = null;

  constructor() {
    super();

    this.room = new Room();
    this.room.on(RoomEvent.Connected, this.handleRoomConnected);
    this.room.on(RoomEvent.Disconnected, this.handleRoomDisconnected);
    this.room.on(RoomEvent.ConnectionStateChanged, this.handleConnectionStateChanged);
    this.room.on(RoomEvent.AudioPlaybackStatusChanged, this.handleAudioPlaybackStatusChanged);
  }

  async connect(url: string, token: string) {
    // FIXME: catch connection errors here and reraise? idk
    await Promise.all([
      this.room.connect(url, token),
      // FIXME: make it so the preconenct buffer thing can be disabled?
      this.room.localParticipant.setMicrophoneEnabled(true, undefined, { preConnectBuffer: true }),
    ]);

    await this.waitUntilAgentIsAvailable();
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
      // FIXME: this probably doesn't handle errors properly right now
      for await (const message of this.messageReceiver!.messages()) {
        this.handleIncomingMessage(message);
      }
    })();

    this.defaultAggregator = new ReceivedMessageAggregator();
    this.aggregators = [];

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

    this.defaultAggregator?.close();
    this.defaultAggregator = null;
    for (const aggregator of this.aggregators ?? []) {
      aggregator.close();
    }
    this.aggregators = null;

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

  private handleAudioPlaybackStatusChanged = async () => {
    this.emit(AgentSessionEvent.AudioPlaybackStatusChanged, this.room.canPlaybackAudio);
  };

  private handleAgentAttributesChanged = () => {
    console.log('!! ATTRIB CHANGED:', this.agentParticipant?.attributes)
    this.updateAgentState();
  }

  private handleIncomingMessage = (incomingMessage: ReceivedMessage) => {
    if (!this.defaultAggregator) {
      throw new Error('AgentSession.defaultAggregator is unset');
    }
    if (!this.aggregators) {
      throw new Error('AgentSession.aggregators is unset');
    }

    this.defaultAggregator.upsert(incomingMessage);
    for (const aggregator of this.aggregators) {
      aggregator.upsert(incomingMessage);
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

  /** Returns a promise that resolves once the agent is available for interaction */
  private async waitUntilAgentIsAvailable(signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const stateChangedHandler = () => {
        if (!this.isAvailable) {
          return;
        }
        cleanup();
        resolve();
      };
      const abortHandler = () => {
        cleanup();
        reject(new Error('AgentSession.waitUntilAgentIsAvailable - signal aborted'));
      };

      const cleanup = () => {
        this.off(AgentSessionEvent.AgentStateChanged, stateChangedHandler);
        signal?.removeEventListener('abort', abortHandler);
      };

      this.on(AgentSessionEvent.AgentStateChanged, stateChangedHandler);
      signal?.addEventListener('abort', abortHandler);
    });
  }

  private async waitUntilRoomConnected(signal?: AbortSignal) {
    if (this.room.state === ConnectionState.Connected /* FIXME: should I check for other states too? */) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const onceRoomConnected = () => {
        cleanup();
        resolve();
      };
      const abortHandler = () => {
        cleanup();
        reject(new Error('AgentSession.waitUntilRoomConnected - signal aborted'));
      };

      const cleanup = () => {
        this.room.off(RoomEvent.Connected, onceRoomConnected);
        signal?.removeEventListener('abort', abortHandler);
      };

      this.room.on(RoomEvent.Connected, onceRoomConnected);
      signal?.addEventListener('abort', abortHandler);
    });
  }

  get localParticipant() {
    return this.room?.localParticipant ?? null;
  }

  get messages() {
    // return this.messageReceiver.messages();
    return this.defaultAggregator?.toArray() ?? [];
  }

  async createMessageAggregator(options: { startsAt?: 'beginning' | 'now' } & ReceivedMessageAggregatorOptions = {}) {
    await this.waitUntilRoomConnected();
    if (!this.aggregators) {
      throw new Error('AgentSession.aggregators is unset');
    }
    const aggregators = this.aggregators; // FIXME: this caching could lead to issues if this.aggregators changed reference?

    const { startsAt, ...aggregatorOptions } = {
      startsAt: 'beginning' as const,
      ...options,
    };

    let aggregator;
    switch (startsAt) {
      case 'now':
        aggregator = new ReceivedMessageAggregator(aggregatorOptions);
        break;

      case 'beginning':
        aggregator = ReceivedMessageAggregator.fromIterator(this.defaultAggregator ?? [], aggregatorOptions);
        break;
    }

    aggregators.push(aggregator);
    const closeHandler = () => {
      const aggregatorIndex = aggregators.indexOf(aggregator);
      if (aggregatorIndex < 0) {
        throw new Error(`Index of aggregator was non integer (found ${aggregatorIndex}), has this aggregator already been closed previously?`);
      }
      aggregators.splice(aggregatorIndex, 1);

      aggregator.off(ReceivedMessageAggregatorEvent.Close, closeHandler);
    };
    aggregator.on(ReceivedMessageAggregatorEvent.Close, closeHandler);

    return aggregator;
  }

  // FIXME: maybe there should be a special case where if message is `string` it is converted into
  // a `SentChatMessage`?
  async sendMessage(message: SentMessage) {
    if (!this.messageSender) {
      throw new Error('AgentSession.sendMessage - cannot send message until room is connected and MessageSender initialized!');
    }
    await this.messageSender.send(message);
  }
  // onMessage?: (callback: (reader: TextStreamReader) => void) => void | undefined;

  // TODO: RPC stuff
  // registerRpcHandler: (
  //   method: string,
  //   handler: (data: RpcInvocationData) => Promise<string>,
  // ) => void;
  // performRpc: (method: string, payload: string) => Promise<string>;

  // TODO: Client media controls
  // setCameraEnabled: (enabled: boolean) => Promise<LocalTrackPublication | undefined>;
  // setMicrophoneEnabled: (enabled: boolean) => Promise<LocalTrackPublication | undefined>;
  // setScreenShareEnabled: (enabled: boolean) => Promise<LocalTrackPublication | undefined>;
  // setCameraInput: (deviceId: string) => Promise<boolean>;
  // setMicrophoneInput: (deviceId: string) => Promise<boolean>;

  // Media Playback
  async startAudioPlayback() {
    await this.room.startAudio();

    // FIXME: add audio track to audio element / etc
    // This probably needs to contain much of the logic in RoomAudioRenderer?
    // And then make a similar type of component that then uses this function internally?
  }
}
