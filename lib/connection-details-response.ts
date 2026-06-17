export type ConnectionDetails = {
  serverUrl: string;
  sessionId: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

type ConnectionDetailsResponseOptions = {
  sessionId?: string;
};

export async function readConnectionDetailsResponse(
  response: Response,
  options: ConnectionDetailsResponseOptions = {}
): Promise<ConnectionDetails> {
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `Failed to fetch connection details (${response.status})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Connection details response was not valid JSON');
  }

  const details = normalizeConnectionDetails(payload, options.sessionId);
  if (!details) {
    throw new Error('Connection details response is missing required fields');
  }

  return details;
}

function normalizeConnectionDetails(
  value: unknown,
  fallbackSessionId?: string
): ConnectionDetails | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const details = value as Record<string, unknown>;
  const sessionId = isNonEmptyString(details.sessionId) ? details.sessionId : fallbackSessionId;
  if (
    !isNonEmptyString(details.serverUrl) ||
    !isNonEmptyString(sessionId) ||
    !isNonEmptyString(details.roomName) ||
    !isNonEmptyString(details.participantName) ||
    !isNonEmptyString(details.participantToken)
  ) {
    return null;
  }

  return {
    serverUrl: details.serverUrl,
    sessionId,
    roomName: details.roomName,
    participantName: details.participantName,
    participantToken: details.participantToken,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
