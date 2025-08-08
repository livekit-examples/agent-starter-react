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
} from "./message";
import AgentParticipant, { AgentParticipantEvent } from './AgentParticipant';
import OrderedMessageList from '@/agent-sdk/lib/ordered-message-list';


export enum AgentSessionEvent {
  AgentStateChanged = 'agentStateChanged',
  AgentAttributesChanged = 'agentAttributesChanged',
  MessagesChanged = 'messagesChanged',
  AgentConnectionFailure = 'AgentConnectionFailure',
}

export type AgentSessionCallbacks = {
  [AgentSessionEvent.AgentStateChanged]: (newAgentState: AgentState) => void;
  [AgentSessionEvent.MessagesChanged]: (newMessages: Array<SentMessage | ReceivedMessage>) => void;
  [AgentSessionEvent.AgentConnectionFailure]: (reason: string) => void;
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
  messageList: OrderedMessageList<SentMessage | ReceivedMessage> | null = null;

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
      // FIXME: this probably doesn't handle errors properly right now
      for await (const message of this.messageReceiver!.messages()) {
        this.handleIncomingMessage(message);
      }
    })();

    this.messageList = new OrderedMessageList();

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

    this.messageList = null;

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
    if (!this.messageList) {
      throw new Error('AgentSession.messageList is unset');
    }
    this.messageList.upsert(incomingMessage);

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
    return this.messageList?.toArray() ?? [];
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
