import assert from 'node:assert/strict';
import { test } from 'node:test';

const protocol = await import('../lib/media-control-protocol.ts');

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

function mediaControl(overrides = {}) {
  return {
    schema_version: 1,
    type: 'lk.media.control',
    command_id: 'command-1',
    policy_epoch: 'policy-1',
    sequence: 3,
    target_identity: 'browser-1',
    desired_listening: 'closed',
    issued_at_unix_ms: 2_000,
    expires_at_unix_ms: 2_750,
    reason: 'face_absent',
    ...overrides,
  };
}

function mediaState(overrides = {}) {
  return {
    schema_version: 1,
    type: 'lk.media.state',
    target_identity: 'browser-1',
    state_epoch: 'state-1',
    state_sequence: 11,
    observed_at_unix_ms: 2_100,
    capture_active: true,
    track_published: true,
    track_muted: true,
    user_muted: false,
    blocked_by: ['face_absent'],
    command_id: 'command-1',
    policy_epoch: 'policy-1',
    command_sequence: 3,
    command_status: 'applied',
    error_code: null,
    ...overrides,
  };
}

function json(value) {
  return JSON.stringify(value);
}

test('exports the locked media topics and decodes deterministic v1 control fields', () => {
  assert.equal(protocol.MEDIA_CONTROL_TOPIC, 'lk.media.control');
  assert.equal(protocol.MEDIA_STATE_TOPIC, 'lk.media.state');

  const expected = mediaControl();
  assert.deepEqual(
    protocol.decodeMediaControl(json({ ...expected, future_extension: true })),
    expected
  );
  assert.deepEqual(protocol.decodeMediaControl(new TextEncoder().encode(json(expected))), expected);
});

test('maps an absent optional reason to null and rejects explicit null', () => {
  const withoutReason = mediaControl();
  delete withoutReason.reason;

  assert.deepEqual(protocol.decodeMediaControl(json(withoutReason)), {
    ...withoutReason,
    reason: null,
  });
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ reason: null }))));
});

test('rejects malformed JSON, duplicate fields, non-objects, and invalid UTF-8', () => {
  assert.throws(() => protocol.decodeMediaControl('{'));
  assert.throws(() => protocol.decodeMediaControl('[]'));
  assert.throws(() =>
    protocol.decodeMediaControl('{"schema_version":1,"schema_version":1,"type":"lk.media.control"}')
  );
  assert.throws(() => protocol.decodeMediaControl(Uint8Array.of(0xff)));
});

test('rejects UTF-8 bytes prefixed with a byte-order mark', () => {
  const jsonBytes = new TextEncoder().encode(json(mediaControl()));
  const payload = new Uint8Array(3 + jsonBytes.byteLength);
  payload.set([0xef, 0xbb, 0xbf]);
  payload.set(jsonBytes, 3);

  assert.throws(() => protocol.decodeMediaControl(payload), /valid JSON/);
});

test('enforces the 16 KiB packet cap by UTF-8 bytes before decoding', () => {
  assert.throws(() => protocol.decodeMediaControl(new Uint8Array(16 * 1024 + 1)), /16 KiB/);
  assert.throws(() => protocol.decodeMediaControl('é'.repeat(8_193)), /16 KiB/);
});

test('rejects missing, unsupported, and wrongly typed envelopes', () => {
  const missingVersion = mediaControl();
  delete missingVersion.schema_version;

  assert.throws(() => protocol.decodeMediaControl(json(missingVersion)));
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ schema_version: 2 }))));
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ schema_version: true }))));
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ type: 'lk.media.state' }))));
});

test('accepts the JS-safe integer boundary and rejects unsafe integer tokens', () => {
  assert.equal(
    protocol.decodeMediaControl(json(mediaControl({ sequence: MAX_SAFE_INTEGER }))).sequence,
    MAX_SAFE_INTEGER
  );

  const payload = json(mediaControl()).replace(
    '"sequence":3',
    `"sequence":${MAX_SAFE_INTEGER + 1}`
  );
  assert.throws(() => protocol.decodeMediaControl(payload));
  assert.throws(() =>
    protocol.decodeMediaControl(`${json(mediaControl()).slice(0, -1)},"future":9007199254740992}`)
  );
});

test('requires integer tokens, exact field types, and a future expiry', () => {
  assert.throws(() =>
    protocol.decodeMediaControl(json(mediaControl()).replace('"sequence":3', '"sequence":3.0'))
  );
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ sequence: true }))));
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ command_id: '' }))));
  assert.throws(() =>
    protocol.decodeMediaControl(json(mediaControl({ desired_listening: 'paused' })))
  );
  assert.throws(() => protocol.decodeMediaControl(json(mediaControl({ issued_at_unix_ms: -1 }))));
  assert.throws(() =>
    protocol.decodeMediaControl(json(mediaControl({ expires_at_unix_ms: 2_000 })))
  );
});

for (const field of ['command_id', 'policy_epoch', 'target_identity', 'reason']) {
  test(`rejects an escaped unpaired surrogate in command field ${field}`, () => {
    const payload = json(mediaControl({ [field]: '\ud800' }));

    assert.match(payload, /\\ud800/);
    assert.throws(() => protocol.decodeMediaControl(payload), /valid UTF-8 text/);
  });
}

test('encodes media state as Python-compatible sorted compact UTF-8 JSON', () => {
  const encoded = protocol.encodeMediaState(mediaState());

  assert.ok(encoded instanceof Uint8Array);
  assert.equal(
    new TextDecoder().decode(encoded),
    '{"blocked_by":["face_absent"],"capture_active":true,"command_id":"command-1","command_sequence":3,"command_status":"applied","error_code":null,"observed_at_unix_ms":2100,"policy_epoch":"policy-1","schema_version":1,"state_epoch":"state-1","state_sequence":11,"target_identity":"browser-1","track_muted":true,"track_published":true,"type":"lk.media.state","user_muted":false}'
  );
});

test('validates media state types, safe integers, blockers, and output size', () => {
  assert.throws(() => protocol.encodeMediaState(mediaState({ state_sequence: 0 })));
  assert.throws(() =>
    protocol.encodeMediaState(mediaState({ state_sequence: MAX_SAFE_INTEGER + 1 }))
  );
  assert.throws(() => protocol.encodeMediaState(mediaState({ capture_active: 1 })));
  assert.throws(() => protocol.encodeMediaState(mediaState({ blocked_by: 'face_absent' })));
  assert.throws(() =>
    protocol.encodeMediaState(mediaState({ blocked_by: ['face_absent', 'face_absent'] }))
  );
  assert.throws(() => protocol.encodeMediaState(mediaState({ blocked_by: [''] })));
  assert.throws(
    () => protocol.encodeMediaState(mediaState({ error_code: 'x'.repeat(17_000) })),
    /16 KiB/
  );
});

test('requires command correlation to be fully null or fully present', () => {
  assert.doesNotThrow(() =>
    protocol.encodeMediaState(
      mediaState({
        command_id: null,
        policy_epoch: null,
        command_sequence: null,
        command_status: null,
        error_code: 'capture_unavailable',
      })
    )
  );
  assert.throws(() => protocol.encodeMediaState(mediaState({ command_id: null })));
  assert.throws(() => protocol.encodeMediaState(mediaState({ command_status: 'ignored' })));
});

test('rejects text and state strings that cannot be represented as valid UTF-8', () => {
  assert.throws(() => protocol.decodeMediaControl('\ud800'));
  assert.throws(() => protocol.encodeMediaState(mediaState({ error_code: '\ud800' })));
});
