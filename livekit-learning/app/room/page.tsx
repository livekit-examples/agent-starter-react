'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Room,
  RoomEvent,
  ConnectionState,
  LocalParticipant,
  RemoteParticipant,
  Track,
  VideoTrack,
  RemoteTrack,
  RemoteTrackPublication,
  Participant,
} from 'livekit-client';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { VideoTile } from '@/components/VideoTile';

/**
 * ROOM PAGE
 *
 * This is the main page where LiveKit connection and interaction happens.
 *
 * Flow:
 * 1. Get room name from URL (?name=my-room)
 * 2. Fetch token from /api/token
 * 3. Create Room instance and connect
 * 4. Enable camera/microphone
 * 5. Display local and remote video tracks
 * 6. Handle events (participants joining/leaving, tracks published/unpublished)
 */

// Generate a random user ID for this session
function generateUserId(): string {
  return `user-${Math.random().toString(36).substring(2, 8)}`;
}

export default function RoomPage() {
  const searchParams = useSearchParams();
  const roomName = searchParams.get('name') || 'default-room';

  // Store userId in a ref so it persists across renders but is generated once
  const userIdRef = useRef<string>(generateUserId());

  // Room instance - the main LiveKit object
  const [room, setRoom] = useState<Room | null>(null);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );

  // Local video track (your camera)
  const [localVideoTrack, setLocalVideoTrack] = useState<VideoTrack | null>(null);

  // Remote participants and their video tracks
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(
    new Map()
  );

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Event log for learning purposes
  const [eventLog, setEventLog] = useState<string[]>([]);

  // Helper to add events to log
  const logEvent = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLog((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
  }, []);

  // Connect to the room
  const connect = useCallback(async () => {
    setError(null);
    logEvent('Fetching token...');

    try {
      // Step 1: Get token from our API
      const response = await fetch(
        `/api/token?room=${encodeURIComponent(roomName)}&user=${encodeURIComponent(userIdRef.current)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get token');
      }

      const { token, url } = await response.json();
      logEvent('Token received, connecting to room...');

      // Step 2: Create a new Room instance
      const newRoom = new Room({
        // Automatically manage subscribed video quality based on size
        adaptiveStream: true,

        // Optimize for low latency
        dynacast: true,
      });

      // Step 3: Set up event listeners BEFORE connecting
      // This ensures we don't miss any events

      // Connection state changes
      newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
        logEvent(`Connection state: ${state}`);
      });

      // When a participant connects
      newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        logEvent(`Participant joined: ${participant.identity}`);
        setRemoteParticipants((prev) => {
          const updated = new Map(prev);
          updated.set(participant.identity, participant);
          return updated;
        });
      });

      // When a participant disconnects
      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        logEvent(`Participant left: ${participant.identity}`);
        setRemoteParticipants((prev) => {
          const updated = new Map(prev);
          updated.delete(participant.identity);
          return updated;
        });
      });

      // When we subscribe to a remote track (audio/video from others)
      newRoom.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          logEvent(`Subscribed to ${track.kind} from ${participant.identity}`);

          // Force re-render to show new tracks
          setRemoteParticipants((prev) => {
            const updated = new Map(prev);
            updated.set(participant.identity, participant);
            return updated;
          });

          // Auto-play audio tracks
          if (track.kind === Track.Kind.Audio) {
            const audioElement = document.createElement('audio');
            audioElement.autoplay = true;
            track.attach(audioElement);
          }
        }
      );

      // When a remote track is unsubscribed
      newRoom.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          logEvent(`Unsubscribed from ${track.kind} from ${participant.identity}`);
          track.detach();
        }
      );

      // Step 4: Connect to the room
      await newRoom.connect(url, token);
      logEvent('Connected to room!');

      // Step 5: Get existing participants
      newRoom.remoteParticipants.forEach((participant: RemoteParticipant) => {
        setRemoteParticipants((prev) => {
          const updated = new Map(prev);
          updated.set(participant.identity, participant);
          return updated;
        });
      });

      setRoom(newRoom);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      logEvent(`Error: ${message}`);
    }
  }, [roomName, logEvent]);

  // Enable camera
  const enableCamera = useCallback(async () => {
    if (!room) return;

    try {
      logEvent('Enabling camera...');

      // This publishes your camera to the room
      await room.localParticipant.setCameraEnabled(true);

      // Get the video track
      const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (cameraTrack?.track) {
        setLocalVideoTrack(cameraTrack.track as VideoTrack);
        logEvent('Camera enabled');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable camera';
      logEvent(`Camera error: ${message}`);
    }
  }, [room, logEvent]);

  // Disable camera
  const disableCamera = useCallback(async () => {
    if (!room) return;

    logEvent('Disabling camera...');
    await room.localParticipant.setCameraEnabled(false);
    setLocalVideoTrack(null);
    logEvent('Camera disabled');
  }, [room, logEvent]);

  // Enable microphone
  const enableMicrophone = useCallback(async () => {
    if (!room) return;

    try {
      logEvent('Enabling microphone...');
      await room.localParticipant.setMicrophoneEnabled(true);
      logEvent('Microphone enabled');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable microphone';
      logEvent(`Microphone error: ${message}`);
    }
  }, [room, logEvent]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    if (!room) return;

    logEvent('Disconnecting...');
    await room.disconnect();
    setRoom(null);
    setLocalVideoTrack(null);
    setRemoteParticipants(new Map());
    setConnectionState(ConnectionState.Disconnected);
    logEvent('Disconnected');
  }, [room, logEvent]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/" style={{ fontSize: '0.875rem' }}>
            ← Back to concepts
          </Link>
          <h1 style={{ marginTop: '0.5rem' }}>Room: {roomName}</h1>
          <p style={{ color: 'var(--muted)' }}>Your ID: {userIdRef.current}</p>
        </div>
        <ConnectionStatus state={connectionState} />
      </div>

      {error && (
        <div
          className="card"
          style={{ background: '#fef2f2', borderColor: '#fecaca', marginTop: '1rem' }}
        >
          <strong style={{ color: '#dc2626' }}>Error:</strong> {error}
        </div>
      )}

      {/* Controls */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Controls</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {connectionState === ConnectionState.Disconnected && (
            <button className="button button-primary" onClick={connect}>
              Connect
            </button>
          )}

          {connectionState === ConnectionState.Connected && (
            <>
              <button
                className="button button-secondary"
                onClick={localVideoTrack ? disableCamera : enableCamera}
              >
                {localVideoTrack ? 'Disable Camera' : 'Enable Camera'}
              </button>
              <button className="button button-secondary" onClick={enableMicrophone}>
                Enable Microphone
              </button>
              <button
                className="button"
                style={{ background: '#fef2f2', color: '#dc2626' }}
                onClick={disconnect}
              >
                Disconnect
              </button>
            </>
          )}

          {connectionState === ConnectionState.Connecting && (
            <button className="button button-secondary" disabled>
              Connecting...
            </button>
          )}
        </div>
      </div>

      {/* Video Grid */}
      {connectionState === ConnectionState.Connected && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Participants</h3>
          <div className="video-grid" style={{ marginTop: '0.5rem' }}>
            {/* Local video (you) */}
            <VideoTile track={localVideoTrack} label={`You (${userIdRef.current})`} mirror />

            {/* Remote participants */}
            {Array.from(remoteParticipants.values()).map((participant) => {
              const videoTrack = participant.getTrackPublication(Track.Source.Camera)
                ?.track as VideoTrack | undefined;

              return (
                <VideoTile
                  key={participant.identity}
                  track={videoTrack || null}
                  label={participant.identity}
                />
              );
            })}
          </div>

          {remoteParticipants.size === 0 && (
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
              No other participants yet. Try opening this room in another tab!
            </p>
          )}
        </div>
      )}

      {/* Event Log */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Event Log</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Watch events as they happen to understand the flow.
        </p>
        <div
          style={{
            marginTop: '0.5rem',
            maxHeight: 200,
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            background: '#f5f5f5',
            padding: '0.5rem',
            borderRadius: 4,
          }}
        >
          {eventLog.length === 0 ? (
            <div style={{ color: '#999' }}>Events will appear here...</div>
          ) : (
            eventLog.map((event, index) => (
              <div key={index} style={{ padding: '2px 0' }}>
                {event}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Code Explanation */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>What&apos;s Happening in the Code</h3>
        <div className="concept">
          <h4>1. Token Fetch</h4>
          <p>We call /api/token to get a JWT that grants access to the room.</p>
        </div>
        <div className="concept">
          <h4>2. Room Creation</h4>
          <p>
            We create a <code>new Room()</code> instance - this is the main LiveKit object.
          </p>
        </div>
        <div className="concept">
          <h4>3. Event Listeners</h4>
          <p>
            We attach listeners for <code>RoomEvent.ParticipantConnected</code>,{' '}
            <code>TrackSubscribed</code>, etc. before connecting.
          </p>
        </div>
        <div className="concept">
          <h4>4. Connect</h4>
          <p>
            <code>room.connect(url, token)</code> establishes the WebSocket connection.
          </p>
        </div>
        <div className="concept">
          <h4>5. Publish Tracks</h4>
          <p>
            <code>localParticipant.setCameraEnabled(true)</code> starts your camera and publishes
            it.
          </p>
        </div>
        <div className="concept">
          <h4>6. Subscribe to Tracks</h4>
          <p>
            When others publish, we automatically subscribe. The <code>TrackSubscribed</code> event
            fires.
          </p>
        </div>
      </div>
    </div>
  );
}
