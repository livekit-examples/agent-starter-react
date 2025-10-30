'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import {
  type AnimationPlaybackControlsWithThen,
  type KeyframesTarget,
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
import { AuroraShaders, type AuroraShadersProps } from './aurora-shaders';

const DEFAULT_SPEED = 10;
const DEFAULT_AMPLITUDE = 2;
const DEFAULT_FREQUENCY = 0.5;
const DEFAULT_SCALE = 0.2;
const DEFAULT_BRIGHTNESS = 1.5;
const DEFAULT_TRANSITION: ValueAnimationTransition = { duration: 0.5, ease: 'easeOut' };
const DEFAULT_PULSE_TRANSITION: ValueAnimationTransition = {
  duration: 0.5,
  ease: 'easeOut',
  repeat: Infinity,
  repeatType: 'mirror',
};

function useAnimatedValue<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  useMotionValueEvent(motionValue, 'change', (value) => setValue(value as T));

  const animateFn = useCallback(
    (targetValue: T | KeyframesTarget, transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue]
  );

  return { value, motionValue, controls: controlsRef, animate: animateFn };
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

interface AudioShaderVisualizerProps {
  state?: AgentState;
  audioTrack: TrackReferenceOrPlaceholder;
}

export function AudioShaderVisualizer({
  size = 'md',
  state = 'speaking',
  shape = 1,
  colorScale = 0.05,
  colorPosition = 0.18,
  audioTrack,
  className,
}: AudioShaderVisualizerProps &
  AuroraShadersProps &
  VariantProps<typeof audioShaderVisualizerVariants>) {
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const {
    value: scale,
    animate: animateScale,
    motionValue: scaleMotionValue,
  } = useAnimatedValue(DEFAULT_SCALE);
  const { value: amplitude, animate: animateAmplitude } = useAnimatedValue(DEFAULT_AMPLITUDE);
  const { value: frequency, animate: animateFrequency } = useAnimatedValue(DEFAULT_FREQUENCY);
  const { value: brightness, animate: animateBrightness } = useAnimatedValue(DEFAULT_BRIGHTNESS);

  const volume = useTrackVolume(audioTrack as TrackReference, {
    fftSize: 512,
    smoothingTimeConstant: 0.55,
  });

  useEffect(() => {
    switch (state) {
      case 'disconnected':
        setSpeed(5);
        animateScale(0.2, DEFAULT_TRANSITION);
        animateAmplitude(1.2, DEFAULT_TRANSITION);
        animateFrequency(0.4, DEFAULT_TRANSITION);
        animateBrightness(1.0, DEFAULT_TRANSITION);
        return;
      case 'listening':
      case 'connecting':
        setSpeed(20);
        animateScale(0.35, DEFAULT_TRANSITION);
        animateAmplitude(1, DEFAULT_TRANSITION);
        animateFrequency(0.7, DEFAULT_TRANSITION);
        // animateBrightness(2.0, DEFAULT_TRANSITION);
        animateBrightness([1.5, 2.0], DEFAULT_PULSE_TRANSITION);
        return;
      case 'initializing':
        setSpeed(30);
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.5, DEFAULT_TRANSITION);
        animateFrequency(1, DEFAULT_TRANSITION);
        animateBrightness([0.5, 2.5], DEFAULT_PULSE_TRANSITION);
        return;
      case 'thinking':
        setSpeed(30);
        animateScale(0.1, DEFAULT_TRANSITION);
        animateAmplitude(1.0, DEFAULT_TRANSITION);
        animateFrequency(3.0, DEFAULT_TRANSITION);
        animateBrightness([1.0, 2.0], DEFAULT_PULSE_TRANSITION);
        return;
      case 'speaking':
        setSpeed(50);
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(1.0, DEFAULT_TRANSITION);
        animateFrequency(0.7, DEFAULT_TRANSITION);
        animateBrightness(1.5, DEFAULT_TRANSITION);
        return;
    }
  }, [
    state,
    shape,
    colorScale,
    animateScale,
    animateAmplitude,
    animateFrequency,
    animateBrightness,
  ]);

  useEffect(() => {
    if (state === 'speaking' && volume > 0 && !scaleMotionValue.isAnimating()) {
      animateScale(0.3 - 0.1 * volume, { duration: 0 });
      animateAmplitude(1.0 + 0.2 * volume, { duration: 0 });
      animateFrequency(0.7 - 0.3 * volume, { duration: 0 });
      animateBrightness(1.5 + 1.0 * volume, { duration: 0 });
    }
  }, [
    state,
    volume,
    scaleMotionValue,
    animateScale,
    animateAmplitude,
    animateFrequency,
    animateBrightness,
  ]);

  return (
    <AuroraShaders
      blur={0.2}
      shape={shape}
      colorScale={colorScale}
      colorPosition={colorPosition}
      speed={speed}
      scale={scale}
      amplitude={amplitude}
      frequency={frequency}
      brightness={brightness}
      className={cn(
        audioShaderVisualizerVariants({ size }),
        'overflow-hidden rounded-full',
        className
      )}
    />
  );
}
