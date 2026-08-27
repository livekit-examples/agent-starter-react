import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const { isRenderableChatMessage } = await import('../lib/chat-message-filter.ts');
const { mergeTranscriptionHistory } = await import('../lib/transcription-history.ts');

function transcription(id, segmentId, timestamp, text) {
  return {
    text,
    participantInfo: { identity: 'frontdesk-agent' },
    streamInfo: {
      id,
      timestamp,
      attributes: { 'lk.segment_id': segmentId },
    },
  };
}

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

test('transcription history preserves a tool preamble replaced by the final stream', () => {
  const preamble = transcription('stream-preamble', 'speech-1', 100, '我查一下。');
  const final = transcription('stream-final', 'speech-1', 200, '已经设置好了。');

  const history = mergeTranscriptionHistory([preamble], [final]);

  assert.deepEqual(
    history.map(({ text }) => text),
    ['我查一下。', '已经设置好了。']
  );
});

test('transcription history updates partial text without duplicating one stream', () => {
  const partial = transcription('stream-1', 'speech-1', 100, '我查');
  const completed = transcription('stream-1', 'speech-1', 100, '我查一下。');

  const history = mergeTranscriptionHistory([partial], [completed]);

  assert.equal(history.length, 1);
  assert.equal(history[0].text, '我查一下。');
});

test('transcription history survives a transient empty snapshot', () => {
  const preamble = transcription('stream-1', 'speech-1', 100, '我查一下。');

  const history = mergeTranscriptionHistory([preamble], []);

  assert.deepEqual(history, [preamble]);
});
