import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { POST as stopSession } from '../app/api/session/stop/route.ts';
import { readAgentWorkerStateFromLog } from '../lib/agent-worker-readiness.ts';
import {
  executeRoomInputStopsSequentially,
  resolveLiveKitHttpUrl,
  resolveRoomInputStopUrls,
} from '../lib/session-stop.ts';

function restoreEnv(previousEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in previousEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, previousEnv);
}

test('parses the latest target agent worker state from LiveKit server logs', () => {
  const source = [
    '{"agentName":"other-agent","status":"WS_AVAILABLE"}',
    '{"agentName":"lexvoice-xunfei-agent","status":"WS_FULL"}',
    '{"status"  :  "WS_AVAILABLE", "agentName"  :  "lexvoice-xunfei-agent"}',
  ].join('\n');

  assert.equal(readAgentWorkerStateFromLog(source, 'lexvoice-xunfei-agent'), 'available');
  assert.equal(readAgentWorkerStateFromLog(source, 'missing-agent'), 'unknown');
});

test('parses the latest local worker capacity state from the agent log', () => {
  const source = [
    'worker is at full capacity, marking as unavailable',
    'worker is below capacity, marking as available',
  ].join('\n');

  assert.equal(readAgentWorkerStateFromLog(source, 'frontdesk-agent'), 'available');
});

test('maps livekit websocket URLs to server API URLs', () => {
  assert.equal(resolveLiveKitHttpUrl('ws://localhost:7818'), 'http://localhost:7818');
  assert.equal(resolveLiveKitHttpUrl('wss://livekit.example'), 'https://livekit.example');
  assert.equal(resolveLiveKitHttpUrl('https://livekit.example'), 'https://livekit.example');
});

test('room input stop URL resolver skips browser input', () => {
  assert.deepEqual(
    resolveRoomInputStopUrls({
      inputSource: 'browser',
      edgeMediaUrl: 'http://edge.local/start',
      videoProcessorUrl: 'http://processor.local/start',
    }),
    []
  );
});

test('room input stop URL resolver returns processor then edge for server input', () => {
  assert.deepEqual(
    resolveRoomInputStopUrls({
      inputSource: 'xunfei',
      edgeMediaUrl: 'http://edge.local/start',
      videoProcessorUrl: 'http://processor.local/start',
    }),
    ['http://processor.local/stop', 'http://edge.local/stop']
  );
});

test('mixed input keeps the complete split topology when either role uses server input', () => {
  for (const roleDevices of [
    { audioInputDevice: 'xunfei', visionInputDevice: 'browser' },
    { audioInputDevice: 'browser', visionInputDevice: 'generic' },
  ]) {
    assert.deepEqual(
      resolveRoomInputStopUrls({
        inputSource: 'mixed',
        ...roleDevices,
        edgeMediaUrl: 'http://edge.local/start',
        videoProcessorUrl: 'http://processor.local/start',
      }),
      ['http://processor.local/stop', 'http://edge.local/stop']
    );
  }
});

test('room input stop URL resolver rejects incomplete split media configuration', () => {
  for (const options of [
    {},
    { videoProcessorUrl: 'http://processor.local/start' },
    { edgeMediaUrl: 'http://edge.local/start' },
  ]) {
    assert.throws(
      () => resolveRoomInputStopUrls({ inputSource: 'xunfei', ...options }),
      /VIDEO_PROCESSOR_URL and EDGE_MEDIA_URL are required/
    );
  }
});

test('room input stop URL resolver rejects duplicate split media endpoints', () => {
  assert.throws(
    () =>
      resolveRoomInputStopUrls({
        inputSource: 'xunfei',
        videoProcessorUrl: 'http://media.local/start',
        edgeMediaUrl: 'http://media.local/stop',
      }),
    /must resolve to distinct stop endpoints/
  );
});

test('session stop reports invalid split media configuration and continues room cleanup', async () => {
  const previousEnv = { ...process.env };

  process.env.INPUT_SOURCE = 'xunfei';
  delete process.env.VIDEO_PROCESSOR_URL;
  delete process.env.EDGE_MEDIA_URL;
  delete process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
  delete process.env.LEXVOICE_RUN_LOG_DIR;

  try {
    const response = await stopSession(
      new Request('http://localhost/api/session/stop', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: '00000000-0000-4000-8000-000000000020',
          wait: true,
        }),
      })
    );
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.equal(payload.status, 'partial');
    assert.deepEqual(
      payload.results.find((result) => result.target === 'room_input_configuration'),
      {
        target: 'room_input_configuration',
        ok: false,
        fatal: true,
        error: 'VIDEO_PROCESSOR_URL and EDGE_MEDIA_URL are required for server room input',
      }
    );
    assert.deepEqual(
      payload.results.find((result) => result.target === 'livekit_room'),
      {
        target: 'livekit_room',
        ok: true,
        skipped: true,
      }
    );
  } finally {
    restoreEnv(previousEnv);
  }
});

test('room input stop executor waits for each stop before starting the next', async () => {
  const processorUrl = 'http://processor.local/stop';
  const edgeUrl = 'http://edge.local/stop';
  const events = [];
  let releaseProcessorStop = () => {};
  const processorStopPending = new Promise((resolve) => {
    releaseProcessorStop = resolve;
  });

  const execution = executeRoomInputStopsSequentially([processorUrl, edgeUrl], async (stopUrl) => {
    events.push(`start:${stopUrl}`);
    if (stopUrl === processorUrl) {
      await processorStopPending;
    }
    events.push(`finish:${stopUrl}`);
    return stopUrl;
  });

  await Promise.resolve();
  assert.deepEqual(events, [`start:${processorUrl}`]);

  releaseProcessorStop();
  assert.deepEqual(await execution, [processorUrl, edgeUrl]);
  assert.deepEqual(events, [
    `start:${processorUrl}`,
    `finish:${processorUrl}`,
    `start:${edgeUrl}`,
    `finish:${edgeUrl}`,
  ]);
});

test('session stop route stops room input before deleting the room', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/stop/route.ts', import.meta.url),
    'utf8'
  );

  const cleanupSource = routeSource.match(/async function runRemoteSessionCleanup[\s\S]*?\n}/)?.[0];
  const stopUrlResolverSource = routeSource.match(
    /function resolveRoomInputStopUrls[\s\S]*?\n}/
  )?.[0];
  const stopRoomInputSource = routeSource.match(/async function stopRoomInput[\s\S]*?\n}/)?.[0];

  assert.ok(cleanupSource, 'runRemoteSessionCleanup should be defined');
  assert.ok(stopUrlResolverSource, 'resolveRoomInputStopUrls should be defined');
  assert.match(stopUrlResolverSource, /videoProcessorUrl: readStopEnv\('VIDEO_PROCESSOR_URL'\)/);
  assert.match(stopUrlResolverSource, /edgeMediaUrl: readStopEnv\('EDGE_MEDIA_URL'\)/);
  assert.equal((stopUrlResolverSource.match(/readStopEnv\(/g) ?? []).length, 2);
  assert.ok(stopRoomInputSource, 'stopRoomInput should be defined');
  assert.match(stopRoomInputSource, /executeRoomInputStopsSequentially\(stopUrls,/);
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
  assert.match(routeSource, /live\.log/);
  assert.doesNotMatch(routeSource, /path\.join\(runLogDir, 'server\.log'\)/);
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
