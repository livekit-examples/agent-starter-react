'use client';

import { Mic, MicOff } from 'lucide-react';
import { useAgent, useLocalParticipant, useSessionContext } from '@livekit/components-react';
import { formatCallTime, useCallTimer } from '@/hooks/useCallTimer';
import { AGENT_AVATAR_LABEL, AGENT_STATE_LABELS } from '@/lib/agent-states';
import { cn } from '@/lib/shadcn/utils';

interface CallStatusProps {
  /** Name of the agent to display. Defaults to a neutral "Агент" label. */
  agentName?: string;
  className?: string;
}

/**
 * Compact in-call status pill: current agent state, elapsed call time and
 * microphone state. Purely informational (`pointer-events-none`).
 */
export function CallStatus({ agentName, className }: CallStatusProps) {
  const { state } = useAgent();
  const { isConnected } = useSessionContext();
  const { localParticipant } = useLocalParticipant();
  const elapsed = useCallTimer(isConnected);

  const micEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const label = state ? (AGENT_STATE_LABELS[state] ?? state) : '—';
  const isActive = state === 'listening' || state === 'speaking' || state === 'thinking';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Агент: ${label}`}
      className={cn(
        'bg-background/80 border-foreground/10 text-foreground backdrop-blur-md',
        'flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/50'
        )}
      />
      <span>{agentName ?? AGENT_AVATAR_LABEL}</span>
      <span className="text-muted-foreground tabular-nums">{label}</span>
      <span className="text-muted-foreground tabular-nums" aria-label="Время звонка">
        {formatCallTime(elapsed)}
      </span>
      <span
        className="text-muted-foreground"
        title={micEnabled ? 'Микрофон включён' : 'Микрофон выключен'}
        aria-hidden="true"
      >
        {micEnabled ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
      </span>
    </div>
  );
}
