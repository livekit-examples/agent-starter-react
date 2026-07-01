type ChatMessageLike = {
  message?: string;
};

export function isRenderableChatMessage(message: ChatMessageLike): boolean {
  return typeof message.message === 'string' && message.message.trim().length > 0;
}
