'use client';

import { useRef, useState } from 'react';
import { Loader, SendHorizontal } from 'lucide-react';
import { useChat } from '@livekit/components-react';
import { AgentControlBar, type AgentControlBarControls } from '@/components/agents-ui/agent-control-bar';
import { VoiceCharacterButton } from '@/components/agents-ui/voice-character-button';
import { Button } from '@/components/ui/button';

interface BottomControlsProps {
  isConnected?: boolean;
  controls?: AgentControlBarControls;
  onDisconnect?: () => void;
}

export function BottomControls({
  isConnected = false,
  controls,
  onDisconnect,
}: BottomControlsProps) {
  const { send } = useChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isDisabled = isSending || message.trim().length === 0;

  const handleSend = async () => {
    if (isDisabled) return;
    try {
      setIsSending(true);
      await send(message.trim());
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
    setMessage(target.value);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 语音角色按钮 - 靠右上方 */}
      <div className="flex justify-end">
        <VoiceCharacterButton />
      </div>

      {/* 输入框 - 自动增高，有上限 */}
      <div className="relative mx-auto w-full max-w-2xl">
        <textarea
          ref={inputRef}
          value={message}
          disabled={!isConnected || isSending}
          placeholder="输入文字..."
          onKeyDown={handleKeyDown}
          onChange={handleInput}
          rows={1}
          className="field-sizing-content w-full resize-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] max-h-[160px] overflow-y-auto"
        />
        <Button
          size="icon"
          type="button"
          disabled={isDisabled}
          variant={isDisabled ? 'secondary' : 'default'}
          onClick={handleSend}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8"
        >
          {isSending ? <Loader className="animate-spin" /> : <SendHorizontal size={16} />}
        </Button>
      </div>

      {/* AgentControlBar - 只有按钮 */}
      <div className="mx-auto w-full max-w-2xl">
        <AgentControlBar
          variant="livekit"
          controls={controls}
          isConnected={isConnected}
          onDisconnect={onDisconnect}
        />
      </div>
    </div>
  );
}
