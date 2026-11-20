'use client';

import { type ComponentProps, useEffect, useState } from 'react';
import { BotIcon, PhoneOffIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';
import type { AgentPopupError } from './agent-popup-block';

export interface TriggerProps extends ComponentProps<'button'> {
  /** Logo image shown in place of the default bot icon. */
  logo?: string;
  /** Brand color used for the idle ring/disc and, via contrast, the fallback icon color. */
  color?: string;
  /** Used to build the default `aria-label` (e.g. "Rex agent") and image `alt` text. */
  agentName?: string;
  /** Whether the popup is currently open. Drives the connecting/active/error visual states. */
  isPressed?: boolean;
  /** Whether the agent session is connected. Only relevant while `isPressed` is true. */
  isConnected?: boolean;
  /** Session error, if any. Only relevant while `isPressed` is true. */
  error?: AgentPopupError;
  /** Called when the trigger is clicked. */
  onToggle: () => void;
}

export function Trigger({
  logo,
  color,
  error,
  agentName,
  isPressed = false,
  isConnected = false,
  onToggle,
  className,
  ...props
}: TriggerProps) {
  const altText = agentName ? `${agentName} agent` : 'Open assistant';
  const isError = isPressed && error !== undefined;
  const isActive = isPressed && error === undefined && isConnected;
  const isConnecting = isPressed && !isError && !isActive;
  const isDestructive = isError || isActive;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logo]);
  const showLogo = Boolean(logo) && !logoFailed;

  return (
    <Button
      type="button"
      size="lg"
      variant="ghost"
      onClick={onToggle}
      aria-label={isPressed ? 'Close assistant' : altText}
      aria-expanded={isPressed}
      className={cn(
        'relative m-0 block size-12 rounded-full p-0.5 drop-shadow-sm transition-transform duration-200 hover:scale-105 focus-visible:scale-105',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-current transition-colors',
          isConnecting && 'animate-spin',
          isConnecting &&
            'bg-current/30 bg-conic from-transparent from-30% via-current via-50% to-transparent to-70%',
          isDestructive && 'bg-transparent'
        )}
        style={{ color }}
      />
      <div
        className={cn(
          'absolute inset-0 z-10 grid place-items-center rounded-full transition-colors',
          isConnecting && 'bg-background text-background inset-0.5',
          isDestructive && 'bg-destructive text-white'
        )}
      >
        {isConnecting ? null : isError ? (
          // The spinning ring is the connecting signal; skip a centred glyph
          // so it reads as a clean spinner rather than a flashing X.
          <XIcon className="size-5" aria-hidden="true" />
        ) : isActive ? (
          // Crossed-out phone on the solid destructive disc signals
          // "click to end the call".
          <PhoneOffIcon className="size-5" aria-hidden="true" />
        ) : showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={altText}
            className="size-6 rounded-sm object-contain"
            referrerPolicy="no-referrer"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          // Pick black vs white based on the user-set brand color so the
          // icon stays readable across a bright yellow, deep navy, etc.
          <BotIcon
            className="text-background size-6"
            aria-hidden="true"
            style={
              color
                ? {
                    color: `contrast-color(${color})`,
                  }
                : undefined
            }
          />
        )}
      </div>
    </Button>
  );
}
