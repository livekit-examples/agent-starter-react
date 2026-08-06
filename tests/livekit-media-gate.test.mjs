import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

const { RoomEvent } = await import('livekit-client');
const { LiveKitMediaGateAdapter } = await import('../lib/livekit-media-gate.ts');
const { MediaGateExecutor } = await import('../lib/media-gate-executor.ts');
const { MEDIA_CONTROL_TOPIC, MEDIA_STATE_TOPIC } = await import('../lib/media-control-protocol.ts');

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class FakeRoom extends EventEmitter {
  constructor(participants = []) {
    super();
    this.remoteParticipants = new Map(
      participants.map((participant) => [participant.identity, participant])
    );
    this.published = [];
    this.publishGate = null;
    this.localParticipant = {
      publishData: async (payload, options) => {
        this.published.push({ payload, options });
        await this.publishGate?.promise;
      },
    };
  }

  connectParticipant(participant) {
    this.remoteParticipants.set(participant.identity, participant);
    this.emit(RoomEvent.ParticipantConnected, participant);
  }

  disconnectParticipant(participant) {
    this.remoteParticipants.delete(participant.identity);
    this.emit(RoomEvent.ParticipantDisconnected, participant);
  }

  sendData(payload, participant, topic) {
    this.emit(RoomEvent.DataReceived, payload, participant, 0, topic);
  }
}

class FakeExecutor {
  constructor({ targetIdentity = 'browser-edge', commandGate = null } = {}) {
    this.targetIdentity = targetIdentity;
    this.commandGate = commandGate;
    this.calls = [];
    this.appliedCommands = [];
  }

  async start() {
    this.calls.push(['start']);
  }

  async bindController(identity) {
    this.calls.push(['bindController', identity]);
  }

  async handleCommand(identity, command) {
    this.calls.push(['handleCommand', identity, command]);
    await this.commandGate?.promise;
    if (command.target_identity === this.targetIdentity) {
      this.appliedCommands.push(command);
    }
  }

  async handleMalformedControl(identity, errorCode) {
    this.calls.push(['handleMalformedControl', identity, errorCode]);
  }

  async disconnectController(identity) {
    this.calls.push(['disconnectController', identity]);
  }

  async stop() {
    this.calls.push(['stop']);
  }
}

function participant({ identity, agentName, isAgent = true }) {
  const attributes = agentName === undefined ? {} : { 'lk.agent.name': agentName };
  return { identity, isAgent, attributes };
}

function command(overrides = {}) {
  return {
    schema_version: 1,
    type: MEDIA_CONTROL_TOPIC,
    command_id: 'command-1',
    policy_epoch: 'policy-1',
    sequence: 1,
    target_identity: 'browser-edge',
    desired_listening: 'open',
    issued_at_unix_ms: 1_000,
    expires_at_unix_ms: 2_000,
    reason: 'face_present',
    ...overrides,
  };
}

function encodedCommand(overrides = {}) {
  return textEncoder.encode(JSON.stringify(command(overrides)));
}

function state(overrides = {}) {
  return {
    schema_version: 1,
    type: MEDIA_STATE_TOPIC,
    target_identity: 'browser-edge',
    state_epoch: 'state-1',
    state_sequence: 1,
    observed_at_unix_ms: 1_100,
    capture_active: false,
    track_published: true,
    track_muted: true,
    user_muted: false,
    blocked_by: ['lease_missing'],
    command_id: null,
    policy_epoch: null,
    command_sequence: null,
    command_status: null,
    error_code: null,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function namedAgent(identity = 'agent-frontdesk') {
  return participant({ identity, agentName: 'frontdesk-browser-agent' });
}

test('start discovers an existing named Agent and binds its exact identity', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });

  await adapter.start(executor);

  assert.deepEqual(executor.calls, [['start'], ['bindController', controller.identity]]);
});

test('start rolls back listeners and stops permanently when initial controller binding fails', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  executor.bindController = async (identity) => {
    executor.calls.push(['bindController', identity]);
    throw new Error('initial bind failed');
  };
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });

  await assert.rejects(adapter.start(executor), /initial bind failed/);

  assert.equal(room.listenerCount(RoomEvent.DataReceived), 0);
  assert.equal(room.listenerCount(RoomEvent.ParticipantConnected), 0);
  assert.equal(room.listenerCount(RoomEvent.ParticipantDisconnected), 0);
  assert.equal(
    executor.calls.some(([name]) => name === 'stop'),
    true
  );
  await assert.rejects(adapter.start(executor), /cannot restart after stop/);
});

test('participant discovery requires Agent role and matching agent-name attributes', async () => {
  const room = new FakeRoom();
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  room.connectParticipant(
    participant({ identity: 'standard', agentName: 'frontdesk-browser-agent', isAgent: false })
  );
  room.connectParticipant(participant({ identity: 'wrong-agent', agentName: 'other-agent' }));
  room.connectParticipant({
    identity: 'expected-agent',
    isAgent: true,
    attributes: { lkAgentName: 'frontdesk-browser-agent' },
  });
  await adapter.drain();

  assert.deepEqual(executor.calls, [['start'], ['bindController', 'expected-agent']]);
});

test('a delayed participant-connected task cannot bind an Agent that already left the room', async () => {
  const firstBindGate = deferred();
  const first = namedAgent('agent-first');
  const departed = namedAgent('agent-departed');
  const room = new FakeRoom();
  const executor = new FakeExecutor();
  executor.bindController = async (identity) => {
    executor.calls.push(['bindController', identity]);
    if (identity === first.identity) await firstBindGate.promise;
  };
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  room.connectParticipant(first);
  await new Promise((resolve) => setImmediate(resolve));
  room.disconnectParticipant(first);
  room.connectParticipant(departed);
  room.disconnectParticipant(departed);

  firstBindGate.resolve();
  await adapter.drain();

  assert.equal(
    executor.calls.some(
      ([name, identity]) => name === 'bindController' && identity === departed.identity
    ),
    false
  );
});

test('anonymous fallback binds only when exactly one unnamed Agent exists', async () => {
  const soleAnonymous = participant({ identity: 'agent-anonymous' });
  const soleRoom = new FakeRoom([soleAnonymous]);
  const soleExecutor = new FakeExecutor();
  const soleAdapter = new LiveKitMediaGateAdapter({
    room: soleRoom,
    agentName: 'frontdesk-browser-agent',
    allowAnonymousLiveKitAgentFallback: true,
  });
  await soleAdapter.start(soleExecutor);

  assert.deepEqual(soleExecutor.calls, [['start'], ['bindController', soleAnonymous.identity]]);

  const ambiguousRoom = new FakeRoom([
    participant({ identity: 'agent-anonymous-1' }),
    participant({ identity: 'agent-anonymous-2' }),
  ]);
  const ambiguousExecutor = new FakeExecutor();
  const ambiguousAdapter = new LiveKitMediaGateAdapter({
    room: ambiguousRoom,
    agentName: 'frontdesk-browser-agent',
    allowAnonymousLiveKitAgentFallback: true,
  });
  await ambiguousAdapter.start(ambiguousExecutor);

  assert.deepEqual(ambiguousExecutor.calls, [['start']]);
});

test('anonymous fallback rejects an unnamed Agent outside the agent identity namespace', async () => {
  const room = new FakeRoom([participant({ identity: 'worker-anonymous' })]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
    allowAnonymousLiveKitAgentFallback: true,
  });

  await adapter.start(executor);

  assert.deepEqual(executor.calls, [['start']]);
});

test('exact topic is checked before decode and trusted malformed control fails closed', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  const malformed = textEncoder.encode('{');
  room.sendData(malformed, controller, 'other.topic');
  room.sendData(malformed, controller, MEDIA_CONTROL_TOPIC);
  await adapter.drain();

  assert.deepEqual(executor.calls.slice(2), [
    ['handleMalformedControl', controller.identity, 'malformed_control'],
  ]);
});

test('unsupported control versions use a stable fail-closed error code', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  room.sendData(encodedCommand({ schema_version: 2 }), controller, MEDIA_CONTROL_TOPIC);
  await adapter.drain();

  assert.deepEqual(executor.calls.at(-1), [
    'handleMalformedControl',
    controller.identity,
    'unsupported_control_version',
  ]);
});

test('controller identity is pinned and valid commands from every other sender are ignored', async () => {
  const controller = namedAgent('agent-controller');
  const impostor = namedAgent('agent-impostor');
  const room = new FakeRoom([controller, impostor]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  room.sendData(encodedCommand(), impostor, MEDIA_CONTROL_TOPIC);
  room.sendData(encodedCommand(), controller, MEDIA_CONTROL_TOPIC);
  await adapter.drain();

  assert.equal(executor.calls.filter(([name]) => name === 'handleCommand').length, 1);
  assert.deepEqual(executor.calls.at(-1).slice(0, 2), ['handleCommand', controller.identity]);
});

test('target validation stays in the executor boundary', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  room.sendData(
    encodedCommand({ target_identity: 'different-edge' }),
    controller,
    MEDIA_CONTROL_TOPIC
  );
  await adapter.drain();

  assert.equal(executor.calls.filter(([name]) => name === 'handleCommand').length, 1);
  assert.equal(executor.appliedCommands.length, 0);
});

test('state publishing is reliable, exact-topic, encoded, and directed only to the pinned controller', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  await adapter.publishState(controller.identity, state(), new AbortController().signal);

  assert.equal(room.published.length, 1);
  assert.deepEqual(room.published[0].options, {
    reliable: true,
    destinationIdentities: [controller.identity],
    topic: MEDIA_STATE_TOPIC,
  });
  assert.deepEqual(JSON.parse(textDecoder.decode(room.published[0].payload)), state());

  await adapter.publishState(
    'agent-impostor',
    state({ state_sequence: 2 }),
    new AbortController().signal
  );
  assert.equal(room.published.length, 1);
});

test('an aborted state sink does not publish data', async () => {
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);
  const abortController = new AbortController();
  abortController.abort();

  await assert.rejects(
    adapter.publishState(controller.identity, state(), abortController.signal),
    (error) => error?.name === 'AbortError'
  );
  assert.equal(room.published.length, 0);
});

test('controller disconnect closes through executor, clears the pin, and permits a later rebind', async () => {
  const first = namedAgent('agent-first');
  const room = new FakeRoom([first]);
  const executor = new FakeExecutor();
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);

  room.disconnectParticipant(first);
  await adapter.drain();
  const second = namedAgent('agent-second');
  room.connectParticipant(second);
  await adapter.drain();

  assert.deepEqual(executor.calls, [
    ['start'],
    ['bindController', first.identity],
    ['disconnectController', first.identity],
    ['bindController', second.identity],
  ]);
});

test('a failed late controller bind rolls back and permits a replacement controller', async () => {
  const room = new FakeRoom();
  const errors = [];
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
    onError: (error) => errors.push(error),
  });
  const executor = new MediaGateExecutor({
    targetIdentity: 'browser-edge',
    device: {
      close() {},
      async open() {},
      snapshot() {
        return {
          captureActive: true,
          trackPublished: true,
          trackMuted: true,
        };
      },
    },
    publishState: adapter.publishState,
    uuid: () => 'state-epoch-1',
    nowUnixMs: () => 1_000,
    nowMonotonicMs: () => 1_000,
    scheduler: {
      setTimeout: () => 1,
      clearTimeout() {},
    },
    maxOpenLeaseMs: 1_000,
  });
  await adapter.start(executor);

  const failedPublish = deferred();
  room.publishGate = failedPublish;
  const first = namedAgent('agent-first');
  room.connectParticipant(first);
  failedPublish.reject(new Error('initial state publish failed'));
  await adapter.drain();

  room.publishGate = null;
  room.disconnectParticipant(first);
  const second = namedAgent('agent-second');
  room.connectParticipant(second);
  await adapter.drain();

  assert.match(errors[0]?.message ?? '', /initial state publish failed/);
  assert.deepEqual(
    room.published.map(({ options }) => options.destinationIdentities),
    [[first.identity], [second.identity]]
  );
});

test('controller disconnect is not blocked behind stuck command work', async () => {
  const commandGate = deferred();
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor({ commandGate });
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);
  room.sendData(encodedCommand(), controller, MEDIA_CONTROL_TOPIC);
  await new Promise((resolve) => setImmediate(resolve));

  room.disconnectParticipant(controller);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(
    executor.calls.some(
      ([name, identity]) => name === 'disconnectController' && identity === controller.identity
    ),
    true
  );

  commandGate.resolve();
  await adapter.drain();
});

test('stop removes all listeners, stops executor, and drains owned command work', async () => {
  const commandGate = deferred();
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor({ commandGate });
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
  });
  await adapter.start(executor);
  room.sendData(encodedCommand(), controller, MEDIA_CONTROL_TOPIC);
  await new Promise((resolve) => setImmediate(resolve));

  let stopped = false;
  const stopPromise = adapter.stop().then(() => {
    stopped = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stopped, false);

  commandGate.resolve();
  await stopPromise;
  assert.equal(stopped, true);
  assert.equal(room.listenerCount(RoomEvent.DataReceived), 0);
  assert.equal(room.listenerCount(RoomEvent.ParticipantConnected), 0);
  assert.equal(room.listenerCount(RoomEvent.ParticipantDisconnected), 0);
  assert.equal(
    executor.calls.some(([name]) => name === 'stop'),
    true
  );

  const callsAfterStop = executor.calls.length;
  room.sendData(encodedCommand(), controller, MEDIA_CONTROL_TOPIC);
  assert.equal(executor.calls.length, callsAfterStop);
});

test('event promise failures are observed without unhandled rejection', async () => {
  const errors = [];
  const controller = namedAgent();
  const room = new FakeRoom([controller]);
  const executor = new FakeExecutor();
  executor.handleCommand = async () => {
    throw new Error('command failed');
  };
  const adapter = new LiveKitMediaGateAdapter({
    room,
    agentName: 'frontdesk-browser-agent',
    onError: (error) => errors.push(error),
  });
  await adapter.start(executor);

  room.sendData(encodedCommand(), controller, MEDIA_CONTROL_TOPIC);
  await adapter.drain();

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /command failed/);
});
