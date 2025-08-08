import Future from "@/agent-sdk/lib/future";
import { type ReceivedMessage } from "..";

/** Thrown to signal that a MessageReceiver.messages() generator invocation was terminated out of band */
export class MessageReceiverTerminationError extends Error {}

/**
  * A MessageReceiver acts as a source for all messages in the system.
  */
export default abstract class MessageReceiver<Message extends ReceivedMessage = ReceivedMessage> {
  private signallingFuture = new Future<null>();
  private queue: Array<Message> = [];

  // This returns a cleanup function like useEffect maybe? That could be a good pattern?
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

  /** Terminate the messages() iteration from an external source */
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
