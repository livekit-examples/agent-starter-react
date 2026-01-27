import { useVoiceAssistant } from '@livekit/components-react';
import { AppConfig } from '@/app-config';
import { cn } from '@/lib/shadcn/utils';
import { AgentAudioVisualizerAura } from '../agents-ui/agent-audio-visualizer-aura';
import { AgentAudioVisualizerBar } from '../agents-ui/agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from '../agents-ui/agent-audio-visualizer-grid';
import { AgentAudioVisualizerRadial } from '../agents-ui/agent-audio-visualizer-radial';
import { AgentAudioVisualizerWave } from '../agents-ui/agent-audio-visualizer-wave';

interface AudioVisualizerProps {
  appConfig: AppConfig;
}

export function AudioVisualizer({ appConfig }: AudioVisualizerProps) {
  const { audioVisualizerType } = appConfig;
  const { state, audioTrack } = useVoiceAssistant();

  switch (audioVisualizerType) {
    case 'aura': {
      const { audioVisualizerColor, audioVisualizerColorShift } = appConfig;
      return (
        <AgentAudioVisualizerAura
          key="audio-visualizer-aura"
          size="md"
          state={state}
          audioTrack={audioTrack}
          color={audioVisualizerColor}
          colorShift={audioVisualizerColorShift}
          className="h-[360px]"
        />
      );
    }
    case 'wave': {
      const { audioVisualizerColor } = appConfig;
      return (
        <AgentAudioVisualizerWave
          key="audio-visualizer-wave"
          size="md"
          state={state}
          audioTrack={audioTrack}
          lineWidth={3}
          color={audioVisualizerColor}
          className="h-[360px]"
        />
      );
    }
    case 'grid': {
      const { audioVisualizerRowCount, audioVisualizerColumnCount } = appConfig;
      return (
        <AgentAudioVisualizerGrid
          key="audio-visualizer-grid"
          size="sm"
          state={state}
          audioTrack={audioTrack}
          rowCount={audioVisualizerRowCount}
          columnCount={audioVisualizerColumnCount}
          className="h-[360px]"
        />
      );
    }
    case 'radial': {
      const { audioVisualizerRadius, audioVisualizerBarCount } = appConfig;
      return (
        <AgentAudioVisualizerRadial
          key="audio-visualizer-radial"
          size="sm"
          state={state}
          audioTrack={audioTrack}
          radius={audioVisualizerRadius}
          barCount={audioVisualizerBarCount}
        />
      );
    }
    default: {
      const { audioVisualizerBarCount } = appConfig;

      return (
        <AgentAudioVisualizerBar
          key="audio-visualizer-bar"
          state={state}
          audioTrack={audioTrack}
          barCount={audioVisualizerBarCount}
          className={cn('flex h-[360px] items-center justify-center gap-1 px-4 py-2')}
        >
          <span
            className={cn([
              'bg-muted min-h-2.5 w-2.5 rounded-full',
              'origin-center transition-colors duration-250 ease-linear',
              'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
            ])}
          />
        </AgentAudioVisualizerBar>
      );
    }
  }
}
