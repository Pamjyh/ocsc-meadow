/**
 * Zero-dependency WebGL 24-hour living-scene renderer for all 4 scenic backgrounds:
 * Mirrors meadowShader.ts with:
 * - C1-continuous 6-keyframe 24-hour atmosphere (Midnight -> Pre-Dawn -> Morning -> Day -> Sunset -> Twilight)
 * - Real painted drifting clouds (meadow-clouds.webp) smoothly tinted by the 24h cycle
 * - Continuous Sun/Moon orbital arcs, twinkling night stars, and night fireflies
 * - Natural per-scene motion: coherent breeze gusts (no jelly shear), drifting cloud sea, and floating pink petals
 */

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uTex;
uniform sampler2D uCloudTex;
uniform float uTime;
uniform float uHour;
uniform float uMode;
uniform vec2 uCanvasSize;
uniform vec2 uImgSize;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec2 coverUv(vec2 uv, vec2 canvasSize, vec2 imgSize) {
  float canvasAspect = canvasSize.x / max(canvasSize.y, 1.0);
  float imgAspect = imgSize.x / max(imgSize.y, 1.0);
  vec2 scale = vec2(1.0);
  if (canvasAspect > imgAspect) {
    scale.y = imgAspect / canvasAspect;
  } else {
    scale.x = canvasAspect / imgAspect;
  }
  float x = (uv.x - 0.5) * scale.x + 0.5;
  float y = (uv.y - 0.5) * scale.y + 0.5;
  return vec2(x, y);
}

// Smoothstep-eased interpolation between 6 circular 24-hour keyframes (matches meadowShader.ts):
// K0: 00:00 Midnight | K1: 05:30 Pre-Dawn | K2: 07:00 Golden Morning
// K3: 12:30 Cerulean Day | K4: 17:45 Golden Sunset | K5: 19:15 Twilight -> K0: 24:00
vec3 sampleCycle(float h, vec3 k0, vec3 k1, vec3 k2, vec3 k3, vec3 k4, vec3 k5) {
  if (h < 5.5) return mix(k0, k1, smoothstep(0.0, 5.5, h));
  if (h < 7.0) return mix(k1, k2, smoothstep(5.5, 7.0, h));
  if (h < 12.5) return mix(k2, k3, smoothstep(7.0, 12.5, h));
  if (h < 17.75) return mix(k3, k4, smoothstep(12.5, 17.75, h));
  if (h < 19.25) return mix(k4, k5, smoothstep(17.75, 19.25, h));
  return mix(k5, k0, smoothstep(19.25, 24.0, h));
}

float sampleCycle1(float h, float k0, float k1, float k2, float k3, float k4, float k5) {
  if (h < 5.5) return mix(k0, k1, smoothstep(0.0, 5.5, h));
  if (h < 7.0) return mix(k1, k2, smoothstep(5.5, 7.0, h));
  if (h < 12.5) return mix(k2, k3, smoothstep(7.0, 12.5, h));
  if (h < 17.75) return mix(k3, k4, smoothstep(12.5, 17.75, h));
  if (h < 19.25) return mix(k4, k5, smoothstep(17.75, 19.25, h));
  return mix(k5, k0, smoothstep(19.25, 24.0, h));
}

void main() {
  vec2 uv = coverUv(vUv, uCanvasSize, uImgSize);
  float h = mod(uHour, 24.0);
  float aspect = uImgSize.x / max(uImgSize.y, 1.0);

  // Per-scene horizon & natural coherent wind motion
  float horizonY = 0.45;
  vec2 sampleUv = uv;

  if (uMode < 1.5) {
    // Scene 1: Blue wildflower meadow (keep distant hills crisp; gentle rolling wind on foreground flowers)
    horizonY = 0.41;
    float flowerMask = smoothstep(0.50, 0.84, uv.y);
    float gust = sin(uv.x * 3.8 - uTime * 1.10) * 0.65 + sin(uv.x * 7.2 - uTime * 1.55) * 0.35;
    float swayX = gust * 0.0019 * flowerMask;
    float swayY = cos(uv.x * 3.8 - uTime * 1.10) * 0.0005 * flowerMask;
    sampleUv = clamp(uv + vec2(swayX, swayY), 0.001, 0.999);
  } else if (uMode < 2.5) {
    // Scene 2: Sea of clouds above river valley
    // Keep the valley crisp; gently breathe only the bright foreground cloud puffs
    horizonY = 0.46;
    vec3 probe = texture2D(uTex, uv).rgb;
    float isCloudPuff = smoothstep(0.68, 0.86, (probe.r + probe.g + probe.b) / 3.0) * smoothstep(0.42, 0.62, uv.y);
    float puffDrift = sin(uv.x * 3.0 - uTime * 0.55) * 0.0042 * isCloudPuff;
    float puffLift = cos(uv.x * 2.4 - uTime * 0.42) * 0.0018 * isCloudPuff;
    sampleUv = clamp(uv + vec2(puffDrift, puffLift), 0.001, 0.999);
  } else if (uMode < 3.5) {
    // Scene 3: Pink rhododendron hillside garden
    // Coherent, ultra-gentle branch breeze on left/right foliage only (zero jelly shear, dirt path stays 100% still)
    horizonY = mix(0.28, 0.48, exp(-pow((uv.x - 0.50) * 3.0, 2.0)));
    float sideFoliage = smoothstep(0.10, 0.34, abs(uv.x - 0.55));
    float pathExclusion = 1.0 - smoothstep(0.66, 0.84, uv.y) * (1.0 - smoothstep(0.06, 0.22, abs(uv.x - 0.56)));
    float upperCanopy = smoothstep(0.96, 0.35, uv.y) * smoothstep(0.08, 0.26, uv.y);
    float branchMask = sideFoliage * pathExclusion * upperCanopy;
    float breeze = sin(uTime * 0.85 + uv.x * 2.1) * 0.7 + sin(uTime * 1.35 - uv.x * 1.4) * 0.3;
    float swayX = breeze * 0.0013 * branchMask;
    float swayY = cos(uTime * 0.85 + uv.x * 2.1) * 0.0004 * branchMask;
    sampleUv = clamp(uv + vec2(swayX, swayY), 0.001, 0.999);
  } else {
    // Scene 4: Hilltop meadow overlooking lake & cumulus clouds (keep valley & lake crisp; sway foreground hill grass)
    horizonY = 0.60;
    float lakeHole = 1.0 - smoothstep(0.24, 0.30, uv.x) * (1.0 - smoothstep(0.58, 0.65, uv.x)) * smoothstep(0.68, 0.73, uv.y) * (1.0 - smoothstep(0.79, 0.84, uv.y));
    float grassMask = smoothstep(0.70, 0.88, uv.y) * lakeHole;
    float gust = sin(uv.x * 4.2 - uTime * 1.35) * 0.68 + sin(uv.x * 8.4 - uTime * 1.85) * 0.32;
    float grassSway = gust * 0.0024 * grassMask;
    float grassY = cos(uv.x * 4.2 - uTime * 1.15) * 0.0006 * grassMask;
    sampleUv = clamp(uv + vec2(grassSway, grassY), 0.001, 0.999);
  }

  vec3 baseCol = texture2D(uTex, sampleUv).rgb;

  // Detect sky pixels smoothly using horizon + sky-blue/bright-cloud luminance heuristic (F63)
  float aboveHorizon = 1.0 - smoothstep(horizonY - 0.10, horizonY + 0.06, uv.y);
  float blueDominance = smoothstep(-0.04, 0.14, baseCol.b - max(baseCol.r, baseCol.g) * 0.85);
  float brightCloud = smoothstep(0.68, 0.92, (baseCol.r + baseCol.g + baseCol.b) / 3.0);
  float skyMask = aboveHorizon * clamp(blueDominance + brightCloud * 0.90, 0.0, 1.0);

  // Continuous 24-hour palette (matches meadowShader.ts)
  vec3 skyZenith = sampleCycle(
    h,
    vec3(0.04, 0.08, 0.19),
    vec3(0.16, 0.24, 0.44),
    vec3(0.36, 0.62, 0.86),
    vec3(0.24, 0.58, 0.86),
    vec3(0.24, 0.34, 0.62),
    vec3(0.09, 0.15, 0.32)
  );
  vec3 skyHorizon = sampleCycle(
    h,
    vec3(0.11, 0.20, 0.36),
    vec3(0.76, 0.52, 0.54),
    vec3(0.99, 0.82, 0.70),
    vec3(0.76, 0.90, 0.96),
    vec3(0.98, 0.58, 0.38),
    vec3(0.26, 0.28, 0.48)
  );
  float skyGradeAmt = sampleCycle1(h, 0.78, 0.72, 0.46, 0.0, 0.70, 0.76);

  vec3 groundTint = sampleCycle(
    h,
    vec3(0.28, 0.38, 0.56),
    vec3(0.64, 0.58, 0.65),
    vec3(1.04, 0.96, 0.90),
    vec3(1.00, 1.00, 1.00),
    vec3(1.08, 0.80, 0.64),
    vec3(0.44, 0.48, 0.66)
  );
  vec3 cloudTint = sampleCycle(
    h,
    vec3(0.24, 0.34, 0.54),
    vec3(0.74, 0.60, 0.68),
    vec3(1.05, 0.93, 0.86),
    vec3(1.00, 1.00, 1.00),
    vec3(1.10, 0.74, 0.58),
    vec3(0.40, 0.44, 0.66)
  );
  float cloudAlphaScale = sampleCycle1(h, 0.68, 0.82, 0.96, 1.0, 0.98, 0.78);
  float nightStrength = sampleCycle1(h, 1.0, 0.55, 0.0, 0.0, 0.05, 0.82);

  // Grade sky while preserving painted cloud shading
  float horizonT = smoothstep(0.04, max(horizonY, 0.25), uv.y);
  vec3 targetSky = mix(skyZenith, skyHorizon, horizonT);
  float luma = dot(baseCol, vec3(0.299, 0.587, 0.114));
  vec3 cloudLitSky = targetSky * mix(0.78, 1.24, smoothstep(0.42, 0.95, luma));
  vec3 gradedSky = mix(baseCol, cloudLitSky, skyGradeAmt);

  // Continuous Sun arc (05:30 -> 18:30)
  float sunT = clamp((h - 5.2) / 13.8, 0.0, 1.0);
  float sunElev = sin(sunT * 3.14159265);
  float sunVis = smoothstep(5.1, 6.1, h) * (1.0 - smoothstep(18.0, 19.0, h));
  if (sunVis > 0.005) {
    vec2 sunPos = vec2(mix(0.84, 0.16, sunT), horizonY - 0.04 - sunElev * (horizonY * 0.72));
    float dSun = length((uv - sunPos) * vec2(aspect, 1.0));
    float lowSun = 1.0 - smoothstep(0.12, 0.65, sunElev);
    float sunDisc = smoothstep(0.050, 0.025, dSun) * (0.25 + 0.75 * lowSun);
    float sunHalo = exp(-dSun * mix(5.5, 3.6, lowSun)) * (0.16 + 0.42 * lowSun);
    vec3 sunCol = mix(vec3(1.0, 0.98, 0.90), vec3(1.0, 0.68, 0.40), lowSun);
    gradedSky += sunCol * (sunDisc * 0.68 + sunHalo) * sunVis * skyMask;
  }

  // Continuous Moon arc (18:30 -> 05:30) + twinkling stars
  if (nightStrength > 0.01) {
    float moonH = h >= 18.0 ? (h - 18.0) : (h + 6.0);
    float moonT = clamp(moonH / 12.0, 0.0, 1.0);
    float moonElev = sin(moonT * 3.14159265);
    vec2 moonPos = vec2(mix(0.82, 0.18, moonT), horizonY - 0.05 - moonElev * (horizonY * 0.64));
    float dMoon = length((uv - moonPos) * vec2(aspect, 1.0));
    float moonDisc = smoothstep(0.040, 0.031, dMoon);
    float moonHalo = exp(-dMoon * 5.8) * 0.32;
    gradedSky += vec3(0.93, 0.96, 1.0) * (moonDisc * 0.86 + moonHalo) * nightStrength * skyMask;

    // Twinkling stars
    vec2 starGrid = uv * vec2(96.0, 54.0);
    vec2 cell = floor(starGrid);
    vec2 f = fract(starGrid) - 0.5;
    float rnd = hash21(cell);
    if (rnd > 0.942) {
      float starDist = length(f);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.6 + rnd * 3.2) + rnd * 40.0);
      float star = smoothstep(0.18, 0.02, starDist) * twinkle * smoothstep(horizonY, 0.08, uv.y);
      gradedSky += vec3(0.92, 0.96, 1.0) * star * nightStrength * skyMask;
    }
  }

  vec3 groundCol = baseCol * groundTint;

  // Scene 4 (Mountain Lake): organic 24h water shimmer across the valley lake
  if (uMode > 3.5) {
    float inLakeBox = smoothstep(0.25, 0.31, uv.x) * (1.0 - smoothstep(0.57, 0.64, uv.x))
                    * smoothstep(0.70, 0.73, uv.y) * (1.0 - smoothstep(0.78, 0.82, uv.y));
    float isWater = smoothstep(0.56, 0.78, luma) * smoothstep(-0.02, 0.08, baseCol.b - baseCol.g * 0.92);
    float lakeMask = inLakeBox * isWater;
    if (lakeMask > 0.01) {
      float rip1 = vnoise(vec2(uv.x * 54.0 - uTime * 0.9, uv.y * 92.0 + uTime * 0.3));
      float rip2 = vnoise(vec2(uv.x * 86.0 + uTime * 0.6, uv.y * 128.0 - uTime * 0.4));
      float sparkle = smoothstep(0.62, 0.92, rip1 * 0.55 + rip2 * 0.45) * lakeMask;
      vec3 sheenTint = sampleCycle(
        h,
        vec3(0.76, 0.88, 1.00),
        vec3(0.98, 0.82, 0.74),
        vec3(1.00, 0.95, 0.84),
        vec3(0.98, 1.00, 1.00),
        vec3(1.00, 0.78, 0.54),
        vec3(0.80, 0.86, 1.00)
      );
      groundCol = mix(groundCol, sheenTint, sparkle * 0.48);
    }
  }

  vec3 finalRgb = mix(groundCol, gradedSky, skyMask);

  // Drifting painted cumulus clouds (uCloudTex) smoothly tinted by 24h cycle
  if (uMode > 1.5 && uMode < 2.5) {
    // Scene 2 (Sea of Clouds): 2 lush gliding cloud layers across sky + drifting sea mist over lower clouds
    float upperBand = smoothstep(0.56, 0.36, uv.y);
    if (upperBand > 0.005) {
      float cy = clamp(uv.y / 0.54, 0.002, 0.998);
      float d1 = fract(uv.x - uTime * 0.013);
      float d2 = fract(uv.x * 0.85 + 0.48 - uTime * 0.0075);
      vec4 c1 = texture2D(uCloudTex, vec2(d1, cy));
      vec4 c2 = texture2D(uCloudTex, vec2(d2, clamp(cy * 1.08 + 0.04, 0.002, 0.998)));
      finalRgb = mix(finalRgb, c2.rgb * cloudTint, c2.a * 0.42 * upperBand * cloudAlphaScale);
      finalRgb = mix(finalRgb, c1.rgb * cloudTint, c1.a * 0.68 * upperBand * cloudAlphaScale);
    }

    // Soft drifting mist wisps gliding continuously over the lower sea of clouds
    if (uv.y > 0.38) {
      float seaBand = smoothstep(0.38, 0.58, uv.y);
      float mist1 = vnoise(vec2(uv.x * 4.5 - uTime * 0.16, uv.y * 5.0));
      float mist2 = vnoise(vec2(uv.x * 8.0 - uTime * 0.24 + 3.1, uv.y * 7.5 + 1.4));
      float mist = smoothstep(0.46, 0.84, mist1 * 0.6 + mist2 * 0.4) * seaBand;
      vec3 mistCol = vec3(0.98, 0.99, 1.0) * cloudTint;
      finalRgb = mix(finalRgb, mistCol, mist * 0.24 * cloudAlphaScale);
    }
  } else {
    // Scenes 1, 3, 4: 2-layer painted cumulus clouds drifting smoothly inside skyMask
    float skyCloudRange = max(horizonY + 0.04, 0.36);
    if (uv.y < skyCloudRange && skyMask > 0.02) {
      float cy = clamp(uv.y / skyCloudRange, 0.002, 0.998);
      float d1 = fract(uv.x - uTime * 0.0095);
      float d2 = fract(uv.x * 0.90 + 0.45 - uTime * 0.0052);
      vec4 c1 = texture2D(uCloudTex, vec2(d1, cy));
      vec4 c2 = texture2D(uCloudTex, vec2(d2, clamp(cy * 1.06 + 0.03, 0.002, 0.998)));
      float s1 = uMode > 2.5 && uMode < 3.5 ? 0.36 : 0.42;
      float s2 = uMode > 2.5 && uMode < 3.5 ? 0.20 : 0.24;
      finalRgb = mix(finalRgb, c2.rgb * cloudTint, c2.a * s2 * skyMask * cloudAlphaScale);
      finalRgb = mix(finalRgb, c1.rgb * cloudTint, c1.a * s1 * skyMask * cloudAlphaScale);
    }
  }

  // Floating drifting petals (Scene 1: pale blue wildflowers, Scene 3: pink blossoms)
  if (uMode < 1.5 || (uMode > 2.5 && uMode < 3.5)) {
    vec2 pGrid = uv * vec2(9.0, 5.5) + vec2(-uTime * 0.18, -uTime * 0.10);
    vec2 pCell = floor(pGrid);
    float r = hash21(pCell + vec2(4.3, 8.7));
    if (r > 0.78) {
      vec2 center = vec2(
        0.5 + 0.28 * sin(uTime * (0.9 + r * 0.5) + r * 19.0),
        0.5 + 0.26 * cos(uTime * (0.7 + r * 0.4) + r * 13.0)
      );
      vec2 d = fract(pGrid) - center;
      float ang = uTime * (1.2 + r) + r * 6.28;
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 rd = vec2(d.x * ca - d.y * sa, (d.x * sa + d.y * ca) * 1.9);
      float petal = smoothstep(0.11, 0.025, length(rd));
      vec3 basePetal = uMode < 1.5 ? vec3(0.84, 0.93, 1.0) : vec3(1.0, 0.78, 0.86);
      vec3 petalCol = basePetal * mix(groundTint, vec3(1.0), 0.35);
      finalRgb = mix(finalRgb, petalCol, petal * 0.62);
    }
  }

  // Scene 4 (Hilltop Meadow): gentle sunlit pollen / breeze motes drifting during day & sunset
  if (uMode > 3.5 && nightStrength < 0.75) {
    vec2 mGrid = uv * vec2(11.0, 6.5) + vec2(-uTime * 0.15, -uTime * 0.04);
    vec2 mCell = floor(mGrid);
    float r = hash21(mCell + vec2(9.2, 5.4));
    if (r > 0.80) {
      vec2 center = vec2(
        0.5 + 0.30 * sin(uTime * (0.8 + r * 0.4) + r * 17.0),
        0.5 + 0.26 * cos(uTime * (0.6 + r * 0.4) + r * 23.0)
      );
      float d = length(fract(mGrid) - center);
      float mote = exp(-d * 16.0) * smoothstep(0.45, 0.75, uv.y) * (1.0 - nightStrength);
      finalRgb += vec3(1.0, 0.97, 0.84) * mote * 0.42;
    }
  }

  // Night fireflies drifting softly over meadow/garden foliage (skip high-altitude cloud sea Mode 2) (F64)
  if (nightStrength > 0.12 && uv.y > horizonY + 0.10 && (uMode < 1.5 || uMode > 2.5)) {
    vec2 ffGrid = uv * vec2(18.0, 10.0);
    vec2 ffCell = floor(ffGrid);
    float r = hash21(ffCell + vec2(11.7, 3.3));
    if (r > 0.80) {
      vec2 center = vec2(
        0.5 + 0.30 * sin(uTime * (0.55 + r * 0.5) + r * 19.0),
        0.5 + 0.26 * cos(uTime * (0.45 + r * 0.4) + r * 27.0)
      );
      float d = length(fract(ffGrid) - center);
      float pulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.8 + r * 2.0) + r * 31.0));
      float glow = exp(-d * 14.0) * pulse * smoothstep(horizonY + 0.10, horizonY + 0.24, uv.y);
      finalRgb += vec3(1.0, 0.90, 0.48) * glow * 0.85 * nightStrength;
    }
  }

  gl_FragColor = vec4(finalRgb, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function loadTexture(
  gl: WebGLRenderingContext,
  src: string,
): Promise<{ texture: WebGLTexture; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const texture = gl.createTexture();
      if (!texture) {
        reject(new Error('Failed to create WebGL texture'));
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      resolve({ texture, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function shortestHourDelta(fromH: number, toH: number): number {
  let diff = ((toH - fromH + 12) % 24 + 24) % 24 - 12;
  if (diff < -12) diff += 24;
  return diff;
}

export interface LivingSceneHandle {
  setPaused: (paused: boolean) => void;
  setHour: (hourFloat: number, immediate?: boolean) => void;
  destroy: () => void;
}

export async function mountLivingSceneShader(
  canvas: HTMLCanvasElement,
  imageUrl: string,
  cloudsUrl: string,
  shaderMode: 1 | 2 | 3 | 4,
  initialPaused: boolean,
  initialHour: number,
): Promise<LivingSceneHandle | null> {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  let asset: { texture: WebGLTexture; width: number; height: number };
  let cloudAsset: { texture: WebGLTexture; width: number; height: number };
  try {
    [asset, cloudAsset] = await Promise.all([
      loadTexture(gl, imageUrl),
      loadTexture(gl, cloudsUrl),
    ]);
  } catch {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  gl.useProgram(program);
  const posLoc = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, asset.texture);
  gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, cloudAsset.texture);
  gl.uniform1i(gl.getUniformLocation(program, 'uCloudTex'), 1);

  gl.uniform1f(gl.getUniformLocation(program, 'uMode'), shaderMode);
  gl.uniform2f(gl.getUniformLocation(program, 'uImgSize'), asset.width, asset.height);

  const uTime = gl.getUniformLocation(program, 'uTime');
  const uHour = gl.getUniformLocation(program, 'uHour');
  const uCanvasSize = gl.getUniformLocation(program, 'uCanvasSize');

  let paused = initialPaused;
  let displayHour = initialHour;
  let targetHour = initialHour;
  let destroyed = false;
  let rafId = 0;
  let elapsedSeconds = 0;
  let lastFrameMs = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uCanvasSize, width, height);
  };

  const renderFrame = () => {
    resize();
    gl.uniform1f(uTime, elapsedSeconds);
    gl.uniform1f(uHour, displayHour);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const tick = (nowMs: number) => {
    if (destroyed || paused) return;
    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
    lastFrameMs = nowMs;
    elapsedSeconds += dt;

    const diff = shortestHourDelta(displayHour, targetHour);
    if (Math.abs(diff) > 0.002) {
      displayHour = (displayHour + diff * Math.min(1, dt * 3.8) + 24) % 24;
    } else {
      displayHour = targetHour;
    }

    renderFrame();
    rafId = window.requestAnimationFrame(tick);
  };

  const onResize = () => renderFrame();
  window.addEventListener('resize', onResize);

  renderFrame();
  if (!paused) {
    lastFrameMs = performance.now();
    rafId = window.requestAnimationFrame(tick);
  }

  return {
    setPaused(nextPaused: boolean) {
      paused = nextPaused;
      if (paused) {
        window.cancelAnimationFrame(rafId);
        renderFrame();
      } else if (!destroyed) {
        lastFrameMs = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    },
    setHour(nextHour: number, immediate = false) {
      targetHour = ((nextHour % 24) + 24) % 24;
      if (immediate || paused) {
        displayHour = targetHour;
        if (!destroyed) renderFrame();
      }
    },
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      gl.deleteTexture(asset.texture);
      gl.deleteTexture(cloudAsset.texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
