import { type SentMessage } from "..";
import MessageSender from "./MessageSender";

/**
  * A `MessageSender` that routes any `SentMessage` to the first underlying `MessageSender` which
  * can accept it.
  */
export default class CombinedMessageSender extends MessageSender {
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
