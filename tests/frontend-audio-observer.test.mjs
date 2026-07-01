import assert from 'node:assert/strict';
import { test } from 'node:test';

const { createAudioActivityDetector, startMediaTrackAudioObserver } = await import(
  '../lib/frontend-audio-observer.ts'
);

test('audio activity detector emits start and end after configured windows', () => {
  const events = [];
  let now = 0;
  const levels = [0.001, 0.004, 0.022, 0.028, 0.018, 0.003, 0.002, 0.001, 0.001];
  const detector = createAudioActivityDetector({
    startThreshold: 0.015,
    endThreshold: 0.006,
    startDurationMs: 40,
    endSilenceMs: 100,
    readLevel: () => levels.shift() ?? 0,
    now: () => now,
    onStart: (event) => events.push(['start', event]),
    onEnd: (event) => events.push(['end', event]),
  });

  for (let index = 0; index < 9; index += 1) {
    detector.sample();
    now += 50;
  }

  assert.equal(events.length, 2);
  assert.equal(events[0][0], 'start');
  assert.equal(events[0][1].timestampMs, 150);
  assert.equal(events[1][0], 'end');
  assert.equal(events[1][1].timestampMs, 350);
});

test('audio activity detector closes an active segment when stopped', () => {
  const events = [];
  let now = 0;
  const detector = createAudioActivityDetector({
    startThreshold: 0.015,
    endThreshold: 0.006,
    startDurationMs: 0,
    endSilenceMs: 100,
    readLevel: () => 0.03,
    now: () => now,
    onStart: (event) => events.push(['start', event]),
    onEnd: (event) => events.push(['end', event]),
  });

  detector.sample();
  now = 250;
  detector.stop({ emitEnd: true });

  assert.equal(events.length, 2);
  assert.equal(events[0][0], 'start');
  assert.equal(events[1][0], 'end');
  assert.equal(events[1][1].reason, 'stop');
});

test('media track audio observer stop is idempotent', () => {
  const originalWindow = globalThis.window;
  const originalMediaStream = globalThis.MediaStream;
  let disconnectCount = 0;
  let closeCount = 0;
  const track = {
    addEventListener() {},
    removeEventListener() {},
  };

  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(samples) {
          samples.fill(0);
        },
      };
    }

    createMediaStreamSource() {
      return {
        connect() {},
        disconnect() {
          disconnectCount += 1;
          if (disconnectCount > 1) {
            throw new Error('disconnect called twice');
          }
        },
      };
    }

    resume() {
      return Promise.resolve();
    }

    close() {
      closeCount += 1;
      return Promise.resolve();
    }
  }

  globalThis.MediaStream = class FakeMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  };
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval,
    clearInterval,
  };

  try {
    const observer = startMediaTrackAudioObserver({
      mediaStreamTrack: track,
      startEventName: 'start',
      endEventName: 'end',
      emit() {},
    });

    observer.stop();
    observer.stop();

    assert.equal(disconnectCount, 1);
    assert.equal(closeCount, 1);
  } finally {
    globalThis.window = originalWindow;
    globalThis.MediaStream = originalMediaStream;
  }
});

test('media track audio observer leaves caller-owned AudioContext open', () => {
  const originalWindow = globalThis.window;
  const originalMediaStream = globalThis.MediaStream;
  let closeCount = 0;
  const track = {
    addEventListener() {},
    removeEventListener() {},
  };

  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(samples) {
          samples.fill(0);
        },
      };
    }

    createMediaStreamSource() {
      return {
        connect() {},
        disconnect() {},
      };
    }

    resume() {
      return Promise.resolve();
    }

    close() {
      closeCount += 1;
      return Promise.resolve();
    }
  }

  globalThis.MediaStream = class FakeMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  };
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval,
    clearInterval,
  };

  try {
    const sharedAudioContext = new FakeAudioContext();
    const observer = startMediaTrackAudioObserver({
      mediaStreamTrack: track,
      startEventName: 'start',
      endEventName: 'end',
      emit() {},
      sharedAudioContext,
    });

    observer.stop();

    assert.equal(closeCount, 0);
  } finally {
    globalThis.window = originalWindow;
    globalThis.MediaStream = originalMediaStream;
  }
});

test('media track audio observer emits resume failure when configured', async () => {
  const originalWindow = globalThis.window;
  const originalMediaStream = globalThis.MediaStream;
  const originalConsoleWarn = console.warn;
  const events = [];
  let clearIntervalCount = 0;
  let closeCount = 0;
  let disconnectCount = 0;
  const track = {
    addEventListener() {},
    removeEventListener() {},
  };

  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(samples) {
          samples.fill(0);
        },
      };
    }

    createMediaStreamSource() {
      return {
        connect() {},
        disconnect() {
          disconnectCount += 1;
        },
      };
    }

    resume() {
      return Promise.reject(new Error('resume blocked'));
    }

    close() {
      closeCount += 1;
      return Promise.resolve();
    }
  }

  globalThis.MediaStream = class FakeMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  };
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: () => 123,
    clearInterval: () => {
      clearIntervalCount += 1;
    },
  };
  console.warn = () => {};

  try {
    const observer = startMediaTrackAudioObserver({
      mediaStreamTrack: track,
      startEventName: 'start',
      endEventName: 'end',
      resumeErrorEventName: 'resume-error',
      emit: (name, attributes) => events.push([name, attributes]),
      attributes: { 'livekit.track_sid': 'TR_A' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.stop();

    assert.equal(events.length, 1);
    assert.equal(events[0][0], 'resume-error');
    assert.equal(events[0][1]['livekit.track_sid'], 'TR_A');
    assert.equal(
      events[0][1]['observability.frontend_audio.reason'],
      'audio-context-resume-failed'
    );
    assert.equal(events[0][1]['observability.frontend_audio.error'], 'resume blocked');
    assert.equal(clearIntervalCount, 1);
    assert.equal(disconnectCount, 1);
    assert.equal(closeCount, 1);
  } finally {
    console.warn = originalConsoleWarn;
    globalThis.window = originalWindow;
    globalThis.MediaStream = originalMediaStream;
  }
});
