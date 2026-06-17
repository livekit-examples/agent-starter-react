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
