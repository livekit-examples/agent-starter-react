import { Participant, ParticipantEvent, Track, TrackPublication, TranscriptionSegment } from "livekit-client";

// This file contains pieces copied and pasted from the components-js repository
// Something is messed up with my local development environment and I can't figure out how to import
// these properly
//
// FIXME: figure out what is going on here or explicitly vendor this stuff into the agents sdk

/** @public */
export type TrackReference = {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
};

export const participantTrackEvents = [
  ParticipantEvent.TrackPublished,
  ParticipantEvent.TrackUnpublished,
  ParticipantEvent.TrackMuted,
  ParticipantEvent.TrackUnmuted,
  ParticipantEvent.TrackStreamStateChanged,
  ParticipantEvent.TrackSubscribed,
  ParticipantEvent.TrackUnsubscribed,
  ParticipantEvent.TrackSubscriptionPermissionChanged,
  ParticipantEvent.TrackSubscriptionFailed,
  ParticipantEvent.LocalTrackPublished,
  ParticipantEvent.LocalTrackUnpublished,
];

export type ReceivedTranscriptionSegment = TranscriptionSegment & {
  receivedAtMediaTimestamp: number;
  receivedAt: number;
};

export function addMediaTimestampToTranscription(
  segment: TranscriptionSegment,
  timestamps: { timestamp: number; rtpTimestamp?: number },
): ReceivedTranscriptionSegment {
  return {
    ...segment,
    receivedAtMediaTimestamp: timestamps.rtpTimestamp ?? 0,
    receivedAt: timestamps.timestamp,
  };
}

/**
 * @returns An array of unique (by id) `TranscriptionSegment`s. Latest wins. If the resulting array would be longer than `windowSize`, the array will be reduced to `windowSize` length
 */
export function dedupeSegments<T extends TranscriptionSegment>(
  prevSegments: T[],
  newSegments: T[],
  windowSize: number,
) {
  return [...prevSegments, ...newSegments]
    .reduceRight((acc, segment) => {
      if (!acc.find((val) => val.id === segment.id)) {
        acc.unshift(segment);
      }
      return acc;
    }, [] as Array<T>)
    .slice(0 - windowSize);
}

/**
 * Create `TrackReferences` for all tracks that are included in the sources property.
 *  */
export function getParticipantTrackRefs(
  participant: Participant,
  identifier: any/* ParticipantTrackIdentifier */,
  onlySubscribedTracks = false,
): TrackReference[] {
  const { sources, kind, name } = identifier;
  const sourceReferences = Array.from(participant.trackPublications.values())
    .filter(
      (pub) =>
        (!sources || sources.includes(pub.source)) &&
        (!kind || pub.kind === kind) &&
        (!name || pub.trackName === name) &&
        // either return all or only the ones that are subscribed
        (!onlySubscribedTracks || pub.track),
    )
    .map((track): TrackReference => {
      return {
        participant: participant,
        publication: track,
        source: track.source,
      };
    });

  return sourceReferences;
}

export interface TextStreamData {
  text: string;
  participantInfo: { identity: string }; // Replace with the correct type from livekit-client
  streamInfo: any /* TextStreamInfo */;
}

export const DataTopic = {
  CHAT: 'lk.chat',
  TRANSCRIPTION: 'lk.transcription',
} as const;

export const trackSourceToProtocol = (source: Track.Source) => {
  // NOTE: this mapping avoids importing the protocol package as that leads to a significant bundle size increase
  switch (source) {
    case Track.Source.Camera:
      return 1;
    case Track.Source.Microphone:
      return 2;
    case Track.Source.ScreenShare:
      return 3;
    default:
      return 0;
  }
};
