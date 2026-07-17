import { TokenSource } from 'livekit-client';
import type { AppConfig } from '@/app-config';
import { getSandboxTokenSource } from '@/lib/utils';

export interface SpatiusConnection {
  url: string;
  token: string;
  roomName: string;
}

/**
 * Extract the room name from a LiveKit participant JWT.
 *
 * The Spatius `AvatarPlayer.connect()` config requires a `roomName`, but the
 * `TokenSource` response only carries `serverUrl` + `participantToken`, so we
 * read it back out of the token's video grant.
 */
export function roomNameFromToken(token: string): string {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return '';
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { video?: { room?: string }; room?: string };
    return payload.video?.room ?? payload.room ?? '';
  } catch {
    return '';
  }
}

/** The same token source the standard path uses (sandbox endpoint or `/api/token`). */
export function getTokenSource(appConfig: AppConfig) {
  return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
    ? getSandboxTokenSource(appConfig)
    : TokenSource.endpoint('/api/token');
}

/**
 * Resolve LiveKit connection credentials for the Spatius avatar. Fetches a token
 * (dispatching `agentName` when provided — this is what tells LiveKit to send a
 * job to the avatar worker) and derives the room name from it.
 */
export async function resolveSpatiusConnection(
  appConfig: AppConfig,
  agentName?: string
): Promise<SpatiusConnection> {
  const tokenSource = getTokenSource(appConfig);
  const dispatchAgent = (agentName ?? appConfig.agentName ?? '').trim();
  const response = await tokenSource.fetch(dispatchAgent ? { agentName: dispatchAgent } : {});

  return {
    url: response.serverUrl,
    token: response.participantToken,
    roomName: roomNameFromToken(response.participantToken),
  };
}
