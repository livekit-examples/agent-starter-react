import assert from 'node:assert/strict';
import { test } from 'node:test';

const { ParticipantInfo_Kind, ParticipantInfo_State, TrackType } = await import(
  '@livekit/protocol'
);
const { AGENT_SESSION_READY_ATTRIBUTE, findReusableAgentParticipant } = await import(
  '../lib/session-dispatch-readiness.ts'
);

function participant({
  identity,
  kind = ParticipantInfo_Kind.STANDARD,
  state = ParticipantInfo_State.ACTIVE,
  attributes = {},
  tracks = [],
}) {
  return {
    identity,
    kind,
    state,
    attributes,
    tracks,
  };
}

test('dispatch reuses an active agent by default without room video input readiness', () => {
  const agent = participant({
    identity: 'agent-AJ_running',
    kind: ParticipantInfo_Kind.AGENT,
    attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
  });
  const participants = [
    agent,
    participant({
      identity: 'voice_assistant_user_session',
      tracks: [{ name: 'browser_video_track', type: TrackType.VIDEO, muted: false }],
    }),
  ];

  assert.equal(findReusableAgentParticipant(participants, 'frontdesk-browser-agent'), agent);
});

test('dispatch can require room video input readiness before reusing an agent', () => {
  const participants = [
    participant({
      identity: 'agent-AJ_stale',
      kind: ParticipantInfo_Kind.AGENT,
      attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
    }),
    participant({
      identity: 'voice_assistant_user_session',
      tracks: [{ name: 'browser_video_track', type: TrackType.VIDEO, muted: false }],
    }),
  ];

  assert.equal(
    findReusableAgentParticipant(participants, 'frontdesk-browser-agent', {
      requireRoomVideoInputReady: true,
    }),
    null
  );
});

test('dispatch can reuse an active agent once room video input is publishing', () => {
  const agent = participant({
    identity: 'agent-AJ_running',
    kind: ParticipantInfo_Kind.AGENT,
    attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
  });
  const participants = [
    agent,
    participant({
      identity: 'room_video_input',
      kind: ParticipantInfo_Kind.AGENT,
      tracks: [{ name: 'room_video', type: TrackType.VIDEO, muted: false }],
    }),
  ];

  assert.equal(
    findReusableAgentParticipant(participants, 'frontdesk-browser-agent', {
      requireRoomVideoInputReady: true,
    }),
    agent
  );
});

test('prewarm readiness requires both room input participants without requiring a video frame', () => {
  const agent = participant({
    identity: 'agent-AJ_running',
    kind: ParticipantInfo_Kind.AGENT,
    attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
  });
  const participants = [
    agent,
    participant({ identity: 'room_audio_input' }),
    participant({ identity: 'room_video_input' }),
  ];

  assert.equal(
    findReusableAgentParticipant(participants, 'frontdesk-browser-agent', {
      requireRoomInputParticipantsReady: true,
    }),
    agent
  );
});

test('prewarm can require the full agent session ready marker', () => {
  const agent = participant({
    identity: 'agent-AJ_running',
    kind: ParticipantInfo_Kind.AGENT,
    attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
  });
  const participants = [
    agent,
    participant({ identity: 'room_audio_input' }),
    participant({ identity: 'room_video_input' }),
  ];
  const options = {
    requireAgentSessionReady: true,
    requireRoomInputParticipantsReady: true,
  };

  assert.equal(
    findReusableAgentParticipant(participants, 'frontdesk-browser-agent', options),
    null
  );

  agent.attributes[AGENT_SESSION_READY_ATTRIBUTE] = 'true';
  assert.equal(
    findReusableAgentParticipant(participants, 'frontdesk-browser-agent', options),
    agent
  );
});

test('prewarm readiness rejects a room missing either input participant', () => {
  const participants = [
    participant({
      identity: 'agent-AJ_running',
      kind: ParticipantInfo_Kind.AGENT,
      attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
    }),
    participant({ identity: 'room_video_input' }),
  ];

  assert.equal(
    findReusableAgentParticipant(participants, 'frontdesk-browser-agent', {
      requireRoomInputParticipantsReady: true,
    }),
    null
  );
});

test('dispatch does not reuse disconnected agents', () => {
  const participants = [
    participant({
      identity: 'agent-AJ_disconnected',
      kind: ParticipantInfo_Kind.AGENT,
      state: ParticipantInfo_State.DISCONNECTED,
      attributes: { 'lk.agent.name': 'frontdesk-browser-agent' },
    }),
    participant({
      identity: 'room_video_input',
      kind: ParticipantInfo_Kind.AGENT,
      tracks: [{ name: 'room_video', type: TrackType.VIDEO, muted: false }],
    }),
  ];

  assert.equal(findReusableAgentParticipant(participants, 'frontdesk-browser-agent'), null);
});
