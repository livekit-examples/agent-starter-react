import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('browser raw audio wires one media gate onto the existing room and local identity', async () => {
  const source = await readFile('hooks/useBrowserSourceClient.ts', 'utf8');

  assert.match(source, /new LiveKitMediaGateAdapter\(\{[\s\S]*room,[\s\S]*agentName/);
  assert.match(source, /allowAnonymousLiveKitAgentFallback:\s*true/);
  assert.match(source, /targetIdentity:\s*room\.localParticipant\.identity/);
  assert.doesNotMatch(source, /new Room\(/);
  assert.doesNotMatch(source, /room\.connect\(/);
});

test('browser audio starts closed before publish and starts control after device reconciliation', async () => {
  const source = await readFile('hooks/useBrowserSourceClient.ts', 'utf8');
  const ensureAudio = source.match(
    /const ensureAudioPublished = useCallback\([\s\S]*?(?=\n  const ensureVideoPublished)/
  )?.[0];
  const start = source.match(/const start = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/)?.[0];

  assert.ok(ensureAudio);
  assert.ok(start);
  assert.match(
    ensureAudio,
    /audioTrack\.mediaStreamTrack\.enabled = false[\s\S]*await audioTrack\.mute\(\)[\s\S]*publishTrack/
  );
  assert.match(
    start,
    /await stage\(\(\) => audioGate\.executor\.start\(\)\)[\s\S]*await stage\(\(\) => audioGate\.executor\.reconcileDevice\(\)\)[\s\S]*await stage\(\(\) => audioGate\.adapter\.start\(audioGate\.executor\)\)/
  );
});

test('privacy mute, device replacement, and stop all close synchronously before async work', async () => {
  const source = await readFile('hooks/useBrowserSourceClient.ts', 'utf8');
  const setAudioEnabled = source.match(
    /const setAudioEnabled = useCallback\([\s\S]*?(?=\n  const setAudioDeviceId)/
  )?.[0];
  const setAudioDeviceId = source.match(
    /const setAudioDeviceId = useCallback\([\s\S]*?(?=\n  const setVideoEnabled)/
  )?.[0];
  const stopRuntime = source.match(
    /const stopRuntime = useCallback\([\s\S]*?(?=\n  const stop = useCallback)/
  )?.[0];
  const stop = source.match(/const stop = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/)?.[0];

  assert.ok(setAudioEnabled);
  assert.ok(setAudioDeviceId);
  assert.ok(stopRuntime);
  assert.ok(stop);
  assert.match(
    setAudioEnabled,
    /if \(!nextEnabled\) \{[\s\S]*audioGate\?\.device\.close\(\)[\s\S]*executor\?\.setUserMuted\(true\)/
  );
  assert.doesNotMatch(setAudioEnabled, /audioEnabledRef\.current = previousEnabled/);
  assert.match(setAudioDeviceId, /replaceRuntimeAudioBinding\(runtime/);
  assert.match(
    stopRuntime,
    /const gateStop = audioGate\.adapter\.stop\(\)[\s\S]*audioGate\.device\.close\(\)[\s\S]*await gateStop[\s\S]*unpublishAudio/
  );
  assert.match(stop, /detachCurrentRuntime\(runtimeRef\)[\s\S]*stopRuntime\(runtime\)/);
});

test('late start cleanup and media publication remain owned by their original runtime', async () => {
  const source = await readFile('hooks/useBrowserSourceClient.ts', 'utf8');

  assert.match(source, /runOwnedRuntimeStart\(runtimeRef, runtime, stopRuntime/);
  assert.match(
    source,
    /ensurePublishedClosed:[\s\S]*ensureAudioPublished\(runtime\)[\s\S]*stage\([\s\S]*adapter\.start/
  );
  assert.match(source, /!isCurrentRuntime\(runtimeRef, runtime\)/);
  assert.doesNotMatch(source, /catch \(error\) \{\s*await stop\(\)/);
});

test('the browser control lease cap is the backend contract value', async () => {
  const source = await readFile('hooks/useBrowserSourceClient.ts', 'utf8');

  assert.match(source, /const BROWSER_MEDIA_GATE_MAX_OPEN_LEASE_MS = 3000/);
  assert.match(source, /maxOpenLeaseMs:\s*BROWSER_MEDIA_GATE_MAX_OPEN_LEASE_MS/);
});
