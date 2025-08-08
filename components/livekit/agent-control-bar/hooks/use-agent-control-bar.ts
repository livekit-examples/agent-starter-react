import * as React from 'react';
import { Track } from 'livekit-client';
import {
  type TrackReferenceOrPlaceholder,
  useLocalParticipant,
  usePersistentUserChoices,
  useRoomContext,
  useTrackToggle,
} from '@livekit/components-react';
import { usePublishPermissions } from './use-publish-permissions';
import { useAgentLocalParticipant } from '@/agent-sdk';

export interface ControlBarControls {
  microphone?: boolean;
  screenShare?: boolean;
  chat?: boolean;
  camera?: boolean;
  leave?: boolean;
}

export interface UseAgentControlBarProps {
  controls?: ControlBarControls;
  saveUserChoices?: boolean;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

export interface UseAgentControlBarReturn {
  micTrackRef: TrackReferenceOrPlaceholder;
  visibleControls: ControlBarControls;
  microphoneToggle: ReturnType<typeof useTrackToggle<Track.Source.Microphone>>;
  cameraToggle: ReturnType<typeof useTrackToggle<Track.Source.Camera>>;
  screenShareToggle: ReturnType<typeof useTrackToggle<Track.Source.ScreenShare>>;
  handleDisconnect: () => void;
  handleAudioDeviceChange: (deviceId: string) => void;
  handleVideoDeviceChange: (deviceId: string) => void;
}

export function useAgentControlBar(props: UseAgentControlBarProps = {}): UseAgentControlBarReturn {
  const { controls, saveUserChoices = true } = props;
  const visibleControls = {
    leave: true,
    ...controls,
  };
  // const { microphoneTrack, localParticipant } = useLocalParticipant(); // FIXME: replace with agent alternative
  const {
    microphoneTrack,
    localParticipant,
    publishPermissions,
  } = useAgentLocalParticipant();
  // const publishPermissions = usePublishPermissions(); // FIXME: replace with agent alternative
  const room = useRoomContext();

  const microphoneToggle = useTrackToggle({ // FIXME: replace with agent alternative
    source: Track.Source.Microphone,
    onDeviceError: (error) => props.onDeviceError?.({ source: Track.Source.Microphone, error }),
  });
  const cameraToggle = useTrackToggle({ // FIXME: replace with agent alternative
    source: Track.Source.Camera,
    onDeviceError: (error) => props.onDeviceError?.({ source: Track.Source.Camera, error }),
  });
  const screenShareToggle = useTrackToggle({ // FIXME: replace with agent alternative
    source: Track.Source.ScreenShare,
    onDeviceError: (error) => props.onDeviceError?.({ source: Track.Source.ScreenShare, error }),
  });

  const micTrackRef = React.useMemo(() => {
    return {
      participant: localParticipant,
      source: Track.Source.Microphone,
      publication: microphoneTrack,
    };
  }, [localParticipant, microphoneTrack]);

  visibleControls.microphone ??= publishPermissions.microphone;
  visibleControls.screenShare ??= publishPermissions.screenShare;
  visibleControls.camera ??= publishPermissions.camera;
  visibleControls.chat ??= publishPermissions.data;

  const {
    saveAudioInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputEnabled,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ // FIXME: replace with agent alternative
    preventSave: !saveUserChoices,
  });

  const handleDisconnect = React.useCallback(async () => {
    if (room) {
      await room.disconnect();
    }
  }, [room]);

  const handleAudioDeviceChange = React.useCallback(
    (deviceId: string) => {
      saveAudioInputDeviceId(deviceId ?? 'default');
    },
    [saveAudioInputDeviceId]
  );

  const handleVideoDeviceChange = React.useCallback(
    (deviceId: string) => {
      saveVideoInputDeviceId(deviceId ?? 'default');
    },
    [saveVideoInputDeviceId]
  );

  const handleToggleCamera = React.useCallback(
    async (enabled?: boolean) => {
      if (screenShareToggle.enabled) {
        screenShareToggle.toggle(false);
      }
      await cameraToggle.toggle(enabled);
      // persist video input enabled preference
      saveVideoInputEnabled(!cameraToggle.enabled);
    },
    [cameraToggle.enabled, screenShareToggle.enabled]
  );

  const handleToggleMicrophone = React.useCallback(
    async (enabled?: boolean) => {
      await microphoneToggle.toggle(enabled);
      // persist audio input enabled preference
      saveAudioInputEnabled(!microphoneToggle.enabled);
    },
    [microphoneToggle.enabled]
  );

  const handleToggleScreenShare = React.useCallback(
    async (enabled?: boolean) => {
      if (cameraToggle.enabled) {
        cameraToggle.toggle(false);
      }
      await screenShareToggle.toggle(enabled);
    },
    [screenShareToggle.enabled, cameraToggle.enabled]
  );

  return {
    micTrackRef,
    visibleControls,
    cameraToggle: {
      ...cameraToggle,
      toggle: handleToggleCamera,
    },
    microphoneToggle: {
      ...microphoneToggle,
      toggle: handleToggleMicrophone,
    },
    screenShareToggle: {
      ...screenShareToggle,
      toggle: handleToggleScreenShare,
    },
    handleDisconnect,
    handleAudioDeviceChange,
    handleVideoDeviceChange,
  };
}
