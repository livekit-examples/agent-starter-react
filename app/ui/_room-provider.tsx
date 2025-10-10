'use client';

import React from 'react';
import { RoomContext } from '@livekit/components-react';
import { AppConfig } from '@/app-config';
import { useRoom } from '@/hooks/useRoom';

interface RoomProviderProps {
  appConfig: AppConfig;
  children: React.ReactNode;
}

export function RoomProvider({ appConfig, children }: RoomProviderProps) {
  const { room } = useRoom(appConfig);

  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}
