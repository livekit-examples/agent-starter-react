import { createBrowserRandomUuidFromRandomValues } from './browser-room-session';

type BrowserCryptoProvider = Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>>;

export type BrowserRandomUuidStatus =
  | { ok: true; installed: boolean }
  | { ok: false; message: string };

export function ensureBrowserRandomUuid(
  cryptoProvider: BrowserCryptoProvider | undefined = globalThis.crypto
): BrowserRandomUuidStatus {
  if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
    return {
      ok: false,
      message: 'This browser does not provide the secure random values required by randomUUID.',
    };
  }

  if (typeof cryptoProvider.randomUUID === 'function') {
    return { ok: true, installed: false };
  }

  try {
    Object.defineProperty(cryptoProvider, 'randomUUID', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: () => createBrowserRandomUuidFromRandomValues(cryptoProvider),
    });
  } catch {
    return {
      ok: false,
      message: 'This browser could not install the required randomUUID compatibility support.',
    };
  }

  if (typeof cryptoProvider.randomUUID !== 'function') {
    return {
      ok: false,
      message: 'This browser could not install the required randomUUID compatibility support.',
    };
  }

  return { ok: true, installed: true };
}
