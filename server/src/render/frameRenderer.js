// Komposit bingkai 1280x720 RGBA untuk Naze Vector Render Server.
// Modul murni: komposisi source-over alfa lurus, interpolasi bilinear
// dengan konvensi pusat piksel, dan pemetaan invers rotasi/skala.

export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 720;

export function totalFrames(project) {
  const fps = (project && project.canvas && project.canvas.fps) || 30;
  const durationMs = (project && project.durationMs) || 0;
  return Math.max(1, Math.round((durationMs * fps) / 1000));
}

export function createFrameBuffer() {
  return new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT * 4);
}

// Interpolasi linear antar keyframe; nilai dikunci di luar rentang t.
export function sampleTrack(keyframes, tMs) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return 0;
  const first = keyframes[0];
  if (tMs <= first.t) return first.value;
  const last = keyframes[keyframes.length - 1];
  if (tMs >= last.t) return last.value;
  for (let i = 1; i < keyframes.length; i++) {
    const b = keyframes[i];
    if (tMs <= b.t) {
      const a = keyframes[i - 1];
      const span = b.t - a.t;
      if (span <= 0) return b.value;
      const ratio = (tMs - a.t) / span;
      return a.value + (b.value - a.value) * ratio;
    }
  }
  return last.value;
}

export function computeLayerState(layer, tMs) {
  const tracks = (layer && layer.tracks) || {};
  const pick = (name, fallback) => {
    const track = tracks[name];
    return Array.isArray(track) && track.length > 0 ? sampleTrack(track, tMs) : fallback;
  };
  return {
    x: pick('x', 0),
    y: pick('y', 0),
    scale: pick('scale', 1),
    rotation: pick('rotation', 0),
    opacity: pick('opacity', 1),
  };
}

// Batas area tujuan (piksel layar) yang mungkin tersentuh layer,
// dengan konvensi pusat piksel dan memperhitungkan rotasi.
export function layerDestBounds(image, state) {
  const theta = (state.rotation * Math.PI) / 180;
  const cosT = Math.abs(Math.cos(theta));
  const sinT = Math.abs(Math.sin(theta));
  const halfW = (image.width * state.scale) / 2;
  const halfH = (image.height * state.scale) / 2;
  const halfRW = cosT * halfW + sinT * halfH;
  const halfRH = sinT * halfW + cosT * halfH;
  return {
    x0: Math.ceil(state.x - halfRW - 0.5),
    y0: Math.ceil(state.y - halfRH - 0.5),
    x1: Math.floor(state.x + halfRW - 0.5),
    y1: Math.floor(state.y + halfRH - 0.5),
  };
}

function sampleBilinear(pixels, width, height, sx, sy) {
  const tx = sx - 0.5;
  const ty = sy - 0.5;
  let i0 = Math.floor(tx);
  let j0 = Math.floor(ty);
  let fx = tx - i0;
  let fy = ty - j0;
  if (i0 < 0) { i0 = 0; fx = 0; }
  if (j0 < 0) { j0 = 0; fy = 0; }
  if (i0 > width - 1) { i0 = width - 1; fx = 0; }
  if (j0 > height - 1) { j0 = height - 1; fy = 0; }
  const i1 = Math.min(i0 + 1, width - 1);
  const j1 = Math.min(j0 + 1, height - 1);
  const o00 = (j0 * width + i0) * 4;
  const o10 = (j0 * width + i1) * 4;
  const o01 = (j1 * width + i0) * 4;
  const o11 = (j1 * width + i1) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  return {
    r: pixels[o00] * w00 + pixels[o10] * w10 + pixels[o01] * w01 + pixels[o11] * w11,
    g: pixels[o00 + 1] * w00 + pixels[o10 + 1] * w10 + pixels[o01 + 1] * w01 + pixels[o11 + 1] * w11,
    b: pixels[o00 + 2] * w00 + pixels[o10 + 2] * w10 + pixels[o01 + 2] * w01 + pixels[o11 + 2] * w11,
    a: pixels[o00 + 3] * w00 + pixels[o10 + 3] * w10 + pixels[o01 + 3] * w01 + pixels[o11 + 3] * w11,
  };
}

// Menempel satu layer ke bingkai memakai pemetaan invers (rotasi dan skala).
export function compositeFrame(frame, image, state) {
  const bounds = layerDestBounds(image, state);
  const xStart = Math.max(0, bounds.x0);
  const yStart = Math.max(0, bounds.y0);
  const xEnd = Math.min(FRAME_WIDTH - 1, bounds.x1);
  const yEnd = Math.min(FRAME_HEIGHT - 1, bounds.y1);
  if (xEnd < xStart || yEnd < yStart) return frame;
  const theta = (state.rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const invScale = 1 / (state.scale > 0 ? state.scale : 1);
  const halfW = image.width / 2;
  const halfH = image.height / 2;
  const srcAlphaMul = state.opacity;
  for (let py = yStart; py <= yEnd; py++) {
    const dy = py + 0.5 - state.y;
    for (let px = xStart; px <= xEnd; px++) {
      const dx = px + 0.5 - state.x;
      const sx = (dx * cosT + dy * sinT) * invScale + halfW;
      const sy = (-dx * sinT + dy * cosT) * invScale + halfH;
      if (sx < 0 || sy < 0 || sx > image.width || sy > image.height) continue;
      const s = sampleBilinear(image.pixels, image.width, image.height, sx, sy);
      const a = (s.a / 255) * srcAlphaMul;
      if (a <= 0) continue;
      const o = (py * FRAME_WIDTH + px) * 4;
      const dstA = frame[o + 3] / 255;
      const outA = a + dstA * (1 - a);
      if (outA <= 0) {
        frame[o] = 0;
        frame[o + 1] = 0;
        frame[o + 2] = 0;
        frame[o + 3] = 0;
        continue;
      }
      frame[o] = (s.r * a + frame[o] * dstA * (1 - a)) / outA;
      frame[o + 1] = (s.g * a + frame[o + 1] * dstA * (1 - a)) / outA;
      frame[o + 2] = (s.b * a + frame[o + 2] * dstA * (1 - a)) / outA;
      frame[o + 3] = outA * 255;
    }
  }
  return frame;
}

// Merender satu bingkai: latar putih buram lalu layer berurutan.
// images[i] adalah {width, height, pixels: Uint8ClampedArray RGBA}
// untuk project.layers[i].
export function renderFrame(frame, project, images, frameIndex) {
  for (let i = 0; i < frame.length; i += 4) {
    frame[i] = 255;
    frame[i + 1] = 255;
    frame[i + 2] = 255;
    frame[i + 3] = 255;
  }
  const fps = (project && project.canvas && project.canvas.fps) || 30;
  const tMs = (frameIndex * 1000) / fps;
  const layers = (project && project.layers) || [];
  for (let i = 0; i < layers.length; i++) {
    const image = images[i];
    if (!image || !image.width || !image.height) continue;
    compositeFrame(frame, image, computeLayerState(layers[i], tMs));
  }
  return frame;
}
