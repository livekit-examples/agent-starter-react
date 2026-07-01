import { OBSERVABILITY_ATTRS, type ObservabilityAttributes } from '@/lib/observability';

type AudioActivityReason = 'silence' | 'stop';

export type AudioActivityEvent = {
  timestampMs: number;
  level: number;
  reason?: AudioActivityReason;
};

export type AudioActivityDetector = {
  sample: () => void;
  stop: (options?: { emitEnd?: boolean }) => void;
  isActive: () => boolean;
};

interface AudioActivityDetectorOptions {
  readLevel: () => number;
  onStart: (event: AudioActivityEvent) => void;
  onEnd: (event: AudioActivityEvent) => void;
  now?: () => number;
  startThreshold?: number;
  endThreshold?: number;
  startDurationMs?: number;
  endSilenceMs?: number;
}

type MediaTrackAudioObserverAttributes = ObservabilityAttributes | (() => ObservabilityAttributes);

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface MediaTrackAudioObserverOptions {
  mediaStreamTrack: MediaStreamTrack;
  startEventName: string;
  endEventName: string;
  resumeErrorEventName?: string;
  emit: (name: string, attributes?: ObservabilityAttributes) => void;
  sharedAudioContext?: AudioContext;
  attributes?: MediaTrackAudioObserverAttributes;
  sampleIntervalMs?: number;
  startThreshold?: number;
  endThreshold?: number;
  startDurationMs?: number;
  endSilenceMs?: number;
}

export function createAudioActivityDetector({
  readLevel,
  onStart,
  onEnd,
  now = () => Date.now(),
  startThreshold = 0.015,
  endThreshold = 0.006,
  startDurationMs = 80,
  endSilenceMs = 500,
}: AudioActivityDetectorOptions): AudioActivityDetector {
  let active = false;
  let stopped = false;
  let aboveStartedAt: number | null = null;
  let belowStartedAt: number | null = null;
  let lastLevel = 0;

  const sample = () => {
    if (stopped) return;

    const timestampMs = now();
    const level = Math.max(0, readLevel());
    lastLevel = level;

    if (!active) {
      if (level >= startThreshold) {
        aboveStartedAt ??= timestampMs;
        if (timestampMs - aboveStartedAt >= startDurationMs) {
          active = true;
          belowStartedAt = null;
          onStart({ timestampMs, level });
        }
      } else {
        aboveStartedAt = null;
      }
      return;
    }

    if (level <= endThreshold) {
      belowStartedAt ??= timestampMs;
      if (timestampMs - belowStartedAt >= endSilenceMs) {
        active = false;
        aboveStartedAt = null;
        belowStartedAt = null;
        onEnd({ timestampMs, level, reason: 'silence' });
      }
    } else {
      belowStartedAt = null;
    }
  };

  const stop = ({ emitEnd = false }: { emitEnd?: boolean } = {}) => {
    if (stopped) return;
    stopped = true;
    if (emitEnd && active) {
      active = false;
      onEnd({ timestampMs: now(), level: lastLevel, reason: 'stop' });
    }
  };

  return {
    sample,
    stop,
    isActive: () => active,
  };
}

export function startMediaTrackAudioObserver({
  mediaStreamTrack,
  startEventName,
  endEventName,
  resumeErrorEventName,
  emit,
  sharedAudioContext,
  attributes = {},
  sampleIntervalMs = 50,
  startThreshold,
  endThreshold,
  startDurationMs,
  endSilenceMs,
}: MediaTrackAudioObserverOptions): { stop: () => void } {
  if (typeof window === 'undefined') {
    return { stop: () => {} };
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!sharedAudioContext && !AudioContextClass) {
    return { stop: () => {} };
  }

  const ownsAudioContext = !sharedAudioContext;
  const audioContext = sharedAudioContext ?? new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;

  const mediaStream = new MediaStream([mediaStreamTrack]);
  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  const detector = createAudioActivityDetector({
    startThreshold,
    endThreshold,
    startDurationMs,
    endSilenceMs,
    readLevel: () => readRmsLevel(analyser, samples),
    onStart: (event) =>
      emit(startEventName, activityAttributes(resolveAttributes(attributes), event)),
    onEnd: (event) => emit(endEventName, activityAttributes(resolveAttributes(attributes), event)),
  });

  const intervalId = window.setInterval(() => detector.sample(), sampleIntervalMs);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(intervalId);
    mediaStreamTrack.removeEventListener('ended', stop);
    detector.stop({ emitEnd: true });
    source.disconnect();
    if (ownsAudioContext) {
      void audioContext.close?.().catch(() => undefined);
    }
  };

  void audioContext.resume?.().catch((error) => {
    console.warn('[frontend-observability] audio observer could not resume AudioContext', error);
    if (resumeErrorEventName) {
      emit(resumeErrorEventName, {
        ...resolveAttributes(attributes),
        [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_REASON]: 'audio-context-resume-failed',
        [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_ERROR]:
          error instanceof Error ? error.message : String(error),
      });
    }
    stop();
  });

  mediaStreamTrack.addEventListener('ended', stop, { once: true });

  return { stop };
}

function readRmsLevel(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(samples);
  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function activityAttributes(baseAttributes: ObservabilityAttributes, event: AudioActivityEvent) {
  return {
    ...baseAttributes,
    [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_LEVEL]: Number(event.level.toFixed(6)),
    [OBSERVABILITY_ATTRS.FRONTEND_AUDIO_REASON]: event.reason ?? null,
  };
}

function resolveAttributes(attributes: MediaTrackAudioObserverAttributes): ObservabilityAttributes {
  return typeof attributes === 'function' ? attributes() : attributes;
}
