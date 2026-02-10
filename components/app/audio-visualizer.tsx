import { type MotionProps, motion } from 'motion/react';
import { useVoiceAssistant } from '@livekit/components-react';
import { AppConfig } from '@/app-config';
import { cn } from '@/lib/shadcn/utils';
import { AgentAudioVisualizerAura } from '../agents-ui/agent-audio-visualizer-aura';
import { AgentAudioVisualizerBar } from '../agents-ui/agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from '../agents-ui/agent-audio-visualizer-grid';
import { AgentAudioVisualizerRadial } from '../agents-ui/agent-audio-visualizer-radial';
import { AgentAudioVisualizerWave } from '../agents-ui/agent-audio-visualizer-wave';

const MotionAgentAudioVisualizerAura = motion.create(AgentAudioVisualizerAura);
const MotionAgentAudioVisualizerBar = motion.create(AgentAudioVisualizerBar);
const MotionAgentAudioVisualizerGrid = motion.create(AgentAudioVisualizerGrid);
const MotionAgentAudioVisualizerRadial = motion.create(AgentAudioVisualizerRadial);
const MotionAgentAudioVisualizerWave = motion.create(AgentAudioVisualizerWave);

interface AudioVisualizerProps extends MotionProps {
  appConfig: AppConfig;
  isChatOpen: boolean;
  className?: string;
}

export function AudioVisualizer({
  appConfig,
  isChatOpen,
  className,
  ...props
}: AudioVisualizerProps) {
  const { audioVisualizerType } = appConfig;
  const { state, audioTrack } = useVoiceAssistant();

  switch (audioVisualizerType) {
    case 'aura': {
      const { audioVisualizerColor, audioVisualizerColorShift } = appConfig;
      return (
        <MotionAgentAudioVisualizerAura
          state={state}
          audioTrack={audioTrack}
          color={audioVisualizerColor}
          colorShift={audioVisualizerColorShift}
          className={className}
          {...props}
        />
      );
    }
    case 'wave': {
      const { audioVisualizerColor } = appConfig;
      return (
        <MotionAgentAudioVisualizerWave
          state={state}
          audioTrack={audioTrack}
          lineWidth={isChatOpen ? 6 : 3}
          color={audioVisualizerColor}
          className={className}
          {...props}
        />
      );
    }
    case 'grid': {
      return (
        <MotionAgentAudioVisualizerGrid
          size="xl"
          state={state}
          audioTrack={audioTrack}
          rowCount={9}
          columnCount={9}
          className={cn('size-[450px] *:place-self-center', className)}
          {...props}
        />
      );
    }
    case 'radial': {
      return (
        <MotionAgentAudioVisualizerRadial
          size="xl"
          state={state}
          audioTrack={audioTrack}
          barCount={25}
          className={className}
          {...props}
        />
      );
    }
    default: {
      return (
        <MotionAgentAudioVisualizerBar
          size="xl"
          state={state}
          audioTrack={audioTrack}
          barCount={5}
          className={cn('gap-[24px] *:min-h-[48px] *:w-[48px]', className)}
          {...props}
        >
          <span
            className={cn([
              'bg-muted min-h-2.5 w-2.5 rounded-full',
              'origin-center transition-colors duration-250 ease-linear',
              'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
            ])}
          />
        </MotionAgentAudioVisualizerBar>
      );
    }
  }
}
