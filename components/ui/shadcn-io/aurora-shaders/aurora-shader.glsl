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
  if(uShape == 1) return sdCircle(st, uScale);
  else if(uShape == 2) return sdLine(st, uScale);
  return sdCircle(st, uScale); // Default
}

vec2 turb(vec2 pos, float t, float it) {
  mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
  float freq = mix(2.0, 15.0, uFrequency);
  float amp = uAmplitude;
  float xp = 1.4;
  float time = t * 0.1 * uSpeed;
  
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