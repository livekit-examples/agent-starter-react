import { AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { type ParticipantInfo } from '@livekit/protocol';
import {
  type ReusableAgentParticipantOptions,
  findReusableAgentParticipant as findReusableAgentParticipantInList,
  summarizePrewarmReadiness,
} from '@/lib/session-dispatch-readiness';
import { resolveLiveKitHttpUrl } from '@/lib/session-stop';
import {
  type AgentWorkerReadiness,
  type WaitForAgentWorkerReadyOptions,
  resolveAgentWorkerReadyTimeoutMs,
  waitForAgentWorkerReady,
} from './agent-worker-readiness';
import {
  type RoomSessionToken,
  beginRoomSessionDispatch,
  finishRoomSessionDispatch,
  isRoomSessionCancelled,
  markRoomSessionRunning,
  registerRoomSessionDispatchId,
} from './session-registry';

type DispatchClient = Pick<AgentDispatchClient, 'createDispatch' | 'deleteDispatch'>;
type RoomClient = Pick<
  RoomServiceClient,
  'createRoom' | 'deleteRoom' | 'listParticipants' | 'listRooms'
>;

type DispatchDependencies = {
  dispatchClient?: DispatchClient;
  roomClient?: RoomClient;
  dispatchTimeoutMs?: number;
  dispatchDeadlineMs?: number;
  dispatchRetryMs?: number;
  dispatchPollMs?: number;
  sleep?: (ms: number) => Promise<unknown>;
  waitForAgentWorkerReady?: (
    agentName: string,
    options?: Pick<WaitForAgentWorkerReadyOptions, 'maxWaitMs'>
  ) => Promise<AgentWorkerReadiness>;
};

export type DispatchRoomSessionRequest = {
  roomName: string;
  sessionId: string;
  agentName: string;
  readiness?: ReusableAgentParticipantOptions;
};

export class RoomSessionCancelledError extends Error {
  constructor(session: RoomSessionToken) {
    super(
      `room session was cancelled for sessionId=${session.sessionId} roomName=${session.roomName}`
    );
    this.name = 'RoomSessionCancelledError';
  }
}

type InFlightDispatch = {
  operation: Promise<Record<string, unknown>>;
  session: RoomSessionToken;
  callers: number;
  deadline: { value: number };
};

type InFlightDispatches = Map<string, InFlightDispatch>;

const globalForInFlightDispatches = globalThis as typeof globalThis & {
  __liveavatarInFlightDispatches?: InFlightDispatches;
};

// Process-local like session-registry; globalThis keeps dispatch de-duplication and
// deadline extensions shared when Next.js loads this service in multiple chunks.
const inFlightDispatches =
  globalForInFlightDispatches.__liveavatarInFlightDispatches ??
  (globalForInFlightDispatches.__liveavatarInFlightDispatches = new Map());
const DEFAULT_AGENT_DISPATCH_TIMEOUT_MS = 30_000;
const DEFAULT_PREWARM_TOTAL_TIMEOUT_MS = 45_000;

export type PrewarmPhase = 'room' | 'worker_readiness' | 'dispatch_readiness';

export type PrewarmTimings = {
  totalPrewarmMs: number;
  roomEnsureMs: number;
  workerReadyWaitMs: number;
  dispatchReadinessMs: number;
};

export type PrewarmFailureTimings = Partial<PrewarmTimings> &
  Pick<PrewarmTimings, 'totalPrewarmMs'>;

export class PrewarmRoomSessionError extends Error {
  readonly phase: PrewarmPhase;
  readonly timings: PrewarmFailureTimings;
  readonly retryReady?: Promise<void>;

  constructor(
    phase: PrewarmPhase,
    timings: PrewarmFailureTimings,
    cause: unknown,
    retryReady?: Promise<void>
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`prewarm failed during ${phase}: ${detail}`, { cause });
    this.name = 'PrewarmRoomSessionError';
    this.phase = phase;
    this.timings = { ...timings };
    this.retryReady = retryReady;
  }
}

class PrewarmDeadlineError extends Error {
  readonly settled: Promise<void>;

  constructor(message: string, settled: Promise<void>) {
    super(message);
    this.name = 'PrewarmDeadlineError';
    this.settled = settled;
  }
}

export async function dispatchRoomSession(
  request: DispatchRoomSessionRequest,
  dependencies: DispatchDependencies = {}
) {
  const startedAt = Date.now();
  const callerDeadline = resolveDispatchDeadline(dependencies, startedAt);
  if (callerDeadline <= startedAt) {
    throw new Error('agent dispatch deadline expired before dispatch');
  }
  const key = `${request.sessionId}\u0000${request.roomName}\u0000${request.agentName}`;
  let inFlight = inFlightDispatches.get(key);
  if (!inFlight) {
    const clients = resolveClients(dependencies);
    const deadline = { value: callerDeadline };
    // Dispatch creation is shared by identity. Each caller waits for its own
    // readiness contract below, while the shared operation keeps the longest
    // timeout budget of all concurrent callers.
    const session = beginRoomSessionDispatch(
      request.roomName,
      request.sessionId,
      request.agentName
    );
    inFlight = {
      operation: runRoomSessionDispatch(
        { ...request, readiness: {} },
        { ...dependencies, ...clients },
        session,
        () => deadline.value
      ),
      session,
      callers: 0,
      deadline,
    };
    inFlightDispatches.set(key, inFlight);
  } else {
    inFlight.deadline.value = Math.max(inFlight.deadline.value, callerDeadline);
  }

  inFlight.callers += 1;
  try {
    const dispatch = await inFlight.operation;
    return await waitForRequestedRoomSessionReadiness(
      request,
      dependencies,
      dispatch,
      inFlight.session,
      startedAt
    );
  } finally {
    inFlight.callers -= 1;
    if (inFlight.callers === 0 && inFlightDispatches.get(key) === inFlight) {
      finishRoomSessionDispatch(inFlight.session);
      inFlightDispatches.delete(key);
    }
  }
}

async function waitForRequestedRoomSessionReadiness(
  request: DispatchRoomSessionRequest,
  dependencies: DispatchDependencies,
  dispatch: Record<string, unknown>,
  session: RoomSessionToken,
  startedAt: number
) {
  const readiness = request.readiness ?? {};
  if (
    readiness.requireAgentSessionReady !== true &&
    readiness.requireRoomInputParticipantsReady !== true &&
    readiness.requireRoomVideoInputReady !== true
  ) {
    return dispatch;
  }

  const clients = resolveClients(dependencies);
  const deadline = resolveDispatchDeadline(dependencies, startedAt);
  const participant = await waitForReusableAgentParticipant(
    clients.roomClient,
    request.roomName,
    request.agentName,
    readiness,
    () => deadline,
    dependencies.dispatchPollMs || readPositiveIntEnv('AGENT_DISPATCH_POLL_MS', 200),
    session,
    dependencies.sleep || sleep
  );
  if (!participant) {
    throw new Error('agent session and required room inputs did not become ready');
  }
  throwIfSessionCancelled(session);
  markRoomSessionRunning(session);
  return {
    ...dispatch,
    agentParticipant: summarizeAgentParticipant(participant),
  };
}

export async function prewarmRoomSession(
  request: Omit<DispatchRoomSessionRequest, 'readiness'>,
  dependencies: DispatchDependencies = {}
) {
  const prewarmStartedAt = Date.now();
  const prewarmTimeoutMs =
    dependencies.dispatchTimeoutMs ||
    readPositiveIntEnv('LIVEAVATAR_PREWARM_TOTAL_TIMEOUT_MS', DEFAULT_PREWARM_TOTAL_TIMEOUT_MS);
  const prewarmDeadline = prewarmStartedAt + prewarmTimeoutMs;
  const prewarmAbortController = new AbortController();
  const completedTimings: Partial<PrewarmTimings> = {};

  const roomPhaseStartedAt = Date.now();
  let roomAndClients: {
    room: Awaited<ReturnType<typeof ensureLiveKitRoom>>;
    clients: ReturnType<typeof resolveClients>;
  };
  try {
    roomAndClients = await runWithinPrewarmDeadline(
      prewarmDeadline,
      'room',
      async () => {
        const clients = resolveClients(dependencies);
        const room = await ensureLiveKitRoom(
          clients.roomClient,
          request.roomName,
          prewarmDeadline,
          prewarmAbortController.signal
        );
        return { clients, room };
      },
      prewarmAbortController
    );
    completedTimings.roomEnsureMs = elapsedSince(roomPhaseStartedAt);
  } catch (error) {
    throw buildPrewarmPhaseError(
      'room',
      prewarmStartedAt,
      roomPhaseStartedAt,
      completedTimings,
      error
    );
  }

  const workerPhaseStartedAt = Date.now();
  let workerReadiness: AgentWorkerReadiness;
  try {
    const workerMaxWaitMs = Math.min(
      resolveAgentWorkerReadyTimeoutMs(),
      remainingDispatchTime(prewarmDeadline)
    );
    workerReadiness = await runWithinPrewarmDeadline(
      prewarmDeadline,
      'worker_readiness',
      () =>
        (dependencies.waitForAgentWorkerReady || waitForAgentWorkerReady)(request.agentName, {
          maxWaitMs: workerMaxWaitMs,
        }),
      prewarmAbortController
    );
    completedTimings.workerReadyWaitMs = elapsedSince(workerPhaseStartedAt);
  } catch (error) {
    throw buildPrewarmPhaseError(
      'worker_readiness',
      prewarmStartedAt,
      workerPhaseStartedAt,
      completedTimings,
      error
    );
  }

  const dispatchPhaseStartedAt = Date.now();
  let dispatchAndParticipants: {
    dispatch: Awaited<ReturnType<typeof dispatchRoomSession>>;
    participants: ParticipantInfo[];
  };
  try {
    dispatchAndParticipants = await runWithinPrewarmDeadline(
      prewarmDeadline,
      'dispatch_readiness',
      async () => {
        const dispatch = await dispatchRoomSession(
          {
            ...request,
            readiness: {
              requireAgentSessionReady: true,
            },
          },
          {
            ...dependencies,
            ...roomAndClients.clients,
            dispatchDeadlineMs: prewarmDeadline,
          }
        );
        throwIfPrewarmUnavailable(
          prewarmDeadline,
          prewarmAbortController.signal,
          'final readiness check'
        );
        const participants = await roomAndClients.clients.roomClient.listParticipants(
          request.roomName
        );
        throwIfPrewarmUnavailable(
          prewarmDeadline,
          prewarmAbortController.signal,
          'final readiness check'
        );
        return { dispatch, participants };
      },
      prewarmAbortController
    );
    completedTimings.dispatchReadinessMs = elapsedSince(dispatchPhaseStartedAt);
  } catch (error) {
    throw buildPrewarmPhaseError(
      'dispatch_readiness',
      prewarmStartedAt,
      dispatchPhaseStartedAt,
      completedTimings,
      error
    );
  }

  const timings: PrewarmTimings = {
    totalPrewarmMs: elapsedSince(prewarmStartedAt),
    roomEnsureMs: completedTimings.roomEnsureMs,
    workerReadyWaitMs: completedTimings.workerReadyWaitMs,
    dispatchReadinessMs: completedTimings.dispatchReadinessMs,
  };
  return {
    room: { name: roomAndClients.room.name },
    workerReadiness,
    dispatch: dispatchAndParticipants.dispatch,
    readiness: summarizePrewarmReadiness(dispatchAndParticipants.participants, request.agentName),
    timings,
  };
}

async function runRoomSessionDispatch(
  request: DispatchRoomSessionRequest,
  dependencies: DispatchDependencies,
  session: RoomSessionToken,
  getDeadline: () => number
) {
  const { roomName, sessionId, agentName, readiness = {} } = request;
  const clients = resolveClients(dependencies);
  const dispatch = await createAgentDispatchWithRetry(
    clients.dispatchClient,
    clients.roomClient,
    roomName,
    agentName,
    session,
    readiness,
    {
      timeoutMs: dependencies.dispatchTimeoutMs,
      getDeadline,
      retryMs: dependencies.dispatchRetryMs,
      pollMs: dependencies.dispatchPollMs,
      sleep: dependencies.sleep,
    }
  );
  console.info('agent session dispatch completed', {
    roomName,
    sessionId,
    agentName,
    dispatch,
  });
  return dispatch;
}

function resolveClients(dependencies: DispatchDependencies): {
  dispatchClient: DispatchClient;
  roomClient: RoomClient;
} {
  if (dependencies.dispatchClient && dependencies.roomClient) {
    return {
      dispatchClient: dependencies.dispatchClient,
      roomClient: dependencies.roomClient,
    };
  }

  const liveKitHttpUrl = resolveLiveKitHttpUrl(process.env.LIVEKIT_URL);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!liveKitHttpUrl || !apiKey || !apiSecret) {
    throw new Error('LiveKit API configuration is required');
  }

  return {
    dispatchClient:
      dependencies.dispatchClient || new AgentDispatchClient(liveKitHttpUrl, apiKey, apiSecret),
    roomClient: dependencies.roomClient || new RoomServiceClient(liveKitHttpUrl, apiKey, apiSecret),
  };
}

async function ensureLiveKitRoom(
  roomClient: RoomClient,
  roomName: string,
  deadline: number,
  abortSignal: AbortSignal
) {
  const existing = await roomClient.listRooms([roomName]);
  throwIfPrewarmUnavailable(deadline, abortSignal, 'room ensure');
  if (existing.length > 0) {
    return existing[0];
  }

  try {
    const created = await roomClient.createRoom({ name: roomName });
    if (abortSignal.aborted || remainingDispatchTime(deadline) <= 0) {
      await deleteLiveKitRoomQuietly(roomClient, roomName);
      throw new Error('room ensure deadline expired after room creation');
    }
    return created;
  } catch (error) {
    throwIfPrewarmUnavailable(deadline, abortSignal, 'room ensure');
    const raced = await roomClient.listRooms([roomName]);
    throwIfPrewarmUnavailable(deadline, abortSignal, 'room ensure');
    if (raced.length > 0) {
      return raced[0];
    }
    throw error;
  }
}

async function createAgentDispatchWithRetry(
  dispatchClient: DispatchClient,
  roomClient: RoomClient,
  roomName: string,
  agentName: string,
  session: RoomSessionToken,
  reusableAgentOptions: ReusableAgentParticipantOptions,
  options: {
    timeoutMs?: number;
    getDeadline?: () => number;
    retryMs?: number;
    pollMs?: number;
    sleep?: (ms: number) => Promise<unknown>;
  }
) {
  const timeoutMs =
    options.timeoutMs ||
    readPositiveIntEnv('AGENT_DISPATCH_TIMEOUT_MS', DEFAULT_AGENT_DISPATCH_TIMEOUT_MS);
  const fixedDeadline = Date.now() + timeoutMs;
  const getDeadline = options.getDeadline || (() => fixedDeadline);
  const retryMs = options.retryMs || readPositiveIntEnv('AGENT_DISPATCH_RETRY_MS', 500);
  const pollMs = options.pollMs || readPositiveIntEnv('AGENT_DISPATCH_POLL_MS', 200);
  const sleepFn = options.sleep || sleep;
  let lastError: unknown;
  let attempts = 0;
  let dispatchId = '';

  do {
    try {
      throwIfSessionCancelled(session);
      throwIfDeadlineExpired(getDeadline(), 'agent dispatch');
      const alreadyJoined = await findReusableAgentParticipant(
        roomClient,
        roomName,
        agentName,
        reusableAgentOptions
      );
      throwIfSessionCancelled(session);
      throwIfDeadlineExpired(getDeadline(), 'agent dispatch');
      if (alreadyJoined) {
        markRoomSessionRunning(session);
        return {
          attempts,
          alreadyJoined: true,
          agentParticipant: summarizeAgentParticipant(alreadyJoined),
        };
      }

      if (!dispatchId) {
        throwIfDeadlineExpired(getDeadline(), 'agent dispatch creation');
        const dispatch = await dispatchClient.createDispatch(roomName, agentName);
        attempts += 1;
        dispatchId = dispatch.id;
        registerRoomSessionDispatchId(session, dispatchId);
        throwIfDeadlineExpired(getDeadline(), 'agent dispatch creation');
      }

      if (isRoomSessionCancelled(session)) {
        await deleteDispatchQuietly(dispatchClient, dispatchId, roomName);
        await deleteLiveKitRoomQuietly(roomClient, roomName);
        throw new RoomSessionCancelledError(session);
      }

      const agentParticipant = await waitForReusableAgentParticipant(
        roomClient,
        roomName,
        agentName,
        reusableAgentOptions,
        getDeadline,
        pollMs,
        session,
        sleepFn
      );
      if (agentParticipant) {
        throwIfSessionCancelled(session);
        markRoomSessionRunning(session);
        return {
          attempts,
          dispatchId,
          agentParticipant: summarizeAgentParticipant(agentParticipant),
        };
      }

      lastError = new Error('agent and required room inputs did not become ready');
    } catch (error) {
      if (error instanceof RoomSessionCancelledError) {
        throw error;
      }
      lastError = error;
      const waitMs = Math.min(
        calculateDispatchRetryDelay(attempts, retryMs),
        remainingDispatchTime(getDeadline())
      );
      if (waitMs > 0) {
        await sleepFn(waitMs);
      }
    }
  } while (Date.now() < getDeadline());

  await deleteDispatchQuietly(dispatchClient, dispatchId, roomName);
  throw new Error(
    `agent dispatch failed for ${agentName} after ${attempts} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function resolveDispatchDeadline(dependencies: DispatchDependencies, startedAt: number) {
  if (
    dependencies.dispatchDeadlineMs !== undefined &&
    Number.isFinite(dependencies.dispatchDeadlineMs)
  ) {
    return dependencies.dispatchDeadlineMs;
  }
  const timeoutMs =
    dependencies.dispatchTimeoutMs ||
    readPositiveIntEnv('AGENT_DISPATCH_TIMEOUT_MS', DEFAULT_AGENT_DISPATCH_TIMEOUT_MS);
  return startedAt + timeoutMs;
}

function remainingDispatchTime(deadline: number) {
  return Math.max(0, deadline - Date.now());
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function buildPrewarmPhaseError(
  phase: PrewarmPhase,
  prewarmStartedAt: number,
  phaseStartedAt: number,
  completedTimings: Partial<PrewarmTimings>,
  cause: unknown
) {
  const phaseTimingKey: Record<
    PrewarmPhase,
    'roomEnsureMs' | 'workerReadyWaitMs' | 'dispatchReadinessMs'
  > = {
    room: 'roomEnsureMs',
    worker_readiness: 'workerReadyWaitMs',
    dispatch_readiness: 'dispatchReadinessMs',
  };
  return new PrewarmRoomSessionError(
    phase,
    {
      ...completedTimings,
      [phaseTimingKey[phase]]: elapsedSince(phaseStartedAt),
      totalPrewarmMs: elapsedSince(prewarmStartedAt),
    },
    cause,
    cause instanceof PrewarmDeadlineError ? cause.settled : undefined
  );
}

async function runWithinPrewarmDeadline<T>(
  deadline: number,
  phase: PrewarmPhase,
  operation: () => Promise<T>,
  abortController: AbortController
): Promise<T> {
  const remainingMs = remainingDispatchTime(deadline);
  if (remainingMs <= 0) {
    abortController.abort();
    throw new Error(`prewarm deadline expired before ${phase}`);
  }

  const operationPromise = Promise.resolve().then(operation);
  const settled = operationPromise.then(
    () => undefined,
    () => undefined
  );
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new PrewarmDeadlineError(`prewarm deadline expired during ${phase}`, settled));
    }, remainingMs);
  });
  try {
    const result = await Promise.race([operationPromise, timeout]);
    if (Date.now() >= deadline) {
      abortController.abort();
      throw new PrewarmDeadlineError(`prewarm deadline expired during ${phase}`, settled);
    }
    return result;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function calculateDispatchRetryDelay(attempts: number, retryMs: number) {
  const multiplier = 2 ** Math.max(0, attempts - 1);
  return retryMs * multiplier;
}

async function waitForReusableAgentParticipant(
  roomClient: RoomClient,
  roomName: string,
  agentName: string,
  readiness: ReusableAgentParticipantOptions,
  getDeadline: () => number,
  pollMs: number,
  session: RoomSessionToken,
  sleepFn: (ms: number) => Promise<unknown>
) {
  while (true) {
    throwIfSessionCancelled(session);
    if (remainingDispatchTime(getDeadline()) <= 0) {
      return null;
    }
    const participant = await findReusableAgentParticipant(roomClient, roomName, agentName, {
      allowAnonymousLiveKitAgentFallback: true,
      ...readiness,
    });
    if (remainingDispatchTime(getDeadline()) <= 0) {
      return null;
    }
    if (participant) {
      throwIfSessionCancelled(session);
      return participant;
    }
    const waitMs = Math.min(pollMs, remainingDispatchTime(getDeadline()));
    if (waitMs <= 0) {
      return null;
    }
    await sleepFn(waitMs);
  }
}

function throwIfDeadlineExpired(deadline: number, phase: string): void {
  if (remainingDispatchTime(deadline) <= 0) {
    throw new Error(`${phase} deadline expired`);
  }
}

function throwIfPrewarmUnavailable(
  deadline: number,
  abortSignal: AbortSignal,
  phase: string
): void {
  if (abortSignal.aborted) {
    throw new Error(`${phase} cancelled after prewarm timeout`);
  }
  throwIfDeadlineExpired(deadline, phase);
}

async function findReusableAgentParticipant(
  roomClient: RoomClient,
  roomName: string,
  agentName: string,
  options: ReusableAgentParticipantOptions = {}
) {
  const participants = await roomClient.listParticipants(roomName);
  return findReusableAgentParticipantInList(participants, agentName, options);
}

function summarizeAgentParticipant(participant: ParticipantInfo | null) {
  return participant ? { identity: participant.identity } : null;
}

async function deleteDispatchQuietly(
  dispatchClient: DispatchClient,
  dispatchId: string,
  roomName: string
) {
  if (!dispatchId) {
    return;
  }
  try {
    await dispatchClient.deleteDispatch(dispatchId, roomName);
  } catch {
    // The dispatch may already have been consumed or cleaned up by LiveKit.
  }
}

async function deleteLiveKitRoomQuietly(roomClient: RoomClient, roomName: string) {
  try {
    await roomClient.deleteRoom(roomName);
  } catch {
    // The room may already be gone because /stop won the race.
  }
}

function throwIfSessionCancelled(session: RoomSessionToken): void {
  if (isRoomSessionCancelled(session)) {
    throw new RoomSessionCancelledError(session);
  }
}

function readPositiveIntEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
