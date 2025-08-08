// This file contains pieces copied and pasted from the livekit-client package, largely internal
// things that aren't currently being exported.
//
// FIXME: export this stuff in livekit-client or explicitly vendor this stuff into the agents sdk

export interface BaseStreamInfo {
  id: string;
  mimeType: string;
  topic: string;
  timestamp: number;
  /** total size in bytes for finite streams and undefined for streams of unknown size */
  size?: number;
  attributes?: Record<string, string>;
}
export interface ByteStreamInfo extends BaseStreamInfo {
  name: string;
}

export interface TextStreamInfo extends BaseStreamInfo {}

export { type ParticipantEventCallbacks } from "../../node_modules/livekit-client/src/room/participant/Participant";
