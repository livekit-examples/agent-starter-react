'use client';

import React, { forwardRef } from 'react';
import { Shader } from '@/components/livekit/react-shader/react-shader';

const oscilliscopeShaderSource = `
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
  
  // Calculate color position based on x position for gradient effect
  float colorPos = x;
  vec3 color = uColor;
  
  // Apply line intensity
  color *= line;
  
  // Add dithering for smoother gradients
  // color += (randFibo(fragCoord).x - 0.5) / 255.0;
  
  // Calculate alpha based on line intensity
  float alpha = line * uMix;
  
  fragColor = vec4(color * uMix, alpha);
}`;

export interface OscilliscopeShadersProps extends React.HTMLAttributes<HTMLDivElement> {
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
   * RGB color of the oscilloscope
   * @default [31.0 / 255, 213.0 / 255, 249.0 / 255]
   */
  rgbColor?: [number, number, number];
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
   * Smoothing of the oscilloscope in pixels
   * @default 0.5
   */
  smoothing?: number;
}

export const OscilliscopeShaders = forwardRef<HTMLDivElement, OscilliscopeShadersProps>(
  (
    {
      className,
      speed = 10,
      amplitude = 0.02,
      frequency = 20.0,
      rgbColor = [31.0 / 255, 213.0 / 255, 249.0 / 255], // LiveKit Blue
      mix = 1.0,
      lineWidth = 2.0,
      smoothing = 0.5,
      ...props
    },
    ref
  ) => {
    const globalThis = typeof window !== 'undefined' ? window : global;

    return (
      <div ref={ref} className={className} {...props}>
        <Shader
          fs={oscilliscopeShaderSource}
          devicePixelRatio={globalThis.devicePixelRatio ?? 1}
          uniforms={{
            uSpeed: { type: '1f', value: speed },
            uAmplitude: { type: '1f', value: amplitude },
            uFrequency: { type: '1f', value: frequency },
            uMix: { type: '1f', value: mix },
            uLineWidth: { type: '1f', value: lineWidth },
            uSmoothing: { type: '1f', value: smoothing },
            uColor: { type: '3fv', value: rgbColor },
          }}
          onError={(error) => {
            console.error('Shader error:', error);
          }}
          onWarning={(warning) => {
            console.warn('Shader warning:', warning);
          }}
          style={{ width: '100%', height: '100%' } as CSSStyleDeclaration}
        />
      </div>
    );
  }
);

OscilliscopeShaders.displayName = 'OscilliscopeShaders';

export default OscilliscopeShaders;
