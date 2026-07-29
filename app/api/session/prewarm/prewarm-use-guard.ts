type PrewarmUseState = 'started' | 'in_progress' | 'completed';
type PrewarmUseStates = Map<string, Exclude<PrewarmUseState, 'started'>>;

const globalForPrewarmUse = globalThis as typeof globalThis & {
  __liveavatarPrewarmUseStates?: PrewarmUseStates;
};

// Process-local like session-registry: deploy one Next.js process or use sticky routing.
// globalThis also keeps one state if that process loads this module in multiple chunks.
// Completed identities remain consumed: Gateway uses a fresh UUID per sandbox session and
// releases the whole sandbox after any ambiguous/failed prewarm response instead of replaying it.
const prewarmUseStates =
  globalForPrewarmUse.__liveavatarPrewarmUseStates ??
  (globalForPrewarmUse.__liveavatarPrewarmUseStates = new Map());

export function buildPrewarmUseKey(sessionId: string, roomName: string, agentName: string) {
  return `${sessionId}\u0000${roomName}\u0000${agentName}`;
}

export function beginPrewarmUse(key: string): PrewarmUseState {
  const state = prewarmUseStates.get(key);
  if (state) {
    return state;
  }

  prewarmUseStates.set(key, 'in_progress');
  return 'started';
}

export function completePrewarmUse(key: string) {
  if (prewarmUseStates.get(key) === 'in_progress') {
    prewarmUseStates.set(key, 'completed');
  }
}

export function failPrewarmUse(key: string) {
  if (prewarmUseStates.get(key) === 'in_progress') {
    prewarmUseStates.delete(key);
  }
}

export function releasePrewarmUseAfterFailure(key: string, error: unknown): void {
  const retryReady =
    error &&
    typeof error === 'object' &&
    'retryReady' in error &&
    error.retryReady &&
    typeof (error.retryReady as PromiseLike<unknown>).then === 'function'
      ? (error.retryReady as PromiseLike<unknown>)
      : undefined;
  if (!retryReady) {
    failPrewarmUse(key);
    return;
  }
  void retryReady.then(
    () => failPrewarmUse(key),
    () => failPrewarmUse(key)
  );
}
