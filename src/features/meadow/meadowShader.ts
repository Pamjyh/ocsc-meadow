/**
 * Zero-dependency WebGL renderer with AAA-grade C1-continuous 24-hour atmosphere:
 * - Circular 6-keyframe Hermite-interpolated palette (zero overlap dips or color seams)
 * - Continuous orbital arcs for Sun (05:30->18:30) and Moon (18:30->05:30)
 * - Smoothly eased displayHour so preset switches glide like a timelapse
 * - Actual painted clouds, 131 individually swaying flowers, and organic FBM creek
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

uniform sampler2D uBaseTex;
uniform sampler2D uCloudTex;
uniform sampler2D uMaskTex;
uniform float uTime;
uniform float uHour;
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

float waterFbm(vec2 p) {
  float v = 0.0;
  v += 0.55 * vnoise(p);
  v += 0.30 * vnoise(p * 2.07 + vec2(4.1, 1.7));
  v += 0.15 * vnoise(p * 4.13 + vec2(-2.3, 5.4));
  return v;
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
  float y = 1.0 - (1.0 - uv.y) * scale.y;
  return vec2(x, y);
}

// Smoothstep-eased interpolation between 6 circular 24-hour keyframes:
// K0: 00:00 Midnight | K1: 05:30 Pre-Dawn | K2: 07:00 Golden Morning
// K3: 12:30 Cerulean Day | K4: 17:45 Golden Sunset | K5: 19:15 Twilight -> K0: 24:00
vec3 sampleCycle(float h, vec3 k0, vec3 k1, vec3 k2, vec3 k3, vec3 k4, vec3 k5) {
  if (h < 5.5) {
    float t = smoothstep(0.0, 5.5, h);
    return mix(k0, k1, t);
  }
  if (h < 7.0) {
    float t = smoothstep(5.5, 7.0, h);
    return mix(k1, k2, t);
  }
  if (h < 12.5) {
    float t = smoothstep(7.0, 12.5, h);
    return mix(k2, k3, t);
  }
  if (h < 17.75) {
    float t = smoothstep(12.5, 17.75, h);
    return mix(k3, k4, t);
  }
  if (h < 19.25) {
    float t = smoothstep(17.75, 19.25, h);
    return mix(k4, k5, t);
  }
  float t = smoothstep(19.25, 24.0, h);
  return mix(k5, k0, t);
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
  vec3 mask = texture2D(uMaskTex, uv).rgb;
  float h = mod(uHour, 24.0);

  // Continuous C1-smooth atmospheric parameters across the full 24h cycle
  // Keyframes: Midnight(0), PreDawn(5.5), Morning(7.0), Day(12.5), Sunset(17.75), Twilight(19.25)
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
  // 0.0 during bright midday so original painted sky stays 100% pure; rises smoothly toward dawn/sunset/night
  float skyGradeAmt = sampleCycle1(h, 0.95, 0.86, 0.58, 0.0, 0.84, 0.92);

  vec3 groundTint = sampleCycle(
    h,
    vec3(0.26, 0.36, 0.54),
    vec3(0.62, 0.58, 0.64),
    vec3(1.04, 0.96, 0.90),
    vec3(1.00, 1.00, 1.00),
    vec3(1.08, 0.80, 0.64),
    vec3(0.42, 0.46, 0.64)
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

  float flowerWeight = mask.r;
  float flowerPhase = mask.g * 6.2831853;
  float creekMask = mask.b;

  // 1. Sloping hill boundary & subtle grass breeze
  float hillLine = mix(0.775, 0.682, clamp(uv.x, 0.0, 1.0));
  float meadowMask = smoothstep(hillLine - 0.01, hillLine + 0.045, uv.y) * (1.0 - creekMask);
  float skyMask = 1.0 - smoothstep(hillLine - 0.14, hillLine + 0.01, uv.y);
  float grassWave = sin(uv.x * 10.0 - uTime * 1.15) * 0.0018 * meadowMask;

  // 2. Individual flower-by-flower sway (flat-top rigid head)
  float fFreq = 1.55 + mask.g * 1.15;
  float fSwayX = sin(uTime * fFreq + flowerPhase) * 0.0034 * flowerWeight;
  float fSwayY = cos(uTime * fFreq * 1.15 + flowerPhase) * 0.0010 * flowerWeight;

  vec2 meadowUv = vec2(
    clamp(uv.x + grassWave + fSwayX, 0.001, 0.999),
    clamp(uv.y + fSwayY, 0.001, 0.999)
  );
  vec3 baseCol = texture2D(uBaseTex, meadowUv).rgb;

  // 3. Organic FBM creek flow
  if (creekMask > 0.01) {
    vec2 flowDir = vec2(-0.88, 0.44);
    vec2 perpDir = vec2(-flowDir.y, flowDir.x);
    float s = dot(uv, flowDir);
    float c = dot(uv, perpDir);

    vec2 pA = vec2(s * 24.0 - uTime * 1.45, c * 46.0);
    vec2 pB = vec2(s * 38.0 - uTime * 2.05, c * 68.0 + 7.3);
    float n1 = waterFbm(pA);
    float n2 = waterFbm(pB + vec2(n1 * 1.4, -n1 * 0.8));

    vec2 refrUv = clamp(
      uv + perpDir * ((n1 - 0.5) * 0.0042 * creekMask)
         + flowDir * ((n2 - 0.5) * 0.0026 * creekMask),
      0.001,
      0.999
    );
    vec3 waterCol = texture2D(uBaseTex, refrUv).rgb;
    float shade = smoothstep(0.20, 0.55, n1);
    waterCol = mix(waterCol * vec3(0.86, 0.93, 0.99), waterCol, shade);

    vec3 sheenTint = sampleCycle(
      h,
      vec3(0.76, 0.86, 1.00),
      vec3(0.96, 0.80, 0.74),
      vec3(1.00, 0.94, 0.84),
      vec3(0.96, 0.99, 1.00),
      vec3(1.00, 0.80, 0.56),
      vec3(0.80, 0.84, 0.98)
    );
    float sheen = smoothstep(0.60, 0.86, n2) * 0.28 * creekMask;
    waterCol = mix(waterCol, sheenTint, sheen);

    baseCol = mix(baseCol, waterCol, creekMask);
  }

  // 4. Seamless Sky Gradient + Continuous Sun & Moon Orbits
  float horizonT = smoothstep(0.06, 0.74, uv.y);
  vec3 targetSky = mix(skyZenith, skyHorizon, horizonT);
  vec3 gradedSky = mix(baseCol, targetSky, skyGradeAmt);

  float aspect = uImgSize.x / max(uImgSize.y, 1.0);

  // Continuous Sun arc from East (05:30 -> x=0.84) through Noon (12:00 -> x=0.50, y=0.14) to West (18:30 -> x=0.16)
  float sunT = clamp((h - 5.2) / 13.8, 0.0, 1.0);
  float sunElev = sin(sunT * 3.14159265);
  float sunVis = smoothstep(5.1, 6.1, h) * (1.0 - smoothstep(18.0, 19.0, h));
  if (sunVis > 0.005) {
    vec2 sunPos = vec2(mix(0.84, 0.16, sunT), 0.72 - sunElev * 0.56);
    float dSun = length((uv - sunPos) * vec2(aspect, 1.0));
    float lowSun = 1.0 - smoothstep(0.12, 0.65, sunElev);
    float sunDisc = smoothstep(0.055, 0.028, dSun) * (0.25 + 0.75 * lowSun);
    float sunHalo = exp(-dSun * mix(5.5, 3.6, lowSun)) * (0.18 + 0.45 * lowSun);
    vec3 sunCol = mix(vec3(1.0, 0.98, 0.90), vec3(1.0, 0.68, 0.40), lowSun);
    gradedSky += sunCol * (sunDisc * 0.72 + sunHalo) * sunVis * skyMask;
  }

  // Continuous Moon arc across night sky (18:30 -> 05:30) + twinkling stars
  if (nightStrength > 0.01) {
    float moonH = h >= 18.0 ? (h - 18.0) : (h + 6.0);
    float moonT = clamp(moonH / 12.0, 0.0, 1.0);
    float moonElev = sin(moonT * 3.14159265);
    vec2 moonPos = vec2(mix(0.82, 0.18, moonT), 0.68 - moonElev * 0.48);
    float dMoon = length((uv - moonPos) * vec2(aspect, 1.0));
    float moonDisc = smoothstep(0.042, 0.033, dMoon);
    float moonHalo = exp(-dMoon * 5.8) * 0.34;
    gradedSky += vec3(0.93, 0.96, 1.0) * (moonDisc * 0.88 + moonHalo) * nightStrength * skyMask;

    // Twinkling stars smoothly fading in/out with nightStrength
    vec2 starGrid = uv * vec2(96.0, 54.0);
    vec2 cell = floor(starGrid);
    vec2 f = fract(starGrid) - 0.5;
    float rnd = hash21(cell);
    if (rnd > 0.942) {
      float starDist = length(f);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.6 + rnd * 3.2) + rnd * 40.0);
      float star = smoothstep(0.18, 0.02, starDist) * twinkle * smoothstep(0.68, 0.12, uv.y);
      gradedSky += vec3(0.92, 0.96, 1.0) * star * nightStrength * skyMask;
    }
  }

  vec3 groundCol = baseCol * groundTint;
  vec3 finalRgb = mix(groundCol, gradedSky, skyMask);

  // 5. Actual painted cumulus clouds smoothly tinted by continuous 24h cycle
  float cloudHeightRatio = 460.0 / 768.0;
  if (uv.y < cloudHeightRatio) {
    float cy = uv.y / cloudHeightRatio;
    float drift1 = fract(uv.x - uTime * 0.0075);
    float breath1 = sin(uTime * 0.35 + uv.x * 3.0) * 0.005;
    vec4 c1 = texture2D(uCloudTex, vec2(drift1, clamp(cy + breath1, 0.002, 0.998)));

    float drift2 = fract(uv.x * 0.92 + 0.52 - uTime * 0.0042);
    vec4 c2 = texture2D(uCloudTex, vec2(drift2, clamp(cy * 1.06 + 0.03, 0.002, 0.998)));

    vec3 tintCloud1 = c1.rgb * cloudTint;
    vec3 tintCloud2 = c2.rgb * cloudTint;

    finalRgb = mix(finalRgb, tintCloud2, c2.a * 0.38 * cloudAlphaScale);
    finalRgb = mix(finalRgb, tintCloud1, c1.a * cloudAlphaScale);
  }

  // 6. Gentle glowing fireflies drifting over the meadow at night
  if (nightStrength > 0.12 && uv.y > 0.62) {
    vec2 ffGrid = uv * vec2(18.0, 10.0);
    vec2 ffCell = floor(ffGrid);
    float r = hash21(ffCell + vec2(11.7, 3.3));
    if (r > 0.78) {
      vec2 center = vec2(
        0.5 + 0.32 * sin(uTime * (0.55 + r * 0.5) + r * 19.0),
        0.5 + 0.28 * cos(uTime * (0.45 + r * 0.4) + r * 27.0)
      );
      float d = length(fract(ffGrid) - center);
      float pulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.8 + r * 2.0) + r * 31.0));
      float glow = exp(-d * 14.0) * pulse * smoothstep(0.64, 0.78, uv.y) * (1.0 - creekMask);
      finalRgb += vec3(1.0, 0.90, 0.48) * glow * 0.9 * nightStrength;
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

/** Shortest signed distance on a 24-hour circular clock. */
function shortestHourDelta(fromH: number, toH: number): number {
  let diff = ((toH - fromH + 12) % 24 + 24) % 24 - 12;
  if (diff < -12) diff += 24;
  return diff;
}

export interface MeadowRendererHandle {
  setPaused: (paused: boolean) => void;
  setHour: (hourFloat: number, immediate?: boolean) => void;
  destroy: () => void;
}

export async function mountMeadowShader(
  canvas: HTMLCanvasElement,
  baseUrl: string,
  cloudsUrl: string,
  maskUrl: string,
  initialPaused: boolean,
  initialHour: number,
): Promise<MeadowRendererHandle | null> {
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

  const [baseAsset, cloudAsset, maskAsset] = await Promise.all([
    loadTexture(gl, baseUrl),
    loadTexture(gl, cloudsUrl),
    loadTexture(gl, maskUrl),
  ]);

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
  gl.bindTexture(gl.TEXTURE_2D, baseAsset.texture);
  gl.uniform1i(gl.getUniformLocation(program, 'uBaseTex'), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, cloudAsset.texture);
  gl.uniform1i(gl.getUniformLocation(program, 'uCloudTex'), 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, maskAsset.texture);
  gl.uniform1i(gl.getUniformLocation(program, 'uMaskTex'), 2);

  gl.uniform2f(gl.getUniformLocation(program, 'uImgSize'), baseAsset.width, baseAsset.height);

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

    // Smooth exponential ease on displayHour so preset jumps glide seamlessly like a timelapse
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
      gl.deleteTexture(baseAsset.texture);
      gl.deleteTexture(cloudAsset.texture);
      gl.deleteTexture(maskAsset.texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
