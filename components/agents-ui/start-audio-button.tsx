import { useEnsureRoom, useStartAudio } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { Room } from 'livekit-client';

export interface StartAudioButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  room?: Room;
  label: string;
}

export function StartAudioButton({ label, room, ...props }: StartAudioButtonProps) {
  const roomEnsured = useEnsureRoom(room);
  const { mergedProps } = useStartAudio({ room: roomEnsured, props });

  return <Button {...mergedProps}>{label}</Button>;
}
