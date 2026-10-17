// js/modules/amAdapter.js — Serializer XML Alight Motion (AM-1 + AM-2 + AM-3, v0.4.2).
// Membangun dokumen scene XML Alight Motion dari VectorPathData (keluaran VE-1):
// satu elemen <shape> non-live (imported) dengan outline pada <path d="..."/>.
// Bukti AM-3 (v0.4.2): parser asli Alight Motion 5.0.273 (dekompilasi,
// ShapeElementTypeImpl.unserializeElement) hanya membaca outline shape imported
// dari tag <path> dengan atribut d (konstanta "path"), dan serializer asli
// menulis outline non-keyed sebagai <path d="..."/> langsung di bawah <shape>
// setelah common child tags. Ekspor asli (preset/Proyek Baru 19.xml, AM
// 5.0.273.1028425) memuat <path d="M -360.0 -640.0L 360.0 -640.0...Z"/>. Struktur
// <parameter><contour d/></parameter> (v0.4.1) TIDAK dibaca parser: berkas dapat
// diimpor namun shape tanpa outline sehingga kanvas tampak kosong.
// Pola AM-2 (v0.4.1) dipertahankan: prolog <?xml?>, scene memuat
// precompose/retime/retimeAdaptFPS, setiap elemen memuat mediaFillMode
// (lihat docs/SDD.md bagian 11 dan 12).
// Batas jujur: keluaran berupa bentuk statis TANPA keyframe (AN-1 belum dikerjakan)
// dan impor nyata belum terbukti: ekspor v0.4.1 berhasil diimpor namun shape tidak
// terlihat; struktur v0.4.2 diselaraskan dengan parser asli namun wajib diuji ulang
// di perangkat nyata (TS-1).
// Asumsi belum terverifikasi penuh (menunggu TS-1): kontur bentuk imported
// diposisikan terpusat relatif terhadap transform.location — bukti tidak langsung:
// ekspor asli Proyek Baru 19.xml memuat path rect media 720x1280 dari (-360,-640)
// sampai (360,640) terpusat (0,0) dengan location menentukan posisi di kanvas,
// sehingga kontur digeser (-width/2, -height/2) dan location diisi pusat kanvas.

export const AM_ADAPTER_STATUS = {
  id: 'AM',
  label: 'Adapter XML Alight Motion',
  reason:
    'Menghasilkan XML scene berisi satu bentuk statis (tanpa keyframe). Outline memakai tag path sesuai parser asli Alight Motion (AM-3); impor nyata belum terbukti (TS-1).',
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

// Prolog ditulis oleh setiap ekspor asli Alight Motion yang diperiksa (AM-2).
const XML_PROLOG = '<?xml version=\'1.0\' encoding=\'UTF-8\' ?>';

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
  // Digabung tanpa separator antar kontur: serializer asli (CubicBSplineKt.toSVGPath
  // pada CompoundCubicBSpline) memakai joinToString dengan separator kosong sehingga
  // pola "Z" + "M..." menjadi token "ZM" yang didukung parser asli (AM-3).
  const outline = subpaths
    .map((subpath) => pathD(subpath.points, centerX, centerY))
    .join('');

  return (
    XML_PROLOG +
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
    '" precompose="dynamicResolution" bgcolor="#00000000" totalTime="' +
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
    '" retime="freeze" retimeAdaptFPS="false">' +
    '<shape id="1" label="Shape 1" startTime="0" endTime="' +
    totalTime +
    '" fillType="color" mediaFillMode="fill">' +
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
    '<path d="' +
    outline +
    '"/>' +
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

// pathD meniru format serializer asli (CubicBSplineKt.toSVGPath): "M x y" lalu
// "L x y" per titik, dengan titik awal diulang sebagai L terakhir sebelum
// penutup "Z" — persis pola ekspor asli "M -360.0 -640.0L ... L -360.0 -640.0Z".
// Parser asli mendukung perintah M, L, C, Z/z, dan token "ZM" antar kontur.
function pathD(points, offsetX, offsetY) {
  const x0 = points[0][0] - offsetX;
  const y0 = points[0][1] - offsetY;
  let d = 'M ' + x0 + ' ' + y0;
  for (let i = 1; i < points.length; i += 1) {
    d += 'L ' + (points[i][0] - offsetX) + ' ' + (points[i][1] - offsetY);
  }
  return d + 'L ' + x0 + ' ' + y0 + 'Z';
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
