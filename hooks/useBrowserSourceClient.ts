'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LocalAudioTrack,
  LocalTrackPublication,
  LocalVideoTrack,
  Room,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from 'livekit-client';
import type { AppConfig } from '@/app-config';
import { startMediaTrackVadObserver } from '@/lib/frontend-vad-observer';
import {
  FRONTEND_EVENTS,
  OBSERVABILITY_ATTRS,
  publishFrontendObservabilityEvent,
} from '@/lib/observability';

const BROWSER_AUDIO_TRACK_NAME = 'browser_audio_track';
const BROWSER_VIDEO_TRACK_NAME = 'browser_video_track';
const DEFAULT_BROWSER_MEDIA_STREAM_NAME = 'browser_input';
const BROWSER_VIDEO_DEFAULT_ENABLED = true;
const BROWSER_VIDEO_STATS_INTERVAL_MS = 5000;
const BROWSER_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

interface BrowserSourceRuntime {
  audioTrack: LocalAudioTrack | null;
  videoTrack: LocalVideoTrack | null;
  audioPublication: LocalTrackPublication | null;
  videoPublication: LocalTrackPublication | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  videoStatsStartedAt: number | null;
  videoStatsTimer: number | null;
  previousVideoStats: BrowserVideoStatsSnapshot | null;
  audioObserverStop: (() => Promise<void>) | null;
}

interface BrowserVideoStatsSnapshot {
  timestamp: number;
  bytesSent: number;
  framesEncoded: number;
  packetsSent: number;
  retransmittedPacketsSent: number;
}

export interface BrowserSourceClient {
  enabled: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  videoTrack: LocalVideoTrack | null;
  audioPending: boolean;
  videoPending: boolean;
  setAudioDeviceId: (deviceId: string) => Promise<void>;
  setAudioEnabled: (enabled: boolean) => Promise<void>;
  setVideoEnabled: (enabled: boolean) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface BrowserSourceClientOptions {
  onVideoError?: (error: Error) => void;
}

export function useBrowserSourceClient(
  room: Room,
  appConfig: AppConfig,
  { onVideoError }: BrowserSourceClientOptions = {}
) {
  const runtimeRef = useRef<BrowserSourceRuntime | null>(null);
  const audioConfigured =
    appConfig.usesBrowserRawAudioInput ?? !!appConfig.usesBrowserRawMediaInput;
  const videoConfigured =
    appConfig.usesBrowserRawVideoInput ?? !!appConfig.usesBrowserRawMediaInput;
  const enabled = audioConfigured || videoConfigured;
  const browserMediaStreamName =
    appConfig.browserMediaStreamName || DEFAULT_BROWSER_MEDIA_STREAM_NAME;
  const browserVideoFrameRate = appConfig.browserVideoFps ?? 25;
  const browserVideoMaxBitrate = appConfig.browserVideoMaxBitrate ?? 1700000;
  const browserVideoWidth = appConfig.browserVideoWidth ?? 640;
  const browserVideoHeight = appConfig.browserVideoHeight ?? 480;
  const browserVideoStatsEnabled = appConfig.browserVideoStats || appConfig.debugVideo || false;
  const audioEnabledRef = useRef(audioConfigured);
  const audioDeviceIdRef = useRef<string | null>(null);
  const videoEnabledRef = useRef(videoConfigured ? BROWSER_VIDEO_DEFAULT_ENABLED : false);
  const [audioEnabled, setAudioEnabledState] = useState(audioConfigured);
  const [videoEnabled, setVideoEnabledState] = useState(
    videoConfigured ? BROWSER_VIDEO_DEFAULT_ENABLED : false
  );
  const [videoTrack, setVideoTrackState] = useState<LocalVideoTrack | null>(null);
  const [audioPending, setAudioPending] = useState(false);
  const [videoPending, setVideoPending] = useState(false);
  const recordFrontendObservability = useCallback(
    (
      name: string,
      attributes?: Record<string, string | number | boolean | null>,
      options?: { wallTimeUnixMs?: number }
    ) => {
      void publishFrontendObservabilityEvent({
        enabled: !!appConfig.observabilityEnabled,
        room,
        name,
        attributes,
        wallTimeUnixMs: options?.wallTimeUnixMs,
      }).catch((error) => {
        console.warn('[frontend-observability] failed to publish event', error);
      });
    },
    [appConfig.observabilityEnabled, room]
  );

  const ensureAudioPublished = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!audioConfigured || !runtime || runtime.audioTrack || !runtime.audioEnabled) {
      return;
    }

    const vadAttributes: Record<string, string | number | boolean | null> = {
      [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_DIRECTION]: 'input',
      [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_PROBE]: 'vad-web',
      [OBSERVABILITY_ATTRS.TRACK_NAME]: BROWSER_AUDIO_TRACK_NAME,
      [OBSERVABILITY_ATTRS.TRACK_SID]: null,
      [OBSERVABILITY_ATTRS.TRACK_STREAM_NAME]: browserMediaStreamName,
    };
    const audioTrack = await createLocalAudioTrack(
      buildAudioCaptureOptions(audioDeviceIdRef.current)
    );
    const captureTrack = audioTrack.mediaStreamTrack;
    audioTrack.mediaStreamTrack.enabled = runtime.audioEnabled;

    try {
      const publication = await room.localParticipant.publishTrack(audioTrack, {
        name: BROWSER_AUDIO_TRACK_NAME,
        source: Track.Source.Microphone,
        stream: browserMediaStreamName,
      });
      runtime.audioTrack = audioTrack;
      runtime.audioPublication = publication;
      runtime.audioObserverStop = null;
      vadAttributes[OBSERVABILITY_ATTRS.TRACK_SID] = publication.trackSid || null;
      recordFrontendObservability(FRONTEND_EVENTS.BROWSER_AUDIO_TRACK_PUBLISHED, {
        [OBSERVABILITY_ATTRS.TRACK_NAME]: BROWSER_AUDIO_TRACK_NAME,
        [OBSERVABILITY_ATTRS.TRACK_SID]: publication.trackSid || null,
        [OBSERVABILITY_ATTRS.TRACK_STREAM_NAME]: browserMediaStreamName,
      });
      if (appConfig.observabilityEnabled) {
        void startMediaTrackVadObserver({
          mediaStreamTrack: captureTrack,
          onSpeechStart: (event) => {
            recordFrontendObservability(
              FRONTEND_EVENTS.BROWSER_AUDIO_VAD_SPEECH_STARTED,
              {
                ...vadAttributes,
                [OBSERVABILITY_ATTRS.VAD_PROVIDER]: event.provider,
                [OBSERVABILITY_ATTRS.VAD_MODEL]: event.model,
              },
              { wallTimeUnixMs: event.timestampMs }
            );
          },
          onSpeechEnd: (event) => {
            recordFrontendObservability(
              FRONTEND_EVENTS.BROWSER_AUDIO_VAD_SPEECH_ENDED,
              {
                ...vadAttributes,
                [OBSERVABILITY_ATTRS.VAD_PROVIDER]: event.provider,
                [OBSERVABILITY_ATTRS.VAD_MODEL]: event.model,
                [OBSERVABILITY_ATTRS.VAD_AUDIO_DURATION_MS]: event.audioDurationMs ?? null,
              },
              { wallTimeUnixMs: event.timestampMs }
            );
          },
        })
          .then((observer) => {
            if (runtime.audioTrack === audioTrack) {
              runtime.audioObserverStop = observer.stop;
              return;
            }
            observer.stop();
          })
          .catch((error) => {
            if (runtime.audioTrack !== audioTrack) {
              return;
            }
            console.warn('[browser-audio] VAD observer unavailable', error);
            recordFrontendObservability(FRONTEND_EVENTS.BROWSER_AUDIO_VAD_PROBE_UNAVAILABLE, {
              [OBSERVABILITY_ATTRS.TRACK_NAME]: BROWSER_AUDIO_TRACK_NAME,
              [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_PROBE]: 'vad-web',
              [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_ERROR]:
                error instanceof Error ? error.message : String(error),
            });
          });
      }
    } catch (error) {
      audioTrack.stop();
      throw error;
    }
  }, [
    appConfig.observabilityEnabled,
    audioConfigured,
    browserMediaStreamName,
    recordFrontendObservability,
    room,
  ]);

  const ensureVideoPublished = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!videoConfigured || !runtime || runtime.videoTrack || !runtime.videoEnabled) {
      return;
    }

    const videoTrack = await createLocalVideoTrack({
      facingMode: 'user',
      frameRate: { ideal: browserVideoFrameRate, max: browserVideoFrameRate },
      resolution: {
        width: browserVideoWidth,
        height: browserVideoHeight,
        frameRate: browserVideoFrameRate,
      },
    });
    videoTrack.mediaStreamTrack.enabled = runtime.videoEnabled;

    try {
      const publication = await room.localParticipant.publishTrack(videoTrack, {
        name: BROWSER_VIDEO_TRACK_NAME,
        source: Track.Source.Camera,
        stream: browserMediaStreamName,
        simulcast: false,
        degradationPreference: 'maintain-resolution',
        videoEncoding: {
          maxBitrate: browserVideoMaxBitrate,
          maxFramerate: browserVideoFrameRate,
        },
      });
      runtime.videoTrack = videoTrack;
      runtime.videoPublication = publication;
      setVideoTrackState(videoTrack);
      if (browserVideoStatsEnabled) {
        startBrowserVideoStatsLogging(runtime, videoTrack, publication, room);
      }
    } catch (error) {
      videoTrack.stop();
      throw error;
    }
  }, [
    browserMediaStreamName,
    browserVideoFrameRate,
    browserVideoHeight,
    browserVideoMaxBitrate,
    browserVideoStatsEnabled,
    browserVideoWidth,
    room,
    videoConfigured,
  ]);

  const unpublishAudio = useCallback(
    async (runtime: BrowserSourceRuntime) => {
      const track = runtime.audioTrack;
      const publication = runtime.audioPublication;
      const stopObservedAudio = runtime.audioObserverStop;
      runtime.audioTrack = null;
      runtime.audioPublication = null;
      runtime.audioObserverStop = null;
      if (!track) return;

      await room.localParticipant.unpublishTrack(track, true).catch(() => undefined);
      try {
        await stopObservedAudio?.();
      } catch (error) {
        console.warn('[browser-audio] VAD observer stop failed', error);
      } finally {
        track.stop();
        recordFrontendObservability(FRONTEND_EVENTS.BROWSER_AUDIO_TRACK_UNPUBLISHED, {
          [OBSERVABILITY_ATTRS.TRACK_NAME]: BROWSER_AUDIO_TRACK_NAME,
          [OBSERVABILITY_ATTRS.TRACK_SID]: publication?.trackSid || null,
        });
      }
    },
    [recordFrontendObservability, room]
  );

  const unpublishVideo = useCallback(
    async (runtime: BrowserSourceRuntime) => {
      const track = runtime.videoTrack;
      stopBrowserVideoStatsLogging(runtime);
      runtime.videoTrack = null;
      runtime.videoPublication = null;
      setVideoTrackState(null);
      if (!track) return;

      await room.localParticipant.unpublishTrack(track, true).catch(() => undefined);
      track.stop();
    },
    [room]
  );

  const stop = useCallback(async () => {
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    if (!runtime) return;

    await Promise.all([unpublishAudio(runtime), unpublishVideo(runtime)]);
  }, [unpublishAudio, unpublishVideo]);

  const start = useCallback(async () => {
    if (!enabled || runtimeRef.current) {
      return;
    }

    runtimeRef.current = {
      audioTrack: null,
      videoTrack: null,
      audioPublication: null,
      videoPublication: null,
      audioEnabled: audioEnabledRef.current,
      videoEnabled: videoEnabledRef.current,
      videoStatsStartedAt: null,
      videoStatsTimer: null,
      previousVideoStats: null,
      audioObserverStop: null,
    };

    try {
      if (audioEnabledRef.current) {
        await ensureAudioPublished();
      }
    } catch (error) {
      await stop();
      throw error;
    }

    if (videoEnabledRef.current) {
      try {
        await ensureVideoPublished();
      } catch (error) {
        videoEnabledRef.current = false;
        setVideoEnabledState(false);
        const runtime = runtimeRef.current;
        if (runtime) {
          runtime.videoEnabled = false;
        }
        onVideoError?.(error as Error);
      }
    }
  }, [enabled, ensureAudioPublished, ensureVideoPublished, onVideoError, stop]);

  const setAudioEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (!audioConfigured) {
        return;
      }
      setAudioPending(true);
      const previousEnabled = audioEnabledRef.current;
      const runtime = runtimeRef.current;
      const previousRuntimeEnabled = runtime?.audioEnabled;
      const previousAudioTrack = runtime?.audioTrack ?? null;
      try {
        audioEnabledRef.current = nextEnabled;
        setAudioEnabledState(nextEnabled);

        if (!runtime) return;

        runtime.audioEnabled = nextEnabled;
        if (nextEnabled) {
          if (runtime.audioTrack) {
            syncTrackEnabled(runtime.audioTrack, true);
            await runtime.audioTrack.unmute();
            recordFrontendObservability(FRONTEND_EVENTS.BROWSER_AUDIO_TRACK_UNMUTED, {
              [OBSERVABILITY_ATTRS.TRACK_NAME]: BROWSER_AUDIO_TRACK_NAME,
            });
          } else {
            await ensureAudioPublished();
          }
        } else if (runtime.audioTrack) {
          syncTrackEnabled(runtime.audioTrack, false);
          await runtime.audioTrack.mute();
          recordFrontendObservability(FRONTEND_EVENTS.BROWSER_AUDIO_TRACK_MUTED, {
            [OBSERVABILITY_ATTRS.TRACK_NAME]: BROWSER_AUDIO_TRACK_NAME,
          });
        }
      } catch (error) {
        audioEnabledRef.current = previousEnabled;
        setAudioEnabledState(previousEnabled);
        if (runtime && previousRuntimeEnabled !== undefined) {
          runtime.audioEnabled = previousRuntimeEnabled;
          if (
            !previousRuntimeEnabled &&
            runtime.audioTrack &&
            runtime.audioTrack !== previousAudioTrack
          ) {
            await unpublishAudio(runtime);
          } else {
            syncTrackEnabled(runtime.audioTrack, previousRuntimeEnabled);
          }
        }
        throw error;
      } finally {
        setAudioPending(false);
      }
    },
    [audioConfigured, ensureAudioPublished, recordFrontendObservability, unpublishAudio]
  );

  const setAudioDeviceId = useCallback(
    async (deviceId: string) => {
      if (!audioConfigured) {
        return;
      }

      const nextDeviceId = normalizeAudioDeviceId(deviceId);
      const previousDeviceId = audioDeviceIdRef.current;
      if (nextDeviceId === previousDeviceId) {
        return;
      }

      setAudioPending(true);
      audioDeviceIdRef.current = nextDeviceId;
      const runtime = runtimeRef.current;
      try {
        if (runtime?.audioEnabled) {
          await unpublishAudio(runtime);
          await ensureAudioPublished();
        }
      } catch (error) {
        audioDeviceIdRef.current = previousDeviceId;
        if (runtime?.audioEnabled && !runtime.audioTrack) {
          await ensureAudioPublished().catch((restoreError) => {
            console.warn('[browser-audio] failed to restore previous input device', restoreError);
          });
        }
        throw error;
      } finally {
        setAudioPending(false);
      }
    },
    [audioConfigured, ensureAudioPublished, unpublishAudio]
  );

  const setVideoEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (!videoConfigured) {
        return;
      }
      setVideoPending(true);
      const previousEnabled = videoEnabledRef.current;
      const runtime = runtimeRef.current;
      const previousRuntimeEnabled = runtime?.videoEnabled;
      const previousVideoTrack = runtime?.videoTrack ?? null;
      try {
        videoEnabledRef.current = nextEnabled;
        setVideoEnabledState(nextEnabled);

        if (!runtime) return;

        runtime.videoEnabled = nextEnabled;
        if (nextEnabled) {
          await ensureVideoPublished();
          if (runtime.videoTrack) {
            runtime.videoTrack.mediaStreamTrack.enabled = true;
            await runtime.videoTrack.unmute();
          }
        } else {
          await unpublishVideo(runtime);
        }
      } catch (error) {
        videoEnabledRef.current = previousEnabled;
        setVideoEnabledState(previousEnabled);
        if (runtime && previousRuntimeEnabled !== undefined) {
          runtime.videoEnabled = previousRuntimeEnabled;
          if (
            !previousRuntimeEnabled &&
            runtime.videoTrack &&
            runtime.videoTrack !== previousVideoTrack
          ) {
            await unpublishVideo(runtime);
          } else {
            syncTrackEnabled(runtime.videoTrack, previousRuntimeEnabled);
          }
        }
        throw error;
      } finally {
        setVideoPending(false);
      }
    },
    [ensureVideoPublished, unpublishVideo, videoConfigured]
  );

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return useMemo(
    (): BrowserSourceClient => ({
      enabled,
      audioEnabled,
      videoEnabled,
      videoTrack,
      audioPending,
      videoPending,
      setAudioDeviceId,
      setAudioEnabled,
      setVideoEnabled,
      start,
      stop,
    }),
    [
      enabled,
      audioEnabled,
      videoEnabled,
      videoTrack,
      audioPending,
      videoPending,
      setAudioDeviceId,
      setAudioEnabled,
      setVideoEnabled,
      start,
      stop,
    ]
  );
}

function normalizeAudioDeviceId(deviceId: string | null | undefined) {
  if (!deviceId || deviceId === 'default') {
    return null;
  }

  return deviceId;
}

function buildAudioCaptureOptions(deviceId: string | null) {
  return {
    ...BROWSER_AUDIO_CONSTRAINTS,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

function syncTrackEnabled(track: LocalAudioTrack | LocalVideoTrack | null, enabled: boolean) {
  if (!track) return;

  track.mediaStreamTrack.enabled = enabled;
  void (enabled ? track.unmute() : track.mute()).catch(() => undefined);
}

function startBrowserVideoStatsLogging(
  runtime: BrowserSourceRuntime,
  track: LocalVideoTrack,
  publication: LocalTrackPublication,
  room: Room
) {
  stopBrowserVideoStatsLogging(runtime);
  runtime.videoStatsStartedAt = Date.now();
  runtime.previousVideoStats = null;

  const logStats = () => {
    void logBrowserVideoStats(runtime, track, publication, room).catch((error) => {
      console.warn('[browser-video-stats] failed to read WebRTC stats', error);
    });
  };

  logStats();
  runtime.videoStatsTimer = window.setInterval(logStats, BROWSER_VIDEO_STATS_INTERVAL_MS);
}

function stopBrowserVideoStatsLogging(runtime: BrowserSourceRuntime) {
  if (runtime.videoStatsTimer !== null) {
    window.clearInterval(runtime.videoStatsTimer);
  }

  runtime.videoStatsStartedAt = null;
  runtime.videoStatsTimer = null;
  runtime.previousVideoStats = null;
}

async function logBrowserVideoStats(
  runtime: BrowserSourceRuntime,
  track: LocalVideoTrack,
  publication: LocalTrackPublication,
  room: Room
) {
  if (runtime.videoTrack !== track || runtime.videoPublication !== publication) {
    return;
  }

  const report = await track.getRTCStatsReport();
  if (!report) {
    return;
  }

  const outbound = findStats(
    report,
    (stats) => stats.type === 'outbound-rtp' && isVideoStats(stats)
  );
  if (!outbound) {
    return;
  }

  const selectedPair = findSelectedCandidatePair(report);
  const remoteInbound = findStats(
    report,
    (stats) => stats.type === 'remote-inbound-rtp' && isVideoStats(stats)
  );
  const timestamp = Date.now();
  const previous = runtime.previousVideoStats;
  const snapshot: BrowserVideoStatsSnapshot = {
    timestamp,
    bytesSent: readNumber(outbound, 'bytesSent') ?? 0,
    framesEncoded: readNumber(outbound, 'framesEncoded') ?? 0,
    packetsSent: readNumber(outbound, 'packetsSent') ?? 0,
    retransmittedPacketsSent: readNumber(outbound, 'retransmittedPacketsSent') ?? 0,
  };
  runtime.previousVideoStats = snapshot;

  const elapsedMs = previous ? timestamp - previous.timestamp : 0;
  const elapsedSeconds = runtime.videoStatsStartedAt
    ? (timestamp - runtime.videoStatsStartedAt) / 1000
    : 0;
  const retransmittedPacketsDelta = previous
    ? snapshot.retransmittedPacketsSent - previous.retransmittedPacketsSent
    : undefined;
  const bytesSentDelta = previous ? snapshot.bytesSent - previous.bytesSent : undefined;
  const framesEncodedDelta = previous ? snapshot.framesEncoded - previous.framesEncoded : undefined;
  const packetsSentDelta = previous ? snapshot.packetsSent - previous.packetsSent : undefined;
  const settings = track.mediaStreamTrack.getSettings();

  const payload = {
    timestamp: new Date(timestamp).toISOString(),
    roomName: room.name,
    localParticipantIdentity: room.localParticipant.identity,
    trackName: BROWSER_VIDEO_TRACK_NAME,
    trackSid: publication.trackSid,
    elapsedSeconds: round(elapsedSeconds, 1),
    capture: {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      aspectRatio: settings.aspectRatio,
    },
    selectedCandidatePair: formatSelectedCandidatePair(report, selectedPair),
    video: {
      width: readNumber(outbound, 'frameWidth'),
      height: readNumber(outbound, 'frameHeight'),
      framesPerSecond: readNumber(outbound, 'framesPerSecond'),
      framesSent: readNumber(outbound, 'framesSent'),
      framesEncoded: snapshot.framesEncoded,
      framesEncodedDelta,
      framesDropped: readNumber(outbound, 'framesDropped'),
      sentFps:
        previous && elapsedMs > 0
          ? round(((snapshot.framesEncoded - previous.framesEncoded) * 1000) / elapsedMs, 1)
          : undefined,
      bitrateKbps:
        previous && elapsedMs > 0
          ? round(((snapshot.bytesSent - previous.bytesSent) * 8) / elapsedMs, 1)
          : undefined,
      bytesSent: snapshot.bytesSent,
      bytesSentDelta,
      targetBitrateKbps: bitsPerSecondToKbps(readNumber(outbound, 'targetBitrate')),
      packetsSent: snapshot.packetsSent,
      packetsSentDelta,
      retransmittedPacketsSent: snapshot.retransmittedPacketsSent,
      retransmittedPacketsDelta,
      nackCount: readNumber(outbound, 'nackCount'),
      pliCount: readNumber(outbound, 'pliCount'),
      firCount: readNumber(outbound, 'firCount'),
      totalEncodeTimeSeconds: readNumber(outbound, 'totalEncodeTime'),
      totalPacketSendDelaySeconds: readNumber(outbound, 'totalPacketSendDelay'),
      qpSum: readNumber(outbound, 'qpSum'),
      encoderImplementation: readString(outbound, 'encoderImplementation'),
      powerEfficientEncoder: readBoolean(outbound, 'powerEfficientEncoder'),
      qualityLimitationReason: readString(outbound, 'qualityLimitationReason'),
      qualityLimitationResolutionChanges: readNumber(
        outbound,
        'qualityLimitationResolutionChanges'
      ),
    },
    network: {
      availableOutgoingBitrateKbps: bitsPerSecondToKbps(
        readNumber(selectedPair, 'availableOutgoingBitrate')
      ),
      currentRoundTripTimeMs: secondsToMilliseconds(
        readNumber(selectedPair, 'currentRoundTripTime')
      ),
      remoteRoundTripTimeMs: secondsToMilliseconds(readNumber(remoteInbound, 'roundTripTime')),
      remoteJitterMs: secondsToMilliseconds(readNumber(remoteInbound, 'jitter')),
      remotePacketsLost: readNumber(remoteInbound, 'packetsLost'),
      remoteFractionLost: readNumber(remoteInbound, 'fractionLost'),
    },
  };

  console.info('[browser-video-stats]', JSON.stringify(payload));
}

type StatsRecord = RTCStats & Record<string, unknown>;

function findStats(
  report: RTCStatsReport,
  predicate: (stats: StatsRecord) => boolean
): StatsRecord | undefined {
  let match: StatsRecord | undefined;
  report.forEach((stats) => {
    const record = stats as StatsRecord;
    if (!match && predicate(record)) {
      match = record;
    }
  });
  return match;
}

function getStatsById(report: RTCStatsReport, id: string | undefined): StatsRecord | undefined {
  if (!id) return undefined;
  return report.get(id) as StatsRecord | undefined;
}

function findSelectedCandidatePair(report: RTCStatsReport): StatsRecord | undefined {
  const transport = findStats(
    report,
    (stats) => stats.type === 'transport' && !!readString(stats, 'selectedCandidatePairId')
  );
  const selectedPairId = readString(transport, 'selectedCandidatePairId');
  const selectedPair = getStatsById(report, selectedPairId);
  if (selectedPair) {
    return selectedPair;
  }

  return (
    findStats(
      report,
      (stats) =>
        stats.type === 'candidate-pair' &&
        readString(stats, 'state') === 'succeeded' &&
        (readBoolean(stats, 'nominated') === true || readBoolean(stats, 'selected') === true)
    ) ??
    findStats(
      report,
      (stats) => stats.type === 'candidate-pair' && readString(stats, 'state') === 'succeeded'
    )
  );
}

function formatSelectedCandidatePair(report: RTCStatsReport, pair: StatsRecord | undefined) {
  if (!pair) {
    return undefined;
  }

  const localCandidate = getStatsById(report, readString(pair, 'localCandidateId'));
  const remoteCandidate = getStatsById(report, readString(pair, 'remoteCandidateId'));

  return {
    protocol:
      readString(pair, 'protocol') ??
      readString(localCandidate, 'protocol') ??
      readString(remoteCandidate, 'protocol'),
    state: readString(pair, 'state'),
    local: formatCandidateStats(localCandidate),
    remote: formatCandidateStats(remoteCandidate),
  };
}

function formatCandidateStats(stats: StatsRecord | undefined) {
  if (!stats) {
    return undefined;
  }

  const address = readString(stats, 'address') ?? readString(stats, 'ip');
  const port = readNumber(stats, 'port') ?? readNumber(stats, 'portNumber');
  const relatedAddress = readString(stats, 'relatedAddress');
  const relatedPort = readNumber(stats, 'relatedPort');

  return {
    endpoint: formatEndpoint(address, port),
    protocol: readString(stats, 'protocol'),
    candidateType: readString(stats, 'candidateType'),
    networkType: readString(stats, 'networkType'),
    relayProtocol: readString(stats, 'relayProtocol'),
    tcpType: readString(stats, 'tcpType'),
    relatedEndpoint: formatEndpoint(relatedAddress, relatedPort),
  };
}

function formatEndpoint(address: string | undefined, port: number | undefined) {
  if (!address) {
    return undefined;
  }
  return port === undefined ? address : `${address}:${port}`;
}

function isVideoStats(stats: StatsRecord) {
  return readString(stats, 'kind') === 'video' || readString(stats, 'mediaType') === 'video';
}

function readString(stats: StatsRecord | undefined, key: string): string | undefined {
  const value = stats?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(stats: StatsRecord | undefined, key: string): number | undefined {
  const value = stats?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function readBoolean(stats: StatsRecord | undefined, key: string): boolean | undefined {
  const value = stats?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function bitsPerSecondToKbps(value: number | undefined) {
  return value === undefined ? undefined : round(value / 1000, 1);
}

function secondsToMilliseconds(value: number | undefined) {
  return value === undefined ? undefined : round(value * 1000, 1);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
