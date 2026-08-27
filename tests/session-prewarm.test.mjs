import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ParticipantInfo_Kind, ParticipantInfo_State, TrackType } from '@livekit/protocol';
import {
  beginPrewarmUse,
  buildPrewarmUseKey,
  completePrewarmUse,
  failPrewarmUse,
  releasePrewarmUseAfterFailure,
} from '@/app/api/session/prewarm/prewarm-use-guard';
import {
  resolveAgentWorkerReadyFile,
  waitForAgentWorkerReady,
} from '../app/api/session/agent-worker-readiness.ts';
import { POST as prewarmRoute } from '../app/api/session/prewarm/route.ts';
import {
  PrewarmRoomSessionError,
  dispatchRoomSession,
  prewarmRoomSession,
} from '../app/api/session/session-dispatch-service.ts';
import { getRoomSessionSnapshot } from '../app/api/session/session-registry.ts';
import { AGENT_SESSION_READY_ATTRIBUTE } from '../lib/session-dispatch-readiness.ts';

function activeParticipant(identity, attributes = {}) {
  return {
    identity,
    kind: identity.startsWith('agent-')
      ? ParticipantInfo_Kind.AGENT
      : ParticipantInfo_Kind.STANDARD,
    state: ParticipantInfo_State.ACTIVE,
    attributes,
    tracks: [],
  };
}

function readyParticipants(agentName, { agentSessionReady = true, videoReady = false } = {}) {
  const videoParticipant = activeParticipant('room_video_input');
  if (videoReady) {
    videoParticipant.tracks = [{ name: 'room_video', type: TrackType.VIDEO, muted: false }];
  }
  const agentAttributes = { 'lk.agent.name': agentName };
  if (agentSessionReady) {
    agentAttributes[AGENT_SESSION_READY_ATTRIBUTE] = 'true';
  }
  return [
    activeParticipant('agent-ready', agentAttributes),
    activeParticipant('room_audio_input'),
    videoParticipant,
  ];
}

test('prewarm route is unavailable outside sandbox runtime', async () => {
  const previousRuntimeMode = process.env.LIVEAVATAR_RUNTIME_MODE;
  const previousSecret = process.env.LIVEAVATAR_PREWARM_SECRET;
  process.env.LIVEAVATAR_RUNTIME_MODE = 'local';
  process.env.LIVEAVATAR_PREWARM_SECRET = 'prewarm-secret';
  try {
    const response = await prewarmRoute(
      new Request('http://local.example.test/api/session/prewarm', {
        method: 'POST',
        headers: { 'x-liveavatar-prewarm-secret': 'prewarm-secret' },
      })
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { status: 'error', error: 'not found' });
  } finally {
    if (previousRuntimeMode === undefined) {
      delete process.env.LIVEAVATAR_RUNTIME_MODE;
    } else {
      process.env.LIVEAVATAR_RUNTIME_MODE = previousRuntimeMode;
    }
    if (previousSecret === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_SECRET;
    } else {
      process.env.LIVEAVATAR_PREWARM_SECRET = previousSecret;
    }
  }
});

test('prewarm route rejects requests without the per-sandbox secret', async () => {
  const previous = process.env.LIVEAVATAR_PREWARM_SECRET;
  const previousRuntimeMode = process.env.LIVEAVATAR_RUNTIME_MODE;
  process.env.LIVEAVATAR_RUNTIME_MODE = 'sandbox';
  process.env.LIVEAVATAR_PREWARM_SECRET = 'expected-prewarm-secret';
  try {
    const missing = await prewarmRoute(
      new Request('http://sandbox.example.test/api/session/prewarm', { method: 'POST' })
    );
    const wrong = await prewarmRoute(
      new Request('http://sandbox.example.test/api/session/prewarm', {
        method: 'POST',
        headers: { 'x-liveavatar-prewarm-secret': 'wrong-prewarm-secret' },
      })
    );

    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
  } finally {
    if (previous === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_SECRET;
    } else {
      process.env.LIVEAVATAR_PREWARM_SECRET = previous;
    }
    if (previousRuntimeMode === undefined) {
      delete process.env.LIVEAVATAR_RUNTIME_MODE;
    } else {
      process.env.LIVEAVATAR_RUNTIME_MODE = previousRuntimeMode;
    }
  }
});

test('prewarm authorization is single-use after success and retryable after failure', () => {
  const completedKey = buildPrewarmUseKey(
    'completed-session',
    'voice_assistant_room_completed-session',
    'frontdesk-browser-agent-completed-session'
  );
  assert.equal(beginPrewarmUse(completedKey), 'started');
  assert.equal(beginPrewarmUse(completedKey), 'in_progress');
  completePrewarmUse(completedKey);
  assert.equal(beginPrewarmUse(completedKey), 'completed');

  const retryableKey = buildPrewarmUseKey(
    'retryable-session',
    'voice_assistant_room_retryable-session',
    'frontdesk-browser-agent-retryable-session'
  );
  assert.equal(beginPrewarmUse(retryableKey), 'started');
  failPrewarmUse(retryableKey);
  assert.equal(beginPrewarmUse(retryableKey), 'started');
  failPrewarmUse(retryableKey);
});

test('prewarm route returns 409 after its server-owned authorization is consumed', async () => {
  const sessionId = 'a16e0a10-4f28-4a78-8f1f-019c25a273cb';
  const roomName = `voice_assistant_room_${sessionId}`;
  const agentName = 'frontdesk-browser-agent-consumed';
  const secret = 'consumed-prewarm-secret';
  const envNames = [
    'LIVEAVATAR_PREWARM_SECRET',
    'LIVEAVATAR_VOICE_SESSION_ID',
    'LIVEAVATAR_LIVEKIT_ROOM_NAME',
    'LIVEAVATAR_RUNTIME_MODE',
    'AGENT_NAME',
  ];
  const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    LIVEAVATAR_PREWARM_SECRET: secret,
    LIVEAVATAR_VOICE_SESSION_ID: sessionId,
    LIVEAVATAR_LIVEKIT_ROOM_NAME: roomName,
    LIVEAVATAR_RUNTIME_MODE: 'sandbox',
    AGENT_NAME: agentName,
  });

  const useKey = buildPrewarmUseKey(sessionId, roomName, agentName);
  assert.equal(beginPrewarmUse(useKey), 'started');
  completePrewarmUse(useKey);

  try {
    const response = await prewarmRoute(
      new Request('http://sandbox.example.test/api/session/prewarm', {
        method: 'POST',
        headers: { 'x-liveavatar-prewarm-secret': secret },
      })
    );

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      status: 'error',
      error: 'prewarm authorization already consumed',
    });
  } finally {
    for (const name of envNames) {
      if (previous[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previous[name];
      }
    }
  }
});

test('prewarm route returns a structured retryable 502 without leaking its secret', async () => {
  const sessionId = 'c5b8c624-7f55-4acf-bbe5-a7ddc634a101';
  const roomName = `voice_assistant_room_${sessionId}`;
  const agentName = 'frontdesk-browser-agent-room-failure';
  const secret = 'room-failure-prewarm-secret';
  const envNames = [
    'LIVEAVATAR_PREWARM_SECRET',
    'LIVEAVATAR_VOICE_SESSION_ID',
    'LIVEAVATAR_LIVEKIT_ROOM_NAME',
    'LIVEAVATAR_RUNTIME_MODE',
    'AGENT_NAME',
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
  ];
  const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const originalConsoleError = console.error;
  const errorLogs = [];
  console.error = (...args) => {
    errorLogs.push(args);
  };
  Object.assign(process.env, {
    LIVEAVATAR_PREWARM_SECRET: secret,
    LIVEAVATAR_VOICE_SESSION_ID: sessionId,
    LIVEAVATAR_LIVEKIT_ROOM_NAME: roomName,
    LIVEAVATAR_RUNTIME_MODE: 'sandbox',
    AGENT_NAME: agentName,
  });
  delete process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await prewarmRoute(
        new Request('http://sandbox.example.test/api/session/prewarm', {
          method: 'POST',
          headers: { 'x-liveavatar-prewarm-secret': secret },
        })
      );
      const payload = await response.json();

      assert.equal(response.status, 502);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(payload.phase, 'room');
      assert.equal(Number.isInteger(payload.timings.totalPrewarmMs), true);
      assert.equal(Number.isInteger(payload.timings.roomEnsureMs), true);
      assert.deepEqual(Object.keys(payload.timings).sort(), ['roomEnsureMs', 'totalPrewarmMs']);
      assert.equal(JSON.stringify(payload).includes(secret), false);
      assert.equal(JSON.stringify(payload).includes('attributes'), false);
    }
    assert.equal(errorLogs.length, 2);
    assert.equal(
      errorLogs.every((entry) => entry[0] === 'session prewarm failed'),
      true
    );
    assert.equal(
      errorLogs.every((entry) => entry[1]?.phase === 'room'),
      true
    );
    assert.equal(JSON.stringify(errorLogs).includes(secret), false);
  } finally {
    console.error = originalConsoleError;
    for (const name of envNames) {
      if (previous[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previous[name];
      }
    }
  }
});

test('prewarm phase errors preserve their original cause', () => {
  const cause = Object.assign(new Error('livekit request failed'), { code: 'ECONNRESET' });
  const error = new PrewarmRoomSessionError('room', { totalPrewarmMs: 5, roomEnsureMs: 5 }, cause);

  assert.equal(error.cause, cause);
});

test('prewarm authorization remains in progress until timed-out work settles', async () => {
  const key = buildPrewarmUseKey(
    'settling-session',
    'voice_assistant_room_settling-session',
    'frontdesk-browser-agent-settling-session'
  );
  let releaseSettlement;
  const retryReady = new Promise((resolve) => {
    releaseSettlement = resolve;
  });
  const error = new PrewarmRoomSessionError(
    'room',
    { totalPrewarmMs: 5, roomEnsureMs: 5 },
    new Error('room deadline expired'),
    retryReady
  );

  assert.equal(beginPrewarmUse(key), 'started');
  releasePrewarmUseAfterFailure(key, error);
  assert.equal(beginPrewarmUse(key), 'in_progress');

  releaseSettlement();
  await retryReady;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(beginPrewarmUse(key), 'started');
  failPrewarmUse(key);
});

test('prewarm route allowlists readiness and timings instead of spreading internal results', async () => {
  const source = await readFile(
    new URL('../app/api/session/prewarm/route.ts', import.meta.url),
    'utf8'
  );
  const successSource = source.slice(
    source.indexOf('const result = await prewarmRoomSession'),
    source.indexOf('} catch (error)')
  );

  assert.doesNotMatch(successSource, /\.\.\.result/);
  assert.match(successSource, /readiness:\s*result\.readiness/);
  assert.match(successSource, /timings:\s*result\.timings/);
  assert.doesNotMatch(successSource, /workerReadiness:\s*result\.workerReadiness/);
  assert.doesNotMatch(successSource, /dispatch:\s*result\.dispatch/);
});

test('missing LiveKit configuration fails before registering a room session', async () => {
  const names = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => delete process.env[name]);

  const request = {
    roomName: 'voice_assistant_room_missing_config',
    sessionId: 'missing-config',
    agentName: 'frontdesk-browser-agent-missing-config',
  };
  try {
    await assert.rejects(dispatchRoomSession(request), /LiveKit API configuration is required/);
    assert.equal(getRoomSessionSnapshot(request.roomName), undefined);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previous[name];
      }
    }
  }
});

test('regular dispatch keeps its 30s timeout while prewarm gets the default 45s total budget', async () => {
  const originalNow = Date.now;
  const originalTimeout = process.env.AGENT_DISPATCH_TIMEOUT_MS;
  const originalPrewarmTimeout = process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  let now = 1_000;
  let dispatchCount = 0;
  Date.now = () => now;
  delete process.env.AGENT_DISPATCH_TIMEOUT_MS;
  delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;

  const dispatchClient = {
    async createDispatch() {
      dispatchCount += 1;
      return { id: `dispatch-timeout-${dispatchCount}` };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listRooms([roomName]) {
      return [{ name: roomName }];
    },
    async createRoom({ name }) {
      return { name };
    },
    async listParticipants() {
      return [];
    },
    async deleteRoom() {},
  };
  const dependencies = {
    dispatchClient,
    roomClient,
    dispatchPollMs: 1_000,
    dispatchRetryMs: 1_000,
    sleep: async (ms) => {
      now += ms;
    },
    waitForAgentWorkerReady: async () => ({ state: 'not_required' }),
  };

  try {
    const regularStartedAt = now;
    await assert.rejects(
      dispatchRoomSession(
        {
          roomName: 'voice_assistant_room_regular_timeout',
          sessionId: 'regular-timeout',
          agentName: 'frontdesk-browser-agent-regular-timeout',
        },
        dependencies
      ),
      /agent dispatch failed/
    );
    assert.equal(now - regularStartedAt, 30_000);

    const prewarmStartedAt = now;
    await assert.rejects(
      prewarmRoomSession(
        {
          roomName: 'voice_assistant_room_prewarm_timeout',
          sessionId: 'prewarm-timeout',
          agentName: 'frontdesk-browser-agent-prewarm-timeout',
        },
        dependencies
      ),
      /agent dispatch failed/
    );
    assert.equal(now - prewarmStartedAt, 45_000);
  } finally {
    Date.now = originalNow;
    if (originalTimeout === undefined) {
      delete process.env.AGENT_DISPATCH_TIMEOUT_MS;
    } else {
      process.env.AGENT_DISPATCH_TIMEOUT_MS = originalTimeout;
    }
    if (originalPrewarmTimeout === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = originalPrewarmTimeout;
    }
  }
});

test('prewarm shares its 45s total budget across worker readiness and dispatch', async () => {
  const originalNow = Date.now;
  const originalPrewarmTimeout = process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  const originalWorkerTimeout = process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
  let now = 1_000;
  let workerMaxWaitMs;
  Date.now = () => now;
  delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  delete process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;

  const dispatchClient = {
    async createDispatch() {
      return { id: 'dispatch-shared-prewarm-timeout' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listRooms() {
      return [{ name: 'voice_assistant_room_shared_prewarm_timeout' }];
    },
    async createRoom({ name }) {
      return { name };
    },
    async listParticipants() {
      return [];
    },
    async deleteRoom() {},
  };

  try {
    const startedAt = now;
    await assert.rejects(
      prewarmRoomSession(
        {
          roomName: 'voice_assistant_room_shared_prewarm_timeout',
          sessionId: 'shared-prewarm-timeout',
          agentName: 'frontdesk-browser-agent-shared-prewarm-timeout',
        },
        {
          dispatchClient,
          roomClient,
          waitForAgentWorkerReady: async (_agentName, options) => {
            workerMaxWaitMs = options.maxWaitMs;
            now += 12_000;
            return {
              state: 'skipped',
              agentName: _agentName,
              reason: 'not_sandbox',
              waitedMs: 0,
            };
          },
          dispatchPollMs: 1_000,
          dispatchRetryMs: 1_000,
          sleep: async (ms) => {
            now += ms;
          },
        }
      ),
      /agent dispatch failed/
    );

    assert.equal(workerMaxWaitMs, 30_000);
    assert.equal(now - startedAt, 45_000);
  } finally {
    Date.now = originalNow;
    if (originalPrewarmTimeout === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = originalPrewarmTimeout;
    }
    if (originalWorkerTimeout === undefined) {
      delete process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS = originalWorkerTimeout;
    }
  }
});

test('room 2s plus worker 17s still completes dispatch readiness before the deadline', async () => {
  const originalNow = Date.now;
  const originalTotalTimeout = process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  const originalWorkerTimeout = process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
  let now = 1_000;
  const startedAt = now;
  const absoluteDeadline = startedAt + 45_000;
  const agentName = 'frontdesk-browser-agent-cold-start-model';
  let roomEnsureStarted = false;
  let workerMaxWaitMs;
  Date.now = () => now;
  delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  delete process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;

  const dispatchClient = {
    async createDispatch() {
      return { id: 'dispatch-cold-start-model' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listRooms() {
      if (!roomEnsureStarted) {
        roomEnsureStarted = true;
        now += 2_000;
      }
      return [{ name: 'voice_assistant_room_cold_start_model' }];
    },
    async createRoom({ name }) {
      return { name };
    },
    async listParticipants() {
      return now >= absoluteDeadline - 1_000 ? readyParticipants(agentName) : [];
    },
    async deleteRoom() {},
  };

  try {
    const result = await prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_cold_start_model',
        sessionId: 'cold-start-model',
        agentName,
      },
      {
        dispatchClient,
        roomClient,
        waitForAgentWorkerReady: async (requestedAgentName, options) => {
          assert.equal(requestedAgentName, agentName);
          workerMaxWaitMs = options.maxWaitMs;
          now += 17_000;
          return {
            state: 'ready',
            agentName,
            workerId: 'AW_cold_start_model',
            registeredAt: '2026-07-24T00:00:00Z',
            waitedMs: 17_000,
          };
        },
        dispatchPollMs: 1_000,
        dispatchRetryMs: 1_000,
        sleep: async (ms) => {
          now += ms;
        },
      }
    );

    assert.equal(workerMaxWaitMs, 30_000);
    assert.equal(now, absoluteDeadline - 1_000);
    assert.deepEqual(result.timings, {
      totalPrewarmMs: 44_000,
      roomEnsureMs: 2_000,
      workerReadyWaitMs: 17_000,
      dispatchReadinessMs: 25_000,
    });
    assert.deepEqual(result.readiness, {
      agentSessionReady: true,
      audioParticipantReady: true,
      visionParticipantReady: true,
    });
  } finally {
    Date.now = originalNow;
    if (originalTotalTimeout === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = originalTotalTimeout;
    }
    if (originalWorkerTimeout === undefined) {
      delete process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS = originalWorkerTimeout;
    }
  }
});

test('dispatch deadline never starts participant IO, dispatch creation, or sleep at zero budget', async () => {
  const originalNow = Date.now;
  let now = 1_000;
  const deadline = now + 1_000;
  let participantReadsAtDeadline = 0;
  let dispatchCreatesAtDeadline = 0;
  let sleepsAtDeadline = 0;
  Date.now = () => now;

  try {
    await assert.rejects(
      prewarmRoomSession(
        {
          roomName: 'voice_assistant_room_hard_deadline',
          sessionId: 'hard-deadline',
          agentName: 'frontdesk-browser-agent-hard-deadline',
        },
        {
          dispatchClient: {
            async createDispatch() {
              if (now >= deadline) {
                dispatchCreatesAtDeadline += 1;
              }
              return { id: 'dispatch-hard-deadline' };
            },
            async deleteDispatch() {},
          },
          roomClient: {
            async listRooms() {
              return [{ name: 'voice_assistant_room_hard_deadline' }];
            },
            async createRoom({ name }) {
              return { name };
            },
            async listParticipants() {
              if (now >= deadline) {
                participantReadsAtDeadline += 1;
              }
              return [];
            },
            async deleteRoom() {},
          },
          waitForAgentWorkerReady: async (requestedAgentName) => ({
            state: 'ready',
            agentName: requestedAgentName,
            workerId: 'AW_hard_deadline',
            registeredAt: '2026-07-24T00:00:00Z',
            waitedMs: 0,
          }),
          dispatchTimeoutMs: 1_000,
          dispatchPollMs: 1_000,
          dispatchRetryMs: 1_000,
          sleep: async (ms) => {
            if (now >= deadline) {
              sleepsAtDeadline += 1;
            }
            now += ms;
          },
        }
      ),
      /prewarm failed during dispatch_readiness/
    );

    assert.equal(participantReadsAtDeadline, 0);
    assert.equal(dispatchCreatesAtDeadline, 0);
    assert.equal(sleepsAtDeadline, 0);
  } finally {
    Date.now = originalNow;
  }
});

test('room timeout cannot create a room after a delayed list operation finishes', async () => {
  const originalNow = Date.now;
  Date.now = () => 1_000;
  let releaseListRooms;
  let markListRoomsStarted;
  let createRoomCalls = 0;
  const listRoomsStarted = new Promise((resolve) => {
    markListRoomsStarted = resolve;
  });
  const listRoomsGate = new Promise((resolve) => {
    releaseListRooms = resolve;
  });
  try {
    const pending = prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_late_list',
        sessionId: 'late-list',
        agentName: 'frontdesk-browser-agent-late-list',
      },
      {
        dispatchClient: {
          async createDispatch() {
            throw new Error('dispatch should not start');
          },
          async deleteDispatch() {},
        },
        roomClient: {
          async listRooms() {
            markListRoomsStarted();
            await listRoomsGate;
            return [];
          },
          async createRoom({ name }) {
            createRoomCalls += 1;
            return { name };
          },
          async listParticipants() {
            return [];
          },
          async deleteRoom() {},
        },
        dispatchTimeoutMs: 5,
      }
    );

    await listRoomsStarted;
    await assert.rejects(pending, /prewarm failed during room/);
    releaseListRooms();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(createRoomCalls, 0);
  } finally {
    releaseListRooms?.();
    Date.now = originalNow;
  }
});

test('room timeout removes a room whose delayed creation completes after the deadline', async () => {
  const originalNow = Date.now;
  Date.now = () => 1_000;
  let releaseCreateRoom;
  let markCreateRoomStarted;
  let deleteRoomCalls = 0;
  const createRoomStarted = new Promise((resolve) => {
    markCreateRoomStarted = resolve;
  });
  const createRoomGate = new Promise((resolve) => {
    releaseCreateRoom = resolve;
  });
  try {
    const pending = prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_late_create',
        sessionId: 'late-create',
        agentName: 'frontdesk-browser-agent-late-create',
      },
      {
        dispatchClient: {
          async createDispatch() {
            throw new Error('dispatch should not start');
          },
          async deleteDispatch() {},
        },
        roomClient: {
          async listRooms() {
            return [];
          },
          async createRoom({ name }) {
            markCreateRoomStarted();
            await createRoomGate;
            return { name };
          },
          async listParticipants() {
            return [];
          },
          async deleteRoom() {
            deleteRoomCalls += 1;
          },
        },
        dispatchTimeoutMs: 5,
      }
    );

    await createRoomStarted;
    await assert.rejects(pending, /prewarm failed during room/);
    releaseCreateRoom();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(deleteRoomCalls, 1);
  } finally {
    releaseCreateRoom?.();
    Date.now = originalNow;
  }
});

test('prewarm total timeout and worker cap honor their environment overrides', async () => {
  const originalNow = Date.now;
  const originalTotalTimeout = process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  const originalWorkerTimeout = process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
  let now = 1_000;
  let workerMaxWaitMs;
  let roomEnsureStarted = false;
  Date.now = () => now;
  process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = '12000';
  process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS = '7000';
  const agentName = 'frontdesk-browser-agent-env-budget';

  try {
    const result = await prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_env_budget',
        sessionId: 'env-budget',
        agentName,
      },
      {
        dispatchClient: {
          async createDispatch() {
            throw new Error('ready participants should be reused');
          },
          async deleteDispatch() {},
        },
        roomClient: {
          async listRooms() {
            if (!roomEnsureStarted) {
              roomEnsureStarted = true;
              now += 2_000;
            }
            return [{ name: 'voice_assistant_room_env_budget' }];
          },
          async createRoom({ name }) {
            return { name };
          },
          async listParticipants() {
            return readyParticipants(agentName);
          },
          async deleteRoom() {},
        },
        waitForAgentWorkerReady: async (requestedAgentName, options) => {
          workerMaxWaitMs = options.maxWaitMs;
          return {
            state: 'ready',
            agentName: requestedAgentName,
            workerId: 'AW_env_budget',
            registeredAt: '2026-07-24T00:00:00Z',
            waitedMs: 0,
          };
        },
      }
    );

    assert.equal(workerMaxWaitMs, 7_000);
    assert.deepEqual(result.timings, {
      totalPrewarmMs: 2_000,
      roomEnsureMs: 2_000,
      workerReadyWaitMs: 0,
      dispatchReadinessMs: 0,
    });
  } finally {
    Date.now = originalNow;
    if (originalTotalTimeout === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = originalTotalTimeout;
    }
    if (originalWorkerTimeout === undefined) {
      delete process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS = originalWorkerTimeout;
    }
  }
});

test('worker max wait is capped by the total time remaining after room ensure', async () => {
  const originalNow = Date.now;
  const originalTotalTimeout = process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
  const originalWorkerTimeout = process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
  let now = 1_000;
  let workerMaxWaitMs;
  let roomEnsureStarted = false;
  Date.now = () => now;
  process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = '5000';
  process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS = '7000';
  const agentName = 'frontdesk-browser-agent-remaining-budget';

  try {
    await prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_remaining_budget',
        sessionId: 'remaining-budget',
        agentName,
      },
      {
        dispatchClient: {
          async createDispatch() {
            throw new Error('ready participants should be reused');
          },
          async deleteDispatch() {},
        },
        roomClient: {
          async listRooms() {
            if (!roomEnsureStarted) {
              roomEnsureStarted = true;
              now += 2_000;
            }
            return [{ name: 'voice_assistant_room_remaining_budget' }];
          },
          async createRoom({ name }) {
            return { name };
          },
          async listParticipants() {
            return readyParticipants(agentName);
          },
          async deleteRoom() {},
        },
        waitForAgentWorkerReady: async (requestedAgentName, options) => {
          workerMaxWaitMs = options.maxWaitMs;
          return {
            state: 'ready',
            agentName: requestedAgentName,
            workerId: 'AW_remaining_budget',
            registeredAt: '2026-07-24T00:00:00Z',
            waitedMs: 0,
          };
        },
      }
    );

    assert.equal(workerMaxWaitMs, 3_000);
  } finally {
    Date.now = originalNow;
    if (originalTotalTimeout === undefined) {
      delete process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS = originalTotalTimeout;
    }
    if (originalWorkerTimeout === undefined) {
      delete process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS;
    } else {
      process.env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS = originalWorkerTimeout;
    }
  }
});

test('prewarm failures identify the active phase and completed timings', async () => {
  const originalNow = Date.now;
  let now = 1_000;
  let roomEnsureStarted = false;
  Date.now = () => now;

  try {
    const error = await prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_worker_failure',
        sessionId: 'worker-failure',
        agentName: 'frontdesk-browser-agent-worker-failure',
      },
      {
        dispatchClient: {
          async createDispatch() {
            throw new Error('dispatch should not start');
          },
          async deleteDispatch() {},
        },
        roomClient: {
          async listRooms() {
            if (!roomEnsureStarted) {
              roomEnsureStarted = true;
              now += 2_000;
            }
            return [{ name: 'voice_assistant_room_worker_failure' }];
          },
          async createRoom({ name }) {
            return { name };
          },
          async listParticipants() {
            return [];
          },
          async deleteRoom() {},
        },
        waitForAgentWorkerReady: async () => {
          now += 3_000;
          throw new Error('worker marker failed');
        },
      }
    ).then(
      () => null,
      (reason) => reason
    );

    assert.ok(error instanceof Error);
    assert.equal(error.phase, 'worker_readiness');
    assert.match(error.message, /worker marker failed/);
    assert.deepEqual(error.timings, {
      totalPrewarmMs: 5_000,
      roomEnsureMs: 2_000,
      workerReadyWaitMs: 3_000,
    });
  } finally {
    Date.now = originalNow;
  }
});

test('dispatch readiness failures report their phase and all elapsed timings', async () => {
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    const error = await prewarmRoomSession(
      {
        roomName: 'voice_assistant_room_dispatch_failure',
        sessionId: 'dispatch-failure',
        agentName: 'frontdesk-browser-agent-dispatch-failure',
      },
      {
        dispatchClient: {
          async createDispatch() {
            return { id: 'dispatch-phase-failure' };
          },
          async deleteDispatch() {},
        },
        roomClient: {
          async listRooms() {
            return [{ name: 'voice_assistant_room_dispatch_failure' }];
          },
          async createRoom({ name }) {
            return { name };
          },
          async listParticipants() {
            return [];
          },
          async deleteRoom() {},
        },
        waitForAgentWorkerReady: async (requestedAgentName) => ({
          state: 'skipped',
          agentName: requestedAgentName,
          reason: 'not_sandbox',
          waitedMs: 0,
        }),
        dispatchTimeoutMs: 100,
        dispatchPollMs: 10,
        dispatchRetryMs: 10,
        sleep: async (ms) => {
          now += ms;
        },
      }
    ).then(
      () => null,
      (reason) => reason
    );

    assert.ok(error instanceof Error);
    assert.equal(error.phase, 'dispatch_readiness');
    assert.deepEqual(error.timings, {
      totalPrewarmMs: 100,
      roomEnsureMs: 0,
      workerReadyWaitMs: 0,
      dispatchReadinessMs: 100,
    });
  } finally {
    Date.now = originalNow;
  }
});

test('concurrent prewarm dispatch calls share one LiveKit dispatch', async () => {
  const firstService = await import(
    '../app/api/session/session-dispatch-service.ts?chunk=dispatch-a'
  );
  const secondService = await import(
    '../app/api/session/session-dispatch-service.ts?chunk=dispatch-b'
  );
  const agentName = 'frontdesk-browser-agent-concurrent';
  let dispatchCalls = 0;
  let ready = false;
  let releaseDispatch;
  const dispatchGate = new Promise((resolve) => {
    releaseDispatch = resolve;
  });
  const dispatchClient = {
    async createDispatch() {
      dispatchCalls += 1;
      await dispatchGate;
      ready = true;
      return { id: 'dispatch-concurrent' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listParticipants() {
      return ready ? readyParticipants(agentName) : [];
    },
    async listRooms() {
      return [{ name: 'voice_assistant_room_concurrent' }];
    },
    async createRoom() {
      throw new Error('room already exists');
    },
    async deleteRoom() {},
  };
  const request = {
    roomName: 'voice_assistant_room_concurrent',
    sessionId: 'concurrent',
    agentName,
    readiness: { requireRoomInputParticipantsReady: true },
  };

  const first = firstService.dispatchRoomSession(request, { dispatchClient, roomClient });
  const second = secondService.dispatchRoomSession(request, { dispatchClient, roomClient });
  releaseDispatch();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(dispatchCalls, 1);
  assert.deepEqual(secondResult, firstResult);
  assert.equal(firstResult.dispatchId, 'dispatch-concurrent');
});

test('a concurrent prewarm budget extends the shared in-flight dispatch', async () => {
  const originalNow = Date.now;
  let now = 1_000;
  let dispatchCalls = 0;
  Date.now = () => now;

  const dispatchClient = {
    async createDispatch() {
      dispatchCalls += 1;
      return { id: 'dispatch-shared-budget' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listParticipants() {
      return [];
    },
    async deleteRoom() {},
  };
  const dependencies = {
    dispatchClient,
    roomClient,
    dispatchPollMs: 1_000,
    dispatchRetryMs: 1_000,
    sleep: async (ms) => {
      now += ms;
    },
  };
  const request = {
    roomName: 'voice_assistant_room_shared_budget',
    sessionId: 'shared-budget',
    agentName: 'frontdesk-browser-agent-shared-budget',
  };

  try {
    const startedAt = now;
    const regularDispatch = dispatchRoomSession(request, {
      ...dependencies,
      dispatchTimeoutMs: 8_000,
    });
    const prewarmDispatch = dispatchRoomSession(request, {
      ...dependencies,
      dispatchTimeoutMs: 20_000,
    });
    const results = await Promise.allSettled([regularDispatch, prewarmDispatch]);

    assert.equal(dispatchCalls, 1);
    assert.equal(now - startedAt, 20_000);
    for (const result of results) {
      assert.equal(result.status, 'rejected');
      assert.match(result.reason.message, /agent dispatch failed/);
    }
  } finally {
    Date.now = originalNow;
  }
});

test('a prewarm budget can extend the dispatch during the old deadline check', async () => {
  const originalNow = Date.now;
  let now = 1_000;
  let dispatchCalls = 0;
  let releaseDeadlineCheck;
  let markDeadlineCheckStarted;
  let deadlineCheckBlocked = false;
  Date.now = () => now;

  const deadlineCheckStarted = new Promise((resolve) => {
    markDeadlineCheckStarted = resolve;
  });
  const deadlineCheckGate = new Promise((resolve) => {
    releaseDeadlineCheck = resolve;
  });
  const dispatchClient = {
    async createDispatch() {
      dispatchCalls += 1;
      return { id: 'dispatch-late-shared-budget' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listParticipants() {
      if (now === 8_000 && !deadlineCheckBlocked) {
        deadlineCheckBlocked = true;
        markDeadlineCheckStarted();
        await deadlineCheckGate;
      }
      return [];
    },
    async deleteRoom() {},
  };
  const dependencies = {
    dispatchClient,
    roomClient,
    dispatchPollMs: 1_000,
    dispatchRetryMs: 1_000,
    sleep: async (ms) => {
      now += ms;
    },
  };
  const request = {
    roomName: 'voice_assistant_room_late_shared_budget',
    sessionId: 'late-shared-budget',
    agentName: 'frontdesk-browser-agent-late-shared-budget',
  };

  try {
    const regularDispatch = dispatchRoomSession(request, {
      ...dependencies,
      dispatchTimeoutMs: 8_000,
    });
    await deadlineCheckStarted;
    const prewarmDispatch = dispatchRoomSession(request, {
      ...dependencies,
      dispatchTimeoutMs: 20_000,
    });
    const resultsPromise = Promise.allSettled([regularDispatch, prewarmDispatch]);
    releaseDeadlineCheck();
    const results = await resultsPromise;

    assert.equal(dispatchCalls, 1);
    assert.equal(now, 28_000);
    assert.equal(
      results.every((result) => result.status === 'rejected'),
      true
    );
  } finally {
    releaseDeadlineCheck?.();
    Date.now = originalNow;
  }
});

test('concurrent dispatch callers wait for their own readiness contract', async () => {
  const agentName = 'frontdesk-browser-agent-readiness-contract';
  let dispatchCalls = 0;
  let agentReady = false;
  let videoReady = false;
  let releaseDispatch;
  let releaseVideo;
  let markVideoWaitStarted;
  const dispatchGate = new Promise((resolve) => {
    releaseDispatch = resolve;
  });
  const videoGate = new Promise((resolve) => {
    releaseVideo = resolve;
  });
  const videoWaitStarted = new Promise((resolve) => {
    markVideoWaitStarted = resolve;
  });
  const dispatchClient = {
    async createDispatch() {
      dispatchCalls += 1;
      await dispatchGate;
      agentReady = true;
      return { id: 'dispatch-readiness-contract' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listParticipants() {
      return agentReady ? readyParticipants(agentName, { videoReady }) : [];
    },
    async listRooms() {
      return [{ name: 'voice_assistant_room_readiness_contract' }];
    },
    async createRoom() {
      throw new Error('room already exists');
    },
    async deleteRoom() {},
  };
  const request = {
    roomName: 'voice_assistant_room_readiness_contract',
    sessionId: 'readiness-contract',
    agentName,
  };

  const prewarm = dispatchRoomSession(
    { ...request, readiness: { requireRoomInputParticipantsReady: true } },
    { dispatchClient, roomClient, dispatchTimeoutMs: 100 }
  );
  const browserDispatch = dispatchRoomSession(
    { ...request, readiness: { requireRoomVideoInputReady: true } },
    {
      dispatchClient,
      roomClient,
      dispatchTimeoutMs: 100,
      dispatchPollMs: 1,
      sleep: async () => {
        markVideoWaitStarted();
        await videoGate;
      },
    }
  );

  releaseDispatch();
  const prewarmResult = await prewarm;
  await videoWaitStarted;
  assert.equal(dispatchCalls, 1);
  assert.equal(prewarmResult.dispatchId, 'dispatch-readiness-contract');

  videoReady = true;
  releaseVideo();
  const browserResult = await browserDispatch;

  assert.equal(dispatchCalls, 1);
  assert.equal(browserResult.dispatchId, 'dispatch-readiness-contract');
});

test('shared dispatch token stays active through per-caller readiness waits', async () => {
  const source = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );
  const dispatchSource = source.slice(
    source.indexOf('export async function dispatchRoomSession'),
    source.indexOf('async function waitForRequestedRoomSessionReadiness')
  );
  const readinessSource = source.slice(
    source.indexOf('async function waitForRequestedRoomSessionReadiness'),
    source.indexOf('export async function prewarmRoomSession')
  );

  assert.match(
    dispatchSource,
    /inFlight\.callers === 0[\s\S]*finishRoomSessionDispatch\(inFlight\.session\)/
  );
  assert.doesNotMatch(readinessSource, /beginRoomSessionDispatch|finishRoomSessionDispatch/);
});

test('prewarm completes when the agent session is ready without waiting for optional video input', async () => {
  const agentName = 'frontdesk-browser-agent-readiness';
  let roomCreated = false;
  let workerReady = false;
  let dispatchCreated = false;
  let agentSessionReady = false;
  let visionReady = false;
  const dispatchClient = {
    async createDispatch() {
      assert.equal(workerReady, true);
      dispatchCreated = true;
      return { id: 'dispatch-readiness' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listRooms() {
      return roomCreated ? [{ name: 'voice_assistant_room_readiness' }] : [];
    },
    async createRoom({ name }) {
      roomCreated = true;
      return { name };
    },
    async listParticipants() {
      if (!dispatchCreated) {
        return [];
      }
      return readyParticipants(agentName, { agentSessionReady }).filter(
        (participant) => visionReady || participant.identity !== 'room_video_input'
      );
    },
    async deleteRoom() {},
  };

  const result = await prewarmRoomSession(
    {
      roomName: 'voice_assistant_room_readiness',
      sessionId: 'readiness',
      agentName,
    },
    {
      dispatchClient,
      roomClient,
      waitForAgentWorkerReady: async (requestedAgentName) => {
        assert.equal(roomCreated, true);
        assert.equal(requestedAgentName, agentName);
        workerReady = true;
        return {
          state: 'ready',
          agentName,
          workerId: 'AW_readiness',
          registeredAt: '2026-07-13T00:00:00Z',
          waitedMs: 7,
        };
      },
      dispatchTimeoutMs: 100,
      dispatchPollMs: 1,
      sleep: async () => {
        if (!agentSessionReady) {
          agentSessionReady = true;
        } else {
          visionReady = true;
        }
      },
    }
  );

  assert.equal(roomCreated, true);
  assert.equal(result.workerReadiness.workerId, 'AW_readiness');
  assert.equal(result.dispatch.dispatchId, 'dispatch-readiness');
  assert.deepEqual(result.readiness, {
    agentSessionReady: true,
    audioParticipantReady: true,
    visionParticipantReady: false,
  });
});

test('repeated prewarm reuses ready participants without creating another dispatch', async () => {
  const agentName = 'frontdesk-browser-agent-idempotent';
  let dispatchCalls = 0;
  const dispatchClient = {
    async createDispatch() {
      dispatchCalls += 1;
      return { id: 'unexpected-dispatch' };
    },
    async deleteDispatch() {},
  };
  const roomClient = {
    async listRooms() {
      return [{ name: 'voice_assistant_room_idempotent' }];
    },
    async createRoom() {
      throw new Error('room already exists');
    },
    async listParticipants() {
      return readyParticipants(agentName);
    },
    async deleteRoom() {},
  };
  const request = {
    roomName: 'voice_assistant_room_idempotent',
    sessionId: 'idempotent',
    agentName,
  };
  const dependencies = {
    dispatchClient,
    roomClient,
    waitForAgentWorkerReady: async () => ({ state: 'not_required' }),
  };

  const first = await prewarmRoomSession(request, dependencies);
  const second = await prewarmRoomSession(request, dependencies);

  assert.equal(first.dispatch.alreadyJoined, true);
  assert.equal(second.dispatch.alreadyJoined, true);
  assert.equal(dispatchCalls, 0);
});

test('sandbox worker readiness resolves to the shared workspace marker', () => {
  assert.equal(
    resolveAgentWorkerReadyFile({
      LIVEAVATAR_RUNTIME_MODE: 'sandbox',
      LIVEAVATAR_SANDBOX_WORKSPACE_DATA_DIR: '/workspace/test-data',
    }),
    '/workspace/test-data/logs/sandbox/agent-worker-ready.json'
  );
  assert.equal(resolveAgentWorkerReadyFile({ LIVEAVATAR_RUNTIME_MODE: 'local' }), '');
});

test('worker readiness ignores stale agent markers and waits for the expected worker', async () => {
  let reads = 0;
  const readiness = await waitForAgentWorkerReady('frontdesk-browser-agent-current', {
    readyFile: '/tmp/agent-worker-ready.json',
    timeoutMs: 100,
    pollMs: 1,
    readFile: async () => {
      reads += 1;
      return JSON.stringify({
        version: 1,
        agentName:
          reads === 1 ? 'frontdesk-browser-agent-stale' : 'frontdesk-browser-agent-current',
        workerId: reads === 1 ? 'AW_stale' : 'AW_current',
        registeredAt: '2026-07-13T00:00:00Z',
      });
    },
    sleep: async () => undefined,
  });

  assert.equal(reads, 2);
  assert.equal(readiness.state, 'ready');
  assert.equal(readiness.workerId, 'AW_current');
});

test('worker readiness respects a caller-owned maximum wait budget', async () => {
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    await assert.rejects(
      waitForAgentWorkerReady('frontdesk-browser-agent-timeout', {
        readyFile: '/tmp/agent-worker-ready.json',
        timeoutMs: 100,
        maxWaitMs: 30,
        pollMs: 10,
        readFile: async () => '{}',
        sleep: async (ms) => {
          now += ms;
        },
      }),
      /agent worker did not register before prewarm timeout/
    );
    assert.equal(now, 1_030);
  } finally {
    Date.now = originalNow;
  }
});

test('worker readiness with zero remaining budget does not read or sleep', async () => {
  let reads = 0;
  let sleeps = 0;

  await assert.rejects(
    waitForAgentWorkerReady('frontdesk-browser-agent-no-budget', {
      readyFile: '/tmp/agent-worker-ready.json',
      timeoutMs: 100,
      maxWaitMs: 0,
      pollMs: 10,
      readFile: async () => {
        reads += 1;
        return '{}';
      },
      sleep: async () => {
        sleeps += 1;
      },
    }),
    /agent worker did not register before prewarm timeout/
  );

  assert.equal(reads, 0);
  assert.equal(sleeps, 0);
});
