import assert from 'node:assert/strict';
import { test } from 'node:test';

const { BrowserAudioGateDevice } = await import('../lib/browser-audio-gate-device.ts');
const { replaceRuntimeAudioBinding } = await import('../lib/browser-source-runtime-lifecycle.ts');
const { MediaGateExecutor } = await import('../lib/media-gate-executor.ts');

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class FakeClock {
  wall = 1_000;
  monotonic = 10;
  nextTimer = 1;
  timers = new Map();

  setTimeout(callback, delayMs) {
    const handle = this.nextTimer++;
    this.timers.set(handle, { callback, deadline: this.monotonic + delayMs });
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

function fakeTrack(events, { unmuteBarrier = null } = {}) {
  return {
    isMuted: true,
    mediaStreamTrack: { enabled: false, readyState: 'live' },
    async mute() {
      events.push('mute');
      this.isMuted = true;
      this.mediaStreamTrack.enabled = false;
    },
    async unmute() {
      events.push('unmute:start');
      this.isMuted = false;
      this.mediaStreamTrack.enabled = true;
      if (unmuteBarrier) await unmuteBarrier.promise;
      events.push('unmute:done');
    },
  };
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

function harness({ trackOptions } = {}) {
  const events = [];
  const clock = new FakeClock();
  let binding = null;
  let publishes = 0;
  const track = fakeTrack(events, trackOptions);
  const device = new BrowserAudioGateDevice({
    getBinding: () => binding,
    ensurePublishedClosed: async (signal) => {
      if (binding) return;
      events.push('publish:start');
      assert.equal(signal.aborted, false);
      track.mediaStreamTrack.enabled = false;
      track.isMuted = true;
      binding = { track, publication: { isMuted: true } };
      publishes += 1;
      events.push('publish:closed');
    },
  });
  const states = [];
  const executor = new MediaGateExecutor({
    targetIdentity: 'browser-1',
    device,
    publishState: async (_controllerIdentity, state) => states.push(structuredClone(state)),
    uuid: () => 'state-epoch-1',
    nowUnixMs: () => clock.wall,
    nowMonotonicMs: () => clock.monotonic,
    scheduler: clock,
    maxOpenLeaseMs: 3_000,
  });
  return {
    clock,
    device,
    events,
    executor,
    getBinding: () => binding,
    getPublishes: () => publishes,
    replaceBinding(next) {
      binding = next;
    },
    states,
    track,
  };
}

test('publishes a missing track closed and only opens it through a valid executor command', async () => {
  const { device, events, executor, getPublishes, states, track } = harness();

  await executor.start();
  await executor.bindController('agent-1');
  assert.deepEqual(device.snapshot(), {
    captureActive: false,
    trackPublished: false,
    trackMuted: true,
  });

  await executor.handleCommand('agent-1', command());

  assert.equal(getPublishes(), 1);
  assert.equal(track.mediaStreamTrack.enabled, true);
  assert.equal(track.isMuted, false);
  assert.deepEqual(events, ['publish:start', 'publish:closed', 'unmute:start', 'unmute:done']);
  assert.equal(states.at(-1).command_status, 'applied');
  assert.equal(states.at(-1).track_muted, false);
});

test('close disables capture synchronously while LiveKit mute remains best effort', async () => {
  const { device, events, replaceBinding, track } = harness();
  track.isMuted = false;
  track.mediaStreamTrack.enabled = true;
  replaceBinding({ track, publication: { isMuted: false } });

  device.close();

  assert.equal(track.mediaStreamTrack.enabled, false);
  assert.deepEqual(device.snapshot(), {
    captureActive: false,
    trackPublished: true,
    trackMuted: true,
  });
  await Promise.resolve();
  assert.deepEqual(events, ['mute']);
});

test('close remains fail-safe when the LiveKit mute call throws synchronously', () => {
  const track = fakeTrack([]);
  track.mediaStreamTrack.enabled = true;
  track.isMuted = false;
  track.mute = () => {
    throw new Error('mute failed');
  };
  const device = new BrowserAudioGateDevice({
    getBinding: () => ({ track, publication: {} }),
    ensurePublishedClosed: async () => {},
  });

  assert.doesNotThrow(() => device.close());
  assert.equal(track.mediaStreamTrack.enabled, false);
  assert.equal(device.snapshot().trackMuted, true);
});

test('a later open waits for an in-flight LiveKit mute before unmuting', async () => {
  const muteBarrier = deferred();
  const events = [];
  const track = {
    isMuted: false,
    mediaStreamTrack: { enabled: true, readyState: 'live' },
    async mute() {
      events.push('mute:start');
      await muteBarrier.promise;
      this.isMuted = true;
      this.mediaStreamTrack.enabled = false;
      events.push('mute:done');
    },
    async unmute() {
      events.push('unmute');
      this.isMuted = false;
      this.mediaStreamTrack.enabled = true;
    },
  };
  const binding = { track, publication: {} };
  const device = new BrowserAudioGateDevice({
    getBinding: () => binding,
    ensurePublishedClosed: async () => {},
  });

  device.close();
  let opened = false;
  const opening = device.open(new AbortController().signal).then(() => {
    opened = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(opened, false);
  assert.deepEqual(events, ['mute:start']);

  muteBarrier.resolve();
  await opening;

  assert.deepEqual(events, ['mute:start', 'mute:done', 'unmute']);
  assert.equal(track.mediaStreamTrack.enabled, true);
  assert.equal(track.isMuted, false);
  assert.equal(device.snapshot().trackMuted, false);
});

test('user mute wins over an in-flight open and a later unmute cannot revive it', async () => {
  const barrier = deferred();
  const { device, executor, states, track } = harness({
    trackOptions: { unmuteBarrier: barrier },
  });
  await executor.start();
  await executor.bindController('agent-1');

  const opening = executor.handleCommand('agent-1', command());
  await new Promise((resolve) => setTimeout(resolve, 0));
  const muting = executor.setUserMuted(true);
  assert.equal(track.mediaStreamTrack.enabled, false);
  barrier.resolve();
  await Promise.all([opening, muting]);

  assert.equal(track.mediaStreamTrack.enabled, false);
  assert.equal(device.snapshot().trackMuted, true);
  assert.equal(states.at(-1).user_muted, true);
  assert.notEqual(states.at(-1).command_status, 'applied');
});

test('removing user mute only reopens while the same open lease is still fresh', async () => {
  const { clock, device, executor, track } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.setUserMuted(true);
  await executor.handleCommand('agent-1', command({ expires_at_unix_ms: 5_000 }));

  await executor.setUserMuted(false);
  assert.equal(device.snapshot().trackMuted, false);

  await executor.setUserMuted(true);
  clock.advance(3_000);
  await executor.setUserMuted(false);
  await executor.drain();

  assert.equal(track.mediaStreamTrack.enabled, false);
  assert.equal(device.snapshot().trackMuted, true);
});

test('a track replacement remains closed until reconcile reapplies a fresh lease', async () => {
  const { device, events, executor, replaceBinding } = harness();
  await executor.start();
  await executor.bindController('agent-1');
  await executor.handleCommand('agent-1', command());

  device.close();
  const replacement = fakeTrack(events);
  replacement.mediaStreamTrack.enabled = false;
  replacement.isMuted = true;
  replaceBinding({ track: replacement, publication: { isMuted: true } });
  assert.equal(device.snapshot().trackMuted, true);

  await executor.reconcileDevice();

  assert.equal(replacement.mediaStreamTrack.enabled, true);
  assert.equal(replacement.isMuted, false);
});

test('an old asynchronous open cannot leak after the bound track is replaced', async () => {
  const barrier = deferred();
  const { device, replaceBinding, track } = harness({
    trackOptions: { unmuteBarrier: barrier },
  });
  const signal = new AbortController().signal;
  const opening = device.open(signal);
  await new Promise((resolve) => setTimeout(resolve, 0));

  device.close();
  const replacement = fakeTrack([]);
  replaceBinding({ track: replacement, publication: { isMuted: true } });
  barrier.resolve();

  await assert.rejects(opening, { name: 'AbortError' });
  assert.equal(track.mediaStreamTrack.enabled, false);
  assert.equal(replacement.mediaStreamTrack.enabled, false);
  assert.equal(device.snapshot().trackMuted, true);
});

test('a late old open failure cannot overwrite a newer successful replacement open', async () => {
  const barrier = deferred();
  const oldTrack = fakeTrack([], { unmuteBarrier: barrier });
  let binding = { track: oldTrack, publication: {} };
  const device = new BrowserAudioGateDevice({
    getBinding: () => binding,
    ensurePublishedClosed: async () => {},
  });
  const oldOpen = device.open(new AbortController().signal);
  await new Promise((resolve) => setTimeout(resolve, 0));

  device.close();
  const replacement = fakeTrack([]);
  binding = { track: replacement, publication: {} };
  await device.open(new AbortController().signal);
  barrier.resolve();
  await assert.rejects(oldOpen, { name: 'AbortError' });

  assert.equal(oldTrack.mediaStreamTrack.enabled, false);
  assert.equal(replacement.mediaStreamTrack.enabled, true);
  assert.deepEqual(device.snapshot(), {
    captureActive: true,
    trackPublished: true,
    trackMuted: false,
  });
});

test('switching devices while user-muted removes A without publishing and the next open creates B', async () => {
  const events = [];
  let selectedDeviceId = 'A';
  const oldTrack = fakeTrack(events);
  let binding = { track: oldTrack, publication: { deviceId: 'A' } };
  const createdDeviceIds = [];
  const device = new BrowserAudioGateDevice({
    getBinding: () => binding,
    ensurePublishedClosed: async () => {
      const deviceId = selectedDeviceId;
      const track = fakeTrack(events);
      createdDeviceIds.push(deviceId);
      binding = { track, publication: { deviceId } };
    },
  });
  const runtime = { audioEnabled: false, audioPublishPromise: null };

  selectedDeviceId = 'B';
  await replaceRuntimeAudioBinding(runtime, {
    close: () => device.close(),
    unpublish: async () => {
      events.push(`unpublish:${binding?.publication.deviceId}`);
      binding = null;
    },
    reconcile: async () => assert.fail('muted replacement must not reconcile open'),
    ensurePublished: async () => assert.fail('muted replacement must not publish B'),
    hasBinding: () => binding !== null,
  });

  assert.equal(binding, null);
  assert.deepEqual(createdDeviceIds, []);
  assert.equal(oldTrack.mediaStreamTrack.enabled, false);

  runtime.audioEnabled = true;
  await device.open(new AbortController().signal);

  assert.deepEqual(createdDeviceIds, ['B']);
  assert.equal(binding.publication.deviceId, 'B');
  assert.equal(binding.track.mediaStreamTrack.enabled, true);
  assert.equal(binding.track.isMuted, false);
});

test('switching devices while listening reconciles a fresh lease onto B without restoring A', async () => {
  const events = [];
  const clock = new FakeClock();
  let selectedDeviceId = 'A';
  let binding = null;
  const createdDeviceIds = [];
  const device = new BrowserAudioGateDevice({
    getBinding: () => binding,
    ensurePublishedClosed: async () => {
      const deviceId = selectedDeviceId;
      const track = fakeTrack(events);
      createdDeviceIds.push(deviceId);
      binding = { track, publication: { deviceId } };
    },
  });
  const executor = new MediaGateExecutor({
    targetIdentity: 'browser-1',
    device,
    publishState: async () => {},
    uuid: () => 'state-epoch-1',
    nowUnixMs: () => clock.wall,
    nowMonotonicMs: () => clock.monotonic,
    scheduler: clock,
    maxOpenLeaseMs: 3_000,
  });
  const runtime = { audioEnabled: true, audioPublishPromise: null };
  await executor.start();
  await executor.bindController('agent-1');
  await executor.handleCommand('agent-1', command({ expires_at_unix_ms: 4_000 }));
  const oldTrack = binding.track;

  selectedDeviceId = 'B';
  await replaceRuntimeAudioBinding(runtime, {
    close: () => device.close(),
    unpublish: async () => {
      events.push(`unpublish:${binding?.publication.deviceId}`);
      binding = null;
    },
    reconcile: () => executor.reconcileDevice(),
    ensurePublished: async () => assert.fail('fresh lease reconcile must create B itself'),
    hasBinding: () => binding !== null,
  });

  assert.deepEqual(createdDeviceIds, ['A', 'B']);
  assert.equal(oldTrack.mediaStreamTrack.enabled, false);
  assert.equal(binding.publication.deviceId, 'B');
  assert.equal(binding.track.mediaStreamTrack.enabled, true);
  assert.equal(binding.track.isMuted, false);
});
