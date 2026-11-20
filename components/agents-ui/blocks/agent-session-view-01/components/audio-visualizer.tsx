'use client';

import React from 'react';
import { type MotionProps, motion } from 'motion/react';
import { useVoiceAssistant } from '@livekit/components-react';
import {
  AgentAudioVisualizerAura,
  type AgentAudioVisualizerAuraProps,
} from '@/components/agents-ui/agent-audio-visualizer-aura';
import {
  AgentAudioVisualizerBar,
  type AgentAudioVisualizerBarProps,
} from '@/components/agents-ui/agent-audio-visualizer-bar';
import {
  AgentAudioVisualizerGrid,
  type AgentAudioVisualizerGridProps,
} from '@/components/agents-ui/agent-audio-visualizer-grid';
import {
  AgentAudioVisualizerRadial,
  type AgentAudioVisualizerRadialProps,
} from '@/components/agents-ui/agent-audio-visualizer-radial';
import {
  AgentAudioVisualizerWave,
  type AgentAudioVisualizerWaveProps,
} from '@/components/agents-ui/agent-audio-visualizer-wave';
import { cn } from '@/lib/shadcn/utils';

const MotionAgentAudioVisualizerAura = motion.create(AgentAudioVisualizerAura);
const MotionAgentAudioVisualizerBar = motion.create(AgentAudioVisualizerBar);
const MotionAgentAudioVisualizerGrid = motion.create(AgentAudioVisualizerGrid);
const MotionAgentAudioVisualizerRadial = motion.create(AgentAudioVisualizerRadial);
const MotionAgentAudioVisualizerWave = motion.create(AgentAudioVisualizerWave);

function getGridSize(rowCount: number, columnCount: number): AgentAudioVisualizerBarProps['size'] {
  const totalCount = rowCount * columnCount;

  if (totalCount < 100) {
    return 'xl';
  } else if (totalCount < 200) {
    return 'lg';
  } else if (totalCount < 300) {
    return 'md';
  }

  return 'sm';
}

function getBarSize(barCount: number): AgentAudioVisualizerBarProps['size'] {
  if (barCount <= 5) {
    return 'xl';
  } else if (barCount <= 10) {
    return 'lg';
  } else if (barCount <= 15) {
    return 'md';
  } else if (barCount <= 30) {
    return 'sm';
  }

  return 'icon';
}

function getBarClassName(size: AgentAudioVisualizerBarProps['size']) {
  if (size == 'xl') {
    return 'size-[450px] *:min-h-[64px] *:w-[64px] gap-4';
  } else if (size == 'lg') {
    return 'size-[450px] *:min-h-[48px] *:w-[48px]';
  } else if (size == 'md') {
    return 'size-[350px] @md/agent-session-block:size-[450px]  *:min-h-[32px] *:w-[32px]';
  } else if (size == 'sm') {
    return 'size-[300px] @md/agent-session-block:size-[450px] *:min-h-[16px] *:w-[16px]';
  }

  return 'size-[300px] @md/agent-session-block:size-[450px] *:min-h-[4px] *:w-[4px]';
}

interface AudioVisualizerProps extends MotionProps {
  isChatOpen: boolean;
  type: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  config?:
    | AgentAudioVisualizerBarProps
    | AgentAudioVisualizerWaveProps
    | AgentAudioVisualizerGridProps
    | AgentAudioVisualizerRadialProps
    | AgentAudioVisualizerAuraProps;
  themeMode?: 'dark' | 'light';
  className?: string;
}

export function AudioVisualizer({
  themeMode,
  type,
  config,
  className,
  ...props
}: AudioVisualizerProps) {
  const { state, audioTrack } = useVoiceAssistant();

  // `state`/`audioTrack` always reflect the live agent session; any same-named field on
  // `config` is ignored by spreading it before these are set explicitly below.
  switch (type) {
    case 'aura': {
      return (
        <MotionAgentAudioVisualizerAura
          {...config}
          state={state}
          themeMode={themeMode}
          audioTrack={audioTrack}
          className={cn('size-[300px] @md/agent-session-block:size-[450px]', className)}
          {...props}
        />
      );
    }
    case 'wave': {
      return (
        <motion.div className={className} {...props}>
          <MotionAgentAudioVisualizerWave
            {...config}
            state={state}
            audioTrack={audioTrack}
            className="size-[300px] @md/agent-session-block:size-[450px]"
          />
        </motion.div>
      );
    }
    case 'grid': {
      const {
        size,
        radius,
        rowCount = 15,
        columnCount = 15,
      } = config as AgentAudioVisualizerGridProps;

      return (
        <MotionAgentAudioVisualizerGrid
          {...config}
          size={size ?? getGridSize(rowCount, columnCount)}
          state={state}
          audioTrack={audioTrack}
          rowCount={rowCount}
          columnCount={columnCount}
          radius={radius ?? Math.round(Math.min(rowCount, columnCount) / 4)}
          className={cn(
            'size-[350px] gap-0 p-20 *:place-self-center @md/agent-session-block:size-[450px]',
            className
          )}
          {...props}
        />
      );
    }
    case 'radial': {
      const { radius = 100, barCount = 25 } = config as AgentAudioVisualizerRadialProps;
      return (
        <motion.div className={className} {...props}>
          <MotionAgentAudioVisualizerRadial
            {...config}
            size="xl"
            state={state}
            radius={radius}
            barCount={barCount}
            audioTrack={audioTrack}
            className="size-[450px]"
          />
        </motion.div>
      );
    }
    default: {
      const { size, barCount = 5 } = (config as AgentAudioVisualizerBarProps) ?? {};
      const _size = size ?? getBarSize(barCount);
      const sizedClassName = getBarClassName(_size);

      return (
        <MotionAgentAudioVisualizerBar
          {...config}
          size={_size}
          state={state}
          barCount={barCount}
          audioTrack={audioTrack}
          className={cn(sizedClassName, className)}
          {...props}
        >
          <span className="min-h-2.5 w-2.5 rounded-full bg-current/10 transition-colors duration-250 ease-linear data-[lk-highlighted=true]:bg-current" />
        </MotionAgentAudioVisualizerBar>
      );
    }
  }
}
