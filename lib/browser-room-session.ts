import { isValidConnectionRoomId } from './connection-room-id';

const VOICE_SESSION_ID_STORAGE_KEY = 'lexvoice.session_id.v1';

let fallbackSessionId: string | null = null;

export function getVoiceSessionId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined = getSessionStorage(),
  createSessionId: () => string = () => crypto.randomUUID()
) {
  if (storage) {
    try {
      const storedSessionId = storage.getItem(VOICE_SESSION_ID_STORAGE_KEY);
      if (isValidConnectionRoomId(storedSessionId)) {
        fallbackSessionId = storedSessionId.trim();
        return fallbackSessionId;
      }

      const sessionId = createSessionId();
      storage.setItem(VOICE_SESSION_ID_STORAGE_KEY, sessionId);
      fallbackSessionId = sessionId;
      return sessionId;
    } catch {
      // Fall through to in-memory storage when sessionStorage is blocked.
    }
  }

  if (isValidConnectionRoomId(fallbackSessionId)) {
    return fallbackSessionId;
  }

  fallbackSessionId = createSessionId();
  return fallbackSessionId;
}

export function resetVoiceSessionId(
  storage: Pick<Storage, 'removeItem'> | null | undefined = getSessionStorage()
) {
  fallbackSessionId = null;
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(VOICE_SESSION_ID_STORAGE_KEY);
  } catch {
    // Ignore blocked sessionStorage and rely on the in-memory fallback reset.
  }
}

export const getBrowserRoomSessionId = getVoiceSessionId;
export const resetBrowserRoomSessionId = resetVoiceSessionId;

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}
