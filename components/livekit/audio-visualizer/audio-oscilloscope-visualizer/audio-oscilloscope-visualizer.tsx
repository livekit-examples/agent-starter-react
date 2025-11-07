'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import {
  type AnimationPlaybackControlsWithThen,
  type ValueAnimationTransition,
  animate,
  useMotionValue,
  useMotionValueEvent,
} from 'motion/react';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  // useMultibandTrackVolume,
  useTrackVolume,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { OscilliscopeShaders, type OscilliscopeShadersProps } from './oscilliscope-shaders';

const DEFAULT_SPEED = 5;
const DEFAULT_AMPLITUDE = 0.025;
const DEFAULT_FREQUENCY = 10;
const DEFAULT_TRANSITION: ValueAnimationTransition = { duration: 0.2, ease: 'easeOut' };

function useAnimatedValue<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  useMotionValueEvent(motionValue, 'change', (value) => setValue(value as T));

  const animateFn = useCallback(
    (targetValue: T | T[], transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue]
  );

  return { value, controls: controlsRef, animate: animateFn };
}

export const audioShaderVisualizerVariants = cva(['aspect-square'], {
  variants: {
    size: {
      icon: 'h-[24px] gap-[2px]',
      sm: 'h-[56px] gap-[4px]',
      md: 'h-[112px] gap-[8px]',
      lg: 'h-[224px] gap-[16px]',
      xl: 'h-[448px] gap-[32px]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

interface AudioOscilloscopeVisualizerProps {
  speed?: number;
  state?: AgentState;
  audioTrack: TrackReferenceOrPlaceholder;
  className?: string;
}

export function AudioOscilloscopeVisualizer({
  size = 'lg',
  state = 'speaking',
  speed = DEFAULT_SPEED,
  audioTrack,
  className,
}: AudioOscilloscopeVisualizerProps &
  OscilliscopeShadersProps &
  VariantProps<typeof audioShaderVisualizerVariants>) {
  const { value: amplitude, animate: animateAmplitude } = useAnimatedValue(DEFAULT_AMPLITUDE);
  const { value: frequency, animate: animateFrequency } = useAnimatedValue(DEFAULT_FREQUENCY);
  const { value: opacity, animate: animateOpacity } = useAnimatedValue(1.0);

  const volume = useTrackVolume(audioTrack as TrackReference, {
    fftSize: 512,
    smoothingTimeConstant: 0.55,
  });

  useEffect(() => {
    switch (state) {
      case 'disconnected':
        animateAmplitude(0, DEFAULT_TRANSITION);
        animateFrequency(0, DEFAULT_TRANSITION);
        animateOpacity(1.0, DEFAULT_TRANSITION);
        return;
      case 'listening':
      case 'connecting':
        animateAmplitude(DEFAULT_AMPLITUDE, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY, DEFAULT_TRANSITION);
        animateOpacity([1.0, 0.2], {
          duration: 0.75,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'thinking':
      case 'initializing':
        animateAmplitude(DEFAULT_AMPLITUDE, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY, DEFAULT_TRANSITION);
        animateOpacity([1.0, 0.2], {
          duration: 0.2,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'speaking':
      default:
        animateAmplitude(DEFAULT_AMPLITUDE, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY, DEFAULT_TRANSITION);
        animateOpacity(1.0, DEFAULT_TRANSITION);
        return;
    }
  }, [state, animateAmplitude, animateFrequency, animateOpacity]);

  useEffect(() => {
    if (state === 'speaking' && volume > 0) {
      animateAmplitude(0.02 + 0.4 * volume, { duration: 0 });
      animateFrequency(20 + 60 * volume, { duration: 0 });
    }
  }, [state, volume, animateAmplitude, animateFrequency]);

  return (
    <OscilliscopeShaders
      speed={speed}
      amplitude={amplitude}
      frequency={frequency}
      lineWidth={0.005}
      smoothing={0.001}
      style={{ opacity }}
      className={cn(
        audioShaderVisualizerVariants({ size }),
        '[mask-image:linear-gradient(90deg,rgba(0,0,0,0)_0%,rgba(0,0,0,1)_20%,rgba(0,0,0,1)_80%,rgba(0,0,0,0)_100%)]',
        'overflow-hidden rounded-full',
        className
      )}
    />
  );
}
