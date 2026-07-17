'use client';

import { cn } from '@/lib/shadcn/utils';
import type { AvatarProvider, SpatiusSettings } from '@/lib/spatius/config';

interface SpatiusConfigFormProps {
  settings: SpatiusSettings;
  onChange: (settings: SpatiusSettings) => void;
  className?: string;
}

const PROVIDERS: { value: AvatarProvider; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'LiveKit video / voice' },
  { value: 'spatius', label: 'Spatius avatar', hint: 'WebGPU motion decode' },
];

/**
 * Pre-connect settings for choosing the avatar decoder. Selecting "Spatius
 * avatar" and entering an avatar id switches the app to the Spatius decode path.
 * Persistence is handled by the caller (localStorage via `saveSpatiusSettings`).
 */
export function SpatiusConfigForm({ settings, onChange, className }: SpatiusConfigFormProps) {
  const isSpatius = settings.provider === 'spatius';

  return (
    <div
      className={cn(
        'bg-card/60 text-card-foreground mx-auto w-full max-w-sm rounded-2xl border p-4 text-left',
        className
      )}
    >
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Avatar source
      </p>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Avatar source">
        {PROVIDERS.map((provider) => {
          const selected = settings.provider === provider.value;
          return (
            <button
              key={provider.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ ...settings, provider: provider.value })}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-input hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <span className="text-sm font-medium">{provider.label}</span>
              <span className="text-muted-foreground text-xs">{provider.hint}</span>
            </button>
          );
        })}
      </div>

      {isSpatius && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-xs font-medium">
              Spatius App ID
            </span>
            <input
              type="text"
              value={settings.appId}
              spellCheck={false}
              autoComplete="off"
              placeholder="app_..."
              onChange={(event) => onChange({ ...settings, appId: event.target.value })}
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-muted-foreground mb-1 block text-xs font-medium">
              Spatius Avatar ID
            </span>
            <input
              type="text"
              value={settings.avatarId}
              spellCheck={false}
              autoComplete="off"
              placeholder="00000000-0000-0000-0000-000000000000"
              onChange={(event) => onChange({ ...settings, avatarId: event.target.value })}
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Agent name</span>
            <input
              type="text"
              value={settings.agentName}
              spellCheck={false}
              autoComplete="off"
              placeholder="voice-assistant"
              onChange={(event) => onChange({ ...settings, agentName: event.target.value })}
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
            <span className="text-muted-foreground mt-1 block text-xs">
              Must match the worker&apos;s registered <code>agent_name</code>. Leave empty if the
              worker uses automatic dispatch.
            </span>
          </label>

          {settings.avatarId.trim().length === 0 && (
            <p className="text-muted-foreground text-xs">
              Enter an avatar id to enable the Spatius decoder.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
