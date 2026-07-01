import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const { isRenderableChatMessage } = await import('../lib/chat-message-filter.ts');

test('chat message filter hides empty transcription messages', () => {
  assert.equal(isRenderableChatMessage({ message: '' }), false);
  assert.equal(isRenderableChatMessage({ message: '   \n\t  ' }), false);
});

test('chat message filter keeps normal chat text', () => {
  assert.equal(isRenderableChatMessage({ message: '天气怎么样？' }), true);
});

test('chat message hook filters empty merged messages before sorting', async () => {
  const source = await readFile('hooks/useChatMessages.ts', 'utf8');

  assert.match(source, /isRenderableChatMessage/);
  assert.match(source, /\.filter\(isRenderableChatMessage\)/);
});
