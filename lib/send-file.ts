import type { LocalParticipant } from 'livekit-client';

export interface SendFileOptions {
  topic?: string;
  onProgress?: (progress: number) => void;
}

export interface SendFileResult {
  id: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Sends a file to the room (the agent backend) over the LiveKit data channel
 * using the SDK's native file-streaming API.
 *
 * @example
 * import { sendFile } from '@/lib/send-file';
 *
 * await sendFile(room.localParticipant, file, {
 *   topic: 'files',
 *   onProgress: (progress) => {
 *     console.log(`Upload: ${Math.round(progress * 100)}%`);
 *   },
 * });
 */
export async function sendFile(
  participant: LocalParticipant,
  file: File,
  options: SendFileOptions = {}
): Promise<SendFileResult> {
  const { topic = 'files', onProgress } = options;
  const { id } = await participant.sendFile(file, {
    topic,
    mimeType: file.type,
    onProgress,
  });

  return { id, name: file.name, size: file.size, type: file.type };
}
