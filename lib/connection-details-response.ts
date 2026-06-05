export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export async function readConnectionDetailsResponse(
  response: Response
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

  if (!isConnectionDetails(payload)) {
    throw new Error('Connection details response is missing required fields');
  }

  return payload;
}

function isConnectionDetails(value: unknown): value is ConnectionDetails {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const details = value as Record<string, unknown>;
  return (
    isNonEmptyString(details.serverUrl) &&
    isNonEmptyString(details.roomName) &&
    isNonEmptyString(details.participantName) &&
    isNonEmptyString(details.participantToken)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
