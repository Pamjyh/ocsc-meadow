/**
 * Zero-dependency WebGL living-scene renderer for custom anime backgrounds:
 * Mirrors meadowShader.ts (DPR-capped, coverUv, low-power WebGL, pause-friendly)
 * with tailored subtle atmospheric motion per scene:
 *  - Mode 1 (Frieren): swaying foreground blue-moon flowers, drifting petals, warm sunset glow
 *  - Mode 2 (Haku Night): twinkling stars, lunar halo breath, softly drifting cloud sea
 *  - Mode 3 (Chihiro Flowers): radial breeze swaying outer pink blossoms (face stays sharp) + sunlight motes
 *  - Mode 4 (Your Name): twinkling night stars, comet luminescence pulse, swaying grass silhouette
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

void main() {
  vec2 uv = coverUv(vUv, uCanvasSize, uImgSize);
  vec2 sampleUv = uv;
  float aspect = uImgSize.x / max(uImgSize.y, 1.0);

  // Mode 1: Frieren blue-moon flower meadow at sunset
  if (uMode < 1.5) {
    float flowerMask = smoothstep(0.32, 0.68, uv.y);
    float breezeX = sin(uv.x * 7.5 - uTime * 1.1 + uv.y * 3.0) * 0.0032 * flowerMask;
    float breezeY = cos(uv.x * 5.2 - uTime * 0.85) * 0.0012 * flowerMask;
    sampleUv = clamp(uv + vec2(breezeX, breezeY), 0.001, 0.999);
  }
  // Mode 2: Haku flying above moonlit clouds
  else if (uMode < 2.5) {
    float cloudMask = smoothstep(0.54, 0.72, uv.y);
    float glideY = sin(uTime * 0.65) * 0.0022 * (1.0 - cloudMask);
    float cloudDrift = sin(uv.y * 12.0 + uTime * 0.55) * 0.0025 * cloudMask;
    sampleUv = clamp(uv + vec2(cloudDrift, glideY), 0.001, 0.999);
  }
  // Mode 3: Chihiro in pink flower garden (keep center face crisp, sway outer bushes)
  else if (uMode < 3.5) {
    float distCenter = length((uv - vec2(0.47, 0.50)) * vec2(1.25, 1.0));
    float bushMask = smoothstep(0.18, 0.44, distCenter);
    float swayX = sin(uv.y * 9.0 + uTime * 1.15 + uv.x * 4.0) * 0.0032 * bushMask;
    float swayY = cos(uv.x * 7.0 + uTime * 0.9) * 0.0014 * bushMask;
    sampleUv = clamp(uv + vec2(swayX, swayY), 0.001, 0.999);
  }
  // Mode 4: Your Name starry night & comet
  else {
    float grassMask = smoothstep(0.76, 0.92, uv.y);
    float grassSway = sin(uv.x * 16.0 - uTime * 1.35) * 0.0026 * grassMask;
    sampleUv = clamp(uv + vec2(grassSway, 0.0), 0.001, 0.999);
  }

  vec3 col = texture2D(uTex, sampleUv).rgb;

  // Atmospheric overlays per scene
  if (uMode < 1.5) {
    // Warm sunset glow breathing from upper golden sky
    float sunPulse = 0.5 + 0.5 * sin(uTime * 0.55);
    float skyGlow = exp(-length((uv - vec2(0.52, 0.20)) * vec2(aspect * 0.55, 1.0)) * 2.1);
    col += vec3(1.0, 0.84, 0.58) * skyGlow * (0.04 + 0.045 * sunPulse);

    // Gently drifting pale-blue flower petals
    vec2 pGrid = uv * vec2(10.0, 6.0) + vec2(-uTime * 0.14, -uTime * 0.08);
    vec2 pCell = floor(pGrid);
    float r = hash21(pCell + vec2(3.7, 9.1));
    if (r > 0.76) {
      vec2 center = vec2(
        0.5 + 0.28 * sin(uTime * (0.7 + r * 0.5) + r * 20.0),
        0.5 + 0.26 * cos(uTime * (0.6 + r * 0.4) + r * 15.0)
      );
      vec2 d = (fract(pGrid) - center) * vec2(1.0, 1.8);
      float petal = smoothstep(0.11, 0.02, length(d));
      col += vec3(0.86, 0.90, 1.0) * petal * 0.24;
    }
  } else if (uMode < 2.5) {
    // Subtle lunar halo pulse around the crescent moon
    float moonPulse = 0.5 + 0.5 * sin(uTime * 0.7);
    float dMoon = length((uv - vec2(0.635, 0.165)) * vec2(aspect, 1.0));
    col += vec3(0.95, 0.97, 0.86) * exp(-dMoon * 4.5) * (0.05 + 0.04 * moonPulse);

    // Twinkling stars in upper night sky
    if (uv.y < 0.56) {
      vec2 sGrid = uv * vec2(88.0, 48.0);
      vec2 sCell = floor(sGrid);
      float r = hash21(sCell);
      if (r > 0.952) {
        float twinkle = 0.45 + 0.55 * sin(uTime * (1.5 + r * 3.0) + r * 42.0);
        float star = smoothstep(0.18, 0.02, length(fract(sGrid) - 0.5)) * twinkle;
        col += vec3(0.88, 0.96, 1.0) * star * 0.52 * smoothstep(0.56, 0.18, uv.y);
      }
    }
  } else if (uMode < 3.5) {
    // Warm sunlit motes & soft pink blossom drift
    vec2 mGrid = uv * vec2(12.0, 7.0) + vec2(-uTime * 0.10, uTime * 0.06);
    vec2 mCell = floor(mGrid);
    float r = hash21(mCell + vec2(5.1, 2.3));
    if (r > 0.78) {
      vec2 center = vec2(
        0.5 + 0.3 * sin(uTime * 0.65 + r * 18.0),
        0.5 + 0.28 * cos(uTime * 0.55 + r * 24.0)
      );
      float d = length(fract(mGrid) - center);
      float pulse = 0.5 + 0.5 * sin(uTime * (1.2 + r * 1.6) + r * 11.0);
      float mote = exp(-d * 11.0) * pulse;
      vec3 tint = r > 0.89 ? vec3(1.0, 0.82, 0.90) : vec3(1.0, 0.96, 0.82);
      col += tint * mote * 0.28;
    }
  } else {
    // Twinkling starry sky + gentle comet shimmer
    if (uv.y < 0.74) {
      vec2 sGrid = uv * vec2(96.0, 52.0);
      vec2 sCell = floor(sGrid);
      float r = hash21(sCell + vec2(7.3, 1.9));
      if (r > 0.945) {
        float twinkle = 0.4 + 0.6 * sin(uTime * (1.6 + r * 3.4) + r * 37.0);
        float star = smoothstep(0.18, 0.02, length(fract(sGrid) - 0.5)) * twinkle;
        col += vec3(0.84, 0.94, 1.0) * star * 0.65 * smoothstep(0.74, 0.15, uv.y);
      }
    }
    // Luminous pulse along comet core
    float cometPulse = 0.5 + 0.5 * sin(uTime * 1.15);
    float dComet = length((uv - vec2(0.47, 0.34)) * vec2(aspect * 0.65, 1.0));
    col += vec3(0.55, 0.78, 1.0) * exp(-dComet * 3.4) * (0.04 + 0.055 * cometPulse);
  }

  gl_FragColor = vec4(col, 1.0);
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

export interface LivingSceneHandle {
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}

export async function mountLivingSceneShader(
  canvas: HTMLCanvasElement,
  imageUrl: string,
  shaderMode: 1 | 2 | 3 | 4,
  initialPaused: boolean,
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
  const uCanvasSize = gl.getUniformLocation(program, 'uCanvasSize');

  let paused = initialPaused;
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
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const tick = (nowMs: number) => {
    if (destroyed || paused) return;
    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
    lastFrameMs = nowMs;
    elapsedSeconds += dt;
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
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      gl.deleteTexture(asset.texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
