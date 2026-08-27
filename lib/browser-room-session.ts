import { isValidConnectionRoomId } from './connection-room-id';

const VOICE_SESSION_ID_STORAGE_KEY = 'lexvoice.session_id.v1';

let fallbackSessionId: string | null = null;

export function getVoiceSessionId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined = getSessionStorage(),
  createSessionId: () => string = createBrowserRandomUuid
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

export function createBrowserRandomUuid(
  cryptoProvider: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto
) {
  if (typeof cryptoProvider.randomUUID === 'function') {
    return cryptoProvider.randomUUID();
  }

  return createBrowserRandomUuidFromRandomValues(cryptoProvider);
}

export function createBrowserRandomUuidFromRandomValues(
  cryptoProvider: Pick<Crypto, 'getRandomValues'>
) {
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}
