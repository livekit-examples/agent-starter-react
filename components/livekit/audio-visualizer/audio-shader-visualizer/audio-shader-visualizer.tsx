'use client';

import { useEffect, useRef, useState } from 'react';
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
import { AuroraShaders, type AuroraShadersProps } from '@/components/ui/shadcn-io/aurora-shaders';
import { cn } from '@/lib/utils';

// const PRESETS = [
//   (volume: number) => ({
//     amplitude: 0.3,
//     scale: 0.35 - 0.05 * volume,
//     frequency: 0.25,
//     brightness: 1.5 + 2.5 * volume,
//   }),
//   (volume: number) => ({
//     amplitude: 0.2 + 1 * volume,
//     scale: 0.35 - 0.05 * volume,
//     frequency: 0.25 + 5 * volume,
//     brightness: 1.5 + 2.5 * volume,
//   }),
//   (volume: number) => ({
//     amplitude: 0.5 + 0.05 * volume,
//     scale: 0.35 + 0.05 * volume,
//     frequency: 2 - 2 * volume,
//     brightness: 1.5 + 2.5 * volume,
//   }),
//   (volume: number) => ({
//     amplitude: 0.5 + 0.2 * volume,
//     scale: 0.35 - 0.05 * volume,
//     frequency: 1 - 1 * volume,
//     brightness: 1.5 + 2.5 * volume,
//   }),
// ];

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
  const [speed, setSpeed] = useState(10);
  const [amplitude, setAmplitude] = useState(0.5);
  const [frequency, setFrequency] = useState(1.0);
  const [scale, setScale] = useState(0.2);
  const [brightness, setBrightness] = useState(1.5);

  const amplitudeValue = useMotionValue(0.5);
  const frequencyValue = useMotionValue(0.5);
  const scaleValue = useMotionValue(0.3);
  const brightnessValue = useMotionValue(0);

  const amplitudeControlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const frequencyControlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const scaleControlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const brightnessControlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);

  useMotionValueEvent(amplitudeValue, 'change', (value) => setAmplitude(value));
  useMotionValueEvent(frequencyValue, 'change', (value) => setFrequency(value));
  useMotionValueEvent(scaleValue, 'change', (value) => setScale(value));
  useMotionValueEvent(brightnessValue, 'change', (value) => setBrightness(value));

  const volume = useTrackVolume(audioTrack as TrackReference, {
    fftSize: 512,
    smoothingTimeConstant: 0.5,
  });

  useEffect(() => {
    const DEFAULT_TRANSITION: ValueAnimationTransition = { duration: 0.5, ease: 'easeOut' };

    switch (state) {
      case 'disconnected':
        setSpeed(5);
        scaleControlsRef.current = animate(scaleValue, 0.2, DEFAULT_TRANSITION);
        amplitudeControlsRef.current = animate(amplitudeValue, 1.2, DEFAULT_TRANSITION);
        frequencyControlsRef.current = animate(frequencyValue, 0.4, DEFAULT_TRANSITION);
        brightnessControlsRef.current = animate(brightnessValue, 1.0, DEFAULT_TRANSITION);
        return;
      case 'connecting':
        setSpeed(50);
        scaleControlsRef.current = animate(scaleValue, 0.3, DEFAULT_TRANSITION);
        amplitudeControlsRef.current = animate(amplitudeValue, 0.5, DEFAULT_TRANSITION);
        frequencyControlsRef.current = animate(frequencyValue, 1, DEFAULT_TRANSITION);
        brightnessControlsRef.current = animate(brightnessValue, [0.5, 2.5], {
          duration: 1,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'initializing':
        setSpeed(30);
        scaleControlsRef.current = animate(scaleValue, 0.3, DEFAULT_TRANSITION);
        amplitudeControlsRef.current = animate(amplitudeValue, 0.5, DEFAULT_TRANSITION);
        frequencyControlsRef.current = animate(frequencyValue, 1, DEFAULT_TRANSITION);
        brightnessControlsRef.current = animate(brightnessValue, [0.5, 2.5], {
          duration: 0.2,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'listening':
        setSpeed(20);
        scaleControlsRef.current = animate(scaleValue, [0.3, 0.35], {
          duration: 1.5,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        amplitudeControlsRef.current = animate(amplitudeValue, 0.5, DEFAULT_TRANSITION);
        frequencyControlsRef.current = animate(frequencyValue, 1.0, DEFAULT_TRANSITION);
        brightnessControlsRef.current = animate(brightnessValue, [1.5, 2.5], {
          duration: 1.5,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'thinking':
        setSpeed(50);
        scaleControlsRef.current = animate(scaleValue, [0.35, 0.3], {
          duration: 0.5,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        amplitudeControlsRef.current = animate(amplitudeValue, 0.5, {
          ...DEFAULT_TRANSITION,
          duration: 0.2,
        });
        frequencyControlsRef.current = animate(frequencyValue, 2.5, {
          ...DEFAULT_TRANSITION,
          duration: 0.2,
        });
        brightnessControlsRef.current = animate(brightnessValue, [0.5, 2.5], {
          duration: 0.2,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'speaking':
        setSpeed(50);
        scaleControlsRef.current = animate(scaleValue, 0.35, DEFAULT_TRANSITION);
        amplitudeControlsRef.current = animate(amplitudeValue, 0.5, DEFAULT_TRANSITION);
        frequencyControlsRef.current = animate(frequencyValue, 1.0, DEFAULT_TRANSITION);
        brightnessControlsRef.current = animate(brightnessValue, 0.5, DEFAULT_TRANSITION);
        return;
    }
  }, [
    state,
    shape,
    colorScale,
    scaleValue,
    colorPosition,
    amplitudeValue,
    frequencyValue,
    brightnessValue,
  ]);

  useEffect(() => {
    if (state === 'speaking' && volume > 0) {
      scaleControlsRef.current?.stop();
      amplitudeControlsRef.current?.stop();
      frequencyControlsRef.current?.stop();
      brightnessControlsRef.current?.stop();

      scaleValue.set(0.3 - 0.05 * volume);
      amplitudeValue.set(0.5 + 0.2 * volume);
      frequencyValue.set(1 - 1 * volume);
      brightnessValue.set(1.0 + 2.0 * volume);
    }
  }, [state, volume, scaleValue, amplitudeValue, frequencyValue, brightnessValue]);

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
