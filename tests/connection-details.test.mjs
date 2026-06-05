import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.LIVEKIT_URL = 'ws://localhost:7818';
process.env.LIVEKIT_API_KEY = 'devkey';
process.env.LIVEKIT_API_SECRET = 'devsecret-devsecret-devsecret-dev';

const { resolveConnectionRoomId } = await import('../lib/connection-room-id.ts');
const { readConnectionDetailsResponse } = await import('../lib/connection-details-response.ts');

test('connection details reuse a client supplied room id', async () => {
  const roomId = '11111111-2222-4333-8444-555555555555';
  assert.equal(resolveConnectionRoomId({ room_id: roomId }), roomId);
});

test('connection details ignore an invalid client supplied room id', async () => {
  assert.equal(
    resolveConnectionRoomId({ room_id: '../../not-a-room' }, () => {
      return '22222222-3333-4444-8555-666666666666';
    }),
    '22222222-3333-4444-8555-666666666666'
  );
});

test('connection details parse a valid response body', async () => {
  const payload = {
    serverUrl: 'wss://example.livekit.cloud',
    roomName: 'voice_assistant_room_11111111-2222-4333-8444-555555555555',
    participantName: 'user',
    participantToken: 'token',
  };

  const result = await readConnectionDetailsResponse(
    new Response(JSON.stringify(payload), { status: 200 })
  );

  assert.deepEqual(result, payload);
});

test('connection details surface non-OK response text', async () => {
  await assert.rejects(
    readConnectionDetailsResponse(new Response('LIVEKIT_API_KEY is not defined', { status: 500 })),
    /LIVEKIT_API_KEY is not defined/
  );
});

test('connection details reject malformed success payloads', async () => {
  await assert.rejects(
    readConnectionDetailsResponse(
      new Response(JSON.stringify({ serverUrl: 'wss://example.test' }))
    ),
    /missing required fields/
  );
});
