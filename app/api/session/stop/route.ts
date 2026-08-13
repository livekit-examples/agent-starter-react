import { NextResponse } from 'next/server';
import { AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { access, open } from 'node:fs/promises';
import path from 'node:path';
import { type AgentWorkerState, readAgentWorkerStateFromLog } from '@/lib/agent-worker-readiness';
import {
  deriveLiveKitRoomName,
  deriveSessionIdFromLiveKitRoomName,
  isValidConnectionRoomId,
} from '@/lib/connection-room-id';
import {
  executeRoomInputStopsSequentially,
  resolveRoomInputStopUrls as resolveConfiguredRoomInputStopUrls,
  resolveLiveKitHttpUrl,
} from '@/lib/session-stop';
import {
  markRoomSessionStopped,
  markRoomSessionStopping,
  waitForRoomSessionDispatchesToFinish,
} from '../session-registry';

const AGENT_DISPATCH_STOP_BARRIER_MS = readPositiveIntEnv('AGENT_DISPATCH_STOP_BARRIER_MS', 2_000);
const AGENT_WORKER_READINESS_POLL_MS = 500;
const AGENT_WORKER_READINESS_TIMEOUT_MS = readPositiveIntEnv(
  'AGENT_WORKER_READINESS_TIMEOUT_MS',
  10_000
);
const AGENT_WORKER_LOG_TAIL_BYTES = readPositiveIntEnv('AGENT_WORKER_LOG_TAIL_BYTES', 256 * 1024);
const ROOM_INPUT_STOP_TIMEOUT_MS = readPositiveIntEnv('ROOM_INPUT_STOP_TIMEOUT_MS', 3_000);

type StopResult = {
  target: string;
  ok: boolean;
  skipped?: boolean;
  fatal?: boolean;
  status?: number;
  error?: string;
  dispatch_ids?: string[];
};

export const runtime = 'nodejs';
export const revalidate = 0;

type StopRequestBody = {
  roomName?: string;
  room_name?: string;
  sessionId?: string;
  session_id?: string;
  wait?: boolean | string | number;
};

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStopInputSource(): string {
  return readStopRoleDevice(
    'INPUT_SOURCE',
    'NEXT_PUBLIC_INPUT_SOURCE',
    'NEXT_PUBLIC_LEXVOICE_DEVICE'
  );
}

function readStopEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value.trim();
    }
  }
  return '';
}

function readStopAgentName(): string {
  const configuredAgentName = readStopEnv(
    'AGENT_NAME',
    'NEXT_PUBLIC_AGENT_NAME',
    'NEXT_PUBLIC_LEXVOICE_AGENT_NAME'
  );
  if (configuredAgentName) {
    return configuredAgentName;
  }

  return `lexvoice-${readStopInputSource() || 'browser'}-agent`;
}

function readStopRoleDevice(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value.trim().toLowerCase();
    }
  }
  return '';
}

function usesBrowserOnlyMixedInput(): boolean {
  return (
    readStopRoleDevice('ROOM_AUDIO_INPUT_DEVICE', 'NEXT_PUBLIC_ROOM_AUDIO_INPUT_DEVICE') ===
      'browser' &&
    readStopRoleDevice('ROOM_VISION_INPUT_DEVICE', 'NEXT_PUBLIC_ROOM_VISION_INPUT_DEVICE') ===
      'browser' &&
    readStopRoleDevice('ROOM_OUTPUT_DEVICE', 'NEXT_PUBLIC_ROOM_OUTPUT_DEVICE') === 'browser'
  );
}

function requestWaitsForRemoteCleanup(body: StopRequestBody): boolean {
  const wait = body.wait;
  if (typeof wait === 'boolean') {
    return wait;
  }
  if (typeof wait === 'number') {
    return wait !== 0;
  }
  if (typeof wait === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(wait.trim().toLowerCase());
  }
  return false;
}

function shouldDeferRemoteSessionCleanup(body: StopRequestBody): boolean {
  if (requestWaitsForRemoteCleanup(body)) {
    return false;
  }
  const inputSource = readStopInputSource();
  return inputSource === 'browser' || (inputSource === 'mixed' && usesBrowserOnlyMixedInput());
}

function shouldWaitForLocalAgentWorkerReadiness(): boolean {
  const inputSource = readStopInputSource();
  if (!inputSource) {
    return false;
  }
  return inputSource !== 'browser' && !(inputSource === 'mixed' && usesBrowserOnlyMixedInput());
}

function shouldStopRoomInput(): boolean {
  return shouldWaitForLocalAgentWorkerReadiness();
}

function resolveRoomInputStopUrls(): string[] {
  if (!shouldStopRoomInput()) {
    return [];
  }

  return resolveConfiguredRoomInputStopUrls({
    inputSource: readStopInputSource(),
    audioInputDevice: readStopRoleDevice(
      'ROOM_AUDIO_INPUT_DEVICE',
      'NEXT_PUBLIC_ROOM_AUDIO_INPUT_DEVICE'
    ),
    visionInputDevice: readStopRoleDevice(
      'ROOM_VISION_INPUT_DEVICE',
      'NEXT_PUBLIC_ROOM_VISION_INPUT_DEVICE'
    ),
    videoProcessorUrl: readStopEnv('VIDEO_PROCESSOR_URL'),
    edgeMediaUrl: readStopEnv('EDGE_MEDIA_URL'),
  });
}

function resolveLocalAgentWorkerLogPath(): string {
  const runLogDir = process.env.LEXVOICE_RUN_LOG_DIR?.trim();
  return runLogDir ? path.join(runLogDir, 'live.log') : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readAgentWorkerStateFromLocalLog(
  logPath: string,
  agentName: string
): Promise<AgentWorkerState> {
  const source = await readFileTail(logPath, AGENT_WORKER_LOG_TAIL_BYTES);
  return readAgentWorkerStateFromLog(source, agentName);
}

async function readFileTail(filePath: string, maxBytes: number): Promise<string> {
  const file = await open(filePath, 'r');
  try {
    const stat = await file.stat();
    const byteLength = Math.min(stat.size, maxBytes);
    const start = Math.max(0, stat.size - byteLength);
    const buffer = Buffer.alloc(byteLength);
    const { bytesRead } = await file.read(buffer, 0, byteLength, start);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await file.close();
  }
}

async function waitForLocalAgentWorkerReadiness(): Promise<StopResult> {
  if (!shouldWaitForLocalAgentWorkerReadiness()) {
    return { target: 'agent_worker_readiness', ok: true, skipped: true };
  }

  const logPath = resolveLocalAgentWorkerLogPath();
  const agentName = readStopAgentName();
  if (!logPath || !(await fileExists(logPath))) {
    return { target: 'agent_worker_readiness', ok: true, skipped: true };
  }

  const deadline = Date.now() + AGENT_WORKER_READINESS_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    const state = await readAgentWorkerStateFromLocalLog(logPath, agentName);
    if (state === 'available') {
      return { target: 'agent_worker_readiness', ok: true };
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }
    await sleep(Math.min(AGENT_WORKER_READINESS_POLL_MS, remainingMs));
  }

  return {
    target: 'agent_worker_readiness',
    ok: true,
    skipped: true,
    error: 'timeout',
  };
}

async function deleteLiveKitRoom(roomName: string): Promise<StopResult> {
  const liveKitHttpUrl = resolveLiveKitHttpUrl(process.env.LIVEKIT_URL);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!liveKitHttpUrl || !apiKey || !apiSecret) {
    return { target: 'livekit_room', ok: true, skipped: true };
  }

  try {
    const roomService = new RoomServiceClient(liveKitHttpUrl, apiKey, apiSecret);
    await roomService.deleteRoom(roomName);
    return { target: 'livekit_room', ok: true };
  } catch (error) {
    return {
      target: 'livekit_room',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function cancelPendingDispatches(
  roomName: string,
  dispatchIds: string[]
): Promise<StopResult> {
  const liveKitHttpUrl = resolveLiveKitHttpUrl(process.env.LIVEKIT_URL);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!liveKitHttpUrl || !apiKey || !apiSecret || dispatchIds.length === 0) {
    return {
      target: 'agent_dispatch',
      ok: true,
      skipped: dispatchIds.length === 0,
      dispatch_ids: dispatchIds,
    };
  }

  const dispatchClient = new AgentDispatchClient(liveKitHttpUrl, apiKey, apiSecret);
  await Promise.all(
    dispatchIds.map(async (dispatchId) => {
      try {
        await dispatchClient.deleteDispatch(dispatchId, roomName);
      } catch {
        // The dispatch may already have been consumed, deleted by retry cleanup, or cancelled by LiveKit.
      }
    })
  );

  return {
    target: 'agent_dispatch',
    ok: true,
    dispatch_ids: dispatchIds,
  };
}

async function waitForPendingDispatches(roomName: string, sessionId: string): Promise<StopResult> {
  await waitForRoomSessionDispatchesToFinish(roomName, sessionId, AGENT_DISPATCH_STOP_BARRIER_MS);
  return { target: 'agent_dispatch_barrier', ok: true };
}

async function postRoomInputStop(
  stopUrl: string,
  roomName: string,
  sessionId: string
): Promise<StopResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROOM_INPUT_STOP_TIMEOUT_MS);
  try {
    const response = await fetch(stopUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name: roomName, session_id: sessionId }),
      signal: controller.signal,
    });

    if (response.ok) {
      return { target: 'room_input', ok: true, status: response.status };
    }

    return {
      target: 'room_input',
      ok: false,
      fatal: false,
      status: response.status,
      error: `room-input stop returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      target: 'room_input',
      ok: false,
      fatal: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function stopRoomInput(roomName: string, sessionId: string): Promise<StopResult[]> {
  let stopUrls: string[];
  try {
    stopUrls = resolveRoomInputStopUrls();
  } catch (error) {
    return [
      {
        target: 'room_input_configuration',
        ok: false,
        fatal: true,
        error: error instanceof Error ? error.message : String(error),
      },
    ];
  }
  if (stopUrls.length === 0) {
    return [{ target: 'room_input', ok: true, skipped: true }];
  }

  return executeRoomInputStopsSequentially(stopUrls, (stopUrl) =>
    postRoomInputStop(stopUrl, roomName, sessionId)
  );
}

async function runRemoteSessionCleanup(
  roomName: string,
  sessionId: string,
  dispatchResult: StopResult,
  dispatchIds: string[]
): Promise<{ results: StopResult[]; failures: StopResult[] }> {
  const dispatchBarrierResult = await waitForPendingDispatches(roomName, sessionId);
  const roomInputResults = await stopRoomInput(roomName, sessionId);
  const liveKitRoomResult = await deleteLiveKitRoom(roomName);
  const agentWorkerReadinessResult = await waitForLocalAgentWorkerReadiness();
  const cleanupResults = [
    dispatchBarrierResult,
    ...roomInputResults,
    liveKitRoomResult,
    agentWorkerReadinessResult,
  ];
  const results = [
    {
      target: 'session_registry',
      ok: true,
      dispatch_ids: dispatchIds,
    },
    dispatchResult,
    ...cleanupResults,
  ];
  const failures = results.filter(
    (result) => !result.ok && !result.skipped && result.fatal !== false
  );
  const bestEffortFailures = results.filter(
    (result) => !result.ok && !result.skipped && result.fatal === false
  );
  console.info('agent session remote cleanup completed', {
    roomName,
    sessionId,
    results,
    failures,
    bestEffortFailures,
  });
  markRoomSessionStopped(roomName, sessionId);
  return { results, failures };
}

export async function POST(req: Request) {
  let body: StopRequestBody;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requestedRoomName = (body.roomName || body.room_name || '').trim();
  const requestedSessionId = (body.sessionId || body.session_id || '').trim();
  if (requestedSessionId && !isValidConnectionRoomId(requestedSessionId)) {
    return NextResponse.json(
      { status: 'error', error: 'valid sessionId is required' },
      { status: 400 }
    );
  }

  const sessionId = requestedSessionId || deriveSessionIdFromLiveKitRoomName(requestedRoomName);
  const roomName = sessionId ? deriveLiveKitRoomName(sessionId) : requestedRoomName;
  if (!roomName) {
    return NextResponse.json({ status: 'error', error: 'roomName is required' }, { status: 400 });
  }

  const stoppingSession = markRoomSessionStopping(roomName, sessionId);
  const dispatchResult = await cancelPendingDispatches(roomName, stoppingSession.dispatchIds);
  if (shouldDeferRemoteSessionCleanup(body)) {
    void runRemoteSessionCleanup(roomName, sessionId, dispatchResult, stoppingSession.dispatchIds)
      .then(({ failures }) => {
        if (failures.length > 0) {
          console.error('deferred agent session stop completed with failures', {
            roomName,
            sessionId,
            failures,
          });
        }
      })
      .catch((error) => {
        console.error('deferred agent session stop failed', {
          roomName,
          sessionId,
          error,
        });
      });

    return NextResponse.json(
      {
        status: 'stopping',
        deferred: true,
        roomName,
        sessionId,
        results: [
          {
            target: 'session_registry',
            ok: true,
            dispatch_ids: stoppingSession.dispatchIds,
          },
          dispatchResult,
          { target: 'remote_cleanup', ok: true, status: 202 },
        ],
      },
      { status: 202 }
    );
  }

  const { results, failures } = await runRemoteSessionCleanup(
    roomName,
    sessionId,
    dispatchResult,
    stoppingSession.dispatchIds
  );
  return NextResponse.json(
    {
      status: failures.length === 0 ? 'stopped' : 'partial',
      deferred: false,
      roomName,
      sessionId,
      results,
    },
    { status: failures.length === 0 ? 200 : 502 }
  );
}
