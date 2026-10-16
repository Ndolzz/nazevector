// js/modules/exportManager.js — Orkestrasi pipeline ekspor.
// Tahap yang berjalan nyata: mask dihitung ulang dari gambar dan pengaturan saat
// tombol ditekan (tanpa state kedaluwarsa), lalu divectorisasi (VE-1), lalu
// diserialisasi menjadi XML Alight Motion (AM-1) dan divalidasi (XV-1).
// Keluaran berupa bentuk statis tanpa keyframe (AN-1 belum dikerjakan);
// kompatibilitas impor belum diuji (TS-1) — tidak ada klaim kompatibilitas.

import { computeSilhouetteMask } from './silhouette.js';
import { vectorizeSilhouette } from './vectorEngine.js';
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
    const mask = computeSilhouetteMask(
      state.image.canvas,
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
    };
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
