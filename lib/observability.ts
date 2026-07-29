export const OBSERVABILITY_EVENT_TYPES = {
  FRONTEND_EVENT: 'observability.frontend_event',
  BACKEND_MARKER: 'observability.backend_marker',
} as const;

export const FRONTEND_EVENTS = {
  CONNECTION_DETAILS_STARTED: 'frontend.connection_details.started',
  CONNECTION_DETAILS_FINISHED: 'frontend.connection_details.finished',
  ROOM_CONNECT_STARTED: 'frontend.room_connect.started',
  ROOM_CONNECT_FINISHED: 'frontend.room_connect.finished',
  ROOM_CONNECTED: 'frontend.room.connected',
  DISPATCH_STARTED: 'frontend.dispatch.started',
  DISPATCH_FINISHED: 'frontend.dispatch.finished',
  BROWSER_AUDIO_CAPTURE_STARTED: 'frontend.browser_audio.capture_started',
  BROWSER_AUDIO_CAPTURE_FINISHED: 'frontend.browser_audio.capture_finished',
  BROWSER_AUDIO_PUBLISH_STARTED: 'frontend.browser_audio.publish_started',
  BROWSER_AUDIO_PUBLISH_FINISHED: 'frontend.browser_audio.publish_finished',
  BROWSER_AUDIO_TRACK_PUBLISHED: 'frontend.browser_audio.track_published',
  BROWSER_AUDIO_TRACK_UNPUBLISHED: 'frontend.browser_audio.track_unpublished',
  BROWSER_AUDIO_TRACK_MUTED: 'frontend.browser_audio.track_muted',
  BROWSER_AUDIO_TRACK_UNMUTED: 'frontend.browser_audio.track_unmuted',
  BROWSER_AUDIO_VAD_SPEECH_STARTED: 'frontend.browser_audio.vad_speech_started',
  BROWSER_AUDIO_VAD_SPEECH_ENDED: 'frontend.browser_audio.vad_speech_ended',
  BROWSER_AUDIO_VAD_PROBE_UNAVAILABLE: 'frontend.browser_audio.vad_probe_unavailable',
  BROWSER_VIDEO_CAPTURE_STARTED: 'frontend.browser_video.capture_started',
  BROWSER_VIDEO_CAPTURE_FINISHED: 'frontend.browser_video.capture_finished',
  BROWSER_VIDEO_PUBLISH_STARTED: 'frontend.browser_video.publish_started',
  BROWSER_VIDEO_PUBLISH_FINISHED: 'frontend.browser_video.publish_finished',
  BROWSER_VIDEO_TRACK_PUBLISHED: 'frontend.browser_video.track_published',
  REPLY_AUDIO_PLAYBACK_STARTED: 'frontend.reply_audio.playback_started',
  REPLY_AUDIO_PLAYBACK_ENDED: 'frontend.reply_audio.playback_ended',
  REPLY_AUDIO_PLAYBACK_ERROR: 'frontend.reply_audio.playback_error',
} as const;

export const BACKEND_MARKERS = {
  OUTPUT_AUDIO_SEGMENT_STARTED: 'backend.output_audio.segment_started',
  OUTPUT_AUDIO_SEGMENT_FINISHED: 'backend.output_audio.segment_finished',
  OUTPUT_AUDIO_PLAYBACK_FINISHED: 'backend.output_audio.playback_finished',
} as const;

export const OBSERVABILITY_ATTRS = {
  TURN_ID: 'observability.turn_id',
  OUTPUT_SEGMENT_ID: 'observability.output_segment_id',
  OUTPUT_SEGMENT_INDEX: 'observability.output_segment_index',
  OUTPUT_SEGMENT_KIND: 'observability.output_segment_kind',
  PARTICIPANT_IDENTITY: 'livekit.participant_identity',
  PARTICIPANT_IDENTITY_LEGACY: 'livekit.participant',
  FRONTEND_AUDIO_DIRECTION: 'observability.frontend_audio.direction',
  FRONTEND_AUDIO_PROBE: 'observability.frontend_audio.probe',
  FRONTEND_AUDIO_LEVEL: 'observability.frontend_audio.level',
  FRONTEND_AUDIO_REASON: 'observability.frontend_audio.reason',
  FRONTEND_AUDIO_ERROR: 'observability.frontend_audio.error',
  VAD_PROVIDER: 'observability.vad.provider',
  VAD_MODEL: 'observability.vad.model',
  VAD_AUDIO_DURATION_MS: 'observability.vad.audio_duration_ms',
  TRACK_NAME: 'livekit.track_name',
  TRACK_SID: 'livekit.track_sid',
  TRACK_SOURCE: 'livekit.track_source',
  TRACK_STREAM_NAME: 'livekit.stream_name',
} as const;

export const FRONTEND_OBSERVABILITY_TOPIC = OBSERVABILITY_EVENT_TYPES.FRONTEND_EVENT;
export const BACKEND_OBSERVABILITY_MARKER_TOPIC = OBSERVABILITY_EVENT_TYPES.BACKEND_MARKER;

export type ObservabilityAttribute = string | number | boolean | null;
export type ObservabilityAttributes = Record<string, ObservabilityAttribute>;

export interface BackendObservabilityMarker {
  name: string;
  attributes: ObservabilityAttributes;
}

const MAX_BACKEND_MARKER_NAME_LENGTH = 128;

export type PublishableRoom = {
  name?: string;
  localParticipant?: {
    identity?: string;
    publishData?: (
      data: Uint8Array,
      options?: { reliable?: boolean; topic?: string }
    ) => Promise<void> | void;
  };
};

interface PublishFrontendObservabilityEventOptions {
  enabled: boolean;
  room: PublishableRoom;
  name: string;
  attributes?: Record<string, ObservabilityAttribute>;
  wallTimeUnixMs?: number;
  performanceNowMs?: number;
  now?: () => number;
  performanceNow?: () => number;
}

export async function publishFrontendObservabilityEvent({
  enabled,
  room,
  name,
  attributes,
  wallTimeUnixMs,
  performanceNowMs,
  now = () => Date.now(),
  performanceNow = defaultPerformanceNow,
}: PublishFrontendObservabilityEventOptions) {
  if (!enabled) {
    return false;
  }
  if (typeof room.localParticipant?.publishData !== 'function') {
    return false;
  }

  const payload = {
    schema_version: 1,
    type: OBSERVABILITY_EVENT_TYPES.FRONTEND_EVENT,
    name,
    wall_time_unix_ms: wallTimeUnixMs ?? now(),
    performance_now_ms: performanceNowMs ?? performanceNow(),
    room_name: room.name || undefined,
    participant_identity: room.localParticipant?.identity || undefined,
    attributes: attributes ?? {},
  };
  await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), {
    reliable: true,
    topic: FRONTEND_OBSERVABILITY_TOPIC,
  });
  return true;
}

interface BufferedFrontendObservabilityEvent {
  name: string;
  attributes?: Record<string, ObservabilityAttribute>;
  wallTimeUnixMs: number;
  performanceNowMs: number;
}

interface FrontendObservabilitySession {
  live: boolean;
  events: BufferedFrontendObservabilityEvent[];
}

const frontendObservabilitySessions = new WeakMap<PublishableRoom, FrontendObservabilitySession>();

export function beginFrontendObservabilitySession(room: PublishableRoom) {
  frontendObservabilitySessions.set(room, { live: false, events: [] });
}

export function endFrontendObservabilitySession(room: PublishableRoom) {
  frontendObservabilitySessions.delete(room);
}

export async function recordFrontendObservabilityEvent({
  enabled,
  room,
  name,
  attributes,
  wallTimeUnixMs = Date.now(),
  performanceNowMs = defaultPerformanceNow(),
}: Omit<PublishFrontendObservabilityEventOptions, 'now' | 'performanceNow'>) {
  if (!enabled) {
    return false;
  }

  const session = frontendObservabilitySessions.get(room);
  if (session && !session.live) {
    session.events.push({ name, attributes, wallTimeUnixMs, performanceNowMs });
    return true;
  }

  return publishFrontendObservabilityEvent({
    enabled,
    room,
    name,
    attributes,
    wallTimeUnixMs,
    performanceNowMs,
  });
}

export async function flushFrontendObservabilityEvents({
  enabled,
  room,
}: {
  enabled: boolean;
  room: PublishableRoom;
}) {
  if (!enabled) {
    return 0;
  }

  const session = frontendObservabilitySessions.get(room);
  if (!session || session.live) {
    return 0;
  }

  let published = 0;
  while (session.events.length > 0) {
    const event = session.events[0];
    try {
      if (await publishFrontendObservabilityEvent({ enabled, room, ...event })) {
        published += 1;
      }
    } catch (error) {
      console.warn('[frontend-observability] failed to flush startup event', error);
    } finally {
      session.events.shift();
    }
  }
  session.live = true;
  return published;
}

export function parseBackendObservabilityMarkerPayload(
  payload: Uint8Array | string,
  topic?: string
): BackendObservabilityMarker | null {
  if (topic !== BACKEND_OBSERVABILITY_MARKER_TOPIC) {
    return null;
  }

  let decoded = '';
  try {
    decoded = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const packet = parsed as {
    schema_version?: unknown;
    type?: unknown;
    name?: unknown;
    attributes?: unknown;
  };
  if (packet.schema_version !== 1 || packet.type !== OBSERVABILITY_EVENT_TYPES.BACKEND_MARKER) {
    return null;
  }
  const name = typeof packet.name === 'string' ? packet.name.trim() : '';
  if (!name.startsWith('backend.')) {
    return null;
  }
  if (name.length > MAX_BACKEND_MARKER_NAME_LENGTH) {
    return null;
  }

  return {
    name,
    attributes: sanitizeObservabilityAttributes(packet.attributes),
  };
}

export function outputSegmentAttributesFromMarker(
  marker: BackendObservabilityMarker | null | undefined
): ObservabilityAttributes {
  if (!marker) {
    return {};
  }
  const output: ObservabilityAttributes = {};
  for (const key of [
    OBSERVABILITY_ATTRS.TURN_ID,
    OBSERVABILITY_ATTRS.OUTPUT_SEGMENT_ID,
    OBSERVABILITY_ATTRS.OUTPUT_SEGMENT_INDEX,
    OBSERVABILITY_ATTRS.OUTPUT_SEGMENT_KIND,
  ]) {
    const value = marker.attributes[key];
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function sanitizeObservabilityAttributes(value: unknown): ObservabilityAttributes {
  if (!value || typeof value !== 'object') {
    return {};
  }
  if (Array.isArray(value)) {
    return {};
  }
  const output: ObservabilityAttributes = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!key) {
      continue;
    }
    if (
      rawValue === null ||
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean'
    ) {
      output[key] = rawValue;
    } else {
      output[key] = String(rawValue);
    }
  }
  return output;
}

function defaultPerformanceNow() {
  if (typeof performance === 'undefined') {
    return 0;
  }
  return performance.now();
}
