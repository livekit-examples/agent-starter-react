'use client';

import React, { forwardRef } from 'react';
import { Shader } from 'react-shaders';
import { cn } from '@/lib/utils';

const auroraShaderSource = `
const float TAU = 6.28318530718;

// Cosine palette generator
vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

// Noise for dithering
vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

// Tonemap
vec3 Tonemap_Reinhard(vec3 x) {
  x *= 4.0;
  return x / (1.0 + x);
}

// Luma for alpha
float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// SDF shapes
float sdCircle(vec2 st, float r) {
  return length(st) - r;
}

float sdEllipse(vec2 st, float r) {
  float a = length(st + vec2(0, r * 0.8)) - r;
  float b = length(st + vec2(0, -r * 0.8)) - r;
  return (a + b);
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

float sdBox(vec2 p, float r) {
  vec2 q = abs(p) - vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r * mix(0.0, 0.3333, uAmplitude);
}

float sdEquilateralTriangle(vec2 p, float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if(p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y) - r * mix(0.0, 0.3333, uAmplitude);
}

float getSdf(vec2 st) {
  if(uShape == 1) return sdCircle(st, uScale);
  else if(uShape == 2) return sdEllipse(st, uScale);
  else if(uShape == 3) return sdLine(st, uScale);
  else if(uShape == 4) return sdBox(st, uScale);
  else if(uShape == 5) return sdEquilateralTriangle(st, uScale);
  else return sdCircle(st, uScale);
}

vec2 turb(vec2 pos, float t, float it) {
  mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
  float freq = mix(2.0, 15.0, uFrequency);
  float amp = uAmplitude;
  float xp = 1.4;
  float time = t * 0.1 * uSpeed + uPhase;
  
  for(float i = 0.0; i < 4.0; i++) {
    vec2 s = sin(freq * (pos * rot) + i * time + it);
    pos += amp * rot[0] * s / freq;
    rot *= mat2(0.6, -0.8, 0.8, 0.6);
    amp *= mix(1.0, max(s.y, s.x), uVariance);
    freq *= xp;
  }

  return pos;
}

const float ITERATIONS = 36.0;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  
  vec3 pp = vec3(0.0);
  vec3 bloom = vec3(0.0);
  float t = iTime * 0.5 + uPhase;
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
    
    // Generate color using cosine palette
    vec3 color = pal(
      iter * mix(0.0, 3.0, uColorScale) + uColorPosition * 2.0, 
      vec3(0.5), 
      vec3(0.5), 
      vec3(1.0), 
      vec3(0.0, 0.33, 0.67)
    );
    
    float invd = 1.0 / max(d + dynamicBlur, 0.001);
    pp += (ds - 1.0) * color;
    bloom += clamp(invd, 0.0, 250.0) * color;
  }

  pp *= 1.0 / ITERATIONS;
  bloom = bloom / (bloom + 2e4);

  vec3 color = (-pp + bloom * 3.0 * uBloom);
  color *= 1.2;
  color += (randFibo(fragCoord).x - 0.5) / 255.0;
  color = Tonemap_Reinhard(color);
  
  float alpha = luma(color) * uMix;
  fragColor = vec4(color * uMix, alpha);
}
`;

export interface AuroraShadersProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Aurora wave speed
   * @default 1.0
   */
  speed?: number;

  /**
   * Light intensity (bloom)
   * @default 2.0
   */
  intensity?: number;

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
   * Edge blur/softness
   * @default 1.0
   */
  blur?: number;

  /**
   * Shape type: 1=circle, 2=ellipse, 3=line, 4=box, 5=triangle
   * @default 1
   */
  shape?: number;

  /**
   * Color palette offset - shifts colors along the gradient (0-1)
   * Lower values shift toward start colors, higher toward end colors
   * @default 0.5
   * @example 0.0 - cool tones dominate
   * @example 0.5 - balanced (default)
   * @example 1.0 - warm tones dominate
   */
  colorPosition?: number;

  /**
   * Color variation across layers (0-1)
   * Controls how much colors change between iterations
   * @default 0.5
   * @example 0.0 - minimal color variation (more uniform)
   * @example 0.5 - moderate variation (default)
   * @example 1.0 - maximum variation (rainbow effect)
   */
  colorScale?: number;

  /**
   * Brightness of the aurora (0-1)
   * @default 1.0
   */
  brightness?: number;
}

export const AuroraShaders = forwardRef<HTMLDivElement, AuroraShadersProps>(
  (
    {
      className,
      speed = 1.0,
      intensity = 0.1,
      amplitude = 0.5,
      frequency = 0.5,
      scale = 0.3,
      blur = 1.0,
      shape = 1,
      colorPosition = 1.0,
      colorScale = 1.0,
      brightness = 1.0,
      ...props
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn('h-full w-full', className)} {...props}>
        <Shader
          fs={auroraShaderSource}
          uniforms={{
            uSpeed: { type: '1f', value: speed },
            uBlur: { type: '1f', value: blur },
            uScale: { type: '1f', value: scale },
            uFrequency: { type: '1f', value: frequency },
            uAmplitude: { type: '1f', value: amplitude },
            uBloom: { type: '1f', value: intensity },
            uMix: { type: '1f', value: brightness },
            uSpacing: { type: '1f', value: 0.5 },
            uShape: { type: '1i', value: shape },
            uColorScale: { type: '1f', value: colorScale },
            uColorPosition: { type: '1f', value: colorPosition },
            uVariance: { type: '1f', value: 0.5 },
            uSmoothing: { type: '1f', value: 1 },
            uPhase: { type: '1f', value: 0 },
          }}
          style={{ width: '100%', height: '100%' } as CSSStyleDeclaration}
        />
      </div>
    );
  }
);

AuroraShaders.displayName = 'AuroraShaders';

export default AuroraShaders;
