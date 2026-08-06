import assert from 'node:assert/strict';
import { test } from 'node:test';

const { MediaGateExecutor } = await import('../lib/media-gate-executor.ts');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settlesWithin(promise, timeoutMs = 50) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('operation did not settle')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

class FakeClock {
  wall = 1_000;
  monotonic = 10;
  nextTimer = 1;
  timers = new Map();

  setTimeout(callback, delayMs) {
    const handle = this.nextTimer++;
    this.timers.set(handle, {
      callback,
      deadline: this.monotonic + delayMs,
    });
    return handle;
  }

  clearTimeout(handle) {
    this.timers.delete(handle);
  }

  advance(ms) {
    this.wall += ms;
    this.monotonic += ms;
    for (;;) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.deadline <= this.monotonic)
        .sort((left, right) => left[1].deadline - right[1].deadline)[0];
      if (!next) return;
      this.timers.delete(next[0]);
      next[1].callback();
    }
  }
}

class FakeDevice {
  events = [];
  captureActive = true;
  trackPublished = true;
  trackMuted = false;
  nextOpen = null;

  close() {
    this.events.push('close');
    this.trackMuted = true;
  }

  async open() {
    this.events.push('open:start');
    if (this.nextOpen) await this.nextOpen.promise;
    this.trackMuted = false;
    this.events.push('open:done');
  }

  snapshot() {
    return {
      captureActive: this.captureActive,
      trackPublished: this.trackPublished,
      trackMuted: this.trackMuted,
    };
  }
}

function command(overrides = {}) {
  return {
    schema_version: 1,
    type: 'lk.media.control',
    command_id: 'command-1',
    policy_epoch: 'policy-1',
    sequence: 1,
    target_identity: 'browser-1',
    desired_listening: 'open',
    issued_at_unix_ms: 1_000,
    expires_at_unix_ms: 2_000,
    reason: 'face_present',
    ...overrides,
  };
}

function harness(overrides = {}) {
  const clock = new FakeClock();
  const device = new FakeDevice();
  const states = [];
  const destinations = [];
  const publishState = async (controllerIdentity, state) => {
    destinations.push(controllerIdentity);
    states.push(structuredClone(state));
  };
  const executor = new MediaGateExecutor({
    targetIdentity: 'browser-1',
    device,
    publishState,
    uuid: () => 'state-epoch-1',
    nowUnixMs: () => clock.wall,
    nowMonotonicMs: () => clock.monotonic,
    scheduler: clock,
    maxOpenLeaseMs: 500,
    ...overrides,
  });
  return { clock, destinations, device, executor, states };
}

test('starts closed and only publishes after binding an exact controller', async () => {
  const { destinations, device, executor, states } = harness();

  const started = executor.start();
  assert.equal(device.trackMuted, true);
  await started;
  assert.deepEqual(states, []);

  await executor.bindController('agent-1');

  assert.equal(states.length, 1);
  assert.deepEqual(destinations, ['agent-1']);
  assert.deepEqual(states[0], {
    schema_version: 1,
    type: 'lk.media.state',
    target_identity: 'browser-1',
    state_epoch: 'state-epoch-1',
    state_sequence: 1,
    observed_at_unix_ms: 1_000,
    capture_active: true,
    track_published: true,
    track_muted: true,
    user_muted: false,
    blocked_by: ['lease_missing'],
    command_id: null,
    policy_epoch: null,
    command_sequence: null,
    command_status: null,
    error_code: null,
  });
});

test('binds one exact controller and applies targeted open and close commands', async () => {
  const { device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  device.events.length = 0;
  states.length = 0;

  await executor.handleCommand('agent-1', command());
  await executor.handleCommand(
    'agent-1',
    command({
      command_id: 'command-2',
      sequence: 2,
      desired_listening: 'closed',
      reason: 'face_absent',
    })
  );

  assert.deepEqual(device.events, ['open:start', 'open:done', 'close']);
  assert.deepEqual(
    states.map((state) => [
      state.state_sequence,
      state.command_id,
      state.command_status,
      state.track_muted,
    ]),
    [
      [2, 'command-1', 'applied', false],
      [3, 'command-2', 'applied', true],
    ]
  );
});

test('drops commands from another controller or for another target without side effects or ACKs', async () => {
  const { device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  device.events.length = 0;
  states.length = 0;

  await executor.handleCommand('agent-2', command());
  await executor.handleCommand('agent-1', command({ target_identity: 'browser-2' }));

  assert.deepEqual(device.events, []);
  assert.deepEqual(states, []);
  assert.equal(device.trackMuted, true);
});

test('ACKs an exact duplicate without repeating the device side effect', async () => {
  const { device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  device.events.length = 0;
  states.length = 0;

  await executor.handleCommand('agent-1', command());
  await executor.handleCommand('agent-1', command());

  assert.deepEqual(device.events, ['open:start', 'open:done']);
  assert.deepEqual(
    states.map((state) => [state.state_sequence, state.command_status]),
    [
      [2, 'applied'],
      [3, 'applied'],
    ]
  );
});

test('rejects stale sequences and retired epochs while closing fail-safe', async () => {
  const { device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.handleCommand('agent-1', command({ sequence: 5 }));
  states.length = 0;
  device.events.length = 0;

  await executor.handleCommand(
    'agent-1',
    command({ command_id: 'stale', sequence: 4, desired_listening: 'closed' })
  );
  const eventsAfterStale = device.events.length;
  await executor.handleCommand('agent-1', command({ sequence: 5 }));
  assert.equal(device.events.length, eventsAfterStale);
  await executor.handleCommand(
    'agent-1',
    command({ command_id: 'new-policy', policy_epoch: 'policy-2', sequence: 1 })
  );
  await executor.handleCommand(
    'agent-1',
    command({ command_id: 'retired', policy_epoch: 'policy-1', sequence: 6 })
  );

  assert.equal(device.trackMuted, true);
  assert.equal(states[0].command_status, 'rejected');
  assert.equal(
    states.filter((state) => state.command_id !== null).at(-1).command_status,
    'rejected'
  );
  assert.equal(states.at(-1).command_status, null);
  assert.ok(device.events.includes('close'));
});

test('expires a command by wall time without opening', async () => {
  const { clock, device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  device.events.length = 0;
  states.length = 0;
  clock.wall = 2_001;

  await executor.handleCommand('agent-1', command());

  assert.deepEqual(device.events, ['close']);
  assert.equal(states[0].command_status, 'expired');
  assert.equal(states[0].track_muted, true);
});

test('bounds an open lease on the monotonic clock and closes when it expires', async () => {
  const { clock, device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.handleCommand('agent-1', command({ expires_at_unix_ms: 10_000 }));
  states.length = 0;

  clock.wall = 100;
  clock.advance(499);
  await executor.drain();
  assert.equal(device.trackMuted, false);
  clock.advance(1);
  assert.equal(device.trackMuted, true);
  await executor.drain();

  assert.deepEqual(
    [
      states.at(-1).command_id,
      states.at(-1).policy_epoch,
      states.at(-1).command_sequence,
      states.at(-1).command_status,
    ],
    [null, null, null, null]
  );
  assert.ok(states.at(-1).blocked_by.includes('lease_expired'));
});

test('a renewal cancels the previous lease timer without a close race', async () => {
  const { clock, device, executor } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.handleCommand('agent-1', command({ expires_at_unix_ms: 1_400 }));
  clock.advance(300);
  device.events.length = 0;

  await executor.handleCommand(
    'agent-1',
    command({ command_id: 'renew', sequence: 2, expires_at_unix_ms: 1_800 })
  );
  clock.advance(100);
  await executor.drain();

  assert.equal(device.trackMuted, false);
  assert.ok(!device.events.includes('close'));
});

test('privacy mute closes synchronously and wins an in-flight open', async () => {
  const { device, executor, states } = harness();
  device.nextOpen = deferred();
  await executor.start();
  await executor.bindController('agent-1');
  states.length = 0;
  device.events.length = 0;
  const opening = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setImmediate(resolve));

  const privacy = executor.setUserMuted(true);
  assert.equal(device.trackMuted, true);
  assert.deepEqual(device.events, ['open:start', 'close']);
  device.nextOpen.resolve();
  await opening;
  await privacy;

  assert.equal(device.trackMuted, true);
  assert.equal(
    states.some((state) => state.track_muted === false),
    false
  );
  assert.equal(states[0].command_id, 'command-1');
  assert.equal(states[0].command_status, 'rejected');
  assert.equal(states[0].error_code, 'user_muted');
  assert.deepEqual(
    [
      states.at(-1).command_id,
      states.at(-1).policy_epoch,
      states.at(-1).command_sequence,
      states.at(-1).command_status,
    ],
    [null, null, null, null]
  );
  assert.equal(states.at(-1).user_muted, true);
  assert.ok(states.at(-1).blocked_by.includes('user_muted'));
});

test('remote open cannot clear privacy and unmute only follows a fresh automatic lease', async () => {
  const { clock, device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.setUserMuted(true);
  device.events.length = 0;

  await executor.handleCommand('agent-1', command({ expires_at_unix_ms: 1_400 }));
  assert.equal(device.trackMuted, true);
  assert.equal(states.at(-1).user_muted, true);
  assert.equal(states.at(-1).command_status, 'rejected');
  assert.equal(states.at(-1).error_code, 'user_muted');
  await executor.setUserMuted(false);
  assert.equal(device.trackMuted, false);
  assert.deepEqual(
    [
      states.at(-1).command_id,
      states.at(-1).policy_epoch,
      states.at(-1).command_sequence,
      states.at(-1).command_status,
    ],
    [null, null, null, null]
  );
  const eventsAfterUnmute = device.events.length;
  await executor.handleCommand('agent-1', command({ expires_at_unix_ms: 1_400 }));
  assert.equal(device.events.length, eventsAfterUnmute);
  assert.equal(states.at(-1).command_status, 'applied');
  assert.equal(states.at(-1).error_code, null);

  clock.advance(400);
  await executor.drain();
  await executor.setUserMuted(true);
  device.events.length = 0;
  await executor.setUserMuted(false);
  assert.equal(device.trackMuted, true);
  assert.equal(device.events.includes('open:start'), false);
});

test('controller disconnect and stop close synchronously and defeat late open completion', async () => {
  for (const action of ['disconnect', 'stop']) {
    const { device, executor, states } = harness();
    device.nextOpen = deferred();
    await executor.start();
    await executor.bindController('agent-1');
    states.length = 0;
    const opening = executor.handleCommand('agent-1', command());
    await new Promise((resolve) => setImmediate(resolve));

    const closing =
      action === 'disconnect' ? executor.disconnectController('agent-1') : executor.stop();
    assert.equal(device.trackMuted, true);
    device.nextOpen.resolve();
    await opening;
    await closing;

    assert.equal(device.trackMuted, true, action);
    assert.equal(
      states.some((state) => state.track_muted === false),
      false,
      action
    );
  }
});

test('a newer close command defeats late completion from an older open', async () => {
  const { device, executor, states } = harness();
  device.nextOpen = deferred();
  await executor.start();
  await executor.bindController('agent-1');
  states.length = 0;
  const opening = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setImmediate(resolve));

  const closing = executor.handleCommand(
    'agent-1',
    command({ command_id: 'close', sequence: 2, desired_listening: 'closed' })
  );
  assert.equal(device.trackMuted, true);
  device.nextOpen.resolve();
  await opening;
  await closing;

  assert.equal(device.trackMuted, true);
  assert.equal(
    states.some((state) => state.track_muted === false),
    false
  );
  assert.equal(states.at(-1).command_id, 'close');
  assert.equal(states.at(-1).command_status, 'applied');
  assert.deepEqual(
    states.map((state) => [state.command_id, state.command_status]),
    [
      ['command-1', 'rejected'],
      ['close', 'applied'],
    ]
  );
});

test('an in-flight duplicate waits for the exact command final result', async () => {
  const { device, executor, states } = harness();
  device.nextOpen = deferred();
  await executor.start();
  await executor.bindController('agent-1');
  states.length = 0;
  device.events.length = 0;
  const opening = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setImmediate(resolve));

  const duplicate = executor.handleCommand('agent-1', command());
  device.nextOpen.reject(new Error('device failed'));
  await assert.rejects(opening, /device failed/);
  await duplicate;

  assert.deepEqual(device.events, ['open:start', 'close']);
  assert.deepEqual(
    states.map((state) => [state.command_id, state.command_status, state.error_code]),
    [
      ['command-1', 'rejected', 'device_apply_failed'],
      ['command-1', 'rejected', 'device_apply_failed'],
    ]
  );
});

for (const transition of [
  {
    name: 'local privacy mute',
    status: 'rejected',
    errorCode: 'user_muted',
    apply: async ({ executor }) => executor.setUserMuted(true),
  },
  {
    name: 'local lease expiry',
    status: 'expired',
    errorCode: 'lease_expired',
    apply: async ({ clock, executor }) => {
      clock.advance(500);
      await executor.drain();
    },
  },
  {
    name: 'stale command fail-close',
    status: 'rejected',
    errorCode: 'superseded',
    apply: async ({ executor }) =>
      executor.handleCommand(
        'agent-1',
        command({ command_id: 'stale', sequence: 4, desired_listening: 'closed' })
      ),
  },
]) {
  test(`duplicate reflects final result after ${transition.name}`, async () => {
    const context = harness();
    const { device, executor, states } = context;
    await executor.start();
    await executor.bindController('agent-1');
    const original = command({ sequence: 5, expires_at_unix_ms: 10_000 });
    await executor.handleCommand('agent-1', original);
    states.length = 0;
    device.events.length = 0;

    await transition.apply(context);
    assert.ok(
      states.some(
        (state) =>
          state.command_id === null &&
          state.policy_epoch === null &&
          state.command_sequence === null &&
          state.command_status === null
      )
    );
    const eventsAfterTransition = device.events.length;
    await executor.handleCommand('agent-1', original);

    assert.equal(device.events.length, eventsAfterTransition);
    assert.equal(states.at(-1).command_id, original.command_id);
    assert.equal(states.at(-1).command_status, transition.status);
    assert.equal(states.at(-1).error_code, transition.errorCode);
  });
}

test('state publication failure while opening immediately fails closed', async () => {
  let publishCount = 0;
  const { device, executor } = harness({
    publishState: async () => {
      publishCount += 1;
      if (publishCount === 2) throw new Error('transport down');
    },
  });
  await executor.start();
  await executor.bindController('agent-1');

  await assert.rejects(() => executor.handleCommand('agent-1', command()), /transport down/);

  assert.equal(device.trackMuted, true);
  assert.equal(device.events.at(-1), 'close');
});

test('invalid state construction after device open immediately fails closed', async () => {
  let clockReads = 0;
  const { device, executor } = harness({
    nowUnixMs: () => {
      clockReads += 1;
      return clockReads <= 3 ? 1_000 : Number.NaN;
    },
  });
  await executor.start();
  await executor.bindController('agent-1');

  await assert.rejects(() => executor.handleCommand('agent-1', command()), /wall clock/);

  assert.equal(device.trackMuted, true);
  assert.equal(device.events.at(-1), 'close');
});

test('device snapshot failure after open immediately fails closed', async () => {
  const { device, executor } = harness();
  const snapshot = device.snapshot.bind(device);
  let snapshotReads = 0;
  device.snapshot = () => {
    snapshotReads += 1;
    if (snapshotReads === 2) throw new Error('snapshot failed');
    return snapshot();
  };
  await executor.start();
  await executor.bindController('agent-1');

  await assert.rejects(() => executor.handleCommand('agent-1', command()), /snapshot failed/);

  assert.equal(device.trackMuted, true);
  assert.equal(device.events.at(-1), 'close');
});

test('privacy aborts an in-flight applied state publish and supersedes it with closed state', async () => {
  const blockedPublish = deferred();
  const accepted = [];
  let attemptedApplied = null;
  const { device, executor } = harness({
    publishState: async (_controllerIdentity, state, signal) => {
      if (state.command_status === 'applied' && state.command_id === 'command-1') {
        attemptedApplied = { signal, state: structuredClone(state) };
        await blockedPublish.promise;
      }
      if (signal?.aborted) throw new Error('publish aborted');
      accepted.push(structuredClone(state));
    },
  });
  await executor.start();
  await executor.bindController('agent-1');
  accepted.length = 0;
  const opening = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setImmediate(resolve));

  const privacy = executor.setUserMuted(true);
  assert.ok(attemptedApplied?.signal instanceof AbortSignal);
  assert.equal(attemptedApplied.signal.aborted, true);
  await settlesWithin(opening);
  await settlesWithin(privacy);

  assert.equal(device.trackMuted, true);
  assert.equal(
    accepted.some((state) => state.track_muted === false),
    false
  );
  assert.deepEqual(
    accepted.map((state) => [state.command_id, state.command_status]),
    [
      ['command-1', 'rejected'],
      [null, null],
    ]
  );
  assert.ok(accepted[0].state_sequence > attemptedApplied.state.state_sequence);
});

test('stop and drain abort a state sink that never settles', async () => {
  const blockedPublish = deferred();
  let appliedSignal = null;
  const { device, executor } = harness({
    publishState: async (_controllerIdentity, state, signal) => {
      if (state.command_status !== 'applied') return;
      appliedSignal = signal;
      await blockedPublish.promise;
    },
  });
  await executor.start();
  await executor.bindController('agent-1');
  const opening = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setImmediate(resolve));

  const stopping = executor.stop();
  assert.ok(appliedSignal instanceof AbortSignal);
  assert.equal(appliedSignal.aborted, true);
  await settlesWithin(opening);
  await settlesWithin(stopping);
  await settlesWithin(executor.drain());

  assert.equal(device.trackMuted, true);
});

test('lease expiry aborts a stuck open and preserves expired final result for duplicate', async () => {
  const { clock, device, executor, states } = harness();
  device.nextOpen = deferred();
  await executor.start();
  await executor.bindController('agent-1');
  states.length = 0;
  const original = command({ expires_at_unix_ms: 10_000 });
  const opening = executor.handleCommand('agent-1', original);
  await new Promise((resolve) => setImmediate(resolve));

  clock.advance(500);
  await settlesWithin(opening);
  await settlesWithin(executor.drain());
  await executor.handleCommand('agent-1', original);

  assert.equal(device.trackMuted, true);
  assert.equal(states[0].command_status, 'expired');
  assert.equal(states[0].error_code, 'lease_expired');
  assert.equal(states.at(-1).command_status, 'expired');
  assert.equal(states.at(-1).error_code, 'lease_expired');

  device.nextOpen.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(device.trackMuted, true);
  assert.equal(device.events.at(-1), 'close');
});

test('newer close and stop are not blocked by a device open that never settles', async () => {
  for (const action of ['close', 'stop']) {
    const { device, executor, states } = harness();
    device.nextOpen = deferred();
    await executor.start();
    await executor.bindController('agent-1');
    states.length = 0;
    const opening = executor.handleCommand('agent-1', command());
    await new Promise((resolve) => setImmediate(resolve));

    const closing =
      action === 'close'
        ? executor.handleCommand(
            'agent-1',
            command({ command_id: 'close', sequence: 2, desired_listening: 'closed' })
          )
        : executor.stop();
    await settlesWithin(opening);
    await settlesWithin(closing);
    await settlesWithin(executor.drain());

    assert.equal(device.trackMuted, true, action);
    if (action === 'close') {
      assert.deepEqual(
        states.map((state) => [state.command_id, state.command_status]),
        [
          ['command-1', 'rejected'],
          ['close', 'applied'],
        ]
      );
    }
  }
});

test('late completion from an aborted open does not close a newer successful open', async () => {
  const { device, executor, states } = harness();
  const oldOpen = deferred();
  device.nextOpen = oldOpen;
  await executor.start();
  await executor.bindController('agent-1');
  states.length = 0;
  const firstOpen = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setImmediate(resolve));

  device.nextOpen = null;
  const close = executor.handleCommand(
    'agent-1',
    command({ command_id: 'close', sequence: 2, desired_listening: 'closed' })
  );
  await settlesWithin(firstOpen);
  await settlesWithin(close);
  await executor.handleCommand('agent-1', command({ command_id: 'new-open', sequence: 3 }));
  assert.equal(device.trackMuted, false);

  oldOpen.resolve();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(device.trackMuted, false);
  assert.equal(states.at(-1).command_id, 'new-open');
  assert.equal(states.at(-1).command_status, 'applied');
});

test('a silent no-op open is rejected when actual device state is not ready', async () => {
  const { device, executor, states } = harness();
  device.open = async () => {
    device.events.push('open:no-op');
  };
  await executor.start();
  await executor.bindController('agent-1');
  states.length = 0;

  await executor.handleCommand('agent-1', command());

  assert.equal(device.trackMuted, true);
  assert.equal(states.at(-1).command_status, 'rejected');
  assert.equal(states.at(-1).error_code, 'device_not_ready');
});

test('retired policy epoch replay history is bounded to sixteen entries', async () => {
  const { executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  for (let index = 1; index <= 18; index += 1) {
    await executor.handleCommand(
      'agent-1',
      command({
        command_id: `epoch-${index}`,
        policy_epoch: `policy-${index}`,
        desired_listening: 'closed',
      })
    );
  }
  states.length = 0;

  await executor.handleCommand(
    'agent-1',
    command({ command_id: 'oldest-reused', policy_epoch: 'policy-1' })
  );

  assert.equal(states.at(-1).command_status, 'applied');
});

test('malformed trusted control fails closed', async () => {
  const { device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.handleCommand('agent-1', command());
  states.length = 0;

  const failed = executor.handleMalformedControl('agent-1', 'malformed_control');
  assert.equal(device.trackMuted, true);
  await failed;

  assert.equal(states.at(-1).error_code, 'malformed_control');
});

test('republished device state is reconciled closed before serialized work', async () => {
  const { device, executor, states } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.setUserMuted(true);
  states.length = 0;
  device.events.length = 0;
  device.trackMuted = false;

  const reconciled = executor.reconcileDevice();
  assert.equal(device.trackMuted, true);
  await reconciled;

  assert.deepEqual(device.events, ['close']);
  assert.equal(states.at(-1).track_muted, true);
  assert.deepEqual(
    [
      states.at(-1).command_id,
      states.at(-1).policy_epoch,
      states.at(-1).command_sequence,
      states.at(-1).command_status,
    ],
    [null, null, null, null]
  );
});
