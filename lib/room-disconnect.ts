import { Room, RoomEvent } from 'livekit-client';

const ROOM_DISCONNECT_TIMEOUT_MS = 3_000;

export function waitForRoomDisconnected(room: Room): Promise<void> {
  if (room.state === 'disconnected') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const settle = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      room.off(RoomEvent.Disconnected, onDisconnected);
      resolve();
    };
    const onDisconnected = () => settle();

    room.on(RoomEvent.Disconnected, onDisconnected);
    const timeout = setTimeout(() => {
      console.warn('room disconnect timed out; continuing start flow', {
        state: room.state,
      });
      settle();
    }, ROOM_DISCONNECT_TIMEOUT_MS);
    room.disconnect();

    if (room.state === 'disconnected') {
      settle();
    }
  });
}
