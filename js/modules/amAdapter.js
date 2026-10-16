// js/modules/amAdapter.js — Serializer XML Alight Motion (AM-1, v0.4.0).
// Membangun dokumen scene XML Alight Motion dari VectorPathData (keluaran VE-1):
// satu elemen <shape> non-live (imported) dengan kontur di <parameter><contour>.
// Basis rujukan: dokumentasi komunitas alight-motion-docs (docs/SDD.md 2.3).
// Batas jujur: keluaran berupa bentuk statis TANPA keyframe (AN-1 belum dikerjakan)
// dan kompatibilitas impor belum diuji di aplikasi Alight Motion (TS-1).
// Asumsi belum terverifikasi (menunggu TS-1): kontur bentuk imported diposisikan
// terpusat relatif terhadap transform.location — bukti tidak langsung dari
// dokumentasi komunitas: template .rect berukuran 100x100 digambar terpusat pada
// titik location (scale 1), sehingga kontur digeser (-width/2, -height/2) dan
// location diisi pusat kanvas.

export const AM_ADAPTER_STATUS = {
  id: 'AM',
  label: 'Adapter XML Alight Motion',
  reason:
    'Menghasilkan XML scene berisi satu bentuk statis (tanpa keyframe). Kompatibilitas impor belum diuji di aplikasi Alight Motion (TS-1).',
};

const SCENE_DEFAULTS = {
  title: 'Naze Vector Silhouette',
  totalTime: 5000,
  fps: '30',
  amver: '1028425',
  ffver: '106',
  am: 'com.alightcreative.motion/5.0.273.1028425',
  amplatform: 'android',
};

// buildAlightMotionXml(vectorPathData, options) -> string XML scene.
// options (semua opsional, untuk determinisme pengujian):
//   { title: string, totalTime: int ms, fps: string, modifiedTime: int ms epoch }
export function buildAlightMotionXml(vectorPathData, options = {}) {
  const { width, height, subpaths } = validateVectorData(vectorPathData);
  const title = resolveTitle(options.title);
  const totalTime = resolvePositiveInt(
    options.totalTime !== undefined ? options.totalTime : SCENE_DEFAULTS.totalTime,
    'totalTime'
  );
  const fps = resolveFps(options.fps !== undefined ? options.fps : SCENE_DEFAULTS.fps);
  const modifiedTime = resolveNonNegativeInt(
    options.modifiedTime !== undefined ? options.modifiedTime : Date.now(),
    'modifiedTime'
  );
  const fillColor = resolveFillColor(options.color);

  const centerX = width / 2;
  const centerY = height / 2;
  const contour = subpaths
    .map((subpath) => contourD(subpath.points, centerX, centerY))
    .join(' ');

  return (
    '<scene title="' +
    escapeXml(title) +
    '" width="' +
    width +
    '" height="' +
    height +
    '" exportWidth="' +
    width +
    '" exportHeight="' +
    height +
    '" bgcolor="#00000000" totalTime="' +
    totalTime +
    '" fps="' +
    escapeXml(fps) +
    '" modifiedTime="' +
    modifiedTime +
    '" amver="' +
    SCENE_DEFAULTS.amver +
    '" ffver="' +
    SCENE_DEFAULTS.ffver +
    '" am="' +
    SCENE_DEFAULTS.am +
    '" amplatform="' +
    SCENE_DEFAULTS.amplatform +
    '">' +
    '<shape id="1" label="Shape 1" startTime="0" endTime="' +
    totalTime +
    '" fillType="color">' +
    '<transform>' +
    '<location value="' +
    formatNumber(centerX) +
    ',' +
    formatNumber(centerY) +
    ',0.000000"/>' +
    '</transform>' +
    '<fillColor value="' +
    fillColor +
    '"/>' +
    '<parameter>' +
    '<contour d="' +
    contour +
    '"/>' +
    '</parameter>' +
    '</shape>' +
    '</scene>'
  );
}

/* ---------- Validasi dan resolusi input ---------- */

function validateVectorData(vectorPathData) {
  if (!vectorPathData || typeof vectorPathData !== 'object') {
    throw new Error('Data vektor tidak valid: hasil vektorisasi belum tersedia.');
  }
  const width = vectorPathData.width;
  const height = vectorPathData.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Data vektor tidak valid: dimensi mask harus bilangan bulat positif.');
  }
  if (!Array.isArray(vectorPathData.subpaths) || vectorPathData.subpaths.length === 0) {
    throw new Error('Data vektor tidak valid: tidak ada kontur siluet untuk diekspor.');
  }
  for (const subpath of vectorPathData.subpaths) {
    if (
      !subpath ||
      !Array.isArray(subpath.points) ||
      subpath.points.length < 4 ||
      !subpath.points.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    ) {
      throw new Error('Data vektor tidak valid: kontur siluet tidak lengkap.');
    }
  }
  return { width, height, subpaths: vectorPathData.subpaths };
}

function resolveTitle(title) {
  if (title === undefined || title === null) return SCENE_DEFAULTS.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Judul scene tidak valid: harus berupa teks tak kosong.');
  }
  return title.trim().slice(0, 80);
}

function resolvePositiveInt(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Opsi ' + label + ' tidak valid: harus bilangan bulat positif.');
  }
  return value;
}

function resolveNonNegativeInt(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Opsi ' + label + ' tidak valid: harus bilangan bulat >= 0.');
  }
  return value;
}

function resolveFps(fps) {
  const value = typeof fps === 'number' ? String(fps) : fps;
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) {
    throw new Error('Opsi fps tidak valid: harus angka positif, misalnya "30".');
  }
  return value;
}

function resolveFillColor(colorHex) {
  if (colorHex === undefined || colorHex === null) return '#FF3B82F6';
  if (typeof colorHex !== 'string') {
    throw new Error('Warna siluet tidak valid untuk ekspor.');
  }
  const match = colorHex.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!match) {
    throw new Error('Warna siluet tidak valid untuk ekspor: gunakan format #RRGGBB.');
  }
  return '#FF' + match[1].toUpperCase();
}

/* ---------- Serialisasi ---------- */

function contourD(points, offsetX, offsetY) {
  let d = '';
  for (let i = 0; i < points.length; i += 1) {
    const x = points[i][0] - offsetX;
    const y = points[i][1] - offsetY;
    d += (i === 0 ? 'M' : ' L') + x + ',' + y;
  }
  return d + ' Z';
}

function formatNumber(value) {
  return value.toFixed(6);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
