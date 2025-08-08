import type TypedEventEmitter from 'typed-emitter';
import { EventEmitter } from "events";
import { ParticipantEvent, ParticipantKind, RemoteParticipant, Room, RoomEvent, Track, TranscriptionSegment } from 'livekit-client';
import { getParticipantTrackRefs, participantTrackEvents, TrackReference } from '@/agent-sdk/external-deps/components-js';
import { ParticipantEventCallbacks } from '@/agent-sdk/external-deps/client-sdk-js';

export enum AgentParticipantEvent {
  VideoTrackChanged = 'videoTrackChanged',
  AudioTrackChanged = 'videoTrackChanged',
  AgentAttributesChanged = 'agentAttributesChanged',
  // AgentTranscriptionsChanged = 'agentTranscriptionsChanged',
}

export type AgentParticipantCallbacks = {
  [AgentParticipantEvent.VideoTrackChanged]: (newTrack: TrackReference | null) => void;
  [AgentParticipantEvent.AudioTrackChanged]: (newTrack: TrackReference | null) => void;
  [AgentParticipantEvent.AgentAttributesChanged]: (newAttributes: Record<string, string>) => void;
};

// Goal: some sort of abstraction layer to provide information specific to the agent's interactions
// like video stream / audio stream / transcriptions / underlying participant attributes / etc,
// since it doesn't just come from one RemoteParticipant
// FIXME: maybe this could be named better? ...
export default class AgentParticipant extends (EventEmitter as new () => TypedEventEmitter<AgentParticipantCallbacks>) {
  private room: Room;

  private agentParticipant: RemoteParticipant | null = null;
  private workerParticipant: RemoteParticipant | null = null;
  audioTrack: TrackReference | null = null;
  videoTrack: TrackReference | null = null;

  audioTrackSyncTime: { timestamp: number, rtpTimestamp?: number } | null = null;

  attributes: Record<string, string> = {};

  transcriptions: Array<TranscriptionSegment> = [];
  transcriptionBufferSize: number = 100//TRACK_TRANSCRIPTION_DEFAULTS.bufferSize;

  constructor(room: Room) {
    super();
    this.room = room;

    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
  }

  teardown() {
    this.room.off(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.off(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
  }

  private handleParticipantConnected = () => {
    this.updateParticipants();
  }
  private handleParticipantDisconnected = () => {
    this.updateParticipants();
  }

  private updateParticipants() {
    const newAgentParticipant = this.roomRemoteParticipants.find(
      (p) => p.kind === ParticipantKind.AGENT && !('lk.publish_on_behalf' in p.attributes),
    ) ?? null;
    const newWorkerParticipant = newAgentParticipant ? (
      this.roomRemoteParticipants.find(
        (p) =>
          p.kind === ParticipantKind.AGENT && p.attributes['lk.publish_on_behalf'] === newAgentParticipant.identity,
      ) ?? null
    ) : null;

    const oldAgentParticipant = this.agentParticipant;
    const oldWorkerParticipant = this.workerParticipant;
    this.agentParticipant = newAgentParticipant;
    this.workerParticipant = newWorkerParticipant;

    // 1. Listen for attribute changes
    if (oldAgentParticipant !== this.agentParticipant) {
      oldAgentParticipant?.off(ParticipantEvent.AttributesChanged, this.handleAttributesChanged);

      if (this.agentParticipant) {
        this.agentParticipant.on(ParticipantEvent.AttributesChanged, this.handleAttributesChanged);
        this.handleAttributesChanged(this.agentParticipant.attributes);
      }
    }

    // 2. Listen for track updates
    for (const event of participantTrackEvents) {
      if (oldAgentParticipant !== this.agentParticipant) {
        oldAgentParticipant?.off(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        if (this.agentParticipant) {
          this.agentParticipant.on(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
          this.handleUpdateTracks();
        }
      }
      if (oldWorkerParticipant !== this.workerParticipant) {
        oldWorkerParticipant?.off(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
        if (this.workerParticipant) {
          this.workerParticipant.on(event as keyof ParticipantEventCallbacks, this.handleUpdateTracks);
          this.handleUpdateTracks();
        }
      }
    }
  }

  private handleUpdateTracks = () => {
    const newVideoTrack = (
      this.agentTracks.find((t) => t.source === Track.Source.Camera) ??
      this.workerTracks.find((t) => t.source === Track.Source.Camera) ?? null
    );
    if (this.videoTrack !== newVideoTrack) {
      this.videoTrack = newVideoTrack;
      this.emit(AgentParticipantEvent.VideoTrackChanged, newVideoTrack);
    }

    const newAudioTrack = (
      this.agentTracks.find((t) => t.source === Track.Source.Microphone) ??
      this.workerTracks.find((t) => t.source === Track.Source.Microphone) ?? null
    );
    if (this.audioTrack !== newAudioTrack) {
      // console.log('!! audio track changed', this.audioTrack?.publication);
      // this.audioTrack?.publication.off(TrackEvent.TranscriptionReceived, this.handleTranscriptionReceived);
      this.audioTrack = newAudioTrack;
      // this.audioTrack?.publication.on(TrackEvent.TranscriptionReceived, this.handleTranscriptionReceived);

      // this.audioTrackSyncTime = {
      //   timestamp: Date.now(),
      //   rtpTimestamp: this.audioTrack?.publication.track?.rtpTimestamp,
      // };
      // this.audioTrack?.publication.track?.on(TrackEvent.TimeSyncUpdate, this.handleTimeSyncUpdate);

      this.emit(AgentParticipantEvent.AudioTrackChanged, newAudioTrack);
    }
  };

  private handleAttributesChanged = (attributes: Record<string, string>) => {
    this.attributes = attributes;
    this.emit(AgentParticipantEvent.AgentAttributesChanged, attributes);
  };

  // private handleTranscriptionReceived = (segments: Array<TranscriptionSegment>) => {
  //   console.log('!! TRANSCRIPTION', segments, this.audioTrackSyncTime);
  //   if (!this.audioTrackSyncTime) {
  //     throw new Error('AgentParticipant - audioTrackSyncTime missing');
  //   }
  //   const audioTrackSyncTime = this.audioTrackSyncTime;

  //   this.transcriptions = dedupeSegments(
  //     this.transcriptions,
  //     // when first receiving a segment, add the current media timestamp to it
  //     segments.map((s) => addMediaTimestampToTranscription(s, audioTrackSyncTime)),
  //     this.transcriptionBufferSize,
  //   );
  //   this.emit(AgentParticipantEvent.AgentTranscriptionsChanged, this.transcriptions);
  // }

  // private handleTimeSyncUpdate = (update: { timestamp: number; rtpTimestamp: number }) => {
  //   console.log('!! TIME SYNC UPDATE', update);
  //   this.audioTrackSyncTime = update;
  // };

  private get roomRemoteParticipants() {
    return Array.from(this.room.remoteParticipants.values());
  }

  private get agentTracks() {
    if (!this.agentParticipant) {
      return [];
    }
    return getParticipantTrackRefs(
      this.agentParticipant,
      { sources: [Track.Source.Microphone, Track.Source.Camera] }
    );
  }

  private get workerTracks() {
    if (!this.workerParticipant) {
      return [];
    }
    return getParticipantTrackRefs(
      this.workerParticipant,
      { sources: [Track.Source.Microphone, Track.Source.Camera] }
    );
  }
}
