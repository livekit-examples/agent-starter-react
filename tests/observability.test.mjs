import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const {
  BACKEND_OBSERVABILITY_MARKER_TOPIC,
  BACKEND_MARKERS,
  FRONTEND_OBSERVABILITY_TOPIC,
  FRONTEND_EVENTS,
  OBSERVABILITY_ATTRS,
  OBSERVABILITY_EVENT_TYPES,
  beginFrontendObservabilitySession,
  endFrontendObservabilitySession,
  flushFrontendObservabilityEvents,
  outputSegmentAttributesFromMarker,
  parseBackendObservabilityMarkerPayload,
  publishFrontendObservabilityEvent,
  recordFrontendObservabilityEvent,
} = await import('../lib/observability.ts');

test('frontend observability does not publish when disabled', async () => {
  const calls = [];
  const room = {
    name: 'voice_assistant_room_a',
    localParticipant: {
      identity: 'voice_assistant_user_a',
      publishData: async (...args) => {
        calls.push(args);
      },
    },
  };

  const published = await publishFrontendObservabilityEvent({
    enabled: false,
    room,
    name: 'frontend.room.connected',
  });

  assert.equal(published, false);
  assert.equal(calls.length, 0);
});

test('frontend observability exports shared event protocol constants', () => {
  assert.equal(OBSERVABILITY_EVENT_TYPES.FRONTEND_EVENT, 'observability.frontend_event');
  assert.equal(OBSERVABILITY_EVENT_TYPES.BACKEND_MARKER, 'observability.backend_marker');
  assert.equal(
    FRONTEND_EVENTS.REPLY_AUDIO_PLAYBACK_STARTED,
    'frontend.reply_audio.playback_started'
  );
  assert.equal(FRONTEND_EVENTS.REPLY_AUDIO_PLAYBACK_ERROR, 'frontend.reply_audio.playback_error');
  assert.equal(
    FRONTEND_EVENTS.BROWSER_AUDIO_VAD_SPEECH_ENDED,
    'frontend.browser_audio.vad_speech_ended'
  );
  assert.equal(
    BACKEND_MARKERS.OUTPUT_AUDIO_SEGMENT_STARTED,
    'backend.output_audio.segment_started'
  );
  assert.equal(OBSERVABILITY_ATTRS.PARTICIPANT_IDENTITY, 'livekit.participant_identity');
  assert.equal(OBSERVABILITY_ATTRS.PARTICIPANT_IDENTITY_LEGACY, 'livekit.participant');
  assert.equal(OBSERVABILITY_ATTRS.OUTPUT_SEGMENT_ID, 'observability.output_segment_id');
  assert.equal(OBSERVABILITY_ATTRS.VAD_PROVIDER, 'observability.vad.provider');
  assert.equal(OBSERVABILITY_ATTRS.VAD_MODEL, 'observability.vad.model');
  assert.equal(OBSERVABILITY_ATTRS.VAD_AUDIO_DURATION_MS, 'observability.vad.audio_duration_ms');
  assert.equal(OBSERVABILITY_ATTRS.TRACK_NAME, 'livekit.track_name');
  assert.equal(OBSERVABILITY_ATTRS.TRACK_SID, 'livekit.track_sid');
  assert.equal(OBSERVABILITY_ATTRS.TRACK_SOURCE, 'livekit.track_source');
  assert.equal(OBSERVABILITY_ATTRS.TRACK_STREAM_NAME, 'livekit.stream_name');
});

test('frontend observability publishes livekit data packet payload', async () => {
  const calls = [];
  const room = {
    name: 'voice_assistant_room_a',
    localParticipant: {
      identity: 'voice_assistant_user_a',
      publishData: async (...args) => {
        calls.push(args);
      },
    },
  };

  const published = await publishFrontendObservabilityEvent({
    enabled: true,
    room,
    name: 'frontend.browser_audio.track_published',
    attributes: {
      'livekit.track_name': 'browser_audio_track',
      'livekit.track_sid': 'TR_A',
    },
    now: () => 1_779_773_931_123,
    performanceNow: () => 123.45,
  });

  assert.equal(published, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], {
    reliable: true,
    topic: FRONTEND_OBSERVABILITY_TOPIC,
  });

  const payload = JSON.parse(new TextDecoder().decode(calls[0][0]));
  assert.deepEqual(payload, {
    schema_version: 1,
    type: 'observability.frontend_event',
    name: 'frontend.browser_audio.track_published',
    wall_time_unix_ms: 1_779_773_931_123,
    performance_now_ms: 123.45,
    room_name: 'voice_assistant_room_a',
    participant_identity: 'voice_assistant_user_a',
    attributes: {
      'livekit.track_name': 'browser_audio_track',
      'livekit.track_sid': 'TR_A',
    },
  });
});

test('frontend observability can publish an explicit event wall time', async () => {
  const calls = [];
  const room = {
    localParticipant: {
      publishData: async (...args) => {
        calls.push(args);
      },
    },
  };

  await publishFrontendObservabilityEvent({
    enabled: true,
    room,
    name: 'frontend.browser_audio.vad_speech_ended',
    wallTimeUnixMs: 1_779_773_930_777,
    now: () => 1_779_773_931_123,
    performanceNow: () => 456.78,
  });

  const payload = JSON.parse(new TextDecoder().decode(calls[0][0]));
  assert.equal(payload.wall_time_unix_ms, 1_779_773_930_777);
  assert.equal(payload.performance_now_ms, 456.78);
});

test('frontend observability buffers startup events until the agent can receive them', async () => {
  const calls = [];
  const room = {
    name: 'voice_assistant_room_a',
    localParticipant: {
      identity: 'voice_assistant_user_a',
      publishData: async (...args) => {
        calls.push(args);
      },
    },
  };

  beginFrontendObservabilitySession(room);
  await recordFrontendObservabilityEvent({
    enabled: true,
    room,
    name: FRONTEND_EVENTS.ROOM_CONNECT_STARTED,
    wallTimeUnixMs: 100,
    performanceNowMs: 10,
  });
  await recordFrontendObservabilityEvent({
    enabled: true,
    room,
    name: FRONTEND_EVENTS.ROOM_CONNECT_FINISHED,
    wallTimeUnixMs: 200,
    performanceNowMs: 20,
  });

  assert.equal(calls.length, 0);
  assert.equal(await flushFrontendObservabilityEvents({ enabled: true, room }), 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(([payload]) => {
      const event = JSON.parse(new TextDecoder().decode(payload));
      return [event.name, event.wall_time_unix_ms, event.performance_now_ms];
    }),
    [
      [FRONTEND_EVENTS.ROOM_CONNECT_STARTED, 100, 10],
      [FRONTEND_EVENTS.ROOM_CONNECT_FINISHED, 200, 20],
    ]
  );

  await recordFrontendObservabilityEvent({
    enabled: true,
    room,
    name: FRONTEND_EVENTS.DISPATCH_FINISHED,
    wallTimeUnixMs: 300,
    performanceNowMs: 30,
  });
  assert.equal(calls.length, 3);
  endFrontendObservabilitySession(room);
});

test('frontend observability flush is best effort and switches to live publishing', async () => {
  let publishCalls = 0;
  const room = {
    localParticipant: {
      publishData: async () => {
        publishCalls += 1;
        if (publishCalls === 1) throw new Error('participant not ready');
      },
    },
  };
  beginFrontendObservabilitySession(room);
  await recordFrontendObservabilityEvent({
    enabled: true,
    room,
    name: FRONTEND_EVENTS.ROOM_CONNECT_STARTED,
  });
  await recordFrontendObservabilityEvent({
    enabled: true,
    room,
    name: FRONTEND_EVENTS.ROOM_CONNECT_FINISHED,
  });

  assert.equal(await flushFrontendObservabilityEvents({ enabled: true, room }), 1);
  await recordFrontendObservabilityEvent({
    enabled: true,
    room,
    name: FRONTEND_EVENTS.DISPATCH_FINISHED,
  });

  assert.equal(publishCalls, 3);
  endFrontendObservabilitySession(room);
});

test('frontend observability parses backend output segment markers', () => {
  const payload = {
    schema_version: 1,
    type: 'observability.backend_marker',
    name: 'backend.output_audio.segment_started',
    attributes: {
      'observability.turn_id': 'turn-000001',
      'observability.output_segment_id': 'turn-000001-output-002',
      'observability.output_segment_index': 2,
      'observability.output_segment_kind': 'final',
      'livekit.participant_identity': 'agent',
      'livekit.track_name': 'assistant_audio',
    },
  };

  const marker = parseBackendObservabilityMarkerPayload(
    new TextEncoder().encode(JSON.stringify(payload)),
    BACKEND_OBSERVABILITY_MARKER_TOPIC
  );

  assert.equal(marker?.name, 'backend.output_audio.segment_started');
  assert.deepEqual(outputSegmentAttributesFromMarker(marker), {
    'observability.turn_id': 'turn-000001',
    'observability.output_segment_id': 'turn-000001-output-002',
    'observability.output_segment_index': 2,
    'observability.output_segment_kind': 'final',
  });
});

test('frontend observability rejects oversized backend marker names', () => {
  const marker = parseBackendObservabilityMarkerPayload(
    JSON.stringify({
      schema_version: 1,
      type: 'observability.backend_marker',
      name: `backend.${'x'.repeat(122)}`,
      attributes: {},
    }),
    BACKEND_OBSERVABILITY_MARKER_TOPIC
  );

  assert.equal(marker, null);
});

test('frontend observability rejects array backend marker attributes', () => {
  const marker = parseBackendObservabilityMarkerPayload(
    JSON.stringify({
      schema_version: 1,
      type: 'observability.backend_marker',
      name: 'backend.output_audio.segment_started',
      attributes: ['unexpected'],
    }),
    BACKEND_OBSERVABILITY_MARKER_TOPIC
  );

  assert.deepEqual(marker?.attributes, {});
});

test('frontend observability rejects backend markers on the wrong topic', () => {
  const marker = parseBackendObservabilityMarkerPayload(
    JSON.stringify({
      schema_version: 1,
      type: 'observability.backend_marker',
      name: 'backend.output_audio.segment_started',
      attributes: {},
    }),
    FRONTEND_OBSERVABILITY_TOPIC
  );

  assert.equal(marker, null);
});

test('app routes playback observability through the filtered audio renderer', async () => {
  const source = await readFile('components/app/app.tsx', 'utf8');

  assert.match(source, /FilteredAudioRenderer/);
  assert.match(source, /observabilityEnabled=\{appConfig\.observabilityEnabled\}/);
  assert.doesNotMatch(source, /RemoteAudioPlaybackObserver/);
});

test('track exclusion helpers ignore empty exclude names', async () => {
  const sources = await Promise.all(
    [
      'components/livekit/filtered-audio-renderer.tsx',
      'hooks/useAudioTrackFilter.ts',
      'hooks/useExcludedVideoTracks.ts',
    ].map(async (path) => [path, await readFile(path, 'utf8')])
  );

  for (const [path, source] of sources) {
    assert.match(source, /if \(!excludeName\) \{\s*return false;\s*\}/, path);
    assert.doesNotMatch(source, /trackName === excludeName/, path);
  }
});

test('filtered audio renderer reports real element playback with backend marker context', async () => {
  const source = await readFile('components/livekit/filtered-audio-renderer.tsx', 'utf8');

  assert.match(source, /audioElement\.play\(\)/);
  assert.match(
    source,
    /playPromise[\s\S]*\.then\(\(\) => \{[\s\S]*startPlaybackObserver\(elementKey, diagnostics, mediaStreamTrack\)/
  );
  assert.match(source, /FRONTEND_EVENTS\.REPLY_AUDIO_PLAYBACK_STARTED/);
  assert.match(source, /FRONTEND_EVENTS\.REPLY_AUDIO_PLAYBACK_ENDED/);
  assert.match(source, /FRONTEND_EVENTS\.REPLY_AUDIO_PLAYBACK_ERROR/);
  assert.match(source, /resumeErrorEventName: FRONTEND_EVENTS\.REPLY_AUDIO_PLAYBACK_ERROR/);
  assert.match(
    source,
    /emit: \(name, attributes\) => recordFrontendObservabilityRef\.current\(name, attributes\)/
  );
  assert.match(
    source,
    /const startPlaybackObserver = \([\s\S]*if \(!observabilityEnabledRef\.current\) \{[\s\S]*return;[\s\S]*\}[\s\S]*startMediaTrackAudioObserver/
  );
  assert.match(source, /recordFrontendObservabilityRef\.current/);
  assert.match(source, /addEventListener\('playing', handleElementPlaybackStarted\)/);
  assert.match(source, /activePlaybackSources\.get\(elementKey\)/);
  assert.match(
    source,
    /const handleElementPlaybackError = \(\) => \{[\s\S]*const playbackSource = activePlaybackSources\.get\(elementKey\);[\s\S]*recordPlaybackError\(\s*playbackSource\?\.diagnostics \?\? diagnostics,/
  );
  assert.doesNotMatch(source, /playbackObserverStops\.clear\(\)/);
  assert.match(source, /parseBackendObservabilityMarkerPayload/);
  assert.match(source, /outputSegmentAttributesFromMarker/);
  assert.match(
    source,
    /if \(!observabilityEnabled\) \{[\s\S]*outputSegments\.clear\(\);[\s\S]*return;[\s\S]*\}[\s\S]*room\.on\(RoomEvent\.DataReceived/
  );
  assert.doesNotMatch(
    source,
    /room,\s*participants,\s*excludeTrackNames,\s*volume,\s*debugAudio,\s*observabilityEnabled/
  );
  assert.doesNotMatch(source, /startsWith\(prefix\)/);
  assert.match(source, /OBSERVABILITY_ATTRS\.PARTICIPANT_IDENTITY/);
  assert.match(source, /OBSERVABILITY_ATTRS\.PARTICIPANT_IDENTITY_LEGACY/);
  assert.match(source, /OBSERVABILITY_ATTRS\.TRACK_NAME/);
  assert.match(source, /OBSERVABILITY_ATTRS\.TRACK_SID/);
  assert.match(source, /OBSERVABILITY_ATTRS\.TRACK_SOURCE/);
  assert.doesNotMatch(source, /marker\.attributes\['livekit\.participant'\]/);
  assert.doesNotMatch(source, /'livekit\.track_name'/);
  assert.doesNotMatch(source, /'livekit\.track_sid'/);
  assert.doesNotMatch(source, /'livekit\.track_source'/);
  assert.match(source, /canonical backend marker field -> legacy field -> LiveKit sender/);
});

test('browser source client publishes frontend audio observability events', async () => {
  const source = await readFile('hooks/useBrowserSourceClient.ts', 'utf8');

  assert.match(source, /startMediaTrackVadObserver/);
  assert.match(source, /FRONTEND_EVENTS\.BROWSER_AUDIO_TRACK_PUBLISHED/);
  assert.match(source, /FRONTEND_EVENTS\.BROWSER_AUDIO_TRACK_UNPUBLISHED/);
  assert.match(source, /FRONTEND_EVENTS\.BROWSER_AUDIO_VAD_SPEECH_STARTED/);
  assert.match(source, /FRONTEND_EVENTS\.BROWSER_AUDIO_VAD_SPEECH_ENDED/);
  assert.doesNotMatch(source, /FRONTEND_EVENTS\.BROWSER_AUDIO_USER_SPEECH_ENDED/);
  assert.match(source, /FRONTEND_EVENTS\.BROWSER_AUDIO_VAD_PROBE_UNAVAILABLE/);
  assert.match(source, /OBSERVABILITY_ATTRS\.VAD_PROVIDER/);
  assert.match(source, /OBSERVABILITY_ATTRS\.VAD_MODEL/);
  assert.match(source, /OBSERVABILITY_ATTRS\.VAD_AUDIO_DURATION_MS/);
  assert.doesNotMatch(source, /OBSERVABILITY_ATTRS\.FRONTEND_AUDIO_CONFIRMATION_WALL_TIME_UNIX_MS/);
  assert.doesNotMatch(source, /confirmationTimestampMs/);
  assert.match(source, /OBSERVABILITY_ATTRS\.TRACK_NAME/);
  assert.match(source, /OBSERVABILITY_ATTRS\.TRACK_SID/);
  assert.match(source, /OBSERVABILITY_ATTRS\.TRACK_STREAM_NAME/);
  assert.doesNotMatch(source, /'livekit\.track_name'/);
  assert.doesNotMatch(source, /'livekit\.track_sid'/);
  assert.doesNotMatch(source, /'livekit\.stream_name'/);
  assert.match(source, /'vad-web'/);
  assert.doesNotMatch(source, /startMediaTrackTailObserver/);
  assert.doesNotMatch(source, /BROWSER_AUDIO_LAST_ACTIVE_FRAME_SENT/);
  assert.match(source, /stop:\s*\(\) => Promise<void>/);
  assert.match(
    source,
    /try \{[\s\S]*await stopObservedAudio\?\.\(\);[\s\S]*\} catch \(error\) \{[\s\S]*VAD observer stop failed[\s\S]*\} finally \{[\s\S]*track\.stop\(\);[\s\S]*FRONTEND_EVENTS\.BROWSER_AUDIO_TRACK_UNPUBLISHED/
  );
  assert.doesNotMatch(source, /audioCaptureTrack/);
  assert.doesNotMatch(source, /syncBrowserAudioEnabled/);
});

test('frontend vad observer defaults to local bundled assets', async () => {
  const source = await readFile('lib/frontend-vad-observer.ts', 'utf8');

  assert.match(source, /DEFAULT_VAD_ASSET_BASE_PATH = '\/vad-web\/'/);
  assert.match(source, /DEFAULT_ONNX_WASM_BASE_PATH = '\/onnxruntime-web\/'/);
  assert.doesNotMatch(source, /cdn\.jsdelivr/);
  assert.match(source, /stop:\s*\(\) => Promise<void>/);
  assert.match(source, /await vad\.pause\?\.\(\)/);
  assert.match(source, /await vad\.destroy\?\.\(\)/);
});

test('package scripts sync local vad assets before install and build', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts['sync:vad-assets'], 'node scripts/sync-vad-assets.js');
  assert.equal(packageJson.scripts.postinstall, 'node scripts/sync-vad-assets.js');
  assert.equal(packageJson.scripts.prebuild, 'node scripts/sync-vad-assets.js');
});

test('frontend audio observer reuses shared observability attribute types', async () => {
  const source = await readFile('lib/frontend-audio-observer.ts', 'utf8');

  assert.match(source, /type ObservabilityAttributes/);
  assert.doesNotMatch(source, /type ObservabilityAttribute =/);
});

test('room hook publishes room connected frontend observability event', async () => {
  const source = await readFile('hooks/useRoom.ts', 'utf8');
  const recoverySource = source.slice(
    source.indexOf('const recoverFromStartError'),
    source.indexOf('const handleStartError')
  );

  assert.match(source, /FRONTEND_EVENTS\.ROOM_CONNECTED/);
  assert.match(source, /recordFrontendObservabilityEvent/);
  assert.match(source, /flushFrontendObservabilityEvents/);
  assert.ok(
    recoverySource.indexOf('flushFrontendObservabilityEvents') <
      recoverySource.indexOf('room.disconnect()')
  );
  assert.match(
    source,
    /const recoverFromStartError = async[\s\S]*try \{[\s\S]*await browserSourceClient\.stop\(\);[\s\S]*\} catch \(stopError\)[\s\S]*\} finally \{[\s\S]*room\.disconnect\(\);[\s\S]*\}/
  );
  assert.match(
    source,
    /const endSession = useCallback\(async \(\) => \{[\s\S]*try \{[\s\S]*await browserSourceClient\.stop\(\);[\s\S]*\} catch \(error\)[\s\S]*\} finally \{[\s\S]*room\.disconnect\(\);[\s\S]*resetVoiceSessionId\(\);[\s\S]*setIsSessionActive\(false\);[\s\S]*\}/
  );
});
