/**
 * Zero-dependency WebGL 24-hour living-scene renderer for all 4 scenic backgrounds:
 * Mirrors meadowShader.ts with the same C1-continuous 6-keyframe 24-hour atmosphere
 * (Midnight -> Pre-Dawn -> Golden Morning -> Cerulean Day -> Golden Sunset -> Twilight),
 * continuous Sun/Moon orbital arcs, twinkling night stars, night fireflies,
 * and scene-tailored organic foliage/cloud breeze motion.
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

  // Per-scene horizon & organic wind motion
  float horizonY = 0.45;
  vec2 sampleUv = uv;

  if (uMode < 1.5) {
    // Scene 1: Blue wildflower meadow
    horizonY = 0.41;
    float flowerMask = smoothstep(0.42, 0.78, uv.y);
    float swayX = sin(uv.x * 9.5 - uTime * 1.2 + uv.y * 3.0) * 0.0028 * flowerMask;
    float swayY = cos(uv.x * 6.0 - uTime * 0.9) * 0.0010 * flowerMask;
    sampleUv = clamp(uv + vec2(swayX, swayY), 0.001, 0.999);
  } else if (uMode < 2.5) {
    // Scene 2: Sea of clouds above river valley
    horizonY = 0.46;
    float cloudMask = smoothstep(0.44, 0.70, uv.y);
    float driftX = sin(uv.y * 10.0 + uTime * 0.45) * 0.0024 * cloudMask;
    float breatheY = cos(uv.x * 4.0 - uTime * 0.4) * 0.0010 * cloudMask;
    sampleUv = clamp(uv + vec2(driftX, breatheY), 0.001, 0.999);
  } else if (uMode < 3.5) {
    // Scene 3: Pink rhododendron flower garden (upper-center sky gap)
    horizonY = mix(0.28, 0.48, exp(-pow((uv.x - 0.50) * 3.0, 2.0)));
    float bushMask = smoothstep(horizonY - 0.02, horizonY + 0.14, uv.y);
    float swayX = sin(uv.y * 8.5 + uTime * 1.15 + uv.x * 4.0) * 0.0026 * bushMask;
    float swayY = cos(uv.x * 6.5 + uTime * 0.85) * 0.0011 * bushMask;
    sampleUv = clamp(uv + vec2(swayX, swayY), 0.001, 0.999);
  } else {
    // Scene 4: Hilltop meadow overlooking lake & big cumulus clouds
    horizonY = 0.60;
    float grassMask = smoothstep(0.66, 0.86, uv.y);
    float grassSway = sin(uv.x * 13.0 - uTime * 1.35) * 0.0030 * grassMask;
    float grassY = cos(uv.x * 7.5 - uTime * 1.0) * 0.0010 * grassMask;
    sampleUv = clamp(uv + vec2(grassSway, grassY), 0.001, 0.999);
  }

  vec3 baseCol = texture2D(uTex, sampleUv).rgb;

  // Detect sky pixels smoothly using horizon + sky-blue/bright-cloud luminance heuristic
  float aboveHorizon = 1.0 - smoothstep(horizonY - 0.10, horizonY + 0.06, uv.y);
  float blueDominance = smoothstep(-0.04, 0.14, baseCol.b - max(baseCol.r, baseCol.g) * 0.85);
  float brightCloud = smoothstep(0.68, 0.92, (baseCol.r + baseCol.g + baseCol.b) / 3.0);
  float skyMask = aboveHorizon * clamp(blueDominance + brightCloud * 0.85, 0.35, 1.0);

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
  vec3 finalRgb = mix(groundCol, gradedSky, skyMask);

  // Night fireflies drifting softly over lower ground/foliage
  if (nightStrength > 0.12 && uv.y > horizonY + 0.10) {
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
  try {
    asset = await loadTexture(gl, imageUrl);
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
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
