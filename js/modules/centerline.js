// js/modules/centerline.js — Ekstraksi garis tunggal (centerline) dari pita tipis
// (VE-3, v0.5.0).
// Motivasi bukti lapangan 2026-10-17: pengguna memproses mentahan jersey line art
// (goresan hitam ±2 piksel) dan hasil isi siluet tampil sebagai pita dengan dua
// tepi hampir sejajar — pada tampilan sunting tiap garis visual tampak ganda.
// Mode garis merepresentasikan setiap goresan sebagai SATU kurva di tengah pita:
// region mask per komponen dirampingkan (skeletonisasi Zhang-Suen), dirunut
// menjadi rantai piksel (garis terbuka, loop tertutup, atau segmen pada simpang),
// lalu disederhanakan dengan RDP yang sama dengan kontur siluet.
// Lebar goresan diperkirakan sebagai luas region dibagi panjang total skeleton
// (perkiraan yang tepat untuk pita dengan tebal seragam, khas line art).
// Batas jujur: duri skeleton pendek (< 3 piksel) dibuang; tebal per segmen pada
// simpang memakai tebal rata-rata komponen; region sangat kecil (< 2 piksel)
// dilewati; ujung goresan menyusut maksimal ±1 piksel akibat penipisan. Pada
// perunututan, tepi diagonal semu pada sudut siku-siku hasil Zhang-Suen ditekan
// (diagonal yang dijembatani piksel 4-tetangga diabaikan) sehingga loop
// tertutup dikenali dan tidak terpecah menjadi simpul semu. Semua beban
// komputasi lokal; nol dependensi.

import { labelMaskRegions, findRegionLabel } from './silhouette.js';
import { simplifyPolyline } from './vectorEngine.js';

// extractCenterlines(maskData, vectorPathData, options?) -> CenterlineData:
//   { ok, empty, width, height, lines: [{ points, closed, width, componentIndex }] }
// options: { tolerancePx } — bila dihilangkan memakai vectorPathData.tolerancePx.
// componentIndex = indeks kontur luar komponen pada subpaths (urutan yang sama
// dengan pengelompokan AM-4) sehingga warna per komponen dapat disandingkan.
export function extractCenterlines(maskData, vectorPathData, options = {}) {
  if (!maskData || !maskData.mask || maskData.mask.length === 0) {
    throw new Error('Mask tidak tersedia untuk ekstraksi garis.');
  }
  if (!vectorPathData || !Array.isArray(vectorPathData.subpaths)) {
    throw new Error('Data vektor tidak valid untuk ekstraksi garis.');
  }
  const tolerance = resolveTolerance(options.tolerancePx, vectorPathData.tolerancePx);
  const labels = labelMaskRegions(maskData);
  const regionStats = computeRegionStats(labels, maskData.width, maskData.height);
  const outers = vectorPathData.subpaths.filter((subpath) => subpath.role === 'outer');
  const lines = [];
  for (let outerIndex = 0; outerIndex < outers.length; outerIndex += 1) {
    const outer = outers[outerIndex];
    const label = findRegionLabel(maskData, labels, outer.points[0]);
    if (label === 0) continue;
    const region = collectRegion(maskData, labels, label, regionStats.get(label));
    if (!region || region.count < 2) continue;
    thinRegion(region.grid, region.width, region.height);
    const chains = traceSkeleton(region.grid, region.width, region.height);
    if (chains.length === 0) continue;
    const totalLength = chains.reduce((sum, chain) => sum + chainLength(chain), 0);
    const strokeWidth = Math.max(1, region.count / Math.max(1, totalLength));
    for (const chain of chains) {
      if (chain.points.length < 3) continue;
      let points = chain.points.map((pixel) => [
        pixel.x + region.offsetX + 0.5,
        pixel.y + region.offsetY + 0.5,
      ]);
      if (chain.closed) points = points.concat([points[0]]);
      const simplified = simplifyPolyline(points, tolerance);
      if (simplified.length < 2) continue;
      lines.push({ points: simplified, closed: chain.closed, width: strokeWidth, componentIndex: outerIndex });
    }
  }
  return {
    ok: true,
    empty: lines.length === 0,
    width: maskData.width,
    height: maskData.height,
    lines,
  };
}

function resolveTolerance(optionValue, fallbackValue) {
  if (Number.isFinite(optionValue) && optionValue >= 0) return optionValue;
  if (Number.isFinite(fallbackValue) && fallbackValue >= 0) return fallbackValue;
  return 1.5;
}

/* ---------- Pengumpulan region per label ---------- */

// Statistik bbox dan jumlah piksel per label dalam SATU pindai mask (bukan
// per komponen) agar gambar dengan ribuan komponen tetap linear.
function computeRegionStats(labels, width, height) {
  const stats = new Map();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const label = labels[y * width + x];
      if (label === 0) continue;
      let stat = stats.get(label);
      if (!stat) {
        stat = { minX: x, minY: y, maxX: x, maxY: y, count: 0 };
        stats.set(label, stat);
      }
      stat.count += 1;
      if (x < stat.minX) stat.minX = x;
      if (y < stat.minY) stat.minY = y;
      if (x > stat.maxX) stat.maxX = x;
      if (y > stat.maxY) stat.maxY = y;
    }
  }
  return stats;
}

// Bangun grid biner region terpotong bbox dengan bingkai nol selebar 1 piksel
// (agar penipisan tidak perlu memeriksa batas); hanya memindai area bbox.
function collectRegion(maskData, labels, label, stat) {
  if (!stat) return null;
  const { mask, width } = maskData;
  const gridWidth = stat.maxX - stat.minX + 3;
  const gridHeight = stat.maxY - stat.minY + 3;
  const grid = new Uint8Array(gridWidth * gridHeight);
  for (let y = stat.minY; y <= stat.maxY; y += 1) {
    for (let x = stat.minX; x <= stat.maxX; x += 1) {
      if (labels[y * width + x] === label && mask[y * width + x] !== 0) {
        grid[(y - stat.minY + 1) * gridWidth + (x - stat.minX + 1)] = 1;
      }
    }
  }
  return {
    grid,
    width: gridWidth,
    height: gridHeight,
    offsetX: stat.minX - 1,
    offsetY: stat.minY - 1,
    count: stat.count,
  };
}

/* ---------- Skeletonisasi Zhang-Suen ---------- */

function thinRegion(grid, width, height) {
  let changed = true;
  while (changed) {
    changed = thinPass(grid, width, height, 0);
    if (thinPass(grid, width, height, 1)) changed = true;
  }
}

function thinPass(grid, width, height, step) {
  const toClear = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (grid[index] !== 1) continue;
      const p2 = grid[index - width];
      const p3 = grid[index - width + 1];
      const p4 = grid[index + 1];
      const p5 = grid[index + width + 1];
      const p6 = grid[index + width];
      const p7 = grid[index + width - 1];
      const p8 = grid[index - 1];
      const p9 = grid[index - width - 1];
      const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      if (neighbors < 2 || neighbors > 6) continue;
      const sequence = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
      let transitions = 0;
      for (let k = 0; k < 8; k += 1) {
        if (sequence[k] === 0 && sequence[k + 1] === 1) transitions += 1;
      }
      if (transitions !== 1) continue;
      if (step === 0) {
        if (p2 * p4 * p6 !== 0) continue;
        if (p4 * p6 * p8 !== 0) continue;
      } else {
        if (p2 * p4 * p8 !== 0) continue;
        if (p2 * p6 * p8 !== 0) continue;
      }
      toClear.push(index);
    }
  }
  if (toClear.length === 0) return false;
  for (const index of toClear) grid[index] = 0;
  return true;
}

/* ---------- Perunututan skeleton ---------- */

// Koneksi 8-tetangga dengan penekanan tepi diagonal semu: sisi diagonal
// (dx != 0 dan dy != 0) diabaikan bila salah satu piksel jembatan 4-tetangganya
// hadir, karena jalur melalui jembatan tetap menyambung. Tanpa penekanan ini,
// sudut siku-siku hasil Zhang-Suen (piksel horizontal dan vertikal yang saling
// diagonal di sekitar piksel sudut) menghasilkan simpul semu derajat 3 sehingga
// loop tertutup tidak pernah dikenali dan terpecah menjadi rantai terbuka.
function isConnected(grid, width, x, y, nx, ny) {
  if (grid[ny * width + nx] !== 1) return false;
  const dx = nx - x;
  const dy = ny - y;
  if (dx !== 0 && dy !== 0) {
    if (grid[y * width + nx] === 1 || grid[ny * width + x] === 1) return false;
  }
  return true;
}

// traceSkeleton -> rantai piksel: { points: [{x,y}], closed }.
// Simpul (tetangga 1 = ujung; >= 3 = simpang) menjadi titik ujung rantai;
// piksel bersarang tumpang tindih pada simpang agar garis menyambung secara
// visual. Loop tanpa simpul dirunut sebagai rantai tertutup.
function traceSkeleton(grid, width, height) {
  const degrees = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (grid[index] !== 1) continue;
      degrees[index] = countSkeletonNeighbors(grid, width, x, y);
    }
  }
  const visited = new Uint8Array(width * height);
  const chains = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (grid[index] !== 1 || (degrees[index] !== 1 && degrees[index] < 3)) continue;
      visited[index] = 1;
      for (const [nx, ny] of neighbors8(x, y)) {
        const neighborIndex = ny * width + nx;
        if (!isConnected(grid, width, x, y, nx, ny) || visited[neighborIndex]) continue;
        if (degrees[index] >= 3 && degrees[neighborIndex] >= 3) continue;
        const chain = walkChain(grid, degrees, visited, width, height, x, y, nx, ny);
        if (chain.points.length >= 2) chains.push(chain);
      }
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (grid[index] !== 1 || visited[index] || degrees[index] !== 2) continue;
      const chain = walkLoop(grid, visited, width, height, x, y);
      if (chain.points.length >= 3) chains.push(chain);
    }
  }
  return chains;
}

function countSkeletonNeighbors(grid, width, x, y) {
  let count = 0;
  for (const [nx, ny] of neighbors8(x, y)) {
    if (isConnected(grid, width, x, y, nx, ny)) count += 1;
  }
  return count;
}

function neighbors8(x, y) {
  return [
    [x - 1, y - 1],
    [x, y - 1],
    [x + 1, y - 1],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
    [x - 1, y + 1],
    [x - 1, y],
  ];
}

// Jalur dari simpul (startX, startY) menuju tetangganya (firstX, firstY);
// berhenti pada simpul berikutnya (disertakan) atau bila buntu.
function walkChain(grid, degrees, visited, width, height, startX, startY, firstX, firstY) {
  const points = [{ x: startX, y: startY }];
  let previousX = startX;
  let previousY = startY;
  let currentX = firstX;
  let currentY = firstY;
  while (true) {
    const currentIndex = currentY * width + currentX;
    points.push({ x: currentX, y: currentY });
    if (degrees[currentIndex] !== 2) {
      visited[currentIndex] = 1;
      break;
    }
    visited[currentIndex] = 1;
    let nextX = -1;
    let nextY = -1;
    for (const [nx, ny] of neighbors8(currentX, currentY)) {
      if (nx === previousX && ny === previousY) continue;
      const nIndex = ny * width + nx;
      if (isConnected(grid, width, currentX, currentY, nx, ny) && !visited[nIndex]) {
        nextX = nx;
        nextY = ny;
        break;
      }
    }
    if (nextX === -1) break;
    previousX = currentX;
    previousY = currentY;
    currentX = nextX;
    currentY = nextY;
  }
  return { points, closed: false };
}

// Loop tertutup: dirunut dari piksel berderajat 2 sampai kembali ke titik awal.
function walkLoop(grid, visited, width, height, startX, startY) {
  const startIndex = startY * width + startX;
  const points = [{ x: startX, y: startY }];
  visited[startIndex] = 1;
  let firstX = -1;
  let firstY = -1;
  for (const [nx, ny] of neighbors8(startX, startY)) {
    const nIndex = ny * width + nx;
    if (grid[nIndex] === 1 && !visited[nIndex]) {
      firstX = nx;
      firstY = ny;
      break;
    }
  }
  if (firstX === -1) return { points, closed: false };
  let previousX = startX;
  let previousY = startY;
  let currentX = firstX;
  let currentY = firstY;
  while (currentX !== startX || currentY !== startY) {
    const currentIndex = currentY * width + currentX;
    points.push({ x: currentX, y: currentY });
    visited[currentIndex] = 1;
    let nextX = -1;
    let nextY = -1;
    for (const [nx, ny] of neighbors8(currentX, currentY)) {
      if (nx === previousX && ny === previousY) continue;
      const nIndex = ny * width + nx;
      if (isConnected(grid, width, currentX, currentY, nx, ny) && (nIndex === startIndex || !visited[nIndex])) {
        nextX = nx;
        nextY = ny;
        break;
      }
    }
    if (nextX === -1) return { points, closed: false };
    previousX = currentX;
    previousY = currentY;
    currentX = nextX;
    currentY = nextY;
  }
  return { points, closed: true };
}

function chainLength(chain) {
  let length = 0;
  for (let i = 1; i < chain.points.length; i += 1) {
    length += Math.hypot(
      chain.points[i].x - chain.points[i - 1].x,
      chain.points[i].y - chain.points[i - 1].y
    );
  }
  return length;
}
