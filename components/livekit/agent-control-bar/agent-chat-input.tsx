import { useEffect, useRef, useState } from 'react';
import { PaperPlaneRightIcon, SpinnerIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';

interface AgentChatInputProps {
  chatOpen: boolean;
  isAgentAvailable?: boolean;
  onSend?: (message: string) => void;
}

export function AgentChatInput({
  chatOpen,
  isAgentAvailable = false,
  onSend = async () => {},
}: AgentChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsSending(true);
      await onSend(message);
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = isSending || !isAgentAvailable || message.trim().length === 0;

  useEffect(() => {
    if (chatOpen && isAgentAvailable) return;
    // when not disabled refocus on input
    inputRef.current?.focus();
  }, [chatOpen, isAgentAvailable]);

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 flex grow items-end gap-2 rounded-md pl-1 text-sm"
    >
      <textarea
        autoFocus
        ref={inputRef}
        value={message}
        disabled={!chatOpen}
        placeholder="Type something..."
        onChange={(e) => setMessage(e.target.value)}
        className="field-sizing-content max-h-16 min-h-8 flex-1 py-2 [scrollbar-width:thin] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Button
        size="icon"
        type="submit"
        disabled={isDisabled}
        variant={isDisabled ? 'secondary' : 'default'}
        title={isSending ? 'Sending...' : 'Send'}
        className="self-end rounded-full disabled:cursor-not-allowed"
      >
        {isSending ? (
          <SpinnerIcon className="animate-spin" weight="bold" />
        ) : (
          <PaperPlaneRightIcon weight="bold" />
        )}
      </Button>
    </form>
  );
}
