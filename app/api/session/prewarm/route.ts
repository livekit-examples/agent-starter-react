import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  beginPrewarmUse,
  buildPrewarmUseKey,
  completePrewarmUse,
  releasePrewarmUseAfterFailure,
} from '@/app/api/session/prewarm/prewarm-use-guard';
import {
  PrewarmRoomSessionError,
  prewarmRoomSession,
} from '@/app/api/session/session-dispatch-service';
import { deriveLiveKitRoomName, isValidConnectionRoomId } from '@/lib/connection-room-id';

export const runtime = 'nodejs';
export const revalidate = 0;

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  if ((process.env.LIVEAVATAR_RUNTIME_MODE || '').trim().toLowerCase() !== 'sandbox') {
    return NextResponse.json(
      { status: 'error', error: 'not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const expectedSecret = (process.env.LIVEAVATAR_PREWARM_SECRET || '').trim();
  const actualSecret = (request.headers.get('x-liveavatar-prewarm-secret') || '').trim();
  if (!expectedSecret || !actualSecret || !secretsMatch(actualSecret, expectedSecret)) {
    return NextResponse.json({ status: 'error', error: 'unauthorized' }, { status: 401 });
  }

  const sessionId = (process.env.LIVEAVATAR_VOICE_SESSION_ID || '').trim();
  const agentName = (process.env.AGENT_NAME || '').trim();
  const configuredRoomName = (process.env.LIVEAVATAR_LIVEKIT_ROOM_NAME || '').trim();
  const roomName = isValidConnectionRoomId(sessionId) ? deriveLiveKitRoomName(sessionId) : '';

  if (!sessionId || !roomName || configuredRoomName !== roomName || !agentName) {
    return NextResponse.json(
      { status: 'error', error: 'server-owned prewarm identity is not configured' },
      { status: 503 }
    );
  }

  const prewarmUseKey = buildPrewarmUseKey(sessionId, roomName, agentName);
  const prewarmUseState = beginPrewarmUse(prewarmUseKey);
  if (prewarmUseState !== 'started') {
    return NextResponse.json(
      {
        status: 'error',
        error:
          prewarmUseState === 'in_progress'
            ? 'prewarm already in progress'
            : 'prewarm authorization already consumed',
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const result = await prewarmRoomSession({ roomName, sessionId, agentName });
    completePrewarmUse(prewarmUseKey);
    return NextResponse.json(
      {
        status: 'prewarmed',
        roomName,
        sessionId,
        agentName,
        readiness: result.readiness,
        timings: result.timings,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    releasePrewarmUseAfterFailure(prewarmUseKey, error);
    const phase = error instanceof PrewarmRoomSessionError ? error.phase : 'dispatch_readiness';
    const timings =
      error instanceof PrewarmRoomSessionError ? error.timings : { totalPrewarmMs: 0 };
    const cause = error instanceof PrewarmRoomSessionError ? error.cause : error;
    console.error('session prewarm failed', {
      phase,
      roomName,
      sessionId,
      agentName,
      ...safeErrorDiagnostics(cause),
    });
    return NextResponse.json(
      {
        status: 'error',
        roomName,
        sessionId,
        agentName,
        error: `prewarm failed during ${phase}`,
        phase,
        timings,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

function safeErrorDiagnostics(error: unknown): {
  causeName: string;
  causeCode?: string;
  causeStack?: string;
} {
  const causeName = error instanceof Error ? error.name : typeof error;
  const rawCode =
    error && typeof error === 'object' && 'code' in error ? String(error.code || '') : '';
  const causeCode = /^[A-Za-z0-9_.:-]{1,64}$/.test(rawCode) ? rawCode : undefined;
  const stackLines =
    error instanceof Error
      ? String(error.stack || '')
          .split('\n')
          .slice(1, 9)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('at '))
      : [];
  return {
    causeName,
    ...(causeCode ? { causeCode } : {}),
    ...(stackLines.length > 0 ? { causeStack: stackLines.join('\n') } : {}),
  };
}
