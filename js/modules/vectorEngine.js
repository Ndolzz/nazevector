// js/modules/vectorEngine.js — Mesin vektorisasi mask siluet menjadi path SVG (VE-1).
// Algoritma: penelusuran kontur "crack boundary" (marching squares) di atas grid
// sudut piksel, lalu penyederhanaan Ramer-Douglas-Peucker per kontur tertutup.
// Murni lokal: hanya komputasi array, tanpa DOM dan tanpa dependensi.
//
// Optimasi P1 (v0.4.3): tabel tepi terlacak disimpan pada Uint8Array berbit per
// arah (satu byte per sudut grid; bit 0-3 menandai arah yang sudah dilalui)
// menggantikan Set dengan kunci numerik besar. Sandungan (x, y, dir) ke byte
// adalah bijektif terhadap kunci edgeKey lama, sehingga urutan, peran, dan
// geometri kontur identik dengan implementasi sebelumnya — dibuktikan regresi
// 96 perbandingan mesin lama vs baru (subpath, role, d, SVG identik) pada mask
// uji, mask acak, dan mask sintetis tiga ukuran (docs/SDD.md bagian 13).
// Scan tetap mengunjungi tiap piksel sekali; pemeriksaan tetangga dibaca langsung
// dari mask (tanpa pemanggilan closure per piksel).

export const SIMPLIFICATION_LEVELS = {
  rendah: { tolerancePx: 0.3 },
  sedang: { tolerancePx: 1.5 },
  tinggi: { tolerancePx: 3.5 },
};

const DEFAULT_COLOR = '#3B82F6';
const DX = [-1, 0, 1, 0]; // kiri, bawah, kanan, atas
const DY = [0, 1, 0, -1];

// vectorizeSilhouette(maskData, vectorSettings) -> VectorPathData
//   maskData      : keluaran computeSilhouetteMask — { mask, width, height }
//   vectorSettings: { simplification: 'rendah'|'sedang'|'tinggi', tolerancePx?, color? }
//   VectorPathData = {
//     ok, empty, svg, width, height, pathCount, componentCount, vertexCount,
//     tolerancePx, subpaths: [{ role: 'outer'|'hole', points, d, vertexCount, area }]
//   }
// Mask kosong bukan kesalahan: hasilnya empty=true tanpa svg.
// Input yang tidak valid melempar Error dengan pesan yang dapat dipahami pengguna.
export function vectorizeSilhouette(maskData, vectorSettings = {}) {
  const { mask, width, height } = validateMask(maskData);
  const tolerancePx = resolveTolerancePx(vectorSettings);
  const color = sanitizeColorHex(vectorSettings.color);

  const isInside = (x, y) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] > 0;
  // Tepi terarah (x, y, dir) pada grid sudut [0..width] x [0..height]:
  // satu byte per sudut (stride width+1), bit ke-dir menyala bila tepi dilalui.
  const stride = width + 1;
  const visited = new Uint8Array(stride * (height + 1));
  const subpaths = [];

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const rowAbove = row - width;
    const rowBelow = row + width;
    const hasAbove = y > 0;
    const hasBelow = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x] === 0) continue;
      // Empat tetangga: setiap crack antar piksel dalam/luar punya tepat satu arah.
      // Pembacaan tetangga langsung dari mask setara isInside(x, y±1)/(x±1, y).
      if (!(hasAbove && mask[rowAbove + x] > 0)) traceLoopIfNew(x + 1, y, 0);
      if (!(hasBelow && mask[rowBelow + x] > 0)) traceLoopIfNew(x, y + 1, 2);
      if (!(x > 0 && mask[row + x - 1] > 0)) traceLoopIfNew(x, y, 1);
      if (!(x < width - 1 && mask[row + x + 1] > 0)) traceLoopIfNew(x + 1, y + 1, 3);
    }
  }

  function traceLoopIfNew(startX, startY, startDir) {
    if (visited[startY * stride + startX] & (1 << startDir)) return;
    const loop = traceLoop(startX, startY, startDir, isInside, visited, stride);
    const merged = mergeCollinear(loop);
    if (merged.length < 4) return; // kontur degenerasi: tidak menghasilkan subpath
    const signedArea2 = shoelace2(merged);
    const role = signedArea2 < 0 ? 'outer' : 'hole';
    let points = simplifyRing(merged, tolerancePx);
    enforceOrientation(points, role);
    subpaths.push({
      role,
      points,
      d: ringToPathD(points),
      vertexCount: points.length,
      area: Math.abs(shoelace2(points)) / 2,
    });
  }

  const pathCount = subpaths.length;
  const componentCount = subpaths.reduce(
    (count, subpath) => count + (subpath.role === 'outer' ? 1 : 0),
    0
  );
  const vertexCount = subpaths.reduce(
    (count, subpath) => count + subpath.vertexCount,
    0
  );

  const result = {
    ok: true,
    empty: pathCount === 0,
    svg: null,
    width,
    height,
    pathCount,
    componentCount,
    vertexCount,
    tolerancePx,
    subpaths,
  };
  if (pathCount > 0) {
    result.svg = buildSvgDocument(result, color);
  }
  return result;
}

// buildSvgDocument(vectorPathData, colorHex) -> string
// Membangun ulang dokumen SVG dari geometri yang sudah dihitung, misalnya saat
// hanya warna siluet yang berubah. Mengembalikan string kosong bila tidak ada kontur.
export function buildSvgDocument(vectorPathData, colorHex) {
  if (
    !vectorPathData ||
    !vectorPathData.ok ||
    vectorPathData.empty ||
    !Array.isArray(vectorPathData.subpaths) ||
    vectorPathData.subpaths.length === 0
  ) {
    return '';
  }
  const color = sanitizeColorHex(colorHex);
  const d = vectorPathData.subpaths.map((subpath) => subpath.d).join(' ');
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    vectorPathData.width +
    ' ' +
    vectorPathData.height +
    '" width="' +
    vectorPathData.width +
    '" height="' +
    vectorPathData.height +
    '" role="img" aria-label="Siluet vektor">' +
    '<path fill-rule="evenodd" fill="' +
    color +
    '" d="' +
    d +
    '" /></svg>'
  );
}

// simplifyPolyline(points, tolerancePx) -> titik poliline hasil RDP.
// Pembantu murni untuk modul lain (VE-3, v0.5.0): penyederhanaan poliline
// terbuka dengan titik ujung selalu dipertahankan; memakai implementasi
// RDP yang sama dengan kontur siluet agar perilaku konsisten.
export function simplifyPolyline(points, tolerance) {
  if (!Array.isArray(points) || points.length === 0) return [];
  return rdpSimplify(points, tolerance);
}

/* ---------- Validasi input ---------- */

function validateMask(maskData) {
  if (!maskData || typeof maskData !== 'object') {
    throw new Error('Data mask siluet tidak valid.');
  }
  const { mask, width, height } = maskData;
  const validDimension =
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0;
  if (!validDimension) {
    throw new Error('Dimensi mask tidak valid.');
  }
  if (!mask || typeof mask.length !== 'number' || mask.length !== width * height) {
    throw new Error('Panjang mask tidak sesuai dengan dimensi.');
  }
  return { mask, width, height };
}

function resolveTolerancePx(vectorSettings) {
  const override = vectorSettings.tolerancePx;
  if (typeof override === 'number' && Number.isFinite(override) && override >= 0) {
    return override;
  }
  const level = SIMPLIFICATION_LEVELS[vectorSettings.simplification];
  return level ? level.tolerancePx : SIMPLIFICATION_LEVELS.sedang.tolerancePx;
}

function sanitizeColorHex(colorHex) {
  if (typeof colorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(colorHex)) {
    return colorHex.toUpperCase();
  }
  return DEFAULT_COLOR;
}

/* ---------- Penelusuran kontur (marching squares pada crack boundary) ---------- */

function hasOutgoing(isInside, x, y, dir) {
  switch (dir) {
    case 0: // kiri: piksel kiri-bawah dalam, kiri-atas luar
      return isInside(x - 1, y) && !isInside(x - 1, y - 1);
    case 1: // bawah: piksel kanan-bawah dalam, kiri-bawah luar
      return isInside(x, y) && !isInside(x - 1, y);
    case 2: // kanan: piksel kanan-atas dalam, kanan-bawah luar
      return isInside(x, y - 1) && !isInside(x, y);
    case 3: // atas: piksel kiri-atas dalam, kanan-atas luar
      return isInside(x - 1, y - 1) && !isInside(x, y - 1);
    default:
      return false;
  }
}

function nextDir(isInside, x, y, arrivalDir) {
  // Preferensi belok: kiri, lurus, kanan. Konvensi ini menjaga sisi dalam selalu
  // di kiri arah jalan dan memisahkan komponen yang bersentuhan diagonal.
  const candidates = [(arrivalDir + 1) % 4, arrivalDir, (arrivalDir + 3) % 4];
  for (const dir of candidates) {
    if (hasOutgoing(isInside, x, y, dir)) return dir;
  }
  throw new Error('Kesalahan internal pelacakan kontur siluet.');
}

function traceLoop(startX, startY, startDir, isInside, visited, stride) {
  const xs = [startX];
  const ys = [startY];
  let x = startX;
  let y = startY;
  let dir = startDir;
  do {
    visited[y * stride + x] |= 1 << dir; // bit ke-dir: tepi (x, y, dir) terlacak
    x += DX[dir];
    y += DY[dir];
    xs.push(x);
    ys.push(y);
    dir = nextDir(isInside, x, y, dir);
  } while (x !== startX || y !== startY || dir !== startDir);
  xs.pop(); // titik terakhir sama dengan titik awal
  ys.pop();
  return { xs, ys };
}

/* ---------- Penggabungan titik kolinear ---------- */

function stepCode(x1, y1, x2, y2) {
  return (x2 - x1) * 2 + (y2 - y1); // unik untuk empat arah kartesian
}

function mergeCollinear(loop) {
  const { xs, ys } = loop;
  const n = xs.length;
  if (n === 0) return [];

  // Putar daftar agar mulai di sudut tempat arah berubah; menjamin kolinearitas
  // titik awal/akhir wraparound ikut tergabung dengan benar.
  let start = -1;
  for (let i = 0; i < n; i += 1) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    if (
      stepCode(xs[prev], ys[prev], xs[i], ys[i]) !==
      stepCode(xs[i], ys[i], xs[next], ys[next])
    ) {
      start = i;
      break;
    }
  }
  if (start === -1) return n === 1 ? [[xs[0], ys[0]]] : [];

  const points = [];
  for (let k = 0; k < n; k += 1) {
    const i = (start + k) % n;
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    if (
      stepCode(xs[prev], ys[prev], xs[i], ys[i]) !==
      stepCode(xs[i], ys[i], xs[next], ys[next])
    ) {
      points.push([xs[i], ys[i]]);
    }
  }
  return points;
}

/* ---------- Geometri ---------- */

function shoelace2(points) {
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

function enforceOrientation(points, role) {
  const area2 = shoelace2(points);
  if (role === 'outer' && area2 > 0) points.reverse();
  if (role === 'hole' && area2 < 0) points.reverse();
}

/* ---------- Penyederhanaan Ramer-Douglas-Peucker ---------- */

function rdpSimplify(points, tolerance) {
  const n = points.length;
  if (n < 3) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let maxDistance = -1;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const [px, py] = points[i];
      const distance =
        length === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs(dx * (py - ay) - dy * (px - ax)) / length;
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const simplified = [];
  for (let i = 0; i < n; i += 1) {
    if (keep[i] === 1) simplified.push(points[i]);
  }
  return simplified;
}

function sliceRing(points, from, to) {
  const n = points.length;
  const chain = [];
  let i = from;
  while (true) {
    chain.push(points[i]);
    if (i === to) break;
    i = (i + 1) % n;
  }
  return chain;
}

function simplifyRing(points, tolerance) {
  if (points.length < 4 || tolerance <= 0) return points.slice();

  let anchorA = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    const [ax, ay] = points[anchorA];
    if (x < ax || (x === ax && y < ay)) anchorA = i;
  }
  let anchorB = -1;
  let bestDistance = -1;
  for (let i = 0; i < points.length; i += 1) {
    if (i === anchorA) continue;
    const dx = points[i][0] - points[anchorA][0];
    const dy = points[i][1] - points[anchorA][1];
    const distance = dx * dx + dy * dy;
    if (distance > bestDistance) {
      bestDistance = distance;
      anchorB = i;
    }
  }

  const chain1 = rdpSimplify(sliceRing(points, anchorA, anchorB), tolerance);
  const chain2 = rdpSimplify(sliceRing(points, anchorB, anchorA), tolerance);
  const ring = chain1.slice(0, -1).concat(chain2.slice(0, -1));
  if (ring.length < 4) return points.slice(); // jangan sampai poligon degenerasi
  return ring;
}

/* ---------- Serialisasi path ---------- */

function ringToPathD(points) {
  let d = '';
  for (let i = 0; i < points.length; i += 1) {
    d += (i === 0 ? 'M' : ' L') + points[i][0] + ' ' + points[i][1];
  }
  return d + ' Z';
}
