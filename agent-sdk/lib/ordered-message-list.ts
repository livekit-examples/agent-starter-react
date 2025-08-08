import { BaseMessage } from "../agent-session/message";

/** A container for storing an ordered list of messages that can be easily changed */
export default class OrderedMessageList<Message extends BaseMessage<'inbound' | 'outbound', unknown>> {
  private messageById: Map<Message['id'], Message> = new Map();
  private messageIds: Array<Message['id']> = [];

  constructor(input?: Array<Message>) {
    if (input) {
      this.messageById = new Map(input.map(message => [message.id, message]));
      this.messageIds = input.map(message => message.id);
    }
  }

  upsert(message: Message) {
    this.messageById.set(message.id, message);
    if (!this.messageIds.includes(message.id)) {
      this.messageIds.push(message.id);
    }
  }

  *[Symbol.iterator]() {
    for (const id of this.messageIds) {
      const message = this.messageById.get(id);
      if (!message) {
        continue;
      }
      yield message;
    }
  }

  toArray() {
    return Array.from(this);
  }
}
