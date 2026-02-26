'use client';

import { type ComponentProps, useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import { type AgentState, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { ReactShaderToy } from '@/components/agents-ui/react-shader-toy';
import { useAgentAudioVisualizerWave } from '@/hooks/agents-ui/use-agent-audio-visualizer-wave';
import { cn } from '@/lib/shadcn/utils';

const DEFAULT_COLOR = '#1FD5F9';

function hexToRgb(hexColor: string) {
  try {
    const rgbColor = hexColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);

    if (rgbColor) {
      const [, r, g, b] = rgbColor;
      const color = [r, g, b].map((c = '00') => parseInt(c, 16) / 255);

      return color;
    }
  } catch {
    console.error(
      `Invalid hex color '${hexColor}'.\nFalling back to default color '${DEFAULT_COLOR}'.`
    );
  }

  return hexToRgb(DEFAULT_COLOR);
}

const shaderSource = `
const float TAU = 6.28318530718;

// Noise for dithering
vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

// Luma for alpha
float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Bell curve function for attenuation from center with rounded top
float bellCurve(float distanceFromCenter, float maxDistance) {
  float normalizedDistance = distanceFromCenter / maxDistance;
  // Use cosine with high power for smooth rounded top
  return pow(cos(normalizedDistance * (3.14159265359 / 4.0)), 16.0);
}

// Calculate the sine wave
float oscilloscopeWave(float x, float centerX, float time) {
  float relativeX = x - centerX;
  float maxDistance = centerX;
  float distanceFromCenter = abs(relativeX);
  
  // Apply bell curve for amplitude attenuation
  float bell = bellCurve(distanceFromCenter, maxDistance);
  
  // Calculate wave with uniforms and bell curve attenuation
  float wave = sin(relativeX * uFrequency + time * uSpeed) * uAmplitude * bell;
  
  return wave;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 pos = uv - 0.5;
  
  // Calculate center and positions
  float centerX = 0.5;
  float centerY = 0.5;
  float x = uv.x;
  float y = uv.y;
  
  // Convert line width from pixels to UV space
  // Use the average of width and height to handle aspect ratio
  float pixelSize = 2.0 / (iResolution.x + iResolution.y);
  float lineWidthUV = uLineWidth * pixelSize;
  float smoothingUV = uSmoothing * pixelSize;
  
  // Find minimum distance to the wave by sampling nearby points
  // This gives us consistent line width without high-frequency artifacts
  const int NUM_SAMPLES = 50; // Must be const for GLSL loop
  float minDist = 1000.0;
  float sampleRange = 0.02; // Range to search for closest point
  
  for(int i = 0; i < NUM_SAMPLES; i++) {
    float offset = (float(i) / float(NUM_SAMPLES - 1) - 0.5) * sampleRange;
    float sampleX = x + offset;
    float waveY = centerY + oscilloscopeWave(sampleX, centerX, iTime);
    
    // Calculate distance from current pixel to this point on the wave
    vec2 wavePoint = vec2(sampleX, waveY);
    vec2 currentPoint = vec2(x, y);
    float dist = distance(currentPoint, wavePoint);
    
    minDist = min(minDist, dist);
  }
  
  // Solid line with smooth edges using minimum distance
  float line = smoothstep(lineWidthUV + smoothingUV, lineWidthUV - smoothingUV, minDist);
  
  vec3 color = uColor;
  if(abs(uColorShift) > 0.01) {
    // Keep the center 50% at base color, then ramp shift across outer 25% on each side.
    float centerBandHalfWidth = 0.2;
    float edgeBandWidth = 0.5;
    float distanceFromCenter = abs(x - centerX);
    float edgeFactor = clamp((distanceFromCenter - centerBandHalfWidth) / edgeBandWidth, 0.0, 1.0);
    vec3 hsv = rgb2hsv(color);
    // Hue shift is zero in the center band and strongest at far edges.
    hsv.x = fract(hsv.x + edgeFactor * uColorShift * 0.3);
    color = hsv2rgb(hsv);
  }
  
  // Apply line intensity
  color *= line;
  
  // Add dithering for smoother gradients
  // color += (randFibo(fragCoord).x - 0.5) / 255.0;
  
  // Calculate alpha based on line intensity
  float alpha = line * uMix;
  
  fragColor = vec4(color * uMix, alpha);
}`;

interface WaveShaderProps {
  /**
   * Class name
   * @default ''
   */
  className?: string;
  /**
   * Speed of the oscilloscope
   * @default 10
   */
  speed?: number;
  /**
   * Amplitude of the oscilloscope
   * @default 0.02
   */
  amplitude?: number;
  /**
   * Frequency of the oscilloscope
   * @default 20.0
   */
  frequency?: number;
  /**
   * Color of the oscilloscope in hexidecimal format.
   * @default '#1FD5F9'
   */
  color?: `#${string}`;
  /**
   * Hue shift amount applied toward the outside of the wave. Center remains at the base color.
   * @default 0.05
   */
  colorShift?: number;
  /**
   * Mix of the oscilloscope
   * @default 1.0
   */
  mix?: number;
  /**
   * Line width of the oscilloscope in pixels
   * @default 2.0
   */
  lineWidth?: number;
  /**
   * Blur of the oscilloscope in pixels
   * @default 0.5
   */
  blur?: number;
}

function WaveShader({
  speed = 10,
  color = '#1FD5F9',
  colorShift = 0.05,
  mix = 1.0,
  amplitude = 0.02,
  frequency = 20.0,
  lineWidth = 2.0,
  blur = 0.5,
  ref,
  className,
  ...props
}: WaveShaderProps & ComponentProps<'div'>) {
  const rgbColor = useMemo(() => hexToRgb(color), [color]);

  return (
    <div ref={ref} className={className} {...props}>
      <ReactShaderToy
        fs={shaderSource}
        devicePixelRatio={globalThis.devicePixelRatio ?? 1}
        uniforms={{
          uSpeed: { type: '1f', value: speed },
          uAmplitude: { type: '1f', value: amplitude },
          uFrequency: { type: '1f', value: frequency },
          uMix: { type: '1f', value: mix },
          uLineWidth: { type: '1f', value: lineWidth },
          uSmoothing: { type: '1f', value: blur },
          uColor: { type: '3fv', value: rgbColor },
          uColorShift: { type: '1f', value: colorShift },
        }}
        onError={(error) => {
          console.error('Shader error:', error);
        }}
        onWarning={(warning) => {
          console.warn('Shader warning:', warning);
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

WaveShader.displayName = 'WaveShader';

export const AgentAudioVisualizerWaveVariants = cva(['aspect-square'], {
  variants: {
    size: {
      icon: 'h-[24px]',
      sm: 'h-[56px]',
      md: 'h-[112px]',
      lg: 'h-[224px]',
      xl: 'h-[448px]',
    },
  },
  defaultVariants: {
    size: 'lg',
  },
});

export interface AgentAudioVisualizerWaveProps {
  /**
   * The size of the visualizer.
   * @defaultValue 'lg'
   */
  size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * The agent state.
   * @defaultValue 'speaking'
   */
  state?: AgentState;
  /**
   * The color of the wave in hexidecimal format.
   * @defaultValue '#1FD5F9'
   */
  color?: `#${string}`;
  /**
   * The color shift of the wave. Higher values increase hue variation toward the edges.
   * @defaultValue 0.05
   */
  colorShift?: number;
  /**
   * The line width of the wave in pixels.
   * @defaultValue 2.0
   */
  lineWidth?: number;
  /**
   * The blur of the wave in pixels.
   * @defaultValue 0.5
   */
  blur?: number;
  /**
   * The audio track to visualize. Can be a local/remote audio track or a track reference.
   */
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  /**
   * Additional CSS class names to apply to the container.
   */
  className?: string;
}

/**
 * A wave-style audio visualizer that responds to agent state and audio levels.
 * Displays an animated wave that reacts to the current agent state (connecting, thinking, speaking, etc.)
 * and audio volume when speaking.
 *
 * @extends ComponentProps<'div'>
 *
 * @example ```tsx
 * <AgentAudioVisualizerWave
 *   size="lg"
 *   state="speaking"
 *   color="#1FD5F9"
 *   colorShift={0.3}
 *   lineWidth={2}
 *   blur={0.5}
 *   audioTrack={audioTrack}
 * />
 * ```
 */
export function AgentAudioVisualizerWave({
  size = 'lg',
  state = 'speaking',
  color,
  colorShift = 0.05,
  lineWidth,
  blur,
  audioTrack,
  className,
  ref,
  ...props
}: AgentAudioVisualizerWaveProps &
  ComponentProps<'div'> &
  VariantProps<typeof AgentAudioVisualizerWaveVariants>) {
  const _lineWidth = useMemo(() => {
    if (lineWidth !== undefined) {
      return lineWidth;
    }
    switch (size) {
      case 'icon':
      case 'sm':
        return 2;
      default:
        return 1;
    }
  }, [lineWidth, size]);

  const { speed, amplitude, frequency, opacity } = useAgentAudioVisualizerWave({
    state,
    audioTrack,
  });

  return (
    <WaveShader
      ref={ref}
      data-lk-state={state}
      speed={speed}
      color={color}
      colorShift={colorShift}
      mix={opacity}
      amplitude={amplitude}
      frequency={frequency}
      lineWidth={_lineWidth}
      blur={blur}
      className={cn(
        AgentAudioVisualizerWaveVariants({ size }),
        'mask-[linear-gradient(90deg,transparent_0%,black_20%,black_80%,transparent_100%)]',
        className
      )}
      {...props}
    />
  );
}
