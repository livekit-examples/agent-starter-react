import { NextResponse } from 'next/server';
import { AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { type ParticipantInfo, ParticipantInfo_Kind } from '@livekit/protocol';
import {
  deriveLiveKitRoomName,
  deriveSessionIdFromLiveKitRoomName,
  isValidConnectionRoomId,
} from '@/lib/connection-room-id';
import { resolveLiveKitHttpUrl } from '@/lib/session-stop';
import {
  type RoomSessionToken,
  beginRoomSessionDispatch,
  finishRoomSessionDispatch,
  isRoomSessionCancelled,
  markRoomSessionRunning,
  registerRoomSessionDispatchId,
} from '../session-registry';

const AGENT_DISPATCH_TIMEOUT_MS = readPositiveIntEnv('AGENT_DISPATCH_TIMEOUT_MS', 8_000);
const AGENT_DISPATCH_RETRY_MS = readPositiveIntEnv('AGENT_DISPATCH_RETRY_MS', 500);
const AGENT_DISPATCH_POLL_MS = readPositiveIntEnv('AGENT_DISPATCH_POLL_MS', 200);

export const runtime = 'nodejs';
export const revalidate = 0;

type AgentParticipantMatchOptions = {
  allowAnonymousLiveKitAgentFallback?: boolean;
};

class RoomSessionCancelledError extends Error {
  constructor(session: RoomSessionToken) {
    super(
      `room session was cancelled for sessionId=${session.sessionId} roomName=${session.roomName}`
    );
    this.name = 'RoomSessionCancelledError';
  }
}

export async function POST(req: Request) {
  let body: {
    roomName?: string;
    room_name?: string;
    agentName?: string;
    agent_name?: string;
    sessionId?: string;
    session_id?: string;
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

  const liveKitHttpUrl = resolveLiveKitHttpUrl(process.env.LIVEKIT_URL);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!liveKitHttpUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      { status: 'error', error: 'LiveKit API configuration is required' },
      { status: 500 }
    );
  }

  try {
    const dispatchClient = new AgentDispatchClient(liveKitHttpUrl, apiKey, apiSecret);
    const roomClient = new RoomServiceClient(liveKitHttpUrl, apiKey, apiSecret);
    const session = beginRoomSessionDispatch(roomName, sessionId, agentName);
    try {
      const dispatch = await createAgentDispatchWithRetry(
        dispatchClient,
        roomClient,
        roomName,
        agentName,
        session
      );
      console.info('agent session dispatch completed', {
        roomName,
        sessionId,
        agentName,
        dispatch,
      });
      return NextResponse.json({ status: 'dispatched', roomName, agentName, sessionId, dispatch });
    } finally {
      finishRoomSessionDispatch(session);
    }
  } catch (error) {
    if (error instanceof RoomSessionCancelledError) {
      return NextResponse.json(
        {
          status: 'cancelled',
          roomName,
          agentName,
          sessionId,
          error: error.message,
        },
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

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function createAgentDispatchWithRetry(
  dispatchClient: AgentDispatchClient,
  roomClient: RoomServiceClient,
  roomName: string,
  agentName: string,
  session: RoomSessionToken
) {
  const startedAt = Date.now();
  let lastError: unknown;
  let attempts = 0;

  do {
    try {
      throwIfSessionCancelled(session);

      const alreadyJoined = await roomHasAgentParticipant(roomClient, roomName, agentName);
      throwIfSessionCancelled(session);
      if (alreadyJoined) {
        markRoomSessionRunning(session);
        return { attempts, alreadyJoined: true };
      }

      const dispatch = await dispatchClient.createDispatch(roomName, agentName);
      attempts += 1;
      registerRoomSessionDispatchId(session, dispatch.id);

      if (isRoomSessionCancelled(session)) {
        await deleteDispatchQuietly(dispatchClient, dispatch.id, roomName);
        await deleteLiveKitRoomQuietly(roomClient, roomName);
        throw new RoomSessionCancelledError(session);
      }

      if (
        await waitForAgentParticipant(
          roomClient,
          roomName,
          agentName,
          remainingDispatchTime(startedAt),
          session
        )
      ) {
        if (isRoomSessionCancelled(session)) {
          await deleteLiveKitRoomQuietly(roomClient, roomName);
          throw new RoomSessionCancelledError(session);
        }
        markRoomSessionRunning(session);
        return { attempts, dispatchId: dispatch.id };
      }

      lastError = new Error('agent participant did not join before retry');
      await deleteDispatchQuietly(dispatchClient, dispatch.id, roomName);
    } catch (error) {
      if (error instanceof RoomSessionCancelledError) {
        throw error;
      }
      lastError = error;
      await sleep(
        Math.min(calculateDispatchRetryDelay(attempts), remainingDispatchTime(startedAt))
      );
    }

    if (Date.now() - startedAt >= AGENT_DISPATCH_TIMEOUT_MS) {
      break;
    }
  } while (true);

  throw new Error(
    `agent dispatch failed for ${agentName} after ${attempts} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function remainingDispatchTime(startedAt: number) {
  return Math.max(0, AGENT_DISPATCH_TIMEOUT_MS - (Date.now() - startedAt));
}

function calculateDispatchRetryDelay(attempts: number) {
  const multiplier = 2 ** Math.max(0, attempts - 1);
  return Math.min(AGENT_DISPATCH_RETRY_MS * multiplier, AGENT_DISPATCH_TIMEOUT_MS);
}

async function waitForAgentParticipant(
  roomClient: RoomServiceClient,
  roomName: string,
  agentName: string,
  maxWaitMs: number,
  session: RoomSessionToken
) {
  const deadline = Date.now() + Math.min(maxWaitMs, AGENT_DISPATCH_RETRY_MS);

  do {
    throwIfSessionCancelled(session);
    if (
      await roomHasAgentParticipant(roomClient, roomName, agentName, {
        allowAnonymousLiveKitAgentFallback: true,
      })
    ) {
      throwIfSessionCancelled(session);
      return true;
    }

    const waitMs = Math.min(AGENT_DISPATCH_POLL_MS, deadline - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  } while (Date.now() < deadline);

  throwIfSessionCancelled(session);
  return roomHasAgentParticipant(roomClient, roomName, agentName, {
    allowAnonymousLiveKitAgentFallback: true,
  });
}

async function roomHasAgentParticipant(
  roomClient: RoomServiceClient,
  roomName: string,
  agentName: string,
  options: AgentParticipantMatchOptions = {}
) {
  const participants = await roomClient.listParticipants(roomName);
  if (participants.some((participant) => isExpectedAgentParticipant(participant, agentName))) {
    return true;
  }
  if (!options.allowAnonymousLiveKitAgentFallback) {
    return false;
  }

  // Local LiveKit may omit agent attributes; fresh per-session rooms keep this fallback bounded.
  const anonymousLiveKitAgents = participants.filter(isAnonymousLiveKitAgentParticipant);
  return anonymousLiveKitAgents.length === 1;
}

function isExpectedAgentParticipant(participant: ParticipantInfo, agentName: string) {
  const attributes = participant.attributes ?? {};
  return attributes['lk.agent.name'] === agentName || attributes['lk.agent_name'] === agentName;
}

function isAnonymousLiveKitAgentParticipant(participant: ParticipantInfo) {
  const attributes = participant.attributes ?? {};
  return (
    participant.kind === ParticipantInfo_Kind.AGENT &&
    participant.identity.startsWith('agent-') &&
    !attributes['lk.agent.name'] &&
    !attributes['lk.agent_name']
  );
}

async function deleteDispatchQuietly(
  dispatchClient: AgentDispatchClient,
  dispatchId: string,
  roomName: string
) {
  if (!dispatchId) {
    return;
  }

  try {
    await dispatchClient.deleteDispatch(dispatchId, roomName);
  } catch {
    // The dispatch may already have been consumed or cleaned up by LiveKit.
  }
}

async function deleteLiveKitRoomQuietly(roomClient: RoomServiceClient, roomName: string) {
  try {
    await roomClient.deleteRoom(roomName);
  } catch {
    // The room may already be gone because /stop won the race.
  }
}

function throwIfSessionCancelled(session: RoomSessionToken): void {
  if (isRoomSessionCancelled(session)) {
    throw new RoomSessionCancelledError(session);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
