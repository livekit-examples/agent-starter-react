import { type MotionProps, motion } from 'motion/react';
import { useVoiceAssistant } from '@livekit/components-react';
import { AppConfig } from '@/app-config';
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import {
  AgentAudioVisualizerBar,
  AgentAudioVisualizerBarElementVariants,
} from '@/components/agents-ui/agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from '@/components/agents-ui/agent-audio-visualizer-grid';
import { AgentAudioVisualizerRadial } from '@/components/agents-ui/agent-audio-visualizer-radial';
import { AgentAudioVisualizerWave } from '@/components/agents-ui/agent-audio-visualizer-wave';
import { cn } from '@/lib/shadcn/utils';

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
      const { audioVisualizerColor, audioVisualizerAuraColorShift } = appConfig;
      return (
        <MotionAgentAudioVisualizerAura
          state={state}
          audioTrack={audioTrack}
          color={audioVisualizerColor}
          colorShift={audioVisualizerAuraColorShift}
          className={cn('size-[300px] md:size-[450px]', className)}
          {...props}
        />
      );
    }
    case 'wave': {
      const { audioVisualizerColor, audioVisualizerWaveLineWidth = 3 } = appConfig;
      return (
        <motion.div className={className} {...props}>
          <MotionAgentAudioVisualizerWave
            state={state}
            audioTrack={audioTrack}
            color={audioVisualizerColor}
            lineWidth={isChatOpen ? audioVisualizerWaveLineWidth * 2 : audioVisualizerWaveLineWidth}
            className="size-[300px] md:size-[450px]"
          />
        </motion.div>
      );
    }
    case 'grid': {
      const { audioVisualizerGridRowCount = 9, audioVisualizerGridColumnCount = 9 } = appConfig;
      const totalCount = audioVisualizerGridRowCount * audioVisualizerGridColumnCount;

      let size: 'icon' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
      if (totalCount <= 100) {
        size = 'xl';
      } else if (totalCount <= 200) {
        size = 'lg';
      } else if (totalCount <= 300) {
        size = 'md';
      }

      return (
        <MotionAgentAudioVisualizerGrid
          size={size}
          state={state}
          audioTrack={audioTrack}
          rowCount={audioVisualizerGridRowCount}
          columnCount={audioVisualizerGridColumnCount}
          radius={Math.round(
            Math.min(audioVisualizerGridRowCount, audioVisualizerGridColumnCount) / 4
          )}
          className={cn('size-[350px] gap-0 p-8 md:size-[450px]', className)}
          {...props}
        />
      );
    }
    case 'radial': {
      const { audioVisualizerRadialBarCount = 25, audioVisualizerRadialRadius = 12 } = appConfig;
      return (
        <motion.div className={className} {...props}>
          <MotionAgentAudioVisualizerRadial
            size="xl"
            state={state}
            audioTrack={audioTrack}
            radius={audioVisualizerRadialRadius}
            barCount={audioVisualizerRadialBarCount}
            className="size-[450px]"
          />
        </motion.div>
      );
    }
    default: {
      const { audioVisualizerBarCount = 5 } = appConfig;

      let size: 'icon' | 'sm' | 'md' | 'lg' | 'xl' = 'icon';

      if (audioVisualizerBarCount <= 5) {
        size = 'xl';
      } else if (audioVisualizerBarCount <= 10) {
        size = 'lg';
      } else if (audioVisualizerBarCount <= 15) {
        size = 'md';
      } else if (audioVisualizerBarCount <= 30) {
        size = 'sm';
      }

      return (
        <MotionAgentAudioVisualizerBar
          size={size}
          state={state}
          audioTrack={audioTrack}
          barCount={audioVisualizerBarCount}
          className={cn(
            size === 'xl' && 'size-[450px] gap-2',
            size === 'lg' && 'size-[450px]',
            size === 'md' && 'size-[350px] md:size-[450px]',
            size === 'sm' && 'size-[300px] md:size-[450px]',
            size === 'icon' && 'size-[300px] md:size-[450px]',
            className
          )}
          {...props}
        >
          <span className={cn(AgentAudioVisualizerBarElementVariants({ size }))} />
        </MotionAgentAudioVisualizerBar>
      );
    }
  }
}
