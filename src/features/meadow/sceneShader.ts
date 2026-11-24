import type { LivingShaderMode } from './sceneCatalog';

/**
 * Zero-dependency WebGL 24-hour living-scene renderer supporting all 8 bespoke scenic worlds:
 * - Mode 1: Blue wildflower meadow (foreground flower breeze + pale-blue petals + night fireflies)
 * - Mode 2: Sea of clouds above river valley (2 drifting cloud layers + valley sea mist)
 * - Mode 3: Pink rhododendron hillside garden (coherent canopy breeze + pink petals + night fireflies)
 * - Mode 4: Hilltop meadow overlooking mountain lake (hill grass sway + lake shimmer + sunlit pollen + fireflies)
 * - Mode 5: Coastal Lighthouse & Turquoise Ocean (ocean shimmer + rotating night lighthouse beam + cliff breeze)
 * - Mode 6: Kyoto Crimson Bridge & Sakura Canal (falling sakura petals + canal shimmer + 4 glowing night lanterns)
 * - Mode 7: Snowy Alpine Peaks & Cabin Mirror Lake (gentle snow + nighttime Aurora Borealis + warm cabin hearth)
 * - Mode 8: Seaside Train Station & Shallow Ocean Tracks (shallow sea sparkle + warm night platform lamp pool)
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
  return vec2((uv.x - 0.5) * scale.x + 0.5, (uv.y - 0.5) * scale.y + 0.5);
}

// 6 circular 24-hour keyframes:
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

float warmLampGlow(vec2 uv, vec2 pos, float radius, float aspect) {
  float d = length((uv - pos) * vec2(aspect, 1.0));
  return exp(-d / max(radius, 0.005));
}

void main() {
  vec2 uv = coverUv(vUv, uCanvasSize, uImgSize);
  float h = mod(uHour, 24.0);
  float aspect = uImgSize.x / max(uImgSize.y, 1.0);

  float horizonY = 0.45;
  vec2 sampleUv = uv;

  if (uMode < 1.5) {
    // Mode 1: Blue wildflower meadow
    horizonY = 0.41;
    float flowerMask = smoothstep(0.50, 0.84, uv.y);
    float gust = sin(uv.x * 3.8 - uTime * 1.10) * 0.65 + sin(uv.x * 7.2 - uTime * 1.55) * 0.35;
    sampleUv = clamp(uv + vec2(gust * 0.0019 * flowerMask, cos(uv.x * 3.8 - uTime * 1.10) * 0.0005 * flowerMask), 0.001, 0.999);
  } else if (uMode < 2.5) {
    // Mode 2: Sea of clouds above river valley
    horizonY = 0.46;
    vec3 probe = texture2D(uTex, uv).rgb;
    float isCloudPuff = smoothstep(0.68, 0.86, (probe.r + probe.g + probe.b) / 3.0) * smoothstep(0.42, 0.62, uv.y);
    sampleUv = clamp(uv + vec2(sin(uv.x * 3.0 - uTime * 0.55) * 0.0042 * isCloudPuff, cos(uv.x * 2.4 - uTime * 0.42) * 0.0018 * isCloudPuff), 0.001, 0.999);
  } else if (uMode < 3.5) {
    // Mode 3: Pink rhododendron hillside garden
    horizonY = mix(0.28, 0.48, exp(-pow((uv.x - 0.50) * 3.0, 2.0)));
    float sideFoliage = smoothstep(0.10, 0.34, abs(uv.x - 0.55));
    float pathExclusion = 1.0 - smoothstep(0.66, 0.84, uv.y) * (1.0 - smoothstep(0.06, 0.22, abs(uv.x - 0.56)));
    float upperCanopy = smoothstep(0.96, 0.35, uv.y) * smoothstep(0.08, 0.26, uv.y);
    float branchMask = sideFoliage * pathExclusion * upperCanopy;
    float breeze = sin(uTime * 0.85 + uv.x * 2.1) * 0.7 + sin(uTime * 1.35 - uv.x * 1.4) * 0.3;
    sampleUv = clamp(uv + vec2(breeze * 0.0013 * branchMask, cos(uTime * 0.85 + uv.x * 2.1) * 0.0004 * branchMask), 0.001, 0.999);
  } else if (uMode < 4.5) {
    // Mode 4: Hilltop meadow overlooking lake & cumulus clouds
    horizonY = 0.60;
    float lakeHole = 1.0 - smoothstep(0.24, 0.30, uv.x) * (1.0 - smoothstep(0.58, 0.65, uv.x)) * smoothstep(0.68, 0.73, uv.y) * (1.0 - smoothstep(0.79, 0.84, uv.y));
    float grassMask = smoothstep(0.70, 0.88, uv.y) * lakeHole;
    float gust = sin(uv.x * 4.2 - uTime * 1.35) * 0.68 + sin(uv.x * 8.4 - uTime * 1.85) * 0.32;
    sampleUv = clamp(uv + vec2(gust * 0.0024 * grassMask, cos(uv.x * 4.2 - uTime * 1.15) * 0.0006 * grassMask), 0.001, 0.999);
  } else if (uMode < 5.5) {
    // Mode 5: Coastal Lighthouse & Turquoise Ocean
    horizonY = 0.568;
    float cliffGrass = smoothstep(0.56, 0.72, uv.x) * smoothstep(0.45, 0.75, uv.y);
    float gust = sin(uv.x * 4.5 - uTime * 1.15) * 0.65 + sin(uv.x * 8.0 - uTime * 1.65) * 0.35;
    sampleUv = clamp(uv + vec2(gust * 0.0016 * cliffGrass, 0.0), 0.001, 0.999);
  } else if (uMode < 6.5) {
    // Mode 6: Kyoto Crimson Bridge & Sakura Canal
    horizonY = 0.46;
    float canopy = smoothstep(0.16, 0.34, abs(uv.x - 0.5)) * smoothstep(0.58, 0.22, uv.y);
    sampleUv = clamp(uv + vec2(sin(uTime * 0.85 + uv.x * 2.4) * 0.0012 * canopy, 0.0), 0.001, 0.999);
  } else if (uMode < 7.5) {
    // Mode 7: Snowy Alpine Peaks & Cabin Mirror Lake
    horizonY = 0.48;
    float lakeRippleMask = smoothstep(0.71, 0.78, uv.y) * smoothstep(0.18, 0.34, uv.x);
    sampleUv = clamp(uv + vec2(sin(uv.y * 95.0 - uTime * 1.4 + uv.x * 12.0) * 0.0009 * lakeRippleMask, 0.0), 0.001, 0.999);
  } else {
    // Mode 8: Seaside Train Station & Shallow Ocean Tracks
    horizonY = 0.518;
    float waterMask = smoothstep(0.52, 0.58, uv.y) * smoothstep(0.32, 0.44, uv.x);
    sampleUv = clamp(uv + vec2(sin(uv.y * 65.0 - uTime * 1.5 + uv.x * 9.0) * 0.0011 * waterMask, 0.0), 0.001, 0.999);
  }

  vec3 baseCol = texture2D(uTex, sampleUv).rgb;

  // Detect sky pixels smoothly while protecting iconic bright structures in Modes 5, 7, 8
  float aboveHorizon = 1.0 - smoothstep(horizonY - 0.09, horizonY + 0.05, uv.y);
  float blueDominance = smoothstep(-0.04, 0.13, baseCol.b - max(baseCol.r, baseCol.g) * 0.85);
  float brightCloud = smoothstep(0.69, 0.92, (baseCol.r + baseCol.g + baseCol.b) / 3.0);

  float structureProtect = 1.0;
  if (uMode > 4.5 && uMode < 5.5) {
    // Mode 5: Protect white lighthouse tower from sky grading
    float inTower = smoothstep(0.77, 0.80, uv.x) * (1.0 - smoothstep(0.855, 0.885, uv.x)) * smoothstep(0.03, 0.09, uv.y);
    structureProtect = 1.0 - inTower * 0.95;
  } else if (uMode > 6.5 && uMode < 7.5) {
    // Mode 7: Protect bright snowy alpine peaks below ridge
    float peakMask = smoothstep(0.24, 0.46, uv.y) * (1.0 - blueDominance);
    structureProtect = 1.0 - peakMask * 0.85;
  } else if (uMode > 7.5) {
    // Mode 8: Protect wooden station roof & lamp post on left third
    float inStation = (1.0 - smoothstep(0.30, 0.36, uv.x)) * smoothstep(0.08, 0.14, uv.y);
    structureProtect = 1.0 - inStation * 0.85;
  }
  float skyMask = aboveHorizon * clamp(blueDominance + brightCloud * 0.88, 0.0, 1.0) * structureProtect;

  // Continuous 24-hour palette
  vec3 skyZenith = sampleCycle(
    h,
    vec3(0.03, 0.07, 0.18),
    vec3(0.16, 0.24, 0.44),
    vec3(0.36, 0.62, 0.86),
    vec3(0.24, 0.58, 0.86),
    vec3(0.24, 0.34, 0.62),
    vec3(0.08, 0.14, 0.30)
  );
  vec3 skyHorizon = sampleCycle(
    h,
    vec3(0.10, 0.19, 0.35),
    vec3(0.76, 0.52, 0.54),
    vec3(0.99, 0.82, 0.70),
    vec3(0.76, 0.90, 0.96),
    vec3(0.98, 0.56, 0.36),
    vec3(0.24, 0.26, 0.46)
  );
  float skyGradeAmt = sampleCycle1(h, 0.82, 0.72, 0.46, 0.0, 0.72, 0.78);

  vec3 groundTint = sampleCycle(
    h,
    vec3(0.26, 0.36, 0.54),
    vec3(0.64, 0.58, 0.66),
    vec3(1.04, 0.96, 0.90),
    vec3(1.00, 1.00, 1.00),
    vec3(1.08, 0.78, 0.62),
    vec3(0.42, 0.46, 0.64)
  );
  vec3 cloudTint = sampleCycle(
    h,
    vec3(0.22, 0.32, 0.52),
    vec3(0.74, 0.60, 0.68),
    vec3(1.05, 0.93, 0.86),
    vec3(1.00, 1.00, 1.00),
    vec3(1.10, 0.72, 0.56),
    vec3(0.38, 0.42, 0.64)
  );
  float cloudAlphaScale = sampleCycle1(h, 0.66, 0.82, 0.95, 1.0, 0.96, 0.76);
  float nightStrength = sampleCycle1(h, 1.0, 0.55, 0.0, 0.0, 0.08, 0.84);
  float duskLampStrength = sampleCycle1(h, 1.0, 0.68, 0.08, 0.0, 0.52, 0.92);

  // Grade sky while preserving painted cloud depth
  float horizonT = smoothstep(0.04, max(horizonY, 0.28), uv.y);
  vec3 targetSky = mix(skyZenith, skyHorizon, horizonT);
  float luma = dot(baseCol, vec3(0.299, 0.587, 0.114));
  vec3 cloudLitSky = targetSky * mix(0.78, 1.24, smoothstep(0.42, 0.95, luma));
  vec3 gradedSky = mix(baseCol, cloudLitSky, skyGradeAmt);

  // Continuous Sun arc (05:30 -> 18:30)
  float sunT = clamp((h - 5.2) / 13.8, 0.0, 1.0);
  float sunElev = sin(sunT * 3.14159265);
  float sunVis = smoothstep(5.1, 6.1, h) * (1.0 - smoothstep(18.0, 19.0, h));
  if (sunVis > 0.005) {
    vec2 sunPos = vec2(mix(0.82, 0.18, sunT), horizonY - 0.05 - sunElev * (horizonY * 0.70));
    float dSun = length((uv - sunPos) * vec2(aspect, 1.0));
    float lowSun = 1.0 - smoothstep(0.12, 0.65, sunElev);
    float sunDisc = smoothstep(0.048, 0.024, dSun) * (0.25 + 0.75 * lowSun);
    float sunHalo = exp(-dSun * mix(5.5, 3.6, lowSun)) * (0.16 + 0.42 * lowSun);
    vec3 sunCol = mix(vec3(1.0, 0.98, 0.90), vec3(1.0, 0.66, 0.38), lowSun);
    gradedSky += sunCol * (sunDisc * 0.68 + sunHalo) * sunVis * skyMask;
  }

  // Continuous Moon arc (18:30 -> 05:30) + twinkling stars
  if (nightStrength > 0.01) {
    float moonH = h >= 18.0 ? (h - 18.0) : (h + 6.0);
    float moonT = clamp(moonH / 12.0, 0.0, 1.0);
    float moonElev = sin(moonT * 3.14159265);
    vec2 moonPos = vec2(mix(0.78, 0.22, moonT), horizonY - 0.06 - moonElev * (horizonY * 0.62));
    float dMoon = length((uv - moonPos) * vec2(aspect, 1.0));
    float moonDisc = smoothstep(0.038, 0.029, dMoon);
    float moonHalo = exp(-dMoon * 5.8) * 0.30;
    gradedSky += vec3(0.93, 0.96, 1.0) * (moonDisc * 0.84 + moonHalo) * nightStrength * skyMask;

    vec2 starGrid = uv * vec2(96.0, 54.0);
    vec2 cell = floor(starGrid);
    vec2 f = fract(starGrid) - 0.5;
    float rnd = hash21(cell);
    if (rnd > 0.942) {
      float starDist = length(f);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.6 + rnd * 3.2) + rnd * 40.0);
      float star = smoothstep(0.18, 0.02, starDist) * twinkle * smoothstep(horizonY, 0.06, uv.y);
      gradedSky += vec3(0.92, 0.96, 1.0) * star * nightStrength * skyMask;
    }
  }

  // Mode 7 (Snowy Alpine Peaks): Shimmering nighttime Aurora Borealis across the upper sky
  if (uMode > 6.5 && uMode < 7.5 && nightStrength > 0.08) {
    float bandY = 0.17 + 0.05 * sin(uv.x * 5.2 + uTime * 0.28) + 0.03 * cos(uv.x * 9.0 - uTime * 0.19);
    float ribbon = exp(-pow((uv.y - bandY) * 11.0, 2.0));
    float curtain = 0.55 + 0.45 * vnoise(vec2(uv.x * 10.0 - uTime * 0.22, uv.y * 3.5));
    float aurora = ribbon * curtain * skyMask * nightStrength;
    vec3 auroraCol = mix(vec3(0.18, 0.92, 0.68), vec3(0.56, 0.46, 0.96), smoothstep(0.08, 0.30, uv.y));
    gradedSky += auroraCol * aurora * 0.58;
  }

  vec3 groundCol = baseCol * groundTint;

  // Shared 24h water shimmer tint
  vec3 sheenTint = sampleCycle(
    h,
    vec3(0.76, 0.88, 1.00),
    vec3(0.98, 0.80, 0.72),
    vec3(1.00, 0.95, 0.84),
    vec3(0.98, 1.00, 1.00),
    vec3(1.00, 0.76, 0.50),
    vec3(0.78, 0.86, 1.00)
  );

  // Per-scene water shimmer
  if (uMode > 3.5 && uMode < 4.5) {
    // Mode 4: Valley lake shimmer
    float inLakeBox = smoothstep(0.25, 0.31, uv.x) * (1.0 - smoothstep(0.57, 0.64, uv.x))
                    * smoothstep(0.70, 0.73, uv.y) * (1.0 - smoothstep(0.78, 0.82, uv.y));
    float isWater = smoothstep(0.56, 0.78, luma) * smoothstep(-0.02, 0.08, baseCol.b - baseCol.g * 0.92);
    float lakeMask = inLakeBox * isWater;
    if (lakeMask > 0.01) {
      float rip1 = vnoise(vec2(uv.x * 54.0 - uTime * 0.9, uv.y * 92.0 + uTime * 0.3));
      float rip2 = vnoise(vec2(uv.x * 86.0 + uTime * 0.6, uv.y * 128.0 - uTime * 0.4));
      float sparkle = smoothstep(0.62, 0.92, rip1 * 0.55 + rip2 * 0.45) * lakeMask;
      groundCol = mix(groundCol, sheenTint, sparkle * 0.48);
    }
  } else if (uMode > 4.5 && uMode < 5.5) {
    // Mode 5: Ocean shimmer left of cliffs
    float oceanMask = smoothstep(0.568, 0.60, uv.y) * (1.0 - smoothstep(0.52, 0.64, uv.x));
    if (oceanMask > 0.01) {
      float r1 = vnoise(vec2(uv.x * 48.0 - uTime * 0.85, uv.y * 86.0 + uTime * 0.25));
      float r2 = vnoise(vec2(uv.x * 78.0 + uTime * 0.55, uv.y * 120.0 - uTime * 0.35));
      float sparkle = smoothstep(0.60, 0.90, r1 * 0.55 + r2 * 0.45) * oceanMask;
      groundCol = mix(groundCol, sheenTint, sparkle * 0.42);
    }
  } else if (uMode > 5.5 && uMode < 6.5) {
    // Mode 6: Kyoto canal shimmer under crimson bridge
    float canalMask = smoothstep(0.70, 0.78, uv.y) * smoothstep(0.10, 0.24, uv.x) * (1.0 - smoothstep(0.76, 0.90, uv.x));
    if (canalMask > 0.01) {
      float r1 = vnoise(vec2(uv.x * 42.0 - uTime * 0.6, uv.y * 74.0 + uTime * 0.25));
      float sparkle = smoothstep(0.62, 0.90, r1) * canalMask;
      groundCol = mix(groundCol, sheenTint, sparkle * 0.32);
    }
  } else if (uMode > 6.5 && uMode < 7.5) {
    // Mode 7: Mirror lake aurora reflection at night
    float lakeMask = smoothstep(0.72, 0.78, uv.y) * smoothstep(0.20, 0.36, uv.x);
    if (lakeMask > 0.01 && nightStrength > 0.08) {
      float shimmer = 0.5 + 0.5 * sin(uv.x * 16.0 + uTime * 0.65);
      groundCol += vec3(0.14, 0.65, 0.52) * shimmer * lakeMask * nightStrength * 0.16;
    }
  } else if (uMode > 7.5) {
    // Mode 8: Shallow crystal turquoise water sparkle along ocean horizon & tracks
    float seaMask = smoothstep(0.52, 0.56, uv.y) * smoothstep(0.32, 0.46, uv.x);
    if (seaMask > 0.01) {
      float r1 = vnoise(vec2(uv.x * 56.0 - uTime * 0.95, uv.y * 92.0 + uTime * 0.3));
      float r2 = vnoise(vec2(uv.x * 90.0 + uTime * 0.65, uv.y * 130.0 - uTime * 0.4));
      float sparkle = smoothstep(0.58, 0.88, r1 * 0.55 + r2 * 0.45) * seaMask;
      groundCol = mix(groundCol, sheenTint, sparkle * 0.46);
    }
  }

  vec3 finalRgb = mix(groundCol, gradedSky, skyMask);

  // Drifting painted cumulus clouds tinted by 24h cycle
  if (uMode > 1.5 && uMode < 2.5) {
    // Mode 2 (Sea of Clouds): 2 lush gliding cloud layers + drifting valley mist
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
    if (uv.y > 0.38) {
      float seaBand = smoothstep(0.38, 0.58, uv.y);
      float mist1 = vnoise(vec2(uv.x * 4.5 - uTime * 0.16, uv.y * 5.0));
      float mist2 = vnoise(vec2(uv.x * 8.0 - uTime * 0.24 + 3.1, uv.y * 7.5 + 1.4));
      float mist = smoothstep(0.46, 0.84, mist1 * 0.6 + mist2 * 0.4) * seaBand;
      finalRgb = mix(finalRgb, vec3(0.98, 0.99, 1.0) * cloudTint, mist * 0.24 * cloudAlphaScale);
    }
  } else {
    float skyCloudRange = max(horizonY + 0.03, 0.38);
    if (uv.y < skyCloudRange && skyMask > 0.02) {
      float cy = clamp(uv.y / skyCloudRange, 0.002, 0.998);
      float d1 = fract(uv.x - uTime * 0.009);
      float d2 = fract(uv.x * 0.88 + 0.46 - uTime * 0.005);
      vec4 c1 = texture2D(uCloudTex, vec2(d1, cy));
      vec4 c2 = texture2D(uCloudTex, vec2(d2, clamp(cy * 1.06 + 0.03, 0.002, 0.998)));
      finalRgb = mix(finalRgb, c2.rgb * cloudTint, c2.a * 0.22 * skyMask * cloudAlphaScale);
      finalRgb = mix(finalRgb, c1.rgb * cloudTint, c1.a * 0.38 * skyMask * cloudAlphaScale);
    }
  }

  // Signature 24h practical lights turning on at dusk & night for Modes 5..8
  if (duskLampStrength > 0.02) {
    if (uMode > 4.5 && uMode < 5.5) {
      // Mode 5: Rotating Coastal Lighthouse Beam from lantern room (0.823, 0.112)
      vec2 lamp = vec2(0.823, 0.112);
      vec2 rel = (uv - lamp) * vec2(aspect, 1.0);
      float dist = length(rel);
      float core = exp(-dist * 24.0) * 1.15 + exp(-dist * 7.5) * 0.35;
      float beamAngle = -2.75 + sin(uTime * 0.55) * 0.34;
      vec2 dir = vec2(cos(beamAngle), sin(beamAngle));
      float along = dot(rel, dir);
      float perp = abs(rel.x * (-dir.y) + rel.y * dir.x);
      float coneWidth = 0.018 + max(along, 0.0) * 0.16;
      float beam = smoothstep(coneWidth, coneWidth * 0.15, perp) * smoothstep(0.0, 0.04, along) * exp(-max(along, 0.0) * 1.15);
      finalRgb += vec3(1.0, 0.92, 0.70) * (core + beam * 0.52) * duskLampStrength;
    } else if (uMode > 5.5 && uMode < 6.5) {
      // Mode 6: 4 glowing Kyoto stone lanterns
      float flicker = 0.92 + 0.08 * sin(uTime * 4.5 + uv.x * 18.0);
      float g1 = warmLampGlow(uv, vec2(0.072, 0.680), 0.055, aspect);
      float g2 = warmLampGlow(uv, vec2(0.197, 0.635), 0.036, aspect);
      float g3 = warmLampGlow(uv, vec2(0.842, 0.648), 0.036, aspect);
      float g4 = warmLampGlow(uv, vec2(0.938, 0.692), 0.058, aspect);
      finalRgb += vec3(1.0, 0.74, 0.34) * (g1 + g2 * 0.75 + g3 * 0.75 + g4) * flicker * 0.72 * duskLampStrength;
    } else if (uMode > 6.5 && uMode < 7.5) {
      // Mode 7: Warm golden alpine cabin windows
      float w1 = warmLampGlow(uv, vec2(0.136, 0.722), 0.028, aspect);
      float w2 = warmLampGlow(uv, vec2(0.162, 0.722), 0.028, aspect);
      float w3 = warmLampGlow(uv, vec2(0.214, 0.722), 0.034, aspect);
      float w4 = warmLampGlow(uv, vec2(0.214, 0.665), 0.022, aspect);
      float hearth = (w1 + w2 + w3 + w4 * 0.7) * (0.94 + 0.06 * sin(uTime * 3.2));
      finalRgb += vec3(1.0, 0.76, 0.36) * hearth * 0.78 * duskLampStrength;
    } else if (uMode > 7.5) {
      // Mode 8: Classic Seaside Train Station lamp at (0.166, 0.195) + warm pool on wooden bench
      float bulb = warmLampGlow(uv, vec2(0.166, 0.195), 0.048, aspect);
      float halo = warmLampGlow(uv, vec2(0.166, 0.24), 0.18, aspect);
      float benchPool = warmLampGlow(uv, vec2(0.20, 0.60), 0.16, aspect);
      finalRgb += vec3(1.0, 0.80, 0.44) * (bulb * 0.95 + halo * 0.34 + benchPool * 0.22) * duskLampStrength;
    }
  }

  // Drifting petals (Mode 1: pale blue wildflowers, Mode 3 & 6: pink blossoms/sakura)
  if (uMode < 1.5 || (uMode > 2.5 && uMode < 3.5) || (uMode > 5.5 && uMode < 6.5)) {
    vec2 pGrid = uv * vec2(9.2, 5.6) + vec2(-uTime * 0.17, -uTime * 0.12);
    vec2 pCell = floor(pGrid);
    float r = hash21(pCell + vec2(4.3, 8.7));
    if (r > 0.77) {
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
      vec3 basePetal = uMode < 1.5 ? vec3(0.84, 0.93, 1.0) : vec3(1.0, 0.79, 0.87);
      vec3 petalCol = basePetal * mix(groundTint, vec3(1.0), 0.38);
      finalRgb = mix(finalRgb, petalCol, petal * 0.65);
    }
  }

  // Mode 4 (Hilltop Meadow): gentle sunlit pollen motes during day & sunset
  if (uMode > 3.5 && uMode < 4.5 && nightStrength < 0.75) {
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

  // Mode 7 (Snowy Alpine Peaks): delicate winter snowflakes drifting gently
  if (uMode > 6.5 && uMode < 7.5) {
    vec2 sGrid = uv * vec2(15.0, 9.0) + vec2(-uTime * 0.09, -uTime * 0.24);
    vec2 sCell = floor(sGrid);
    float r = hash21(sCell + vec2(7.1, 2.9));
    if (r > 0.72) {
      vec2 center = vec2(
        0.5 + 0.26 * sin(uTime * (0.8 + r * 0.4) + r * 21.0),
        0.5 + 0.22 * cos(uTime * (0.6 + r * 0.3) + r * 11.0)
      );
      float flake = smoothstep(0.095, 0.02, length(fract(sGrid) - center));
      finalRgb = mix(finalRgb, vec3(0.96, 0.98, 1.0), flake * 0.65);
    }
  }

  // Night fireflies over meadow/garden scenes (Modes 1, 3, 4)
  if (nightStrength > 0.12 && uv.y > horizonY + 0.10 && (uMode < 1.5 || (uMode > 2.5 && uMode < 4.5))) {
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
  shaderMode: LivingShaderMode,
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
