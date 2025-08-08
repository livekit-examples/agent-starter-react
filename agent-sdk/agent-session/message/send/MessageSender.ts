import { type SentMessage } from "..";

export default abstract class MessageSender<Message extends SentMessage = SentMessage> {
  /** Can this MessageSender handle sending the given message? */
  abstract canSend(message: SentMessage): message is Message
  abstract send(message: Message): Promise<void>;
}
