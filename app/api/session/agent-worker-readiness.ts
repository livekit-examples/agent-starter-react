import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_READY_TIMEOUT_MS = 30_000;
const DEFAULT_READY_POLL_MS = 200;

type AgentWorkerReadyMarker = {
  version: number;
  agentName: string;
  workerId: string;
  registeredAt: string;
};

export type WaitForAgentWorkerReadyOptions = {
  readyFile?: string;
  timeoutMs?: number;
  maxWaitMs?: number;
  pollMs?: number;
  readFile?: (filePath: string) => Promise<string>;
  sleep?: (ms: number) => Promise<unknown>;
};

export type AgentWorkerReadiness =
  | {
      state: 'ready';
      agentName: string;
      workerId: string;
      registeredAt: string;
      waitedMs: number;
    }
  | {
      state: 'skipped';
      agentName: string;
      reason: 'not_sandbox';
      waitedMs: 0;
    };

export function resolveAgentWorkerReadyFile(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.LIVEAVATAR_AGENT_WORKER_READY_FILE || '').trim();
  if (configured) {
    return configured;
  }
  if ((env.LIVEAVATAR_RUNTIME_MODE || '').trim().toLowerCase() !== 'sandbox') {
    return '';
  }
  const workspaceDataDir = (env.LIVEAVATAR_SANDBOX_WORKSPACE_DATA_DIR || '/workspace/data').trim();
  return workspaceDataDir
    ? path.join(workspaceDataDir, 'logs', 'sandbox', 'agent-worker-ready.json')
    : '';
}

export function resolveAgentWorkerReadyTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return readPositiveInt(env.LIVEAVATAR_AGENT_WORKER_READY_TIMEOUT_MS, DEFAULT_READY_TIMEOUT_MS);
}

export async function waitForAgentWorkerReady(
  agentName: string,
  options: WaitForAgentWorkerReadyOptions = {}
): Promise<AgentWorkerReadiness> {
  const readyFile = options.readyFile ?? resolveAgentWorkerReadyFile();
  if (!readyFile) {
    return { state: 'skipped', agentName, reason: 'not_sandbox', waitedMs: 0 };
  }

  const configuredTimeoutMs = options.timeoutMs ?? resolveAgentWorkerReadyTimeoutMs();
  const timeoutMs =
    options.maxWaitMs === undefined
      ? configuredTimeoutMs
      : Math.max(0, Math.min(configuredTimeoutMs, options.maxWaitMs));
  if (timeoutMs <= 0) {
    throw new Error(`agent worker did not register before prewarm timeout: ${agentName}`);
  }
  const pollMs =
    options.pollMs ??
    readPositiveInt(process.env.LIVEAVATAR_AGENT_WORKER_READY_POLL_MS, DEFAULT_READY_POLL_MS);
  const readMarkerFile = options.readFile || ((filePath: string) => readFile(filePath, 'utf8'));
  const sleepFn = options.sleep || sleep;
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;

  do {
    const marker = await readReadyMarker(readyFile, readMarkerFile);
    if (marker?.agentName === agentName && marker.workerId) {
      return {
        state: 'ready',
        agentName,
        workerId: marker.workerId,
        registeredAt: marker.registeredAt,
        waitedMs: Date.now() - startedAt,
      };
    }

    const waitMs = Math.min(pollMs, deadline - Date.now());
    if (waitMs > 0) {
      await sleepFn(waitMs);
    }
  } while (Date.now() < deadline);

  throw new Error(`agent worker did not register before prewarm timeout: ${agentName}`);
}

async function readReadyMarker(
  readyFile: string,
  readMarkerFile: (filePath: string) => Promise<string>
): Promise<AgentWorkerReadyMarker | null> {
  try {
    const payload = JSON.parse(await readMarkerFile(readyFile)) as Partial<AgentWorkerReadyMarker>;
    if (
      payload.version !== 1 ||
      typeof payload.agentName !== 'string' ||
      typeof payload.workerId !== 'string' ||
      typeof payload.registeredAt !== 'string'
    ) {
      return null;
    }
    return payload as AgentWorkerReadyMarker;
  } catch {
    return null;
  }
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
