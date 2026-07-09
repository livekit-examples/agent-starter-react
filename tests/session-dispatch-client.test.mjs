import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

async function loadSessionDispatchClientModule() {
  const source = await readFile(
    new URL('../lib/session-dispatch-client.ts', import.meta.url),
    'utf8'
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}#${randomUUID()}`
  );
}

test('agent session dispatch sends only canonical session id to Next API', async () => {
  const originalFetch = globalThis.fetch;
  let postedBody;
  globalThis.fetch = async (_url, init) => {
    postedBody = JSON.parse(String(init.body));
    return { ok: true, status: 200 };
  };

  try {
    const { requestAgentSessionDispatch } = await loadSessionDispatchClientModule();

    await requestAgentSessionDispatch('agent-a', '11111111-2222-4333-8444-555555555555');

    assert.deepEqual(postedBody, {
      agentName: 'agent-a',
      sessionId: '11111111-2222-4333-8444-555555555555',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('agent session dispatch can require room video input readiness', async () => {
  const originalFetch = globalThis.fetch;
  let postedBody;
  globalThis.fetch = async (_url, init) => {
    postedBody = JSON.parse(String(init.body));
    return { ok: true, status: 200 };
  };

  try {
    const { requestAgentSessionDispatch } = await loadSessionDispatchClientModule();

    await requestAgentSessionDispatch('agent-a', '11111111-2222-4333-8444-555555555555', {
      requireRoomVideoInputReady: true,
    });

    assert.deepEqual(postedBody, {
      agentName: 'agent-a',
      sessionId: '11111111-2222-4333-8444-555555555555',
      requireRoomVideoInputReady: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
