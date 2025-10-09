import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/livekit/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  chatOpen: boolean;
  disabled?: boolean;
  onSend?: (message: string) => void;
}

export function ChatInput({ chatOpen, disabled = false, onSend = () => {} }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSend(message);
    setMessage('');
  };

  const isDisabled = disabled || message.trim().length === 0;

  useEffect(() => {
    if (disabled) return;
    // when not disabled refocus on input
    inputRef.current?.focus();
  }, [disabled]);

  return (
    <div
      inert={!chatOpen}
      className={cn(
        'overflow-hidden transition-[height] duration-300 ease-out',
        chatOpen ? 'h-[57px]' : 'h-0'
      )}
    >
      <div className="flex h-8 w-full">
        <form
          onSubmit={handleSubmit}
          className="flex grow items-center gap-2 rounded-md pl-1 text-sm"
        >
          <input
            autoFocus
            ref={inputRef}
            type="text"
            value={message}
            disabled={disabled}
            placeholder="Type something..."
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            size="sm"
            type="submit"
            disabled={isDisabled}
            variant={isDisabled ? 'secondary' : 'primary'}
            className="font-mono uppercase"
          >
            Send
          </Button>
        </form>
      </div>
      <hr className="border-input/50 my-3" />
    </div>
  );
}
