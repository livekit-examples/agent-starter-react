import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('connection details route does not dispatch agents while generating tokens', async () => {
  const routeSource = await readFile(
    new URL('../app/api/connection-details/route.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(routeSource, /AgentDispatchClient/);
  assert.doesNotMatch(routeSource, /RoomServiceClient/);
  assert.doesNotMatch(routeSource, /createRoomAndDispatchAgent/);
  assert.doesNotMatch(routeSource, /createAgentDispatchWithRetry/);
  assert.doesNotMatch(routeSource, /dispatchClient\.createDispatch/);
});

test('connection details route strips room-config agents from the participant token', async () => {
  const routeSource = await readFile(
    new URL('../app/api/connection-details/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /function buildTokenRoomConfig/);
  assert.match(routeSource, /RoomConfiguration\.fromJson/);
  assert.match(routeSource, /agents: \[\]/);
  assert.match(routeSource, /Explicit dispatch is handled by \/api\/session\/dispatch/);
  assert.match(routeSource, /resolveConnectionSessionId/);
  assert.match(routeSource, /deriveLiveKitRoomName/);
});

test('session dispatch route retries explicit agent dispatch after the browser joins', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/dispatch/route.ts', import.meta.url),
    'utf8'
  );
  const serviceSource = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );

  assert.match(serviceSource, /AgentDispatchClient/);
  assert.match(serviceSource, /RoomServiceClient/);
  assert.match(serviceSource, /AGENT_DISPATCH_TIMEOUT_MS/);
  assert.match(serviceSource, /AGENT_DISPATCH_RETRY_MS/);
  assert.match(serviceSource, /calculateDispatchRetryDelay/);
  assert.match(serviceSource, /findReusableAgentParticipant/);
  assert.match(serviceSource, /summarizeAgentParticipant/);
  assert.match(serviceSource, /deleteDispatchQuietly/);
  assert.match(serviceSource, /dispatchClient\.createDispatch/);
  assert.match(routeSource, /roomName is required/);
  assert.match(routeSource, /agentName is required/);
  assert.match(routeSource, /sessionId is required/);
  assert.match(serviceSource, /beginRoomSessionDispatch/);
  assert.match(serviceSource, /registerRoomSessionDispatchId/);
  assert.match(serviceSource, /isRoomSessionCancelled/);
  assert.match(serviceSource, /markRoomSessionRunning/);
  assert.match(serviceSource, /finishRoomSessionDispatch/);
  assert.match(routeSource, /deriveLiveKitRoomName/);
  assert.match(routeSource, /deriveSessionIdFromLiveKitRoomName/);
  assert.match(routeSource, /isValidConnectionRoomId/);
  assert.match(routeSource, /requestedSessionId && !isValidConnectionRoomId\(requestedSessionId\)/);
  assert.match(
    routeSource,
    /const roomName = sessionId \? deriveLiveKitRoomName\(sessionId\) : requestedRoomName/
  );
});

test('session dispatch retry backs off between repeated attempts', async () => {
  const serviceSource = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );

  assert.match(serviceSource, /function calculateDispatchRetryDelay/);
  assert.match(serviceSource, /2 \*\* Math\.max\(0, attempts - 1\)/);
  assert.match(
    serviceSource,
    /Math\.min\([\s\S]*calculateDispatchRetryDelay\(attempts, retryMs\)[\s\S]*remainingDispatchTime\(getDeadline\(\)\)[\s\S]*\)/
  );
});

test('session dispatch route pins the Next.js runtime to nodejs', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/dispatch/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /export const runtime = 'nodejs'/);
});

test('session dispatch route cleans up dispatch when the room session is cancelled', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/dispatch/route.ts', import.meta.url),
    'utf8'
  );
  const serviceSource = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );

  assert.match(serviceSource, /class RoomSessionCancelledError extends Error/);
  assert.match(serviceSource, /constructor\(session: RoomSessionToken\)/);
  assert.match(serviceSource, /session\.sessionId/);
  assert.match(serviceSource, /throwIfSessionCancelled/);
  assert.match(
    serviceSource,
    /await deleteDispatchQuietly\(dispatchClient, dispatchId, roomName\)/
  );
  assert.match(serviceSource, /await deleteLiveKitRoomQuietly\(roomClient, roomName\)/);
  assert.match(routeSource, /status: 409/);
});

test('session dispatch route logs successful dispatch with canonical session identity', async () => {
  const serviceSource = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );

  assert.match(serviceSource, /console\.info\('agent session dispatch completed'/);
  assert.match(serviceSource, /sessionId/);
  assert.match(serviceSource, /roomName/);
});

test('session dispatch response does not expose raw agent attributes', async () => {
  const serviceSource = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );
  const summarySource =
    serviceSource.match(
      /function summarizeAgentParticipant[\s\S]*?\n}\n\nasync function deleteDispatchQuietly/
    )?.[0] ?? '';

  assert.match(summarySource, /identity: participant\.identity/);
  assert.doesNotMatch(summarySource, /participant\.kind/);
  assert.doesNotMatch(summarySource, /participant\.attributes/);
  assert.doesNotMatch(summarySource, /attributes:/);
});

test('session dispatch readiness keeps agent matching tied to the configured agent name', async () => {
  const readinessSource = await readFile(
    new URL('../lib/session-dispatch-readiness.ts', import.meta.url),
    'utf8'
  );
  const participantMatcher = readinessSource.match(
    /function isExpectedAgentParticipant[\s\S]*?\n}/
  );

  assert.ok(participantMatcher, 'isExpectedAgentParticipant should be defined');
  const participantMatcherSource = participantMatcher[0];
  assert.match(participantMatcherSource, /readAgentNameAttribute/);
  assert.match(readinessSource, /attributes\['lk\.agent\.name'\]/);
  assert.match(readinessSource, /attributes\['lk\.agent_name'\]/);
  assert.match(readinessSource, /attributes\.lkAgentName/);
  assert.doesNotMatch(participantMatcherSource, /identity\.startsWith\(['"]agent-['"]\)/);
});

test('session dispatch route only accepts anonymous LiveKit agent fallback after explicit dispatch', async () => {
  const routeSource = await readFile(
    new URL('../app/api/session/dispatch/route.ts', import.meta.url),
    'utf8'
  );
  const serviceSource = await readFile(
    new URL('../app/api/session/session-dispatch-service.ts', import.meta.url),
    'utf8'
  );
  const readinessSource = await readFile(
    new URL('../lib/session-dispatch-readiness.ts', import.meta.url),
    'utf8'
  );

  assert.match(serviceSource, /findReusableAgentParticipant/);
  assert.match(
    serviceSource,
    /const alreadyJoined = await findReusableAgentParticipant\(\s*roomClient,\s*roomName,\s*agentName,\s*reusableAgentOptions\s*\);/
  );
  assert.match(routeSource, /requireRoomVideoInputReady/);
  assert.match(routeSource, /require_room_video_input_ready/);
  assert.match(readinessSource, /type AgentParticipantMatchOptions/);
  assert.match(readinessSource, /type ReusableAgentParticipantOptions/);
  assert.match(readinessSource, /allowAnonymousLiveKitAgentFallback/);
  assert.match(serviceSource, /allowAnonymousLiveKitAgentFallback: true/);
  assert.match(readinessSource, /function isAnonymousLiveKitAgentParticipant/);
  assert.match(readinessSource, /ParticipantInfo_Kind\.AGENT/);
  assert.match(readinessSource, /identity\.startsWith\(['"]agent-['"]\)/);
  assert.match(readinessSource, /!readAgentNameAttribute\(attributes\)/);
  assert.match(readinessSource, /fresh per-session rooms/);
  assert.match(readinessSource, /anonymousLiveKitAgents\.length === 1/);
});

test('start call dispatches the agent with a cancellable room session id', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');
  const dispatchAgentSessionSource =
    useRoomSource.match(/const dispatchAgentSession = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ??
    '';

  assert.match(useRoomSource, /const startSession = useCallback\(async \(\) =>/);
  assert.match(useRoomSource, /const sessionId = resolveVoiceSessionId\(\)/);
  assert.match(useRoomSource, /appConfig\.voiceSessionId/);
  assert.match(useRoomSource, /isValidConnectionRoomId\(configuredSessionId\)/);
  assert.doesNotMatch(dispatchAgentSessionSource, /crypto\.randomUUID\(\)/);
  assert.match(useRoomSource, /beginAgentSessionStart/);
  assert.match(useRoomSource, /registerAgentSessionDispatch/);
  assert.match(useRoomSource, /requestAgentSessionDispatch/);
  assert.match(useRoomSource, /await dispatchPromise/);
  assert.match(useRoomSource, /isExpectedStartCancellation/);
  assert.match(useRoomSource, /waitForAgentSessionStop/);
  assert.match(useRoomSource, /requestAgentSessionDispatch\(\s*appConfig\.agentName,\s*sessionId,/);
  assert.match(
    useRoomSource,
    /requireRoomVideoInputReady: requiresRoomVideoInputReady\(appConfig\)/
  );
  assert.doesNotMatch(useRoomSource, /requestAgentSessionDispatch\(\s*room\.name,/);
});

test('connection details request uses the same canonical session id as dispatch', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');

  assert.match(useRoomSource, /sessionIdRef\.current/);
  assert.match(useRoomSource, /body: JSON\.stringify\(\{\s*sessionId,\s*\}\)/);
  assert.match(useRoomSource, /readConnectionDetailsResponse\(res,\s*\{\s*sessionId\s*\}\)/);
  assert.doesNotMatch(useRoomSource, /room_config/);
  assert.doesNotMatch(useRoomSource, /agents: \[\{ agent_name: appConfig\.agentName \}\]/);
  assert.doesNotMatch(useRoomSource, /room_id: roomId/);
});

test('start call stops the remote room session when dispatch fails after connect', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');

  assert.match(useRoomSource, /requestAgentSessionStop/);
  assert.match(useRoomSource, /let dispatchSessionId: string \| null = sessionId/);
  assert.match(
    useRoomSource,
    /await requestAgentSessionStop\([\s\S]*?dispatchSessionId \?\? sessionIdRef\.current \?\? undefined,[\s\S]*?waitForRemote:\s*true,[\s\S]*?\)/
  );
  assert.doesNotMatch(useRoomSource, /requestAgentSessionStop\(\s*connectedRoomName,/);
});

test('start call stops the remote room when browser source fails after connect', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');

  assert.match(useRoomSource, /let connectedRoomName: string \| null = null/);
  assert.match(useRoomSource, /connectedRoomName = room\.name/);
  assert.match(
    useRoomSource,
    /await requestAgentSessionStop\([\s\S]*?dispatchSessionId \?\? sessionIdRef\.current \?\? undefined,[\s\S]*?waitForRemote:\s*true,[\s\S]*?\)/
  );
  assert.doesNotMatch(useRoomSource, /requestAgentSessionStop\(\s*connectedRoomName,/);
});

test('start call reconnects only after any previous room disconnect has completed', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');

  assert.match(useRoomSource, /waitForRoomDisconnected/);
  assert.match(
    useRoomSource,
    /await waitForAgentSessionStop\(\);\s*await waitForRoomDisconnected\(room\);/
  );
});

test('room disconnect wait has a timeout fallback', async () => {
  const roomDisconnectSource = await readFile(
    new URL('../lib/room-disconnect.ts', import.meta.url),
    'utf8'
  );

  assert.match(roomDisconnectSource, /ROOM_DISCONNECT_TIMEOUT_MS/);
  assert.match(roomDisconnectSource, /setTimeout/);
  assert.match(roomDisconnectSource, /clearTimeout/);
  assert.match(roomDisconnectSource, /room disconnect timed out/);
});

test('unmount cleanup requests remote session stop before disconnecting the room', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');
  const cleanupSource =
    useRoomSource.match(
      /useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]*?\n    \};\s*\}, \[room/
    )?.[0] ?? '';

  assert.match(
    cleanupSource,
    /requestAgentSessionStop\(sessionIdRef\.current,\s*\{\s*waitForRemote:\s*false/
  );
  assert.match(cleanupSource, /requestAgentSessionStop[\s\S]*room\.disconnect\(\)/);
});

test('disconnect control stops the current room session id from the session context', async () => {
  const useRoomSource = await readFile(new URL('../hooks/useRoom.ts', import.meta.url), 'utf8');
  const sessionProviderSource = await readFile(
    new URL('../components/app/session-provider.tsx', import.meta.url),
    'utf8'
  );
  const controlBarSource = await readFile(
    new URL('../components/livekit/agent-control-bar/agent-control-bar.tsx', import.meta.url),
    'utf8'
  );
  const disconnectSource =
    controlBarSource.match(
      /const handleDisconnect = useCallback\(async \(\) => \{[\s\S]*?\n  \);/
    )?.[0] ?? '';

  assert.match(useRoomSource, /getCurrentSessionId/);
  assert.match(sessionProviderSource, /getCurrentSessionId/);
  assert.match(controlBarSource, /getCurrentSessionId/);
  assert.match(disconnectSource, /const sessionId = getCurrentSessionId\(\)/);
  assert.match(
    disconnectSource,
    /getCurrentSessionId\(\) \?\? getActiveAgentSession\(\)\?\.sessionId/
  );
  assert.match(disconnectSource, /requestAgentSessionStop\(sessionId/);
  assert.doesNotMatch(controlBarSource, /usesFastBrowserStop/);
});

test('browser video input shows the camera control as enabled by default', async () => {
  const browserSourceSource = await readFile(
    new URL('../hooks/useBrowserSourceClient.ts', import.meta.url),
    'utf8'
  );
  const controlBarSource = await readFile(
    new URL('../components/livekit/agent-control-bar/agent-control-bar.tsx', import.meta.url),
    'utf8'
  );

  assert.match(browserSourceSource, /const BROWSER_VIDEO_DEFAULT_ENABLED = true/);
  assert.match(
    controlBarSource,
    /mediaEnabled=\{usesBrowserRawVideoInput \? browserSourceClient\.videoEnabled : undefined\}/
  );
});

test('browser source reports video failure even when audio capture also fails', async () => {
  const browserSourceSource = await readFile(
    new URL('../hooks/useBrowserSourceClient.ts', import.meta.url),
    'utf8'
  );
  const audioFailureBranch =
    browserSourceSource.match(
      /if \(audioResult\.status === 'rejected'\) \{[\s\S]*?throw audioResult\.reason;\n    \}/
    )?.[0] ?? '';

  assert.match(audioFailureBranch, /if \(videoResult\.status === 'rejected'\)/);
  assert.match(audioFailureBranch, /onVideoError\?\.\(videoResult\.reason as Error\)/);
});

test('microphone device selector remains visible before media permission is granted', async () => {
  const trackSelectorSource = await readFile(
    new URL('../components/livekit/agent-control-bar/track-selector.tsx', import.meta.url),
    'utf8'
  );
  const deviceSelectSource = await readFile(
    new URL('../components/livekit/agent-control-bar/track-device-select.tsx', import.meta.url),
    'utf8'
  );

  assert.match(trackSelectorSource, /alwaysVisible=\{kind === 'audioinput'\}/);
  assert.match(deviceSelectSource, /alwaysVisible = false/);
  assert.match(deviceSelectSource, /!alwaysVisible && filteredDevices\.length < 2/);
  assert.match(deviceSelectSource, /setRequestPermissionsState\(true\)/);
});

test('raw browser audio applies the selected microphone device to capture', async () => {
  const browserSourceSource = await readFile(
    new URL('../hooks/useBrowserSourceClient.ts', import.meta.url),
    'utf8'
  );
  const sessionProviderSource = await readFile(
    new URL('../components/app/session-provider.tsx', import.meta.url),
    'utf8'
  );
  const controlBarSource = await readFile(
    new URL('../components/livekit/agent-control-bar/agent-control-bar.tsx', import.meta.url),
    'utf8'
  );

  assert.match(browserSourceSource, /setAudioDeviceId: \(deviceId: string\) => Promise<void>/);
  assert.match(browserSourceSource, /const audioDeviceIdRef = useRef<string \| null>\(null\)/);
  assert.match(browserSourceSource, /buildAudioCaptureOptions\(audioDeviceIdRef\.current\)/);
  assert.match(browserSourceSource, /deviceId: \{ exact: deviceId \}/);
  assert.match(sessionProviderSource, /setAudioDeviceId: async \(\) => \{\}/);
  assert.match(controlBarSource, /const handleAudioDeviceSelect = useCallback/);
  assert.match(controlBarSource, /browserSourceClient\.setAudioDeviceId\(deviceId\)/);
  assert.match(controlBarSource, /onActiveDeviceChange=\{handleAudioDeviceSelect\}/);
});

test('configurable video selector only changes externally controlled media from user toggle', async () => {
  const selectorSource = await readFile(
    new URL(
      '../components/livekit/agent-control-bar/configurable-video-selector.tsx',
      import.meta.url
    ),
    'utf8'
  );
  const disablePreviewSource =
    selectorSource.match(/const disableTrackPreview = useCallback\([\s\S]*?\n  \);/)?.[0] ?? '';
  const handleToggleSource =
    selectorSource.match(/const handleToggleVideo = useCallback\([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.ok(disablePreviewSource, 'disableTrackPreview should be defined');
  assert.ok(handleToggleSource, 'handleToggleVideo should be defined');
  assert.doesNotMatch(disablePreviewSource, /onMediaEnabledChange/);
  assert.doesNotMatch(disablePreviewSource, /setExternalMediaEnabledFromUserToggle/);
  assert.match(handleToggleSource, /setExternalMediaEnabledFromUserToggle\(shouldEnable\)/);
});
