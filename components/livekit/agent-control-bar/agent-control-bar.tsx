'use client';

import { type HTMLAttributes, useCallback, useMemo, useState } from 'react';
import { Track } from 'livekit-client';
import { useChat, useRemoteParticipants } from '@livekit/components-react';
import { ChatTextIcon, PhoneDisconnectIcon } from '@phosphor-icons/react/dist/ssr';
import { useSession } from '@/components/app/session-provider';
import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import { toastAlert } from '@/components/livekit/alert-toast';
import { Button } from '@/components/livekit/button';
import { Toggle } from '@/components/livekit/toggle';
import {
  getActiveAgentSession,
  registerAgentSessionLocalCleanup,
  requestAgentSessionStop,
} from '@/lib/session-stop-client';
import { cn } from '@/lib/utils';
import { ChatInput } from './chat-input';
import { ConfigurableVideoSelector } from './configurable-video-selector';
import { UseInputControlsProps, useInputControls } from './hooks/use-input-controls';
import { usePublishPermissions } from './hooks/use-publish-permissions';
import { TrackSelector } from './track-selector';

const BROWSER_VIDEO_TRACK_NAME = 'browser_video_track';

export interface ControlBarControls {
  leave?: boolean;
  camera?: boolean;
  microphone?: boolean;
  screenShare?: boolean;
  chat?: boolean;
}

export interface AgentControlBarProps extends UseInputControlsProps {
  controls?: ControlBarControls;
  chatOpen?: boolean;
  defaultChatOpen?: boolean;
  onDisconnect?: () => void;
  onChatOpenChange?: (open: boolean) => void;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

/**
 * A control bar specifically designed for voice assistant interfaces
 */
export function AgentControlBar({
  controls,
  chatOpen: controlledChatOpen,
  defaultChatOpen = false,
  saveUserChoices = true,
  className,
  onDisconnect,
  onDeviceError,
  onChatOpenChange,
  ...props
}: AgentControlBarProps & HTMLAttributes<HTMLDivElement>) {
  const { send } = useChat();
  const participants = useRemoteParticipants();
  const [uncontrolledChatOpen, setUncontrolledChatOpen] = useState(defaultChatOpen);
  const publishPermissions = usePublishPermissions();
  const { appConfig, isSessionActive, endSession, getCurrentSessionId, browserSourceClient } =
    useSession();
  const isChatControlled = controlledChatOpen !== undefined;
  const chatOpen = controlledChatOpen ?? uncontrolledChatOpen;
  const usesBrowserRawAudioInput =
    !!(appConfig.usesBrowserRawAudioInput ?? appConfig.usesBrowserRawMediaInput) &&
    browserSourceClient.enabled;
  const usesBrowserRawVideoInput =
    !!(appConfig.usesBrowserRawVideoInput ?? appConfig.usesBrowserRawMediaInput) &&
    browserSourceClient.enabled;
  const browserRawVideoTracks = useMemo(() => {
    if (!usesBrowserRawVideoInput || !browserSourceClient.videoTrack) {
      return undefined;
    }

    return new Map([[BROWSER_VIDEO_TRACK_NAME, browserSourceClient.videoTrack]]);
  }, [usesBrowserRawVideoInput, browserSourceClient.videoTrack]);
  const handleDeviceError = useCallback(
    (deviceError: { source: Track.Source; error: Error }) => {
      if (onDeviceError) {
        onDeviceError(deviceError);
        return;
      }

      toastAlert({
        title: `${getDeviceLabel(deviceError.source)} could not start`,
        description: `${deviceError.error.name}: ${deviceError.error.message}`,
      });
    },
    [onDeviceError]
  );

  const {
    micTrackRef,
    cameraToggle,
    microphoneToggle,
    screenShareToggle,
    handleAudioDeviceChange,
    handleVideoDeviceChange,
    handleMicrophoneDeviceSelectError,
    handleCameraDeviceSelectError,
  } = useInputControls({ onDeviceError: handleDeviceError, saveUserChoices });

  const handleSendMessage = async (message: string) => {
    await send(message);
  };

  const handleToggleTextInput = useCallback(
    (open: boolean) => {
      if (!isChatControlled) {
        setUncontrolledChatOpen(open);
      }
      onChatOpenChange?.(open);
    },
    [isChatControlled, onChatOpenChange]
  );

  const handleDisconnect = useCallback(async () => {
    const sessionId = getCurrentSessionId() ?? getActiveAgentSession()?.sessionId;
    const localDisconnectPromise = Promise.resolve().then(async () => {
      await endSession();
      onDisconnect?.();
    });
    registerAgentSessionLocalCleanup(localDisconnectPromise);
    void requestAgentSessionStop(sessionId);
  }, [endSession, getCurrentSessionId, onDisconnect]);

  const handleRawMicrophoneToggle = useCallback(
    (enabled: boolean) => {
      void browserSourceClient.setAudioEnabled(enabled).catch((error) => {
        handleDeviceError({ source: Track.Source.Microphone, error });
      });
    },
    [browserSourceClient, handleDeviceError]
  );

  const handleAudioDeviceSelect = useCallback(
    (deviceId: string) => {
      handleAudioDeviceChange(deviceId);
      if (!usesBrowserRawAudioInput) {
        return;
      }

      void browserSourceClient.setAudioDeviceId(deviceId).catch((error) => {
        handleDeviceError({ source: Track.Source.Microphone, error });
      });
    },
    [browserSourceClient, handleAudioDeviceChange, handleDeviceError, usesBrowserRawAudioInput]
  );

  const handleRawVideoToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await browserSourceClient.setVideoEnabled(enabled);
      } catch (error) {
        handleDeviceError({ source: Track.Source.Camera, error: error as Error });
      }
    },
    [browserSourceClient, handleDeviceError]
  );
  const visibleControls = {
    leave: controls?.leave ?? true,
    microphone: controls?.microphone ?? publishPermissions.microphone,
    screenShare: controls?.screenShare ?? publishPermissions.screenShare,
    camera: controls?.camera ?? publishPermissions.camera,
    chat: controls?.chat ?? publishPermissions.data,
  };

  const isAgentAvailable = participants.some((p) => p.isAgent);

  return (
    <div
      aria-label="Voice assistant controls"
      className={cn(
        'bg-background border-input/50 dark:border-muted flex flex-col rounded-[31px] border p-3 drop-shadow-md/3',
        className
      )}
      {...props}
    >
      {/* Chat Input */}
      {visibleControls.chat && (
        <ChatInput
          chatOpen={chatOpen}
          isAgentAvailable={isAgentAvailable}
          onSend={handleSendMessage}
        />
      )}

      <div className="flex gap-1">
        <div className="flex grow gap-1">
          {/* Toggle Microphone */}
          {visibleControls.microphone && (
            <TrackSelector
              kind="audioinput"
              aria-label="Toggle microphone"
              source={Track.Source.Microphone}
              pressed={
                usesBrowserRawAudioInput
                  ? browserSourceClient.audioEnabled
                  : microphoneToggle.enabled
              }
              disabled={
                usesBrowserRawAudioInput
                  ? !isSessionActive || browserSourceClient.audioPending
                  : microphoneToggle.pending
              }
              audioTrackRef={usesBrowserRawAudioInput ? undefined : micTrackRef}
              onPressedChange={
                usesBrowserRawAudioInput ? handleRawMicrophoneToggle : microphoneToggle.toggle
              }
              onMediaDeviceError={handleMicrophoneDeviceSelectError}
              onActiveDeviceChange={handleAudioDeviceSelect}
            />
          )}

          {/* Configurable Video Selector */}
          {visibleControls.camera && (
            <ConfigurableVideoSelector
              availableConfigs={appConfig.availableVideoTracks}
              defaultTrackId={appConfig.defaultVideoTrack}
              existingLivekitTracks={browserRawVideoTracks}
              appConfig={appConfig}
              pressed={usesBrowserRawVideoInput ? undefined : cameraToggle.enabled}
              pending={usesBrowserRawVideoInput ? false : cameraToggle.pending}
              disabled={usesBrowserRawVideoInput ? !isSessionActive : cameraToggle.pending}
              mediaEnabled={usesBrowserRawVideoInput ? browserSourceClient.videoEnabled : undefined}
              mediaPending={usesBrowserRawVideoInput ? browserSourceClient.videoPending : undefined}
              autoPreviewLivekitTracks
              onMediaEnabledChange={usesBrowserRawVideoInput ? handleRawVideoToggle : undefined}
              onPressedChange={usesBrowserRawVideoInput ? undefined : cameraToggle.toggle}
              onMediaDeviceError={handleCameraDeviceSelectError}
              onTrackChange={handleVideoDeviceChange}
            />
          )}

          {/* Toggle Screen Share */}
          {visibleControls.screenShare && (
            <TrackToggle
              size="icon"
              variant="secondary"
              aria-label="Toggle screen share"
              source={Track.Source.ScreenShare}
              pressed={screenShareToggle.enabled}
              disabled={screenShareToggle.pending}
              onPressedChange={screenShareToggle.toggle}
            />
          )}

          {/* Toggle text input */}
          <Toggle
            size="icon"
            variant="secondary"
            aria-label="Toggle text input"
            pressed={chatOpen}
            onPressedChange={handleToggleTextInput}
          >
            <ChatTextIcon weight="bold" />
          </Toggle>
        </div>

        {/* Disconnect */}
        {visibleControls.leave && (
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={!isSessionActive}
            className="font-mono"
          >
            <PhoneDisconnectIcon weight="bold" />
            <span className="hidden md:inline">END CALL</span>
            <span className="inline md:hidden">END</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function getDeviceLabel(source: Track.Source) {
  if (source === Track.Source.Microphone) {
    return 'Microphone';
  }
  if (source === Track.Source.Camera) {
    return 'Camera';
  }
  if (source === Track.Source.ScreenShare) {
    return 'Screen share';
  }
  return 'Media device';
}
