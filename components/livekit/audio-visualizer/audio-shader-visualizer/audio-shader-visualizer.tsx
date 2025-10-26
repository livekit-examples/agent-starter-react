'use client';

import {
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  // useMultibandTrackVolume,
  useTrackVolume,
} from '@livekit/components-react';
import { AuroraShaders, type AuroraShadersProps } from '@/components/ui/shadcn-io/aurora-shaders';
import { cn } from '@/lib/utils';

const PRESETS = [
  (volume: number) => ({
    amplitude: 0.3,
    scale: 0.3 - 0.1 * (volume * 1.5),
    frequency: 0.25,
    brightness: 0.5 + 2.5 * volume,
  }),
  (volume: number) => ({
    amplitude: 0.2 + 1 * volume,
    scale: 0.3 - 0.1 * (volume * 1.5),
    frequency: 0.25 + 5 * volume,
    brightness: 0.5 + 2.5 * volume,
  }),
  (volume: number) => ({
    amplitude: 0.5 + 0.1 * volume,
    scale: 0.2 + 0.1 * (volume * 1.5),
    frequency: 5 - 6 * volume,
    brightness: 0.5 + 2.5 * volume,
  }),
  (volume: number) => ({
    amplitude: 0.5 + 0.1 * volume,
    scale: 0.2 + 0.1 * volume * 0.5,
    frequency: 1 - 1 * volume,
    brightness: 0.5 + 2.5 * volume,
  }),
];

export function AudioShaderVisualizer({
  speed = 1.0,
  // intensity = 0,
  blur = 0.2,
  shape = 1,
  colorPosition = 0.5,
  colorScale = 0.1,
  audioTrack,
  presetIndex = 0,
  className,
}: AuroraShadersProps & { presetIndex?: number; audioTrack?: TrackReferenceOrPlaceholder }) {
  // const [volume] = useMultibandTrackVolume(audioTrack, {
  //   bands: 1,
  //   loPass: 100,
  //   hiPass: 150,
  // });
  const volume = useTrackVolume(audioTrack as TrackReference, {
    fftSize: 2048,
    smoothingTimeConstant: 0.5,
  });

  const { amplitude, scale, frequency, brightness } = PRESETS[presetIndex](volume);

  return (
    <div className={cn('size-80 overflow-hidden rounded-full', className)}>
      <AuroraShaders
        speed={speed}
        // intensity={intensity}
        amplitude={amplitude}
        frequency={frequency}
        scale={scale}
        blur={blur}
        shape={shape}
        colorPosition={colorPosition}
        colorScale={colorScale}
        brightness={brightness}
        // colorPhaseEnd={colorPhaseEnd}
      />
    </div>
  );
}

// import {
//   CosmicWavesShaders,
//   type CosmicWavesShadersProps,
// } from '@/components/ui/shadcn-io/cosmic-waves-shaders';

// export function AudioShaderVisualizer({
//   speed = 1.0,
//   amplitude = 1.0,
//   frequency = 1.0,
//   starDensity = 1.0,
//   colorShift = 1.0,
// }: CosmicWavesShadersProps) {
//   return (
//     <div className="size-40 overflow-hidden rounded-full">
//       <CosmicWavesShaders
//         speed={speed}
//         amplitude={amplitude}
//         frequency={frequency}
//         starDensity={starDensity}
//         colorShift={colorShift}
//       />
//     </div>
//   );
// }

// import {
//   SingularityShaders,
//   type SingularityShadersProps,
// } from '@/components/ui/shadcn-io/singularity-shaders';

// export function AudioShaderVisualizer({
//   speed = 1.0,
//   intensity = 1.0,
//   size = 1.0,
//   waveStrength = 1.0,
//   colorShift = 1.0,
// }: SingularityShadersProps) {
//   return (
//     <div className="size-40 overflow-hidden rounded-full">
//       <SingularityShaders
//         speed={speed}
//         intensity={intensity}
//         size={size}
//         waveStrength={waveStrength}
//         colorShift={colorShift}
//       />
//     </div>
//   );
// }
