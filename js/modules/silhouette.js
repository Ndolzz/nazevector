// js/modules/silhouette.js — Pemrosesan siluet raster (berfungsi, lokal).
// Mask biner berbasis luminansi; pratinjau ini bukan hasil vektor.

export function computeSilhouetteMask(sourceCanvas, mode, thresholdPercent) {
  const context = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = sourceCanvas;
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const threshold = Math.round((thresholdPercent / 100) * 255);
  const mask = new Uint8ClampedArray(width * height);

  for (let px = 0, i = 0; px < mask.length; px += 1, i += 4) {
    if (pixels[i + 3] < 16) {
      mask[px] = 0;
      continue;
    }
    const luminance =
      0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    const inside =
      mode === 'terang' ? luminance >= threshold : luminance <= threshold;
    mask[px] = inside ? 255 : 0;
  }

  return { mask, width, height };
}

export function renderSilhouetteToCanvas(targetCanvas, maskData, colorHex) {
  if (!maskData) return;
  targetCanvas.width = maskData.width;
  targetCanvas.height = maskData.height;
  const context = targetCanvas.getContext('2d');
  if (!context) return;
  const { r, g, b } = hexToRgb(colorHex);
  const output = context.createImageData(maskData.width, maskData.height);
  const out = output.data;
  for (let px = 0, i = 0; px < maskData.mask.length; px += 1, i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = maskData.mask[px];
  }
  context.putImageData(output, 0, 0);
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
