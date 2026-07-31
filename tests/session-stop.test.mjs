import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { readAgentWorkerStateFromLog } from '../lib/agent-worker-readiness.ts';
import { resolveLiveKitHttpUrl, resolveRoomInputStopUrls } from '../lib/session-stop.ts';

test('parses the latest target agent worker state from LiveKit server logs', () => {
  const source = [
    '{"agentName":"other-agent","status":"WS_AVAILABLE"}',
    '{"agentName":"lexvoice-xunfei-agent","status":"WS_FULL"}',
    '{"status"  :  "WS_AVAILABLE", "agentName"  :  "lexvoice-xunfei-agent"}',
  ].join('\n');

  assert.equal(readAgentWorkerStateFromLog(source, 'lexvoice-xunfei-agent'), 'available');
  assert.equal(readAgentWorkerStateFromLog(source, 'missing-agent'), 'unknown');
});

test('maps livekit websocket URLs to server API URLs', () => {
  assert.equal(resolveLiveKitHttpUrl('ws://localhost:7818'), 'http://localhost:7818');
  assert.equal(resolveLiveKitHttpUrl('wss://livekit.example'), 'https://livekit.example');
  assert.equal(resolveLiveKitHttpUrl('https://livekit.example'), 'https://livekit.example');
});

test('room input stop URL resolver ignores primebot non-server input', () => {
  assert.deepEqual(
    resolveRoomInputStopUrls({
      inputSource: 'primebot',
      roomInputUrl: 'http://room-input.local/start',
      roomAudioInputUrl: 'http://audio.local/start',
      roomVisionInputUrl: 'http://vision.local/start',
      frontdeskInputParticipantUrl: 'http://xunfei.local/start',
      faceServiceUrl: 'http://face.local/start',
      genericCameraParticipantUrl: 'http://generic.local/start',
    }),
    []
  );
});

test('room input stop URL resolver only stops selected mixed server roles', () => {
  assert.deepEqual(
    resolveRoomInputStopUrls({
      inputSource: 'mixed',
      audioInputDevice: 'xunfei',
      visionInputDevice: 'browser',
      roomAudioInputUrl: 'http://xunfei-audio.local/start',
      roomVisionInputUrl: 'http://unused-vision.local/start',
      roomInputUrl: 'http://fallback.local/start',
      frontdeskInputParticipantUrl: 'http://frontdesk.local/start',
      faceServiceUrl: 'http://face.local/start',
      genericCameraParticipantUrl: 'http://generic.local/start',
    }),
    ['http://xunfei-audio.local/stop', 'http://frontdesk.local/stop', 'http://face.local/stop']
  );
});

test('session stop route can call the room-input control endpoint before deleting the room', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  const cleanupSource = routeSource.match(/async function runRemoteSessionCleanup[\s\S]*?\n}/)?.[0];

  assert.ok(cleanupSource, 'runRemoteSessionCleanup should be defined');
  assert.match(routeSource, /readStopEnv\('ROOM_INPUT_URL'\)/);
  assert.match(routeSource, /resolveRoomInputStopUrls/);
  assert.match(routeSource, /stopRoomInput/);
  assert.match(routeSource, /FRONTDESK_INPUT_PARTICIPANT_URL/);
  assert.match(routeSource, /FACE_SERVICE_URL/);
  assert.match(routeSource, /GENERIC_CAMERA_PARTICIPANT_URL/);
  assert.match(
    cleanupSource,
    /const roomInputResults = await stopRoomInput\(roomName, sessionId\);[\s\S]*const liveKitRoomResult = await deleteLiveKitRoom\(roomName\);/
  );
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
  assert.match(routeSource, /await stopRoomInput\(roomName, sessionId\)/);
  assert.match(routeSource, /deleteLiveKitRoom\(roomName\)/);
});

test('session stop route waits for local agent worker readiness before finishing server cleanup', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );
  const cleanupSource = routeSource.match(/async function runRemoteSessionCleanup[\s\S]*?\n}/)?.[0];

  assert.ok(cleanupSource, 'runRemoteSessionCleanup should be defined');
  assert.match(routeSource, /function waitForLocalAgentWorkerReadiness/);
  assert.match(routeSource, /process\.env\.LEXVOICE_RUN_LOG_DIR/);
  assert.match(routeSource, /server\.log/);
  assert.match(routeSource, /AGENT_WORKER_READINESS_TIMEOUT_MS/);
  assert.match(routeSource, /readFileTail\(logPath/);
  assert.doesNotMatch(routeSource, /readFile\(logPath,\s*'utf8'\)/);
  assert.doesNotMatch(routeSource, /if \(state === 'unknown'\)/);
  assert.match(cleanupSource, /deleteLiveKitRoom\(roomName\)/);
  assert.match(cleanupSource, /await waitForLocalAgentWorkerReadiness\(\)/);
  assert.match(
    cleanupSource,
    /const cleanupResults = \[\s*dispatchBarrierResult,\s*\.\.\.roomInputResults,\s*liveKitRoomResult,\s*agentWorkerReadinessResult,\s*\]/
  );
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
  assert.match(cleanupSource, /result\.fatal !== false/);
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
