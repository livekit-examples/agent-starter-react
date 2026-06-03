'use client';

import { createContext, use, useState, useCallback } from 'react';

const DEFAULT_VOICES = ['Maia', 'Cherry', 'Emma', 'Alfred'];
const VOICE_STORAGE_KEY = 'selected-voice';

interface VoiceContextValue {
  voices: string[];
  currentVoice: string;
  setCurrentVoice: (voice: string) => void;
  sendVoiceToRoom: (room: unknown) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue>({
  voices: DEFAULT_VOICES,
  currentVoice: 'Maia',
  setCurrentVoice: () => {},
  sendVoiceToRoom: async () => {},
});

function getInitialVoice(): string {
  if (typeof window === 'undefined') return 'Maia';
  return localStorage.getItem(VOICE_STORAGE_KEY) || 'Maia';
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [currentVoice, setCurrentVoiceState] = useState(getInitialVoice);

  const setCurrentVoice = useCallback((voice: string) => {
    setCurrentVoiceState(voice);
    localStorage.setItem(VOICE_STORAGE_KEY, voice);
  }, []);

  const sendVoiceToRoom = useCallback(async (room: unknown) => {
    if (!room) return;
    const r = room as { localParticipant: { publishData: (data: Uint8Array, opts?: object) => Promise<void> } };
    const payload = JSON.stringify({ type: 'voice_change', voice: currentVoice });
    await r.localParticipant.publishData(
      new TextEncoder().encode(payload),
      { reliable: true }
    );
  }, [currentVoice]);

  return (
    <VoiceContext.Provider value={{ voices: DEFAULT_VOICES, currentVoice, setCurrentVoice, sendVoiceToRoom }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  return use(VoiceContext);
}
