import assert from 'node:assert/strict';
import { test } from 'node:test';

const { resolveVadAssetBasePaths, startMediaTrackVadObserver } = await import(
  '../lib/frontend-vad-observer.ts'
);

test('vad asset paths stay local and become session scoped behind the gateway', () => {
  assert.deepEqual(resolveVadAssetBasePaths(), {
    baseAssetPath: '/vad-web/',
    onnxWASMBasePath: '/onnxruntime-web/',
  });
  assert.deepEqual(resolveVadAssetBasePaths('/sandbox-session'), {
    baseAssetPath: '/sandbox-session/vad-web/',
    onnxWASMBasePath: '/sandbox-session/onnxruntime-web/',
  });
  assert.deepEqual(resolveVadAssetBasePaths('/s/sandbox-session/'), {
    baseAssetPath: '/s/sandbox-session/vad-web/',
    onnxWASMBasePath: '/s/sandbox-session/onnxruntime-web/',
  });
});

test('media track vad observer uses the supplied track and emits speech events', async () => {
  const originalMediaStream = globalThis.MediaStream;
  const events = [];
  let sourceTrackStopCount = 0;
  let endedListener;
  const track = {
    id: 'browser-audio-track',
    addEventListener(eventName, listener) {
      if (eventName === 'ended') endedListener = listener;
    },
    removeEventListener(eventName, listener) {
      if (eventName === 'ended' && endedListener === listener) endedListener = undefined;
    },
    stop() {
      sourceTrackStopCount += 1;
    },
  };
  let capturedOptions;
  let startCount = 0;
  let pauseCount = 0;
  let destroyCount = 0;
  let now = 10_000;

  globalThis.MediaStream = class FakeMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  };

  try {
    const observer = await startMediaTrackVadObserver({
      mediaStreamTrack: track,
      now: () => now,
      createMicVad: async (options) => {
        capturedOptions = options;
        return {
          start() {
            startCount += 1;
          },
          pause() {
            pauseCount += 1;
          },
          destroy() {
            destroyCount += 1;
          },
        };
      },
      onSpeechStart: (event) => events.push(['start', event]),
      onSpeechEnd: (event) => events.push(['end', event]),
    });

    const stream = await capturedOptions.getStream();
    assert.deepEqual(stream.tracks, [track]);
    assert.equal(capturedOptions.model, 'v5');
    assert.equal(capturedOptions.startOnLoad, false);
    assert.equal(capturedOptions.baseAssetPath, '/vad-web/');
    assert.equal(capturedOptions.onnxWASMBasePath, '/onnxruntime-web/');
    await capturedOptions.pauseStream(stream);
    assert.equal(sourceTrackStopCount, 0);
    assert.equal(await capturedOptions.resumeStream(stream), stream);
    assert.equal(startCount, 1);

    now = 12_345;
    capturedOptions.onSpeechStart();
    now = 12_450;
    capturedOptions.onFrameProcessed({ isSpeech: 0.2 }, new Float32Array(512));
    now = 12_500;
    capturedOptions.onFrameProcessed({ isSpeech: 0.8 }, new Float32Array(512));
    now = 12_700;
    capturedOptions.onFrameProcessed({ isSpeech: 0.1 }, new Float32Array(512));
    now = 12_789;
    capturedOptions.onSpeechEnd(new Float32Array(1600));

    assert.deepEqual(events, [
      [
        'start',
        {
          timestampMs: 12_345,
          provider: 'vad-web',
          model: 'silero_vad_v5',
        },
      ],
      [
        'end',
        {
          timestampMs: 12_500,
          provider: 'vad-web',
          model: 'silero_vad_v5',
          audioDurationMs: 100,
        },
      ],
    ]);

    assert.equal(typeof endedListener, 'function');
    await observer.stop();
    assert.equal(pauseCount, 1);
    assert.equal(destroyCount, 1);
    assert.equal(endedListener, undefined);
  } finally {
    globalThis.MediaStream = originalMediaStream;
  }
});

test('media track vad observer destroys vad even when pause fails', async () => {
  const originalMediaStream = globalThis.MediaStream;
  let endedListener;
  const track = {
    addEventListener(eventName, listener) {
      if (eventName === 'ended') endedListener = listener;
    },
    removeEventListener(eventName, listener) {
      if (eventName === 'ended' && endedListener === listener) endedListener = undefined;
    },
  };
  let destroyCount = 0;

  globalThis.MediaStream = class FakeMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  };

  try {
    const observer = await startMediaTrackVadObserver({
      mediaStreamTrack: track,
      createMicVad: async () => ({
        start() {},
        pause() {
          throw new Error('pause failed');
        },
        destroy() {
          destroyCount += 1;
        },
      }),
      onSpeechStart: () => {},
      onSpeechEnd: () => {},
    });

    await assert.rejects(observer.stop(), /pause failed/);

    assert.equal(destroyCount, 1);
    assert.equal(endedListener, undefined);
  } finally {
    globalThis.MediaStream = originalMediaStream;
  }
});
