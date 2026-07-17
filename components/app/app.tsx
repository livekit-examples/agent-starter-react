'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AppConfig } from '@/app-config';
import { SpatiusConfigForm } from '@/components/app/spatius-config-form';
import { StandardApp } from '@/components/app/standard-app';
import { SpatiusAvatarContext } from '@/components/spatius-avatar/spatius-avatar-context';
import { type SpatiusSupport, detectSpatiusSupport } from '@/lib/spatius/capabilities';
import {
  type SpatiusSettings,
  defaultSpatiusSettings,
  isSpatiusEnabled,
  loadSpatiusSettings,
  saveSpatiusSettings,
} from '@/lib/spatius/config';

// Lazily loaded, client-only: keeps the Spatius WASM decoder (and its global
// `RTCPeerConnection` patch) out of the bundle unless the avatar path is active.
const SpatiusApp = dynamic(() => import('@/components/app/spatius-app').then((m) => m.SpatiusApp), {
  ssr: false,
});

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [settings, setSettings] = useState<SpatiusSettings>(() =>
    defaultSpatiusSettings(appConfig)
  );
  const [support, setSupport] = useState<SpatiusSupport | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Resolve per-browser settings + browser capabilities on the client only. The
  // first render matches SSR (defaults + standard app) to avoid a hydration
  // mismatch, then we reconcile here.
  useEffect(() => {
    setSettings(loadSpatiusSettings(defaultSpatiusSettings(appConfig)));
    setSupport(detectSpatiusSupport());
    setHydrated(true);
  }, [appConfig]);

  const handleSettingsChange = useCallback((next: SpatiusSettings) => {
    setSettings(next);
    saveSpatiusSettings(next);
  }, []);

  const welcomeSlot = useMemo(
    () => <SpatiusConfigForm settings={settings} onChange={handleSettingsChange} />,
    [settings, handleSettingsChange]
  );

  // Standard path (default, SSR-safe, and until the client reconciles).
  if (!hydrated || !isSpatiusEnabled(settings)) {
    return <StandardApp appConfig={appConfig} welcomeSlot={welcomeSlot} />;
  }

  // Spatius selected but the browser can't render it: keep the standard
  // connection but force the audio-only tile with an explanatory notice.
  if (support && !support.supported) {
    return (
      <SpatiusAvatarContext.Provider
        value={{
          renderMode: 'audio-only',
          notice: support.reason ?? 'Avatar rendering is not supported in this browser.',
        }}
      >
        <StandardApp appConfig={appConfig} welcomeSlot={welcomeSlot} />
      </SpatiusAvatarContext.Provider>
    );
  }

  return <SpatiusApp appConfig={appConfig} settings={settings} welcomeSlot={welcomeSlot} />;
}
