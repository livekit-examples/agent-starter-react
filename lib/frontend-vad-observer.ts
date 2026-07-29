export interface BrowserVadEvent {
  timestampMs: number;
  provider: 'vad-web';
  model: 'silero_vad_v5';
  audioDurationMs?: number;
}

interface MicVadInstance {
  start: () => void | Promise<void>;
  pause?: () => void | Promise<void>;
  destroy?: () => void | Promise<void>;
}

interface MicVadOptions {
  getStream: () => Promise<MediaStream>;
  pauseStream: (stream: MediaStream) => Promise<void>;
  resumeStream: (stream: MediaStream) => Promise<MediaStream>;
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array) => void;
  onFrameProcessed?: (
    probabilities: { isSpeech: number; notSpeech?: number },
    frame: Float32Array
  ) => void;
  baseAssetPath: string;
  onnxWASMBasePath: string;
  model: 'v5';
  startOnLoad: boolean;
}

type CreateMicVad = (options: MicVadOptions) => Promise<MicVadInstance>;

interface MediaTrackVadObserverOptions {
  mediaStreamTrack: MediaStreamTrack;
  onSpeechStart: (event: BrowserVadEvent) => void;
  onSpeechEnd: (event: BrowserVadEvent) => void;
  createMicVad?: CreateMicVad;
  now?: () => number;
  baseAssetPath?: string;
  onnxWASMBasePath?: string;
}

const VAD_SAMPLE_RATE = 16_000;
const VAD_MODEL = 'silero_vad_v5';
const VAD_SPEECH_PROBABILITY_THRESHOLD = 0.5;
const DEFAULT_VAD_ASSET_BASE_PATH = '/vad-web/';
const DEFAULT_ONNX_WASM_BASE_PATH = '/onnxruntime-web/';

export function resolveVadAssetBasePaths(sessionPathname = ''): {
  baseAssetPath: string;
  onnxWASMBasePath: string;
} {
  const sessionPath = `/${sessionPathname}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (!sessionPath) {
    return {
      baseAssetPath: DEFAULT_VAD_ASSET_BASE_PATH,
      onnxWASMBasePath: DEFAULT_ONNX_WASM_BASE_PATH,
    };
  }
  return {
    baseAssetPath: `${sessionPath}/vad-web/`,
    onnxWASMBasePath: `${sessionPath}/onnxruntime-web/`,
  };
}

export async function startMediaTrackVadObserver({
  mediaStreamTrack,
  onSpeechStart,
  onSpeechEnd,
  createMicVad = createDefaultMicVad,
  now = () => Date.now(),
  baseAssetPath = DEFAULT_VAD_ASSET_BASE_PATH,
  onnxWASMBasePath = DEFAULT_ONNX_WASM_BASE_PATH,
}: MediaTrackVadObserverOptions): Promise<{ stop: () => Promise<void> }> {
  if (typeof MediaStream === 'undefined') {
    return { stop: async () => {} };
  }

  const mediaStream = new MediaStream([mediaStreamTrack]);
  let lastSpeechFrameTimestampMs: number | null = null;
  const vad = await createMicVad({
    getStream: async () => mediaStream,
    pauseStream: async () => {},
    resumeStream: async () => mediaStream,
    baseAssetPath,
    onnxWASMBasePath,
    model: 'v5',
    startOnLoad: false,
    onSpeechStart: () => {
      lastSpeechFrameTimestampMs = null;
      onSpeechStart({
        timestampMs: now(),
        provider: 'vad-web',
        model: VAD_MODEL,
      });
    },
    onFrameProcessed: (probabilities) => {
      if (probabilities.isSpeech >= VAD_SPEECH_PROBABILITY_THRESHOLD) {
        lastSpeechFrameTimestampMs = now();
      }
    },
    onSpeechEnd: (audio) => {
      const timestampMs = lastSpeechFrameTimestampMs ?? now();
      lastSpeechFrameTimestampMs = null;
      onSpeechEnd({
        timestampMs,
        provider: 'vad-web',
        model: VAD_MODEL,
        audioDurationMs: Math.round((audio.length / VAD_SAMPLE_RATE) * 1000),
      });
    },
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    mediaStreamTrack.removeEventListener('ended', handleTrackEnded);
    try {
      await vad.pause?.();
    } finally {
      await vad.destroy?.();
    }
  };
  const handleTrackEnded = () => {
    void stop();
  };

  await vad.start();
  mediaStreamTrack.addEventListener('ended', handleTrackEnded, { once: true });

  return {
    stop,
  };
}

async function createDefaultMicVad(options: MicVadOptions): Promise<MicVadInstance> {
  const { MicVAD } = await import('@ricky0123/vad-web');
  return MicVAD.new(options);
}
