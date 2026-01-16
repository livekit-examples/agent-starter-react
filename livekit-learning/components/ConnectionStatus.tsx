'use client';

import { ConnectionState } from 'livekit-client';

/**
 * CONNECTION STATUS COMPONENT
 *
 * Displays the current connection state of the LiveKit room.
 *
 * LiveKit connection states:
 * - Disconnected: Not connected to any room
 * - Connecting: In the process of connecting (WebSocket handshake, etc.)
 * - Connected: Successfully connected and ready to communicate
 * - Reconnecting: Connection lost, attempting to reconnect
 */

interface ConnectionStatusProps {
  state: ConnectionState;
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  // Map connection state to display info
  const stateInfo: Record<ConnectionState, { label: string; className: string }> = {
    [ConnectionState.Disconnected]: {
      label: 'Disconnected',
      className: 'status-badge status-disconnected',
    },
    [ConnectionState.Connecting]: {
      label: 'Connecting...',
      className: 'status-badge status-connecting',
    },
    [ConnectionState.Connected]: {
      label: 'Connected',
      className: 'status-badge status-connected',
    },
    [ConnectionState.Reconnecting]: {
      label: 'Reconnecting...',
      className: 'status-badge status-connecting',
    },
  };

  const info = stateInfo[state];

  return (
    <div className={info.className}>
      {/* Visual indicator dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background:
            state === ConnectionState.Connected
              ? '#22c55e'
              : state === ConnectionState.Disconnected
                ? '#9ca3af'
                : '#f59e0b',
        }}
      />
      {info.label}
    </div>
  );
}
