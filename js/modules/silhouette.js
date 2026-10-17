// js/modules/silhouette.js — Pemrosesan siluet raster (berfungsi, lokal).
// Mask biner berbasis luminansi; pratinjau ini bukan hasil vektor.
//
// P1 (v0.4.3): inti perhitungan mask dipisah menjadi fungsi murni dari piksel
// (computeSilhouetteMaskFromPixels) dan pembantu dimensi kerja pratinjau
// (computePreviewDimensions). computeSilhouetteMask (resolusi penuh) tidak
// berubah dan tetap dipakai oleh jalur ekspor sehingga kualitas ekspor final
// tidak terpengaruh resolusi pratinjau (docs/SDD.md bagian 13).

// Batas dimensi kerja pratinjau: sisi terpanjang mask pratinjau. Dipilih agar
// beban pemrosesan pada HP Android berspesifikasi rendah tetap interaktif;
// tidak memperbesar gambar kecil dan tidak menjadi batas resolusi ekspor.
export const PREVIEW_MAX_DIMENSION = 700;

// computePreviewDimensions(sourceWidth, sourceHeight, maxDimension?) ->
//   { width, height } dimensi kerja pratinjau (tidak pernah memperbesar).
// Memvalidasi masukan; melempar Error berbahasa Indonesia bila tidak valid.
export function computePreviewDimensions(
  sourceWidth,
  sourceHeight,
  maxDimension = PREVIEW_MAX_DIMENSION
) {
  if (
    !Number.isInteger(sourceWidth) ||
    !Number.isInteger(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error('Dimensi gambar tidak valid.');
  }
  const limit =
    Number.isInteger(maxDimension) && maxDimension >= 1
      ? maxDimension
      : PREVIEW_MAX_DIMENSION;
  const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

// computeSilhouetteMask(sourceCanvas, mode, thresholdPercent) -> maskData | null
// Jalur resolusi penuh: dipakai oleh ekspor (exportManager) dan oleh pratinjau
// bila gambar sudah di bawah batas pratinjau.
export function computeSilhouetteMask(sourceCanvas, mode, thresholdPercent) {
  const pixelData = getCanvasPixelData(sourceCanvas);
  if (!pixelData) return null;
  return computeSilhouetteMaskFromPixels(
    pixelData.data,
    pixelData.width,
    pixelData.height,
    mode,
    thresholdPercent
  );
}

// getCanvasPixelData(sourceCanvas) -> { data, width, height } | null
// Membaca piksel RGBA kanvas sekali; dipakai jalur ekspor agar mask dan
// sampling warna asli (CV-1) membaca sumber piksel yang sama.
export function getCanvasPixelData(sourceCanvas) {
  if (!sourceCanvas || typeof sourceCanvas.getContext !== 'function') return null;
  const context = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = sourceCanvas;
  const imageData = context.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}

// computeSilhouetteMaskFromPixels(pixels, width, height, mode, thresholdPercent)
//   -> { mask: Uint8ClampedArray, width, height }
// Inti murni: piksel RGBA menjadi mask biner. Piksel transparan (alpha < 16)
// selalu dianggap luar.
export function computeSilhouetteMaskFromPixels(
  pixels,
  width,
  height,
  mode,
  thresholdPercent
) {
  if (
    !pixels ||
    typeof pixels.length !== 'number' ||
    pixels.length < width * height * 4
  ) {
    throw new Error('Data piksel tidak sesuai dengan dimensi.');
  }
  const threshold = Math.round((thresholdPercent / 100) * 255);
  const mask = new Uint8ClampedArray(width * height);
  const brightMode = mode === 'terang';

  for (let px = 0, i = 0; px < mask.length; px += 1, i += 4) {
    if (pixels[i + 3] < 16) {
      mask[px] = 0;
      continue;
    }
    const luminance =
      0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    const inside = brightMode ? luminance >= threshold : luminance <= threshold;
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

/* ---------- Pelabelan region mask (VE-3 + CV-1, v0.5.0) ---------- */

// labelMaskRegions(maskData) -> Int32Array label per piksel (0 = luar).
// Flood fill tumpukan (4-tetangga) dengan urutan pindai baris-maju sehingga
// label deterministik; satu region tersambung = satu label. Region pada
// mask identik dengan komponen siluet yang diberi layer oleh AM-4.
export function labelMaskRegions(maskData) {
  if (!maskData || !maskData.mask || typeof maskData.mask.length !== 'number') {
    throw new Error('Mask tidak tersedia untuk pelabelan region.');
  }
  const { mask, width, height } = maskData;
  if (mask.length !== width * height) {
    throw new Error('Ukuran mask tidak sesuai dengan dimensi.');
  }
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  let nextLabel = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || labels[start] !== 0) continue;
    nextLabel += 1;
    let top = 0;
    stack[top] = start;
    top += 1;
    labels[start] = nextLabel;
    while (top > 0) {
      const index = stack[top - 1];
      top -= 1;
      const x = index % width;
      if (x > 0 && mask[index - 1] !== 0 && labels[index - 1] === 0) {
        labels[index - 1] = nextLabel;
        stack[top] = index - 1;
        top += 1;
      }
      if (x < width - 1 && mask[index + 1] !== 0 && labels[index + 1] === 0) {
        labels[index + 1] = nextLabel;
        stack[top] = index + 1;
        top += 1;
      }
      if (index >= width && mask[index - width] !== 0 && labels[index - width] === 0) {
        labels[index - width] = nextLabel;
        stack[top] = index - width;
        top += 1;
      }
      if (index < mask.length - width && mask[index + width] !== 0 && labels[index + width] === 0) {
        labels[index + width] = nextLabel;
        stack[top] = index + width;
        top += 1;
      }
    }
  }
  return labels;
}

// findRegionLabel(maskData, labels, point) -> label region yang memuat titik.
// Titik kontur berada pada batas retak antara piksel dalam dan luar; kandidat
// piksel di sekitar titik dicoba sampai satu ditemukan dalam mask. Hasil 0
// berarti tidak ditemukan (dipanggil tidak pernah terjadi pada keluaran
// vectorEngine yang valid; pemanggil menanganinya secara eksplisit).
export function findRegionLabel(maskData, labels, point) {
  if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    return 0;
  }
  const { mask, width, height } = maskData;
  const baseX = Math.floor(point[0]);
  const baseY = Math.floor(point[1]);
  const candidates = [
    [baseX, baseY],
    [baseX - 1, baseY],
    [baseX, baseY - 1],
    [baseX - 1, baseY - 1],
    [baseX + 1, baseY],
    [baseX, baseY + 1],
  ];
  for (const [x, y] of candidates) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    if (mask[index] !== 0 && labels[index] !== 0) return labels[index];
  }
  return 0;
}
