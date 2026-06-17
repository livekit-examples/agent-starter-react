let pendingStopPromise: Promise<void> = Promise.resolve();
let pendingStartPromise: Promise<void> = Promise.resolve();
let stopRequestPending = false;
let stopRequestPendingCount = 0;
const stopListeners = new Set<() => void>();
const DEFAULT_STOP_SETTLE_MS = 0;

type ActiveAgentSession = {
  roomName: string;
  sessionId: string;
  abortController: AbortController;
  dispatchPromise: Promise<void>;
};

type AgentSessionStopOptions = {
  waitForRemote?: boolean;
};

let activeStart: ActiveAgentSession | null = null;

function readStopSettleMs(): number {
  const globals = globalThis as typeof globalThis & {
    __LEXVOICE_SESSION_STOP_SETTLE_MS__?: unknown;
  };
  const override = globals.__LEXVOICE_SESSION_STOP_SETTLE_MS__;

  if (typeof override === 'number' && Number.isFinite(override) && override >= 0) {
    return override;
  }

  return DEFAULT_STOP_SETTLE_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function setStopRequestPending(nextPending: boolean) {
  if (stopRequestPending === nextPending) {
    return;
  }

  stopRequestPending = nextPending;
  stopListeners.forEach((listener) => listener());
}

function beginStopRequestPending() {
  stopRequestPendingCount += 1;
  setStopRequestPending(true);
}

function endStopRequestPending() {
  stopRequestPendingCount = Math.max(0, stopRequestPendingCount - 1);
  setStopRequestPending(stopRequestPendingCount > 0);
}

async function sendAgentSessionStop(
  sessionId: string,
  options: AgentSessionStopOptions = {}
): Promise<void> {
  const response = await fetch('/api/session/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, wait: options.waitForRemote }),
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error(`agent session stop failed: ${response.status}`);
  }
}

async function waitForAgentWorkerSettle(): Promise<void> {
  const settleMs = readStopSettleMs();
  if (settleMs <= 0) {
    return;
  }

  await sleep(settleMs);
}

async function sendAgentSessionStopAndSettle(
  sessionId: string,
  options: AgentSessionStopOptions = {}
): Promise<void> {
  try {
    await sendAgentSessionStop(sessionId, options);
  } finally {
    endStopRequestPending();
    await waitForAgentWorkerSettle();
    clearActiveAgentSession(sessionId);
  }
}

function sendAgentSessionStopInBackground(
  sessionId: string,
  options: AgentSessionStopOptions = {}
): void {
  void sendAgentSessionStop(sessionId, options).catch((error: unknown) => {
    console.warn('Failed to stop remote agent session', error);
  });
  clearActiveAgentSession(sessionId);
}

export function waitForAgentSessionStop(): Promise<void> {
  return pendingStopPromise
    .catch(() => undefined)
    .then(() => pendingStartPromise.catch(() => undefined));
}

export function getAgentSessionStopPending(): boolean {
  return stopRequestPending;
}

export function subscribeAgentSessionStop(listener: () => void): () => void {
  stopListeners.add(listener);
  return () => {
    stopListeners.delete(listener);
  };
}

function isExpectedDispatchCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'AgentSessionDispatchCancelledError';
}

function clearActiveAgentSession(sessionId: string): void {
  if (!activeStart) {
    return;
  }
  if (activeStart.sessionId !== sessionId) {
    return;
  }

  activeStart = null;
}

export function beginAgentSessionStart(roomName: string, sessionId: string): AbortSignal {
  const normalizedRoomName = normalize(roomName);
  const normalizedSessionId = normalize(sessionId);
  const abortController = new AbortController();
  pendingStartPromise = Promise.resolve();
  activeStart = {
    roomName: normalizedRoomName,
    sessionId: normalizedSessionId,
    abortController,
    dispatchPromise: Promise.resolve(),
  };
  return abortController.signal;
}

export function registerAgentSessionDispatch(
  roomName: string,
  sessionId: string,
  dispatchPromise: Promise<void>
): void {
  const normalizedRoomName = normalize(roomName);
  const normalizedSessionId = normalize(sessionId);
  if (
    !activeStart ||
    activeStart.roomName !== normalizedRoomName ||
    activeStart.sessionId !== normalizedSessionId
  ) {
    return;
  }

  const settledDispatchPromise = Promise.resolve(dispatchPromise)
    .catch((error: unknown) => {
      if (isExpectedDispatchCancellation(error)) {
        return;
      }
      console.warn('Failed to dispatch agent session', error);
    })
    .then(() => undefined);
  activeStart.dispatchPromise = settledDispatchPromise;
  pendingStartPromise = pendingStartPromise
    .catch(() => undefined)
    .then(() => settledDispatchPromise);
}

export function cancelAgentSessionStart(sessionId?: string | null): void {
  const normalizedSessionId = normalize(sessionId);
  if (!activeStart) {
    return;
  }
  if (normalizedSessionId && activeStart.sessionId !== normalizedSessionId) {
    return;
  }

  activeStart.abortController.abort();
}

export function getActiveAgentSession(): { roomName: string; sessionId: string } | null {
  if (!activeStart) {
    return null;
  }

  return {
    roomName: activeStart.roomName,
    sessionId: activeStart.sessionId,
  };
}

export async function requestAgentSessionStop(
  sessionId?: string | null,
  options: AgentSessionStopOptions = {}
): Promise<void> {
  const normalizedSessionId = normalize(sessionId) || activeStart?.sessionId || '';
  if (!normalizedSessionId) {
    return waitForAgentSessionStop();
  }

  cancelAgentSessionStart(normalizedSessionId);
  clearActiveAgentSession(normalizedSessionId);
  if (options.waitForRemote === false) {
    sendAgentSessionStopInBackground(normalizedSessionId, options);
    return waitForAgentSessionStop();
  }

  beginStopRequestPending();
  const stopPromise = pendingStopPromise
    .catch(() => undefined)
    .then(() => sendAgentSessionStopAndSettle(normalizedSessionId, options));
  pendingStopPromise = stopPromise
    .catch(() => undefined)
    .then(() => pendingStartPromise.catch(() => undefined));
  return stopPromise;
}

export function registerAgentSessionLocalCleanup(cleanupPromise: Promise<unknown>): void {
  beginStopRequestPending();
  const settledCleanupPromise = Promise.resolve(cleanupPromise)
    .catch((error: unknown) => {
      console.warn('Failed to clean up local agent session', error);
    })
    .then(() => undefined)
    .finally(() => {
      endStopRequestPending();
    });
  pendingStopPromise = pendingStopPromise.catch(() => undefined).then(() => settledCleanupPromise);
}
