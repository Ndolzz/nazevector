// js/modules/colorSampling.js — Sampling warna asli per komponen (CV-1, v0.5.0)
// dan per kontur (CV-2, v0.5.1).
// Permintaan pengguna 2026-10-17: hasil ekspor diinginkan 1:1 dengan gambar
// asli "dari warna maupun garis". Mode warna asli mengambil warna dominan
// piksel gambar sumber pada region setiap komponen siluet (region mask yang
// sama dengan layer AM-4), lalu adapter menuliskannya sebagai fillColor layer
// tersebut — menggantikan satu warna global. CV-2 (v0.5.1) memperluas sampling
// ke tiap KONTUR (AM-6: satu layer per kontur): kontur luar memakai warna
// region mask pemiliknya, sedangkan kontur lubang memakai warna piksel latar
// di dalam poligon lubang (piksel dengan mask 0; pulau di dalam lubang tidak
// ikut tersampling karena mask-nya bukan 0) — dicocokkan lewat uji
// titik-dalam-poligon (ray casting, pola yang sama dengan amAdapter.js).
// Metode: piksel region dikelompokkan ke keranjang kuantisasi 16 tingkat per
// kanal (>>4); keranjang terbanyak dipilih (warna inti menang atas piksel tepi
// anti-aliasing yang minoritas), lalu rata-rata tepat piksel pada keranjang itu
// dijadikan warna akhir — untuk desain warna datar hasilnya identik dengan
// warna sumber. Batas jujur: gradien dan foto hanya menghasilkan perkiraan
// warna dominan, bukan reproduksi penuh; piksel transparan diabaikan; kontur
// lubang tanpa satu pun piksel latar layak (misalnya lubang sangat kecil)
// menghasilkan warna cadangan #000000.

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

// sampleContourColors(maskData, pixelData, vectorPathData) -> string[]
// '#RRGGBB' per KONTUR, seurut urutan subpaths (kontur luar, lalu lubangnya,
// lalu pulau) — urutan yang sama dengan shape layer mode kontur pada adapter
// (AM-6). Kontur luar memakai warna dominan region mask pemiliknya; kontur
// lubang memakai warna dominan piksel latar di dalam poligon lubang.
export function sampleContourColors(maskData, pixelData, vectorPathData) {
  if (!maskData || !maskData.mask || typeof maskData.mask.length !== 'number') {
    throw new Error('Mask tidak tersedia untuk sampling warna.');
  }
  if (!pixelData || !pixelData.data || pixelData.width !== maskData.width || pixelData.height !== maskData.height) {
    throw new Error('Data piksel sumber tidak sesuai dengan mask.');
  }
  if (!vectorPathData || !Array.isArray(vectorPathData.subpaths)) {
    throw new Error('Data vektor tidak valid untuk sampling warna.');
  }
  for (const subpath of vectorPathData.subpaths) {
    if (!subpath || !Array.isArray(subpath.points) || subpath.points.length < 3) {
      throw new Error('Data vektor tidak valid untuk sampling warna: kontur tidak lengkap.');
    }
  }
  const labels = labelMaskRegions(maskData);
  const colors = [];
  for (const subpath of vectorPathData.subpaths) {
    if (subpath.role === 'hole') {
      colors.push(dominantHoleColor(maskData, pixelData.data, subpath.points));
      continue;
    }
    const label = findRegionLabel(maskData, labels, subpath.points[0]);
    if (label === 0) {
      throw new Error(
        'Kesalahan internal: kontur siluet tidak dapat dipetakan ke region mask untuk sampling warna.'
      );
    }
    colors.push(dominantRegionColor(pixelData.data, labels, label));
  }
  return colors;
}

// Warna dominan piksel latar di dalam poligon lubang: hanya piksel dengan
// mask 0 (bukan badan siluet maupun pulau di dalam lubang) yang pusatnya
// (x+0.5, y+0.5) berada di dalam cincin kontur lubang.
function dominantHoleColor(maskData, pixels, ring) {
  const box = ringBbox(ring);
  const xStart = Math.max(0, Math.floor(box.minX));
  const xEnd = Math.min(maskData.width - 1, Math.ceil(box.maxX) - 1);
  const yStart = Math.max(0, Math.floor(box.minY));
  const yEnd = Math.min(maskData.height - 1, Math.ceil(box.maxY) - 1);
  const indices = [];
  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = xStart; x <= xEnd; x += 1) {
      const index = y * maskData.width + x;
      if (maskData.mask[index] > 0) continue;
      if (!pointInRing(x + 0.5, y + 0.5, ring)) continue;
      indices.push(index);
    }
  }
  return colorFromPixelIndices(pixels, indices);
}

function dominantRegionColor(pixels, labels, label) {
  const indices = [];
  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] === label) indices.push(index);
  }
  return colorFromPixelIndices(pixels, indices);
}

function colorFromPixelIndices(pixels, indices) {
  const buckets = new Map();
  for (const index of indices) {
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

// Uji titik-dalam-cincin dengan aturan paritas (ray casting) — pola yang sama
// dengan pointInRing pada amAdapter.js (cincin titik tanpa duplikat penutup).
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function ringBbox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function toHexPair(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}
