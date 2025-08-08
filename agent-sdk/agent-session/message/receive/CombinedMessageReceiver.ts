import { parallelMerge } from "streaming-iterables";
import MessageReceiver from "./MessageReceiver";

/**
  * A `MessageReceiver` that zips together multiple underlying `MessageReceiver`s into one unified source.
  */
export default class CombinedMessageReceiver extends MessageReceiver {
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
