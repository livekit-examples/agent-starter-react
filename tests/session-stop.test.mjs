import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

async function loadSessionStopModule() {
  const source = await readFile(new URL('../lib/session-stop.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { resolveLiveKitHttpUrl } = await loadSessionStopModule();

test('maps livekit websocket URLs to server API URLs', () => {
  assert.equal(resolveLiveKitHttpUrl('ws://localhost:7818'), 'http://localhost:7818');
  assert.equal(resolveLiveKitHttpUrl('wss://livekit.example'), 'https://livekit.example');
  assert.equal(resolveLiveKitHttpUrl('https://livekit.example'), 'https://livekit.example');
});

test('session stop route does not call the room-input control endpoint', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(routeSource, /process\.env\.ROOM_INPUT_URL/);
  assert.doesNotMatch(routeSource, /resolveRoomInputStopUrl/);
  assert.doesNotMatch(routeSource, /stopRoomInput/);
  assert.doesNotMatch(routeSource, /GENERIC_CAMERA_PARTICIPANT_URL/);
});

test('session stop route cancels room session before remote cleanup', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /markRoomSessionStopping/);
  assert.match(routeSource, /cancelPendingDispatches/);
  assert.match(routeSource, /markRoomSessionStopped/);
  assert.match(routeSource, /sessionId/);
  assert.match(routeSource, /deriveLiveKitRoomName/);
  assert.match(routeSource, /deriveSessionIdFromLiveKitRoomName/);
  assert.match(routeSource, /isValidConnectionRoomId/);
  assert.match(routeSource, /requestedSessionId && !isValidConnectionRoomId\(requestedSessionId\)/);
  assert.match(
    routeSource,
    /const roomName = sessionId \? deriveLiveKitRoomName\(sessionId\) : requestedRoomName/
  );
  assert.match(routeSource, /dispatch_ids/);
});

test('session stop route pins the Next.js runtime to nodejs', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /export const runtime = 'nodejs'/);
});

test('session stop route deletes the LiveKit room after the dispatch barrier', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /await waitForPendingDispatches\(roomName, sessionId\)/);
  assert.match(routeSource, /deleteLiveKitRoom\(roomName\)/);
});

test('session stop route defers remote cleanup for browser input source', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /function shouldDeferRemoteSessionCleanup/);
  assert.match(routeSource, /const inputSource = readStopInputSource\(\)/);
  assert.match(routeSource, /inputSource === 'browser'/);
  assert.match(routeSource, /function usesBrowserOnlyMixedInput/);
  assert.match(routeSource, /void runRemoteSessionCleanup/);
  assert.match(routeSource, /status: 'stopping'/);
  assert.match(routeSource, /deferred: true/);
  assert.match(routeSource, /\{ status: 202 \}/);
});

test('session stop route defers remote cleanup for mixed all-browser role devices', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );
  const deferSource =
    routeSource.match(/function shouldDeferRemoteSessionCleanup[\s\S]*?\n}/)?.[0] ?? '';

  assert.match(routeSource, /function readStopRoleDevice/);
  assert.match(routeSource, /function usesBrowserOnlyMixedInput/);
  assert.match(deferSource, /inputSource === 'mixed' && usesBrowserOnlyMixedInput\(\)/);
});

test('session stop route closes the registry even when remote cleanup is partial', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );
  const cleanupSource = routeSource.match(/async function runRemoteSessionCleanup[\s\S]*?\n}/)?.[0];

  assert.ok(cleanupSource, 'runRemoteSessionCleanup should be defined');
  assert.match(cleanupSource, /const failures = results\.filter/);
  assert.match(
    cleanupSource,
    /markRoomSessionStopped\(roomName, sessionId\);\s*return \{ results, failures \};/
  );
});

test('session stop route logs remote cleanup with canonical session identity', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );
  const cleanupSource = routeSource.match(/async function runRemoteSessionCleanup[\s\S]*?\n}/)?.[0];

  assert.ok(cleanupSource, 'runRemoteSessionCleanup should be defined');
  assert.match(cleanupSource, /console\.info\('agent session remote cleanup completed'/);
  assert.match(cleanupSource, /roomName/);
  assert.match(cleanupSource, /sessionId/);
  assert.match(cleanupSource, /results/);
  assert.match(cleanupSource, /failures/);
});
