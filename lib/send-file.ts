import type { LocalParticipant } from 'livekit-client';

export interface SendFileOptions {
  topic?: string;
  onProgress?: (loaded: number, total: number) => void;
}

export interface SendFileResult {
  id: string;
  name: string;
  size: number;
  type: string;
}

// livekit-client caps each reliable data packet at 64,000 bytes
// (DEFAULT_MAX_MESSAGE_SIZE in src/room/RTCEngine.ts). Every chunk packet also
// carries a JSON header, a 1-byte terminator, and the protobuf envelope on top
// of the raw bytes, so keep chunks comfortably below the hard limit.
const CHUNK_SIZE = 60 * 1024; // 61,440 bytes per chunk

export async function sendFile(
  participant: LocalParticipant,
  file: File,
  options: SendFileOptions = {}
): Promise<SendFileResult> {
  const { topic = 'file', onProgress } = options;
  const fileId = crypto.randomUUID();
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  const meta = JSON.stringify({
    id: fileId,
    name: file.name,
    type: file.type,
    size: totalSize,
    totalChunks,
  });
  const metaBytes = new TextEncoder().encode(meta);
  const metaPacket = new Uint8Array(metaBytes.length + 1);
  metaPacket.set(metaBytes, 0);
  metaPacket[metaBytes.length] = 0;
  await participant.publishData(metaPacket, { topic, reliable: true });

  let offset = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunkSize = Math.min(CHUNK_SIZE, totalSize - offset);
    const blob = file.slice(offset, offset + chunkSize);
    const buffer = await blob.arrayBuffer();
    const header = JSON.stringify({ id: fileId, index: i, size: chunkSize });
    const headerBytes = new TextEncoder().encode(header);
    const packet = new Uint8Array(headerBytes.length + 1 + buffer.byteLength);
    packet.set(headerBytes, 0);
    packet[headerBytes.length] = 0;
    packet.set(new Uint8Array(buffer), headerBytes.length + 1);
    await participant.publishData(packet, { topic, reliable: true });
    offset += chunkSize;
    onProgress?.(offset, totalSize);
  }

  return { id: fileId, name: file.name, size: totalSize, type: file.type };
}
