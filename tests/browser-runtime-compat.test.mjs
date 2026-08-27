import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as browserCompat from '../lib/browser-runtime-compat.ts';

test('installs an RFC 4122 v4 randomUUID when the browser crypto API omits it', () => {
  const cryptoProvider = {
    getRandomValues(bytes) {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    },
  };

  const result = browserCompat.ensureBrowserRandomUuid(cryptoProvider);

  assert.deepEqual(result, { ok: true, installed: true });
  assert.equal(cryptoProvider.randomUUID(), '00010203-0405-4607-8809-0a0b0c0d0e0f');
  assert.equal(cryptoProvider.randomUUID()[14], '4');
  assert.match(cryptoProvider.randomUUID()[19], /[89ab]/);
});

test('preserves the native randomUUID implementation', () => {
  const nativeRandomUuid = () => '33333333-4444-4555-8666-777777777777';
  const cryptoProvider = {
    randomUUID: nativeRandomUuid,
    getRandomValues() {
      assert.fail('getRandomValues must not run when native randomUUID exists');
    },
  };

  const result = browserCompat.ensureBrowserRandomUuid(cryptoProvider);

  assert.deepEqual(result, { ok: true, installed: false });
  assert.equal(cryptoProvider.randomUUID, nativeRandomUuid);
});

test('fails safely when the browser crypto object rejects the polyfill', () => {
  const cryptoProvider = Object.preventExtensions({
    getRandomValues(bytes) {
      return bytes;
    },
  });

  const result = browserCompat.ensureBrowserRandomUuid(cryptoProvider);

  assert.equal(result.ok, false);
  assert.match(result.message, /randomUUID/i);
  assert.equal('randomUUID' in cryptoProvider, false);
});

test('SessionProvider exposes an explicit compatibility error before creating a Room', async () => {
  const source = await readFile('components/app/session-provider.tsx', 'utf8');

  assert.match(source, /ensureBrowserRandomUuid\(/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Browser compatibility error/);
});

test('AgentControlBar retains the high-level useChat send path', async () => {
  const source = await readFile(
    'components/livekit/agent-control-bar/agent-control-bar.tsx',
    'utf8'
  );

  assert.match(source, /await send\(message\)/);
  assert.doesNotMatch(source, /streamText|sendBrowserChatMessage/);
});
