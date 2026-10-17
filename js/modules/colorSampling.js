// js/modules/colorSampling.js — Sampling warna asli per komponen (CV-1, v0.5.0).
// Permintaan pengguna 2026-10-17: hasil ekspor diinginkan 1:1 dengan gambar
// asli "dari warna maupun garis". Mode warna asli mengambil warna dominan
// piksel gambar sumber pada region setiap komponen siluet (region mask yang
// sama dengan layer AM-4), lalu adapter menuliskannya sebagai fillColor layer
// tersebut — menggantikan satu warna global.
// Metode: piksel region dikelompokkan ke keranjang kuantisasi 16 tingkat per
// kanal (>>4); keranjang terbanyak dipilih (warna inti menang atas piksel tepi
// anti-aliasing yang minoritas), lalu rata-rata tepat piksel pada keranjang itu
// dijadikan warna akhir — untuk desain warna datar hasilnya identik dengan
// warna sumber. Batas jujur: gradien dan foto hanya menghasilkan perkiraan
// warna dominan, bukan reproduksi penuh; piksel transparan diabaikan.

import { labelMaskRegions, findRegionLabel } from './silhouette.js';

// sampleComponentColors(maskData, pixelData, vectorPathData) -> string[]
// '#RRGGBB' per komponen, seurut urutan kontur luar pada subpaths (urutan yang
// sama dengan pengelompokan AM-4 dan shape layer adapter).
export function sampleComponentColors(maskData, pixelData, vectorPathData) {
  if (!maskData || !maskData.mask || typeof maskData.mask.length !== 'number') {
    throw new Error('Mask tidak tersedia untuk sampling warna.');
  }
  if (!pixelData || !pixelData.data || pixelData.width !== maskData.width || pixelData.height !== maskData.height) {
    throw new Error('Data piksel sumber tidak sesuai dengan mask.');
  }
  if (!vectorPathData || !Array.isArray(vectorPathData.subpaths)) {
    throw new Error('Data vektor tidak valid untuk sampling warna.');
  }
  const labels = labelMaskRegions(maskData);
  const outers = vectorPathData.subpaths.filter((subpath) => subpath.role === 'outer');
  const colors = [];
  for (const outer of outers) {
    const label = findRegionLabel(maskData, labels, outer.points[0]);
    if (label === 0) {
      throw new Error(
        'Kesalahan internal: komponen siluet tidak dapat dipetakan ke region mask untuk sampling warna.'
      );
    }
    colors.push(dominantRegionColor(pixelData.data, labels, label));
  }
  return colors;
}

function dominantRegionColor(pixels, labels, label) {
  const buckets = new Map();
  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] !== label) continue;
    const i = index * 4;
    if (pixels[i + 3] < 16) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
  }
  if (buckets.size === 0) return '#000000';
  let best = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  const r = clampByte(Math.round(best.r / best.count));
  const g = clampByte(Math.round(best.g / best.count));
  const b = clampByte(Math.round(best.b / best.count));
  return '#' + toHexPair(r) + toHexPair(g) + toHexPair(b);
}

function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function toHexPair(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}
