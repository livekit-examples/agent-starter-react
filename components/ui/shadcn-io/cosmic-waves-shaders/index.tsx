'use client';

import React, { forwardRef } from 'react';
import { Shader } from 'react-shaders';
import { cn } from '@/lib/utils';

export interface CosmicWavesShadersProps extends React.HTMLAttributes<HTMLDivElement> {
  speed?: number;
  amplitude?: number;
  frequency?: number;
  starDensity?: number;
  colorShift?: number;
}

const cosmicWavesFragment = `

// Hash function for pseudo-random values
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise function
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal noise
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for(int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Star field generation
float stars(vec2 p, float density) {
  vec2 grid = floor(p * density);
  vec2 local = fract(p * density);

  float h = hash(grid);
  if(h > 0.95) {
    float d = length(local - 0.5);
    float star = exp(-d * 20.0);
    return star * (0.5 + 0.5 * sin(iTime * 2.0 + h * 10.0));
  }
  return 0.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 uv = fragCoord.xy / iResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= iResolution.x / iResolution.y;

  float time = iTime * u_speed;

  // Create flowing wave patterns
  vec2 wavePos = p * u_frequency;
  wavePos.y += time * 0.3;

  // Multiple wave layers
  float wave1 = sin(wavePos.x + cos(wavePos.y + time) * 0.5) * u_amplitude;
  float wave2 = sin(wavePos.x * 1.3 - wavePos.y * 0.7 + time * 1.2) * u_amplitude * 0.7;
  float wave3 = sin(wavePos.x * 0.8 + wavePos.y * 1.1 - time * 0.8) * u_amplitude * 0.5;

  // Combine waves
  float waves = (wave1 + wave2 + wave3) * 0.3;

  // Add fractal noise for organic texture
  vec2 noisePos = p * 1.5 + vec2(time * 0.1, time * 0.05);
  float noiseValue = fbm(noisePos) * 0.4;

  // Combine waves and noise
  float pattern = waves + noiseValue;

  // Create flowing cosmic gradient
  float gradient = length(p) * 0.8;
  gradient += pattern;

  // Color cycling through cosmic spectrum
  vec3 color1 = vec3(0.1, 0.2, 0.8); // Deep blue
  vec3 color2 = vec3(0.6, 0.1, 0.9); // Purple
  vec3 color3 = vec3(0.1, 0.8, 0.9); // Cyan
  vec3 color4 = vec3(0.9, 0.3, 0.6); // Pink

  // Color interpolation based on pattern and time
  float colorTime = time * u_colorShift + pattern * 2.0;
  vec3 finalColor;

  float t = fract(colorTime * 0.2);
  if(t < 0.25) {
    finalColor = mix(color1, color2, t * 4.0);
  } else if(t < 0.5) {
    finalColor = mix(color2, color3, (t - 0.25) * 4.0);
  } else if(t < 0.75) {
    finalColor = mix(color3, color4, (t - 0.5) * 4.0);
  } else {
    finalColor = mix(color4, color1, (t - 0.75) * 4.0);
  }

  // Apply wave intensity
  finalColor *= (0.5 + pattern * 0.8);

  // Add star field
  float starField = stars(p + vec2(time * 0.02, time * 0.01), u_starDensity * 15.0);
  starField += stars(p * 1.5 + vec2(-time * 0.015, time * 0.008), u_starDensity * 12.0);

  finalColor += vec3(starField * 0.8);

  // Add subtle glow effect
  float glow = exp(-length(p) * 0.5) * 0.3;
  finalColor += glow * vec3(0.2, 0.4, 0.8);

  // Vignette effect
  float vignette = 1.0 - length(uv - 0.5) * 1.2;
  vignette = smoothstep(0.0, 1.0, vignette);

  finalColor *= vignette;

  fragColor = vec4(finalColor, 1.0);
}
`;

export const CosmicWavesShaders = forwardRef<HTMLDivElement, CosmicWavesShadersProps>(
  (
    {
      speed = 1.0,
      amplitude = 1.0,
      frequency = 1.0,
      starDensity = 1.0,
      colorShift = 1.0,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn('h-full w-full', className)} {...props}>
        <Shader
          fs={cosmicWavesFragment}
          uniforms={{
            u_speed: { type: '1f', value: speed },
            u_amplitude: { type: '1f', value: amplitude },
            u_frequency: { type: '1f', value: frequency },
            u_starDensity: { type: '1f', value: starDensity },
            u_colorShift: { type: '1f', value: colorShift },
          }}
          style={{ width: '100%', height: '100%' } as CSSStyleDeclaration}
        />
      </div>
    );
  }
);

CosmicWavesShaders.displayName = 'CosmicWavesShaders';
