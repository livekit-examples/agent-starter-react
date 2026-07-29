import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function loadAppConfigModule() {
  return import('../app-config.ts');
}

async function loadUtilsModule() {
  return import('../lib/utils.ts');
}

function restoreEnv(previousEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in previousEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, previousEnv);
}

test('frontend derives dispatch agent name from INPUT_SOURCE when AGENT_NAME is unset', async () => {
  const { resolveAgentNameForInputSource } = await loadAppConfigModule();

  assert.equal(resolveAgentNameForInputSource('xunfei'), 'lexvoice-xunfei-agent');
  assert.equal(resolveAgentNameForInputSource('generic'), 'lexvoice-generic-agent');
  assert.equal(resolveAgentNameForInputSource('browser'), 'lexvoice-browser-agent');
  assert.equal(resolveAgentNameForInputSource('primebot'), 'lexvoice-primebot-agent');
  assert.equal(resolveAgentNameForInputSource('mixed'), 'lexvoice-mixed-agent');
  assert.equal(resolveAgentNameForInputSource('robot'), 'lexvoice-robot-agent');
});

test('frontend keeps explicit AGENT_NAME as an override', async () => {
  const { resolveAgentNameForInputSource } = await loadAppConfigModule();

  assert.equal(resolveAgentNameForInputSource('generic', 'custom-agent'), 'custom-agent');
});

test('frontend exposes the server-owned voice session id to dispatch callers', async () => {
  const previousEnv = { ...process.env };

  try {
    process.env.LIVEAVATAR_VOICE_SESSION_ID = 'sandbox-session-123';

    const { getClientConfigFromEnv } = await loadUtilsModule();

    assert.equal(getClientConfigFromEnv().voiceSessionId, 'sandbox-session-123');
  } finally {
    restoreEnv(previousEnv);
  }
});

test('frontend defaults to browser input when INPUT_SOURCE is unset', async () => {
  const { normalizeInputSource, resolveInputDeviceConfig } = await loadAppConfigModule();

  assert.equal(normalizeInputSource(''), 'browser');

  const config = resolveInputDeviceConfig({});
  assert.equal(config.inputSource, 'browser');
  assert.equal(config.audioInputDevice, 'browser');
  assert.equal(config.visionInputDevice, 'browser');
  assert.equal(config.outputDevice, 'browser');
  assert.equal(config.usesBrowserRawAudioInput, true);
  assert.equal(config.usesBrowserRawVideoInput, true);
  assert.equal(config.usesServerRoomInput, false);
});

test('frontend resolves mixed browser audio with xunfei vision role devices', async () => {
  const { resolveInputDeviceConfig } = await loadAppConfigModule();

  const config = resolveInputDeviceConfig({
    inputSource: 'mixed',
    audioInputDevice: 'browser',
    visionInputDevice: 'xunfei',
  });

  assert.equal(config.inputSource, 'mixed');
  assert.equal(config.audioInputDevice, 'browser');
  assert.equal(config.visionInputDevice, 'xunfei');
  assert.equal(config.usesBrowserRawAudioInput, true);
  assert.equal(config.usesBrowserRawVideoInput, false);
  assert.equal(config.usesBrowserRawMediaInput, true);
  assert.equal(config.usesServerRoomInput, true);
  assert.equal(config.supportsScreenShare, true);
  assert.equal(config.showDefaultCameraPreview, true);
});

test('frontend resolves mixed xunfei audio with browser vision role devices', async () => {
  const { resolveInputDeviceConfig } = await loadAppConfigModule();

  const config = resolveInputDeviceConfig({
    inputSource: 'mixed',
    audioInputDevice: 'xunfei',
    visionInputDevice: 'browser',
  });

  assert.equal(config.usesBrowserRawAudioInput, false);
  assert.equal(config.usesBrowserRawVideoInput, true);
  assert.equal(config.usesBrowserRawMediaInput, true);
  assert.equal(config.usesServerRoomInput, true);
  assert.equal(config.supportsScreenShare, false);
  assert.equal(config.showDefaultCameraPreview, false);
});

test('frontend normalizes invalid mixed output devices to the base role input device', async () => {
  const { resolveInputDeviceConfig } = await loadAppConfigModule();

  const config = resolveInputDeviceConfig({
    inputSource: 'mixed',
    audioInputDevice: 'browser',
    visionInputDevice: 'generic',
    outputDevice: 'not-a-role-device',
  });

  assert.equal(config.outputDevice, 'xunfei');
});

test('frontend ignores role devices unless INPUT_SOURCE is mixed', async () => {
  const { resolveInputDeviceConfig } = await loadAppConfigModule();

  const config = resolveInputDeviceConfig({
    inputSource: 'browser',
    audioInputDevice: 'xunfei',
    visionInputDevice: 'generic',
    outputDevice: 'primebot_output',
  });

  assert.equal(config.inputSource, 'browser');
  assert.equal(config.audioInputDevice, 'browser');
  assert.equal(config.visionInputDevice, 'browser');
  assert.equal(config.outputDevice, 'browser');
  assert.equal(config.usesBrowserRawAudioInput, true);
  assert.equal(config.usesBrowserRawVideoInput, true);
});

test('frontend keeps primebot on the non-server room input path', async () => {
  const { buildDefaultVideoTracks, resolveInputDeviceConfig } = await loadAppConfigModule();

  const config = resolveInputDeviceConfig({ inputSource: 'primebot' });
  const tracks = buildDefaultVideoTracks(
    config.usesBrowserRawVideoInput,
    config.usesServerRoomInput
  );

  assert.equal(config.audioInputDevice, 'primebot');
  assert.equal(config.visionInputDevice, 'primebot');
  assert.equal(config.usesBrowserRawMediaInput, false);
  assert.equal(config.usesServerRoomInput, false);
  assert.ok(tracks.some((track) => track.id === 'system_camera_default'));
});

test('frontend reads vision env names for browser and remote vision settings', async () => {
  const previousEnv = { ...process.env };

  try {
    Object.assign(process.env, {
      BROWSER_VISION_WIDTH: '801',
      NEXT_PUBLIC_BROWSER_VISION_HEIGHT: '601',
      NEXT_PUBLIC_LEXVOICE_BROWSER_VISION_FPS: '17',
      BROWSER_VISION_MAX_BITRATE: '123456',
      BROWSER_VISION_STATS: '1',
      REMOTE_VISION_WIDTH: '1024',
      NEXT_PUBLIC_REMOTE_VISION_HEIGHT: '768',
      NEXT_PUBLIC_LEXVOICE_REMOTE_VISION_FPS: '20',
      DEBUG_VISION: 'true',
    });

    const { getClientConfigFromEnv } = await loadUtilsModule();
    const config = getClientConfigFromEnv();

    assert.equal(config.browserVideoWidth, 801);
    assert.equal(config.browserVideoHeight, 601);
    assert.equal(config.browserVideoFps, 17);
    assert.equal(config.browserVideoMaxBitrate, 123456);
    assert.equal(config.browserVideoStats, true);
    assert.equal(config.remoteVideoWidth, 1024);
    assert.equal(config.remoteVideoHeight, 768);
    assert.equal(config.remoteVideoFps, 20);
    assert.equal(config.debugVideo, true);
  } finally {
    restoreEnv(previousEnv);
  }
});

test('frontend accepts legacy video env names as migration fallbacks', async () => {
  const previousEnv = { ...process.env };
  const originalWarn = console.warn;
  const warnings = [];

  try {
    console.warn = (message) => {
      warnings.push(String(message));
    };
    Object.assign(process.env, {
      BROWSER_VIDEO_WIDTH: '802',
      NEXT_PUBLIC_BROWSER_VIDEO_HEIGHT: '602',
      NEXT_PUBLIC_LEXVOICE_BROWSER_VIDEO_FPS: '18',
      BROWSER_VIDEO_MAX_BITRATE: '234567',
      BROWSER_VIDEO_STATS: 'yes',
      REMOTE_VIDEO_WIDTH: '1280',
      NEXT_PUBLIC_REMOTE_VIDEO_HEIGHT: '720',
      NEXT_PUBLIC_LEXVOICE_REMOTE_VIDEO_FPS: '21',
      DEBUG_VIDEO: 'on',
    });

    const { getClientConfigFromEnv } = await loadUtilsModule();
    const config = getClientConfigFromEnv();

    assert.equal(config.browserVideoWidth, 802);
    assert.equal(config.browserVideoHeight, 602);
    assert.equal(config.browserVideoFps, 18);
    assert.equal(config.browserVideoMaxBitrate, 234567);
    assert.equal(config.browserVideoStats, true);
    assert.equal(config.remoteVideoWidth, 1280);
    assert.equal(config.remoteVideoHeight, 720);
    assert.equal(config.remoteVideoFps, 21);
    assert.equal(config.debugVideo, true);
    assert.ok(warnings.some((message) => message.includes('BROWSER_VIDEO_WIDTH is deprecated')));
    assert.ok(warnings.some((message) => message.includes('DEBUG_VIDEO is deprecated')));
  } finally {
    console.warn = originalWarn;
    restoreEnv(previousEnv);
  }
});

test('frontend source exposes vision env keys with legacy video fallbacks', async () => {
  const utilsSource = await readFile('lib/utils.ts', 'utf8');
  const appConfigSource = await readFile('app-config.ts', 'utf8');

  for (const oldName of [
    'BROWSER_VIDEO_WIDTH',
    'BROWSER_VIDEO_HEIGHT',
    'BROWSER_VIDEO_FPS',
    'BROWSER_VIDEO_MAX_BITRATE',
    'BROWSER_VIDEO_STATS',
    'REMOTE_VIDEO_WIDTH',
    'REMOTE_VIDEO_HEIGHT',
    'REMOTE_VIDEO_FPS',
    'DEBUG_VIDEO',
    'NEXT_PUBLIC_ROOM_VIDEO_TRACK_NAME',
  ]) {
    assert.match(`${utilsSource}\n${appConfigSource}`, new RegExp(`['"]${oldName}['"]`));
  }

  assert.match(utilsSource, /BROWSER_VISION_WIDTH/);
  assert.match(utilsSource, /REMOTE_VISION_WIDTH/);
  assert.match(utilsSource, /DEBUG_VISION/);
  assert.match(appConfigSource, /NEXT_PUBLIC_ROOM_VISION_TRACK_NAME/);
});
