import { LocalParticipant } from "livekit-client";

import { type ReceivedChatLoopbackMessage, type SentChatMessage, type SentMessage } from "..";
import MessageSender from "./MessageSender";
import MessageReceiver from "../receive/MessageReceiver";


/** A `MessageSender` for sending chat messages via the `lk.chat` datastream topic. */
export default class ChatMessageSender extends MessageSender<SentChatMessage> {
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

    // FIXME: do I need to handle sending legacy chat messages too?
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
