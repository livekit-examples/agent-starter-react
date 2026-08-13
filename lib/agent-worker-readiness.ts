export type AgentWorkerState = 'available' | 'unavailable' | 'unknown';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readAgentWorkerStateFromLog(source: string, agentName: string): AgentWorkerState {
  let state: AgentWorkerState = 'unknown';
  const agentNamePattern = new RegExp(`"agentName"\\s*:\\s*"${escapeRegExp(agentName)}"`);
  const availablePattern = /"status"\s*:\s*"WS_AVAILABLE"/;
  const unavailablePattern = /"status"\s*:\s*"WS_FULL"/;
  // The run-scoped live.log contains one local worker; these SDK capacity lines omit agentName.
  const localAvailablePattern = /worker is below capacity, marking as available/;
  const localUnavailablePattern = /worker is at full capacity, marking as unavailable/;

  for (const line of source.split(/\r?\n/)) {
    if (localAvailablePattern.test(line)) {
      state = 'available';
      continue;
    }
    if (localUnavailablePattern.test(line)) {
      state = 'unavailable';
      continue;
    }
    if (!agentNamePattern.test(line)) {
      continue;
    }
    if (availablePattern.test(line)) {
      state = 'available';
    } else if (unavailablePattern.test(line)) {
      state = 'unavailable';
    }
  }

  return state;
}
