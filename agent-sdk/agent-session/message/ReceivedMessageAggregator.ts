import { EventEmitter } from "events";
import TypedEventEmitter from "typed-emitter";
import { ReceivedMessage } from ".";

export type ReceivedMessageAggregatorOptions = {
  /**
    * Number of messages to buffer internally before old messages are discarded. If not set, the
    * buffer size is unlimited.
    */
  bufferSize?: number;

  // FIXME: other options?
};

export enum ReceivedMessageAggregatorEvent {
  Updated = 'updated',
  Close = 'close',
}

type ReceivedMessageAggregatorCallbacks = {
  [ReceivedMessageAggregatorEvent.Updated]: () => void;
  [ReceivedMessageAggregatorEvent.Close]: () => void;
};

/** A container for storing an ordered list of messages that can be easily changed */
export default class ReceivedMessageAggregator<Message extends ReceivedMessage> extends (EventEmitter as new () => TypedEventEmitter<ReceivedMessageAggregatorCallbacks>) {
  private messageById: Map<Message['id'], Message> = new Map();
  private messageIds: Array<Message['id']> = [];

  private options: ReceivedMessageAggregatorOptions;
  private closed: boolean = false;

  constructor(options?: ReceivedMessageAggregatorOptions) {
    super();
    this.options = options ?? {};
  }

  /** Create a new aggregator pre-populated with the included messages */
  static fromIterator<Message extends ReceivedMessage>(input: Iterable<Message>, options?: ReceivedMessageAggregatorOptions) {
    const aggregator = new this(options);
    aggregator.extend(input);
    return aggregator;
  }

  upsert(message: Message) {
    this.internalBulkUpsert([message]);
    this.emit(ReceivedMessageAggregatorEvent.Updated);
  }

  delete(message: Message) {
    this.internalBulkDelete([message.id]);
    this.emit(ReceivedMessageAggregatorEvent.Updated);
  }

  extend(input: Iterable<Message>) {
    this.internalBulkUpsert(input);
    this.emit(ReceivedMessageAggregatorEvent.Updated);
  }

  clear() {
    this.messageById.clear();
    this.messageIds = [];
  }

  private internalBulkUpsert(messages: Iterable<Message>) {
    if (this.closed) {
      throw new Error('ReceivedMessageAggregator is closed and is now immutable, no more messages can be ingested!');
    }

    // FIXME: think through this scenario:
    // 1. Message a is upserted
    // 2. `options.bufferSize` messages are upserted, evicting message a
    // 3. Another message a upsert happens, should this somehow get rejected (via bloom filter / etc?)
    // or just end up in the list again as a seemingly brand new message?
    for (const message of messages) {
      this.messageById.set(message.id, message);
      if (!this.messageIds.includes(message.id)) {
        this.messageIds.push(message.id);
      }

      // Truncate message buffer if it is now too large
      const numberOfMessagesToRemove = typeof this.options.bufferSize === 'number' ? (
        this.messageIds.length - this.options.bufferSize
      ) : 0;
      if (numberOfMessagesToRemove > 0) {
        const idsToDelete = this.messageIds.slice(0, numberOfMessagesToRemove);
        this.internalBulkDelete(idsToDelete);
      }
    }
  }
  private internalBulkDelete(messageIdsToDelete: Array<Message['id']>) {
    if (this.closed) {
      throw new Error('ReceivedMessageAggregator is closed and is now immutable, no more messages can be deleted!');
    }

    for (const id of messageIdsToDelete) {
      this.messageById.delete(id);
    }
    this.messageIds = this.messageIds.filter(id => !messageIdsToDelete.includes(id));
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

  close() {
    this.closed = true;
    this.emit(ReceivedMessageAggregatorEvent.Close);
  }
}
