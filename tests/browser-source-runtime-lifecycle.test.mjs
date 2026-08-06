import assert from 'node:assert/strict';
import { test } from 'node:test';

const { detachCurrentRuntime, isCurrentRuntime, runOwnedRuntimeStart, stopOwnedRuntime } =
  await import('../lib/browser-source-runtime-lifecycle.ts');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

for (const settlement of ['resolve', 'reject']) {
  test(`stopped runtime A cannot continue its start pipeline when a pending stage ${settlement}s after runtime B starts`, async () => {
    const slot = { current: null };
    const pendingStage = deferred();
    const events = [];
    const runtimeA = { id: 'A', stopPromise: null };
    const runtimeB = { id: 'B', stopPromise: null };
    const stopRuntime = (runtime) => {
      if (!runtime.stopPromise) {
        runtime.stopPromise = Promise.resolve().then(() => events.push(`stop:${runtime.id}`));
      }
      return runtime.stopPromise;
    };

    slot.current = runtimeA;
    const startA = runOwnedRuntimeStart(slot, runtimeA, stopRuntime, async (stage) => {
      await stage(async () => {
        events.push('create-or-publish:A');
        return pendingStage.promise;
      });
      events.push('reconcile:A');
      await stage(async () => events.push('adapter:A'));
    });
    await Promise.resolve();

    const detachedA = detachCurrentRuntime(slot);
    assert.equal(detachedA, runtimeA);
    await stopRuntime(detachedA);
    slot.current = runtimeB;
    if (settlement === 'resolve') {
      pendingStage.resolve();
    } else {
      pendingStage.reject(new Error('late publish failure'));
    }

    await assert.rejects(startA, (error) => error?.name === 'AbortError');
    assert.equal(slot.current, runtimeB);
    assert.equal(runtimeB.stopPromise, null);
    assert.deepEqual(events, ['create-or-publish:A', 'stop:A']);
  });
}

test('a late failure from stopped runtime A cannot detach or stop replacement runtime B', async () => {
  const slot = { current: null };
  const stopped = [];
  const lateFailure = deferred();
  const runtimeA = { id: 'A', stopped: false };
  const runtimeB = { id: 'B', stopped: false };
  const stopRuntime = async (runtime) => {
    if (runtime.stopped) return;
    runtime.stopped = true;
    stopped.push(runtime.id);
  };

  slot.current = runtimeA;
  const startA = (async () => {
    try {
      await lateFailure.promise;
    } catch (error) {
      await stopOwnedRuntime(slot, runtimeA, stopRuntime);
      throw error;
    }
  })();

  const detachedA = detachCurrentRuntime(slot);
  assert.equal(detachedA, runtimeA);
  await stopRuntime(detachedA);
  slot.current = runtimeB;
  lateFailure.reject(new Error('A start failed late'));
  await assert.rejects(startA, /A start failed late/);

  assert.equal(slot.current, runtimeB);
  assert.equal(isCurrentRuntime(slot, runtimeA), false);
  assert.equal(isCurrentRuntime(slot, runtimeB), true);
  assert.equal(runtimeB.stopped, false);
  assert.deepEqual(stopped, ['A']);
});

test('public stop atomically detaches the current runtime before asynchronous cleanup', async () => {
  const slot = { current: { id: 'A' } };

  const detached = detachCurrentRuntime(slot);

  assert.deepEqual(detached, { id: 'A' });
  assert.equal(slot.current, null);
});
