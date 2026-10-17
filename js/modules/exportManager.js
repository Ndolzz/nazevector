// js/modules/exportManager.js — Orkestrasi pipeline ekspor.
// Tahap yang berjalan nyata (v0.5.1): piksel sumber dibaca SEKALI saat tombol
// ditekan (tanpa state kedaluwarsa), mask siluet dihitung dari piksel itu
// (VE-1), lalu vektorisasi kontur. Mode representasi "isi" menulis outline
// terisi per komponen (AM-4); mode "garis" mengekstraksi centerline per goresan
// (VE-3); mode "kontur" menulis satu layer per kontur — kontur luar maupun
// lubang (AM-6). Mode warna "pilihan" memakai satu warna global; mode "asli"
// mensampling warna dominan piksel sumber per komponen (CV-1) atau per kontur
// (CV-2) sesuai mode representasi. Hasil diserialisasi menjadi XML Alight
// Motion (AM-1) dan divalidasi (XV-1).
// Batas jujur: keluaran berupa bentuk statis tanpa keyframe (AN-1 belum
// dikerjakan); mode garis, mode kontur, dan warna asli belum diuji pada
// perangkat nyata.

import { getCanvasPixelData, computeSilhouetteMaskFromPixels } from './silhouette.js';
import { vectorizeSilhouette } from './vectorEngine.js';
import { extractCenterlines } from './centerline.js';
import { sampleComponentColors, sampleContourColors } from './colorSampling.js';
import { buildAlightMotionXml } from './amAdapter.js';
import { validateAlightMotionXml } from './xmlValidation.js';

export function requestXmlExport(state) {
  try {
    if (!state || !state.image || !state.image.canvas) {
      return {
        ok: false,
        message: 'Unggah gambar terlebih dahulu sebelum mengekspor.',
      };
    }
    const representation =
      state.exportRepresentation === 'garis'
        ? 'garis'
        : state.exportRepresentation === 'kontur'
          ? 'kontur'
          : 'isi';
    const colorMode = state.exportColorMode === 'asli' ? 'asli' : 'pilihan';
    const pixelData = getCanvasPixelData(state.image.canvas);
    if (!pixelData) {
      return {
        ok: false,
        message: 'Piksel gambar tidak dapat dibaca; pastikan gambar telah selesai dimuat.',
      };
    }
    const mask = computeSilhouetteMaskFromPixels(
      pixelData.data,
      pixelData.width,
      pixelData.height,
      state.vector.mode,
      state.vector.threshold
    );
    const vectorData = vectorizeSilhouette(mask, state.vector);
    if (vectorData.empty) {
      return {
        ok: false,
        message:
          'Tidak ada siluet yang terdeteksi pada ambang saat ini. Ubah ambang atau mode siluet lalu coba lagi.',
      };
    }
    const exportOptions = {
      color: state.vector.color,
      representation,
    };
    if (colorMode === 'asli') {
      const pixelSource = { data: pixelData.data, width: pixelData.width, height: pixelData.height };
      if (representation === 'kontur') {
        exportOptions.contourColors = sampleContourColors(mask, pixelSource, vectorData);
      } else {
        exportOptions.componentColors = sampleComponentColors(mask, pixelSource, vectorData);
      }
    }
    if (representation === 'garis') {
      const centerlineData = extractCenterlines(mask, vectorData);
      if (centerlineData.empty) {
        return {
          ok: false,
          message:
            'Tidak ada garis yang dapat diekstraksi pada ambang saat ini. Mode garis paling cocok untuk line art dengan goresan tipis; untuk bentuk terisi gunakan mode isi, atau ubah ambang lalu coba lagi.',
        };
      }
      exportOptions.centerlineData = centerlineData;
    }
    if (typeof state.exportName === 'string' && state.exportName.trim().length > 0) {
      exportOptions.title = state.exportName;
    }
    const xml = buildAlightMotionXml(vectorData, exportOptions);
    const validation = validateAlightMotionXml(xml);
    if (!validation.valid) {
      return {
        ok: false,
        message: 'XML tidak lolos validasi lokal: ' + validation.issues.join(' '),
        validation,
      };
    }
    return { ok: true, xml, validation };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Ekspor gagal karena kesalahan yang tidak diketahui.',
    };
  }
}
