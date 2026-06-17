import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { RoomConfiguration } from '@livekit/protocol';
import { deriveLiveKitRoomName, resolveConnectionSessionId } from '@/lib/connection-room-id';

type ConnectionDetails = {
  serverUrl: string;
  sessionId: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // Parse room configuration from request body
    const body = await req.json();
    const roomConfig = body?.room_config
      ? RoomConfiguration.fromJson(body.room_config, { ignoreUnknownFields: true })
      : new RoomConfiguration();
    const tokenRoomConfig = buildTokenRoomConfig(roomConfig);

    // Generate participant token
    const participantName = 'user';
    const sessionId = resolveConnectionSessionId(body, randomUUID);
    const participantIdentity = `voice_assistant_user_${sessionId}`;
    const roomName = deriveLiveKitRoomName(sessionId);

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      tokenRoomConfig
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      sessionId,
      roomName,
      participantToken: participantToken,
      participantName,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    console.info('agent session connection details issued', {
      sessionId,
      roomName,
      participantIdentity,
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration | undefined
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}

function buildTokenRoomConfig(roomConfig: RoomConfiguration) {
  if (roomConfig.agents.length === 0) {
    return roomConfig;
  }

  // Explicit dispatch is handled by /api/session/dispatch; token agents would create duplicate jobs.
  return new RoomConfiguration({
    ...roomConfig,
    agents: [],
  });
}
