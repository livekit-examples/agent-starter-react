import {
  type ParticipantInfo,
  ParticipantInfo_Kind,
  ParticipantInfo_State,
  TrackType,
} from '@livekit/protocol';

export type AgentParticipantMatchOptions = {
  allowAnonymousLiveKitAgentFallback?: boolean;
};

export type ReusableAgentParticipantOptions = AgentParticipantMatchOptions & {
  requireAgentSessionReady?: boolean;
  requireRoomVideoInputReady?: boolean;
  requireRoomInputParticipantsReady?: boolean;
};

export const AGENT_SESSION_READY_ATTRIBUTE = 'liveavatar.agent.session_ready';
// livekit-server-sdk maps protobuf attribute keys to camelCase object keys.
const AGENT_SESSION_READY_ATTRIBUTE_CAMEL = 'liveavatarAgentSessionReady';

const ROOM_AUDIO_INPUT_IDENTITY = 'room_audio_input';
const ROOM_VIDEO_INPUT_IDENTITY = 'room_video_input';

function readRoomInputVideoTrackName() {
  return (
    process.env['NEXT_PUBLIC_ROOM_VISION_TRACK_NAME'] ||
    process.env['NEXT_PUBLIC_ROOM_VIDEO_TRACK_NAME'] ||
    'room_video'
  );
}

export function findReusableAgentParticipant(
  participants: ParticipantInfo[],
  agentName: string,
  options: ReusableAgentParticipantOptions = {}
): ParticipantInfo | null {
  const {
    requireAgentSessionReady = false,
    requireRoomVideoInputReady = false,
    requireRoomInputParticipantsReady = false,
    ...matchOptions
  } = options;
  const expectedAgent = findAgentParticipantInList(participants, agentName, matchOptions);
  if (!expectedAgent || (requireAgentSessionReady && !isAgentSessionReady(expectedAgent))) {
    return null;
  }

  if (!requireRoomVideoInputReady) {
    return requireRoomInputParticipantsReady && !hasReadyRoomInputParticipants(participants)
      ? null
      : expectedAgent;
  }

  if (!hasReadyRoomVideoInput(participants)) {
    return null;
  }
  return requireRoomInputParticipantsReady && !hasReadyRoomInputParticipants(participants)
    ? null
    : expectedAgent;
}

export function summarizeRoomInputReadiness(participants: ParticipantInfo[]) {
  return {
    audioParticipantReady: hasActiveParticipant(participants, ROOM_AUDIO_INPUT_IDENTITY),
    visionParticipantReady: hasActiveParticipant(participants, ROOM_VIDEO_INPUT_IDENTITY),
  };
}

export function summarizePrewarmReadiness(participants: ParticipantInfo[], agentName: string) {
  const agent = findAgentParticipantInList(participants, agentName);
  return {
    agentSessionReady: agent !== null && isAgentSessionReady(agent),
    ...summarizeRoomInputReadiness(participants),
  };
}

export function findAgentParticipantInList(
  participants: ParticipantInfo[],
  agentName: string,
  options: AgentParticipantMatchOptions = {}
): ParticipantInfo | null {
  const expectedAgent = participants.find((participant) =>
    isExpectedAgentParticipant(participant, agentName)
  );
  if (expectedAgent) {
    return expectedAgent;
  }
  if (!options.allowAnonymousLiveKitAgentFallback) {
    return null;
  }

  // Local LiveKit may omit agent attributes; fresh per-session rooms keep this fallback bounded.
  const anonymousLiveKitAgents = participants.filter(isAnonymousLiveKitAgentParticipant);
  return anonymousLiveKitAgents.length === 1 ? anonymousLiveKitAgents[0] : null;
}

function hasReadyRoomVideoInput(participants: ParticipantInfo[]) {
  const roomVideoTrackName = readRoomInputVideoTrackName();
  return participants.some(
    (participant) =>
      isParticipantActive(participant) &&
      participant.identity === ROOM_VIDEO_INPUT_IDENTITY &&
      (participant.tracks ?? []).some(
        (track) =>
          track.name === roomVideoTrackName &&
          track.type === TrackType.VIDEO &&
          track.muted !== true
      )
  );
}

function hasReadyRoomInputParticipants(participants: ParticipantInfo[]) {
  const readiness = summarizeRoomInputReadiness(participants);
  return readiness.audioParticipantReady && readiness.visionParticipantReady;
}

function hasActiveParticipant(participants: ParticipantInfo[], identity: string) {
  return participants.some(
    (participant) => participant.identity === identity && isParticipantActive(participant)
  );
}

function isExpectedAgentParticipant(participant: ParticipantInfo, agentName: string) {
  return (
    isParticipantActive(participant) &&
    readAgentNameAttribute(participant.attributes ?? {}) === agentName
  );
}

function isAgentSessionReady(participant: ParticipantInfo) {
  const attributes = participant.attributes ?? {};
  return (
    attributes[AGENT_SESSION_READY_ATTRIBUTE] === 'true' ||
    attributes[AGENT_SESSION_READY_ATTRIBUTE_CAMEL] === 'true'
  );
}

function isAnonymousLiveKitAgentParticipant(participant: ParticipantInfo) {
  const attributes = participant.attributes ?? {};
  return (
    isParticipantActive(participant) &&
    participant.kind === ParticipantInfo_Kind.AGENT &&
    participant.identity.startsWith('agent-') &&
    !readAgentNameAttribute(attributes)
  );
}

function isParticipantActive(participant: ParticipantInfo) {
  return participant.state === ParticipantInfo_State.ACTIVE;
}

function readAgentNameAttribute(attributes: Record<string, string>) {
  return attributes['lk.agent.name'] || attributes['lk.agent_name'] || attributes.lkAgentName || '';
}
