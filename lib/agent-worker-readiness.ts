export type AgentWorkerState = 'available' | 'unavailable' | 'unknown';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readAgentWorkerStateFromLog(source: string, agentName: string): AgentWorkerState {
  let state: AgentWorkerState = 'unknown';
  const agentNamePattern = new RegExp(`"agentName"\\s*:\\s*"${escapeRegExp(agentName)}"`);
  const availablePattern = /"status"\s*:\s*"WS_AVAILABLE"/;
  const unavailablePattern = /"status"\s*:\s*"WS_FULL"/;

  for (const line of source.split(/\r?\n/)) {
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
