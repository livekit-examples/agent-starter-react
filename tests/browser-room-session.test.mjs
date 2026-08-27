import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

async function loadBrowserRoomSessionModule() {
  const browserRoomSessionSource = await readFile(
    new URL('../lib/browser-room-session.ts', import.meta.url),
    'utf8'
  );
  const connectionRoomIdSource = await readFile(
    new URL('../lib/connection-room-id.ts', import.meta.url),
    'utf8'
  );
  const source = browserRoomSessionSource.replace(
    "import { isValidConnectionRoomId } from './connection-room-id';",
    connectionRoomIdSource
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}#${randomUUID()}`
  );
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

async function withCryptoProvider(provider, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: provider,
  });
  try {
    return await callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    } else {
      delete globalThis.crypto;
    }
  }
}

test('creates an RFC 4122 v4 browser room id when native randomUUID is unavailable', async () => {
  const { createBrowserRandomUuid, isValidConnectionRoomId } = await loadBrowserRoomSessionModule();

  const sessionId = await withCryptoProvider(
    {
      getRandomValues(bytes) {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    },
    () => createBrowserRandomUuid()
  );

  assert.equal(sessionId, '00010203-0405-4607-8809-0a0b0c0d0e0f');
  assert.equal(sessionId[14], '4');
  assert.match(sessionId[19], /[89ab]/);
  assert.equal(isValidConnectionRoomId(sessionId), true);
});

test('prefers native randomUUID for a new browser room id', async () => {
  const { createBrowserRandomUuid } = await loadBrowserRoomSessionModule();
  const nativeSessionId = '33333333-4444-4555-8666-777777777777';

  const sessionId = await withCryptoProvider(
    {
      randomUUID() {
        return nativeSessionId;
      },
      getRandomValues() {
        assert.fail('getRandomValues must not run when native randomUUID is callable');
      },
    },
    () => createBrowserRandomUuid()
  );

  assert.equal(sessionId, nativeSessionId);
});

test('reuses a valid stored browser room id without creating another', async () => {
  const { getBrowserRoomSessionId } = await loadBrowserRoomSessionModule();
  const storage = createMemoryStorage();
  const storedSessionId = '44444444-5555-4666-8777-888888888888';
  storage.setItem('lexvoice.session_id.v1', storedSessionId);

  const sessionId = getBrowserRoomSessionId(storage, () => {
    assert.fail('stored session id should be reused');
  });

  assert.equal(sessionId, storedSessionId);
});

test('resetting browser room session rotates the next room id', async () => {
  const { getBrowserRoomSessionId, resetBrowserRoomSessionId } =
    await loadBrowserRoomSessionModule();
  const storage = createMemoryStorage();
  const ids = ['11111111-2222-4333-8444-555555555555', '22222222-3333-4444-8555-666666666666'];

  const first = getBrowserRoomSessionId(storage, () => ids.shift());
  resetBrowserRoomSessionId(storage);
  const second = getBrowserRoomSessionId(storage, () => ids.shift());

  assert.equal(first, '11111111-2222-4333-8444-555555555555');
  assert.equal(second, '22222222-3333-4444-8555-666666666666');
});

test('ending a voice session clears the reusable session id', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');

  assert.match(useRoomSource, /resetVoiceSessionId/);
  assert.doesNotMatch(useRoomSource, /if \(appConfig\.usesBrowserRawMediaInput\)/);
});

test('sandbox browser starts media and dispatch concurrently without changing local order', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');
  const browserSourceSource = await readFile(
    new URL('../hooks/useBrowserSourceClient.ts', import.meta.url),
    'utf8'
  );

  assert.match(
    useRoomSource,
    /await room\.connect[\s\S]*connectedRoomName = room\.name;[\s\S]*await Promise\.allSettled\(\[[\s\S]*startLocalInputOrCancelDispatch\(\),[\s\S]*dispatchAgentSession\(\),[\s\S]*\]\)/
  );
  assert.match(
    useRoomSource,
    /usesSandboxConcurrentStartup = Boolean\(appConfig\.sandboxId\) && usesManagedRoomInput/
  );
  assert.match(
    useRoomSource,
    /const startLocalInputOrCancelDispatch = async \(\) => \{[\s\S]*await startLocalInput\(\);[\s\S]*catch \(error\) \{[\s\S]*cancelAgentSessionStart\(sessionId\);[\s\S]*throw error;/
  );
  assert.match(useRoomSource, /localInputResult\.status === 'rejected'/);
  assert.match(useRoomSource, /dispatchResult\.status === 'rejected'/);
  assert.match(
    useRoomSource,
    /localInputResult\.status === 'rejected'[\s\S]*dispatchResult\.status === 'rejected'[\s\S]*console\.warn/
  );
  assert.match(
    browserSourceSource,
    /else \{[\s\S]*await stage\(\(\) => ensureAudioPublished\(runtime\)\);[\s\S]*if \(videoEnabledRef\.current && !videoStartAttempted\)[\s\S]*await stage\(\(\) => ensureVideoPublished\(runtime\)\)/
  );
  assert.match(
    browserSourceSource,
    /appConfig\.sandboxId && videoEnabledRef\.current[\s\S]*Promise\.allSettled\(\[[\s\S]*ensureAudioPublished\(runtime\),[\s\S]*ensureVideoPublished\(runtime\)[\s\S]*\]\)/
  );
});
