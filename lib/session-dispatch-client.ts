type DispatchOptions = {
  signal?: AbortSignal;
  requireRoomVideoInputReady?: boolean;
};

export class AgentSessionDispatchCancelledError extends Error {
  constructor() {
    super('agent session dispatch was cancelled');
    this.name = 'AgentSessionDispatchCancelledError';
  }
}

export async function requestAgentSessionDispatch(
  agentName?: string | null,
  sessionId?: string | null,
  options: DispatchOptions = {}
): Promise<void> {
  const normalizedAgentName = agentName?.trim();
  const normalizedSessionId = sessionId?.trim();
  if (!normalizedAgentName || !normalizedSessionId) {
    return;
  }

  const response = await fetch('api/session/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentName: normalizedAgentName,
      sessionId: normalizedSessionId,
      ...(options.requireRoomVideoInputReady ? { requireRoomVideoInputReady: true } : {}),
    }),
    signal: options.signal,
  });

  if (response.status === 409) {
    throw new AgentSessionDispatchCancelledError();
  }

  if (!response.ok) {
    throw new Error(`agent session dispatch failed: ${response.status}`);
  }
}
