import { useMemo } from 'react';
import { Track } from 'livekit-client';
import {
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  useLocalParticipant,
} from '@livekit/components-react';
import { Container } from '@/components/docs/container';
import { StoryTitle } from '@/components/docs/story-title';
import { TrackControl } from '@/components/livekit/agent-control-bar/track-control';
import { useMicrophone } from '@/hooks/useMicrophone';

export default function TrackControlDemo() {
  const { microphoneTrack, localParticipant } = useLocalParticipant();
  const micTrackRef = useMemo<TrackReferenceOrPlaceholder | undefined>(() => {
    return {
      participant: localParticipant,
      source: Track.Source.Microphone,
      publication: microphoneTrack,
    } as TrackReference;
  }, [localParticipant, microphoneTrack]);

  useMicrophone();

  return (
    <Container componentName="TrackSelector">
      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-8">
          <div>
            <StoryTitle>Track.Source.Microphone</StoryTitle>
            <TrackControl kind="audioinput" source={Track.Source.Microphone} />
          </div>
          <div>
            <StoryTitle>Track.Source.Microphone</StoryTitle>
            <TrackControl
              kind="audioinput"
              source={Track.Source.Microphone}
              audioTrackRef={micTrackRef}
            />
          </div>
        </div>

        <div>
          <StoryTitle>Track.Source.Camera</StoryTitle>
          <TrackControl kind="videoinput" source={Track.Source.Camera} />
        </div>
      </div>
    </Container>
  );
}
