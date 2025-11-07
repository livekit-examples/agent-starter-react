#version 300 es
precision mediump float;

in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform sampler2D uCustomTexture;
uniform vec2 uPos;
uniform float uBlur;
uniform float uScale;
uniform float uFrequency;
uniform float uAngle;
uniform float uAmplitude;
uniform float uTime;
uniform float uBloom;
uniform float uMix;
uniform float uSpacing;
uniform int uBlendMode;
uniform int uShape;
uniform int uWaveType;
uniform int uColorPalette;
uniform float uColorScale;
uniform float uColorPosition;
uniform float uVariance;
uniform float uSmoothing;
uniform float uPhase;
uniform float uMouseInfluence;
uniform vec3 uColor;
${Fe}
${ys}
${Ts}

out vec4 fragColor;

ivec2 customTexSize;
float customTexAspect;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( TAU*(c*t+d) );
}

vec3 Tonemap_Reinhard(vec3 x) {
  x *= 4.;
  return x / (1.0 + x);
}

float sdCircle(vec2 st, float r) {
  return length(st) - r;
}

float sdEllipse(vec2 st, float r) {
  float a =  length(st + vec2(0, r * 0.8)) - r;
  float b = length(st + vec2(0, -r * 0.8)) - r;
  return (a + b);
}

float sdArc(vec2 st, float r) {
  return length(st * vec2(0, r)) - r;
}

float sdLine(vec2 p, float r) {
  float halfLen = r * 2.;
  vec2 a = vec2(-halfLen, 0.0);
  vec2 b = vec2(halfLen, 0.0);
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdBox(vec2 p, float r, float md) {
    vec2 q = abs(p)-vec2(r);
    return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r * mix(0., 0.3333 * md, uAmplitude);
}

float sdEquilateralTriangle(vec2 p, float r, float md) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r/k;
  if( p.x+k*p.y>0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
  p.x -= clamp( p.x, -2.0*r, 0.0 );
  return -length(p)*sign(p.y) - r * mix(0., 0.3333 * md, uAmplitude);
}

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

float screenPxRange() {
  vec2 unitRange = 85./vec2(512);
  vec2 screenTexSize = vec2(1.0)/fwidth(vTextureCoord);
  return max(0.5*dot(unitRange, screenTexSize), 1.0);
}

float sdCustom(vec2 uv) {
  ivec2 customTexSize = textureSize(uCustomTexture, 0);
  float customTexAspect = float(customTexSize.x) / float(customTexSize.y);

  uv.x /= customTexAspect;
  uv /= (uScale * 2.5);
  uv += 0.5;

  if(uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) {
    return 1.;
  }

  vec4 sdColor = texture(uCustomTexture, uv);
  float msdf = median(sdColor.r, sdColor.g, sdColor.b);
  float sd = msdf;
  float screenPxDistance = -(sd - 0.51);
  return screenPxDistance * 2.;
}

float getSdf(vec2 st, float iter, float md) {
  switch(uShape) {
    case 0: return sdCustom(st); break;
    case 1: return sdCircle(st, uScale); break;
    case 2: return sdEllipse(st, uScale); break;
    case 3: return sdLine(st, uScale); break;
    case 4: return sdBox(st, uScale, md); break;
    case 5: return sdEquilateralTriangle(st, uScale, md); break;
    default: return 0.; break;
  }
}

vec2 turb(vec2 pos, float t, float it, float md, vec2 mPos) {
  mat2 rot = mat2(0.6, -0.8, 0.8,  0.6);
  float freq = mix(2., 15., uFrequency);
  float amp = (uAmplitude) * md;
  float xp = 1.4;
  float time = t * 0.1 + uPhase;
  
  for(float i = 0.; i < 4.; i++) {
    vec2 s = sin(freq * ((pos - mPos) * rot) + i * time + it);
    pos += amp * rot[0] * s / freq;
    rot *= mat2(0.6, -0.8, 0.8,  0.6);
    amp *= mix(1., max(s.y, s.x), uVariance);
    freq *= xp;
  }

  return pos;
}


float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

const float ITERATIONS = 36.;

float expApprox(float x) {
    x = clamp(x, -4.0, 4.0);
    float x2 = x * x;
    return 1.0 + x + 0.5 * x2 + (1.0/6.0) * x2 * x;
  }

void main() {
  vec2 uv = vTextureCoord;
  vec4 bg = texture(uTexture, uv);

  if(uShape == 0) {
    customTexSize = textureSize(uCustomTexture, 0);
    customTexAspect = float(customTexSize.x) / float(customTexSize.y);
  }
  
  vec3 pp = vec3(0.);
  vec3 bloom = vec3(0.);
  float t = uTime * 0.5 + uPhase;
  vec2 aspect = vec2(uResolution.x/uResolution.y, 1);
  vec2 mousePos = mix(vec2(0), uMousePos - 0.5, uTrackMouse);
  vec2 pos = (uv * aspect - uPos * aspect);
  float mDist = length(uv * aspect - uMousePos * aspect);
  float md = mix(1., smoothstep(1., 5., 1./mDist), uMouseInfluence);
  float rotation = uAngle * -2.0 * 3.14159265359;
  mat2 rotMatrix = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
  pos = rotMatrix * pos;
  float bm = 0.05;

  // #ifelseopen
  if(uShape == 0) {
    bm = 0.2;
  }
  // #ifelseclose
      
  vec2 prevPos = turb(pos, t, 0. - 1./ITERATIONS, md, mousePos);
  float spacing =  mix(1., TAU, uSpacing);
  float smoothing = uShape == 0 ? uSmoothing * 2. : uSmoothing;
  
  for(float i = 1.; i < ITERATIONS + 1.; i++) {
    float iter = i/ITERATIONS;
    vec2 st = turb(pos, t, iter * spacing, md, mousePos);
    float d = abs(getSdf(st, iter, md));
    float pd = distance(st, prevPos);
    prevPos = st;
    float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;
    float ds = smoothstep(0., uBlur * bm + max(dynamicBlur * smoothing, 0.001), d);
    vec3 color = pal(iter * mix(0.1, 1.9, uColorScale) + uColorPosition, vec3(0.5), vec3(0.5), vec3(1), uColor);
    float invd = 1./max(d + dynamicBlur, 0.001);
    pp += (ds - 1.) * color;
    bloom += clamp(invd, 0., 250.) * color;
  }

  pp *= 1./ITERATIONS;
  bloom = bloom / (bloom + 2e4);
  
  // #ifelseopen
  if(uShape == 0) {
    pp *= 2.;
    bloom *= 2.;
  }
  // #ifelseclose  


  vec3 color = (-pp + bloom * 3. * uBloom);
  color *= 1.2;
  color += (randFibo(gl_FragCoord.xy) - 0.5) / 255.0;
  color = (Tonemap_Reinhard(color));
  vec4 auroraColor = vec4(color, 1.);    
  
  // #ifelseopen
  if(uBlendMode > 0) {
    auroraColor.rgb = blend(uBlendMode, bg.rgb, auroraColor.rgb);
  }
  // #ifelseclose

  auroraColor = vec4(mix(bg.rgb, auroraColor.rgb, uMix), max(bg.a, luma(auroraColor.rgb)));
  
  ${ze("auroraColor")}
}
