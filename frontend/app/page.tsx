"use client";

import "@livekit/components-styles";

import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import { useCallback, useState } from "react";
import { MediaDeviceFailure } from "livekit-client";
import type { ConnectionDetails } from "./api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";

export default function Page() {
  const [connectionDetails, updateConnectionDetails] = useState<
    ConnectionDetails | undefined
  >(undefined);

  const onConnectButtonClicked = useCallback(async () => {
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
      "/api/connection-details",
      window.location.origin
    );
    const subdomain = window.location.host.split(".")[0];
    const response = await fetch(
      url.toString(),
      { headers: { "X-Sandbox-ID": subdomain } });
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);
  }, []);

  return (
    <main data-lk-theme="default" className="h-full grid place-items-center">
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={connectionDetails !== undefined}
        audio={true}
        video={false}
        onMediaDeviceFailure={onDeviceFailure}
        onDisconnected={() => {
          updateConnectionDetails(undefined);
        }}
        className="grid items-center grid-rows-[1fr_min-content]"
      >
        {connectionDetails ? (
          <SimpleVoiceAssistant />
        ) : (
          <div className="flex w-full justify-center">
            <button
              className="lk-button"
              onClick={() => onConnectButtonClicked()}
            >
              Connect
            </button>
          </div>
        )}
        <VoiceAssistantControlBar />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}

function SimpleVoiceAssistant() {
  const { state, audioTrack } = useVoiceAssistant();
  return (
    <div className="h-80">
      <BarVisualizer state={state} barCount={7} trackRef={audioTrack} />
      <p className="text-center">{state}</p>
      <NoAgentNotification state={state}>
        <p>
          No agent joined this session. Follow the guide to setup your agent.
        </p>
        <a href="#" className="underline whitespace-nowrap">
          View guide
        </a>
      </NoAgentNotification>
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}
