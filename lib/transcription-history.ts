import { type TextStreamData } from '@livekit/components-react';

const DEFAULT_TRANSCRIPTION_HISTORY_SIZE = 100;

/**
 * Keep completed text streams even when LiveKit replaces the current entry for
 * the same speech segment. A tool preamble and its final answer can share one
 * segment id while still arriving as distinct text streams.
 */
export function mergeTranscriptionHistory(
  previous: TextStreamData[],
  current: TextStreamData[],
  maxEntries = DEFAULT_TRANSCRIPTION_HISTORY_SIZE
): TextStreamData[] {
  if (current.length === 0) return previous;

  const byStreamId = new Map(previous.map((entry) => [entry.streamInfo.id, entry]));
  current.forEach((entry) => byStreamId.set(entry.streamInfo.id, entry));

  return Array.from(byStreamId.values())
    .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp)
    .slice(-maxEntries);
}
