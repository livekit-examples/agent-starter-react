'use client';

import React, { forwardRef } from 'react';
import { Shader } from 'react-shaders';
import { cn } from '@/lib/utils';

export interface AuroraShadersProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Aurora wave speed
   * @default 1.0
   */
  speed?: number;

  /**
   * Light intensity and brightness
   * @default 1.0
   */
  intensity?: number;

  /**
   * Color vibrancy and saturation
   * @default 1.0
   */
  vibrancy?: number;

  /**
   * Wave frequency and complexity
   * @default 1.0
   */
  frequency?: number;

  /**
   * Vertical stretch of aurora bands (ring thickness)
   * @default 1.0
   */
  stretch?: number;

  /**
   * Ring radius from center
   * @default 0.3
   */
  radius?: number;
}

const auroraShader = `
// Noise function for organic movement
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise for flowing effects
float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal noise for complex aurora patterns
float fractalNoise(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for(int i = 0; i < 4; i++) {
        value += amplitude * smoothNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalize coordinates and center them
    vec2 uv = fragCoord / iResolution.xy;
    vec2 center = vec2(0.5, 0.5);
    vec2 pos = uv - center;
    
    // Adjust aspect ratio
    pos.x *= iResolution.x / iResolution.y;

    // Convert to polar coordinates
    float angle = atan(pos.y, pos.x);
    float dist = length(pos);
    
    // Normalize angle from -PI..PI to 0..1
    float normalizedAngle = (angle / 6.28318530718) + 0.5;

    // Time with speed control
    float time = iTime * u_speed;

    // Create radial gradient for ring positioning (controls ring thickness)
    float ringCenter = u_radius; // Distance from center where ring appears
    float ringWidth = 0.15 * u_stretch; // Width of the ring
    float radialGradient = 1.0 - abs(dist - ringCenter) / ringWidth;
    radialGradient = clamp(radialGradient, 0.0, 1.0);
    radialGradient = pow(radialGradient, 1.5);

    // Create seamless angular coordinate by using sin/cos for tiling
    // This ensures the pattern wraps perfectly around the ring
    float angularCoord = normalizedAngle * 6.28318530718 + time * 0.1 * 6.28318530718;
    vec2 seamlessUV = vec2(cos(angularCoord), sin(angularCoord));

    // Generate multiple aurora layers with different characteristics
    // Using seamless UV coordinates to avoid seams
    float aurora1 = fractalNoise(seamlessUV * u_frequency * 3.0 + vec2(time * 0.2, dist * 10.0));
    float aurora2 = fractalNoise(seamlessUV * u_frequency * 2.0 + vec2(time * 0.15 + 1000.0, dist * 8.0));
    float aurora3 = fractalNoise(seamlessUV * u_frequency * 4.0 + vec2(time * 0.25 + 2000.0, dist * 12.0));

    // Add wave distortion for organic movement (radial waves)
    float wave1 = sin(normalizedAngle * 8.0 * 6.28318530718 + time * 2.0) * 0.02;
    float wave2 = sin(normalizedAngle * 12.0 * 6.28318530718 + time * 1.5) * 0.01;

    float distortedDist = dist + wave1 + wave2;

    // Apply radial positioning to aurora layers (creates the ring shape)
    aurora1 *= smoothstep(ringCenter - ringWidth, ringCenter, distortedDist) * 
              smoothstep(ringCenter + ringWidth, ringCenter, distortedDist);
    aurora2 *= smoothstep(ringCenter - ringWidth * 0.8, ringCenter, distortedDist) * 
              smoothstep(ringCenter + ringWidth * 0.8, ringCenter, distortedDist);
    aurora3 *= smoothstep(ringCenter - ringWidth * 0.9, ringCenter, distortedDist) * 
              smoothstep(ringCenter + ringWidth * 0.9, ringCenter, distortedDist);

    // Combine aurora layers
    float combinedAurora = (aurora1 * 0.6 + aurora2 * 0.8 + aurora3 * 0.4) * radialGradient;

    // Apply intensity scaling
    combinedAurora *= u_intensity;

    // Create aurora color palette
    vec3 color1 = vec3(0.0, 0.8, 0.4);  // Green
    vec3 color2 = vec3(0.2, 0.4, 1.0);  // Blue
    vec3 color3 = vec3(0.8, 0.2, 0.8);  // Purple
    vec3 color4 = vec3(0.0, 1.0, 0.8);  // Cyan

    // Create seamless color transitions using sine waves for smooth wrapping
    float colorPhase = normalizedAngle * 6.28318530718 * 2.0; // Two full cycles around ring
    float colorMix = (sin(colorPhase) + 1.0) * 0.5; // 0 to 1
    float colorMix2 = (sin(colorPhase + 2.094395) + 1.0) * 0.5; // Offset by 120 degrees
    float colorMix3 = (sin(colorPhase + 4.18879) + 1.0) * 0.5; // Offset by 240 degrees

    // Mix colors smoothly with seamless transitions
    vec3 finalColor = mix(color1, color2, colorMix);
    finalColor = mix(finalColor, color3, colorMix2 * 0.5);
    finalColor = mix(finalColor, color4, colorMix3 * 0.3);

    // Apply vibrancy control
    vec3 desaturated = vec3(dot(finalColor, vec3(0.299, 0.587, 0.114)));
    finalColor = mix(desaturated, finalColor, u_vibrancy);

    // Apply aurora intensity
    finalColor *= combinedAurora;

    // Add atmospheric glow around the ring
    float ringGlow = exp(-abs(dist - ringCenter) * 8.0) * 0.15;
    finalColor += finalColor * ringGlow;

    // Ensure colors stay in valid range
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    // Calculate alpha based on aurora intensity for transparency
    float alpha = length(finalColor);
    alpha = clamp(alpha, 0.0, 1.0);

    fragColor = vec4(finalColor, alpha);
}
`;

export const AuroraShaders = forwardRef<HTMLDivElement, AuroraShadersProps>(
  (
    {
      className,
      speed = 1.0,
      intensity = 1.0,
      vibrancy = 1.0,
      frequency = 1.0,
      stretch = 1.0,
      radius = 0.3,
      ...props
    },
    ref
  ) => {
    console.log('radius', radius);
    return (
      <div ref={ref} className={cn('h-full w-full', className)} {...props}>
        <Shader
          fs={auroraShader}
          uniforms={{
            u_speed: { type: '1f', value: speed },
            u_intensity: { type: '1f', value: intensity },
            u_vibrancy: { type: '1f', value: vibrancy },
            u_frequency: { type: '1f', value: frequency },
            u_stretch: { type: '1f', value: stretch },
            u_radius: { type: '1f', value: radius },
          }}
          style={{ width: '100%', height: '100%' } as CSSStyleDeclaration}
        />
      </div>
    );
  }
);

AuroraShaders.displayName = 'AuroraShaders';

export default AuroraShaders;
