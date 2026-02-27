'use client';

import React, { type ComponentProps, useMemo } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import { type AgentState, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { ReactShaderToy } from '@/components/agents-ui/react-shader-toy';
import { useAgentAudioVisualizerAura } from '@/hooks/agents-ui/use-agent-audio-visualizer-aura';
import { cn } from '@/lib/shadcn/utils';

/**
 * @license
 *
 * Originally developed for Unicorn Studio
 * https://unicorn.studio
 *
 * Licensed under the Polyform Non-Resale License 1.0.0
 * https://polyformproject.org/licenses/non-resale/1.0.0/
 *
 * © 2026 UNCRN LLC
 */

const DEFAULT_COLOR = '#1FD5F9';

function hexToRgb(hexColor: string) {
  try {
    const rgbColor = hexColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);

    if (rgbColor) {
      const [, r, g, b] = rgbColor;
      const color = [r, g, b].map((c = '00') => parseInt(c, 16) / 255);

      return color;
    }
  } catch (error) {
    console.error(
      `Invalid hex color '${hexColor}'.\nFalling back to default color '${DEFAULT_COLOR}'.`
    );
  }

  return hexToRgb(DEFAULT_COLOR);
}

const shaderSource = `
const float TAU = 6.283185;

// Noise for dithering
vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

// Tonemap
vec3 Tonemap(vec3 x) {
  x *= 4.0;
  return x / (1.0 + x);
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

// SDF shapes
float sdCircle(vec2 st, float r) {
  return length(st) - r;
}

float sdLine(vec2 p, float r) {
  float halfLen = r * 2.0;
  vec2 a = vec2(-halfLen, 0.0);
  vec2 b = vec2(halfLen, 0.0);
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float getSdf(vec2 st) {
  if(uShape == 1.0) return sdCircle(st, uScale);
  else if(uShape == 2.0) return sdLine(st, uScale);
  return sdCircle(st, uScale); // Default
}

vec2 turb(vec2 pos, float t, float it) {
  // Initial rotation matrix for swirl direction
  mat2 rotation = mat2(0.6, -0.25, 0.25, 0.9);
  // Secondary rotation applied each iteration (approx 53 degree rotation)
  mat2 layerRotation = mat2(0.6, -0.8, 0.8, 0.6);
  
  float frequency = mix(2.0, 15.0, uFrequency);
  float amplitude = uAmplitude;
  float frequencyGrowth = 1.4;
  float animTime = t * 0.1 * uSpeed;
  
  const int LAYERS = 4;
  for(int i = 0; i < LAYERS; i++) {
    // Calculate wave displacement for this layer
    vec2 rotatedPos = pos * rotation;
    vec2 wave = sin(frequency * rotatedPos + float(i) * animTime + it);
    
    // Apply displacement along rotation direction
    pos += (amplitude / frequency) * rotation[0] * wave;
    
    // Evolve parameters for next layer
    rotation *= layerRotation;
    amplitude *= mix(1.0, max(wave.x, wave.y), uVariance);
    frequency *= frequencyGrowth;
  }

  return pos;
}

const float ITERATIONS = 36.0;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  
  vec3 pp = vec3(0.0);
  vec3 bloom = vec3(0.0);
  float t = iTime * 0.5;
  vec2 pos = uv - 0.5;
      
  vec2 prevPos = turb(pos, t, 0.0 - 1.0 / ITERATIONS);
  float spacing = mix(1.0, TAU, uSpacing);

  for(float i = 1.0; i < ITERATIONS + 1.0; i++) {
    float iter = i / ITERATIONS;
    vec2 st = turb(pos, t, iter * spacing);
    float d = abs(getSdf(st));
    float pd = distance(st, prevPos);
    prevPos = st;
    float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;
    float ds = smoothstep(0.0, uBlur * 0.05 + max(dynamicBlur * uSmoothing, 0.001), d);
    
    // Shift color based on iteration using uColorScale
    vec3 color = uColor;
    if(uColorShift > 0.01) {
      vec3 hsv = rgb2hsv(color);
      // Shift hue by iteration
      hsv.x = fract(hsv.x + (1.0 - iter) * uColorShift * 0.3); 
      color = hsv2rgb(hsv);
    }
    
    float invd = 1.0 / max(d + dynamicBlur, 0.001);
    pp += (ds - 1.0) * color;
    bloom += clamp(invd, 0.0, 250.0) * color;
  }

  pp *= 1.0 / ITERATIONS;
  
  vec3 color;
  
  // Dark mode (default)
  if(uMode < 0.5) {
    // use bloom effect
    bloom = bloom / (bloom + 2e4);
    color = (-pp + bloom * 3.0 * uBloom) * 1.2;
    color += (randFibo(fragCoord).x - 0.5) / 255.0;
    color = Tonemap(color);
    float alpha = luma(color) * uMix;
    fragColor = vec4(color * uMix, alpha);
  }
    
  // Light mode 
  else {
    // no bloom effect
    color = -pp;
    color += (randFibo(fragCoord).x - 0.5) / 255.0;
  
    // Preserve hue by tone mapping brightness only
    float brightness = length(color);
    vec3 direction = brightness > 0.0 ? color / brightness : color;
  
    // Reinhard on brightness
    float factor = 2.0;
    float mappedBrightness = (brightness * factor) / (1.0 + brightness * factor);
    color = direction * mappedBrightness;
    
    // Boost saturation to compensate for white background bleed-through
    // When alpha < 1.0, white bleeds through making colors look desaturated
    // So we increase saturation to maintain vibrant appearance
    float gray = dot(color, vec3(0.2, 0.5, 0.1));
    float saturationBoost = 3.0;
    color = mix(vec3(gray), color, saturationBoost);
    
    // Clamp between 0-1
    color = clamp(color, 0.0, 1.0);
    
    float alpha = mappedBrightness * clamp(uMix, 1.0, 2.0);
    fragColor = vec4(color, alpha);
  }
}`;

interface AuraShaderProps {
  /**
   * Aurora wave speed
   * @default 1.0
   */
  speed?: number;

  /**
   * Turbulence amplitude
   * @default 0.5
   */
  amplitude?: number;

  /**
   * Wave frequency and complexity
   * @default 0.5
   */
  frequency?: number;

  /**
   * Shape scale
   * @default 0.3
   */
  scale?: number;

  /**
   * Shape type: 1=circle, 2=line
   * @default 1
   */
  shape?: number;

  /**
   * Edge blur/softness
   * @default 1.0
   */
  blur?: number;

  /**
   * Color of the aura in hexidecimal format.
   * @default '#1FD5F9'
   */
  color?: `#${string}`;

  /**
   * Color variation across layers (0-1)
   * Controls how much colors change between iterations
   * @default 0.5
   * @example 0.0 - minimal color variation (more uniform)
   * @example 0.5 - moderate variation (default)
   * @example 1.0 - maximum variation (rainbow effect)
   */
  colorShift?: number;

  /**
   * Brightness of the aurora (0-1)
   * @default 1.0
   */
  brightness?: number;

  /**
   * Display mode for different backgrounds
   * - 'dark': Optimized for dark backgrounds (default)
   * - 'light': Optimized for light/white backgrounds (inverts colors)
   * @default 'dark'
   */
  themeMode?: 'dark' | 'light';
}

function AuraShader({
  shape = 1.0,
  speed = 1.0,
  amplitude = 0.5,
  frequency = 0.5,
  scale = 0.2,
  blur = 1.0,
  color = DEFAULT_COLOR,
  colorShift = 1.0,
  brightness = 1.0,
  themeMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light',
  ref,
  className,
  ...props
}: AuraShaderProps & ComponentProps<'div'>) {
  const rgbColor = useMemo(() => hexToRgb(color), [color]);

  return (
    <div ref={ref} className={className} {...props}>
      <ReactShaderToy
        fs={shaderSource}
        devicePixelRatio={globalThis.devicePixelRatio ?? 1}
        uniforms={{
          // Aurora wave speed
          uSpeed: { type: '1f', value: speed },
          // Edge blur/softness
          uBlur: { type: '1f', value: blur },
          // Shape scale
          uScale: { type: '1f', value: scale },
          // Shape type: 1=circle, 2=line
          uShape: { type: '1f', value: shape },
          // Wave frequency and complexity
          uFrequency: { type: '1f', value: frequency },
          // Turbulence amplitude
          uAmplitude: { type: '1f', value: amplitude },
          // Light intensity (bloom)
          uBloom: { type: '1f', value: 0.0 },
          // Brightness of the aurora (0-1)
          uMix: { type: '1f', value: brightness },
          // Color variation across layers (0-1)
          uSpacing: { type: '1f', value: 0.5 },
          // Color palette offset - shifts colors along the gradient (0-1)
          uColorShift: { type: '1f', value: colorShift },
          // Color variation across layers (0-1)
          uVariance: { type: '1f', value: 0.1 },
          // Smoothing of the aurora (0-1)
          uSmoothing: { type: '1f', value: 1.0 },
          // Display mode: 0=dark background, 1=light background
          uMode: { type: '1f', value: themeMode === 'light' ? 1.0 : 0.0 },
          // Color
          uColor: { type: '3fv', value: rgbColor ?? [0, 0.7, 1] },
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

AuraShader.displayName = 'AuraShader';

export const AgentAudioVisualizerAuraVariants = cva(['aspect-square'], {
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

export interface AgentAudioVisualizerAuraProps {
  /**
   * The size of the visualizer.
   * @defaultValue 'lg'
   */
  size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Agent state
   * @default 'connecting'
   */
  state?: AgentState;
  /**
   * The color of the aura in hexidecimal format.
   * @defaultValue '#1FD5F9'
   */
  color?: `#${string}`;
  /**
   * The color shift of the aura.
   * @defaultValue 0.05
   */
  colorShift?: number;
  /**
   * The theme mode of the aura.
   * @defaultValue 'dark'
   */
  themeMode?: 'dark' | 'light';
  /**
   * The audio track to visualize. Can be a local/remote audio track or a track reference.
   */
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
}

/**
 * An shader-based audio visualizer that responds to agent state and audio levels.
 * Displays an animated elliptical aura that reacts to the current agent state (connecting, thinking, speaking, etc.)
 * and audio volume when speaking.
 *
 * @extends ComponentProps<'div'>
 *
 * @example
 * ```tsx
 * <AgentAudioVisualizerAura
 *   size="md"
 *   state="speaking"
 *   audioTrack={agentAudioTrack}
 * />
 * ```
 */
export function AgentAudioVisualizerAura({
  size = 'lg',
  state = 'connecting',
  color = DEFAULT_COLOR,
  colorShift = 0.05,
  audioTrack,
  themeMode,
  className,
  ref,
  ...props
}: AgentAudioVisualizerAuraProps &
  ComponentProps<'div'> &
  VariantProps<typeof AgentAudioVisualizerAuraVariants>) {
  const { speed, scale, amplitude, frequency, brightness } = useAgentAudioVisualizerAura(
    state,
    audioTrack
  );

  return (
    <AuraShader
      ref={ref}
      data-lk-state={state}
      blur={0.2}
      color={color}
      colorShift={colorShift}
      speed={speed}
      scale={scale}
      themeMode={themeMode}
      amplitude={amplitude}
      frequency={frequency}
      brightness={brightness}
      className={cn(AgentAudioVisualizerAuraVariants({ size }), className)}
      {...props}
    />
  );
}
