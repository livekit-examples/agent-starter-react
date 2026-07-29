import { NextResponse } from 'next/server';
import {
  RoomSessionCancelledError,
  dispatchRoomSession,
} from '@/app/api/session/session-dispatch-service';
import {
  deriveLiveKitRoomName,
  deriveSessionIdFromLiveKitRoomName,
  isValidConnectionRoomId,
} from '@/lib/connection-room-id';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(req: Request) {
  let body: {
    roomName?: string;
    room_name?: string;
    agentName?: string;
    agent_name?: string;
    sessionId?: string;
    session_id?: string;
    requireRoomVideoInputReady?: boolean;
    require_room_video_input_ready?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requestedRoomName = (body.roomName || body.room_name || '').trim();
  const agentName = (body.agentName || body.agent_name || '').trim();
  const requestedSessionId = (body.sessionId || body.session_id || '').trim();
  if (requestedSessionId && !isValidConnectionRoomId(requestedSessionId)) {
    return NextResponse.json(
      { status: 'error', error: 'valid sessionId is required' },
      { status: 400 }
    );
  }

  const sessionId = requestedSessionId || deriveSessionIdFromLiveKitRoomName(requestedRoomName);
  const roomName = sessionId ? deriveLiveKitRoomName(sessionId) : requestedRoomName;
  if (!roomName) {
    return NextResponse.json({ status: 'error', error: 'roomName is required' }, { status: 400 });
  }
  if (!agentName) {
    return NextResponse.json({ status: 'error', error: 'agentName is required' }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ status: 'error', error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const dispatch = await dispatchRoomSession({
      roomName,
      sessionId,
      agentName,
      readiness: {
        requireRoomVideoInputReady:
          body.requireRoomVideoInputReady === true || body.require_room_video_input_ready === true,
      },
    });
    return NextResponse.json({ status: 'dispatched', roomName, agentName, sessionId, dispatch });
  } catch (error) {
    if (error instanceof RoomSessionCancelledError) {
      return NextResponse.json(
        { status: 'cancelled', roomName, agentName, sessionId, error: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        status: 'error',
        roomName,
        agentName,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
