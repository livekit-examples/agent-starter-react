'use client';

import { useState } from 'react';
import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { useRoomContext } from '@livekit/components-react';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/shadcn/utils';
import { useVoiceContext } from './voice-context';

interface VoiceCharacterButtonProps {
  className?: string;
}

export function VoiceCharacterButton({
  className,
}: VoiceCharacterButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { voices, currentVoice, setCurrentVoice } = useVoiceContext();
  const room = useRoomContext();

  const handleVoiceSelect = async (voiceId: string) => {
    setCurrentVoice(voiceId);
    setMenuOpen(false);
    if (room) {
      const payload = JSON.stringify({ type: 'voice_change', voice: voiceId });
      await room.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Toggle
        variant="outline"
        size="default"
        pressed={menuOpen}
        onPressedChange={() => setMenuOpen(!menuOpen)}
        className={cn(
          'size-9 rounded-full bg-accent/50 hover:bg-accent',
          menuOpen && 'ring-2 ring-ring'
        )}
        aria-label="选择角色音色"
      >
        <UserCircle size={18} weight="duotone" />
      </Toggle>

      {menuOpen && (
        <div className="absolute right-0 bottom-full mb-2 z-50 flex flex-col gap-1 rounded-md border bg-background p-1 shadow-md min-w-[120px]">
          {voices.map((voice) => (
            <button
              key={voice}
              onClick={() => handleVoiceSelect(voice)}
              className={cn(
                'rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left',
                currentVoice === voice && 'bg-accent/50 font-medium'
              )}
            >
              {voice}
            </button>
          ))}
        </div>
      )}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}
    </div>
  );
}
