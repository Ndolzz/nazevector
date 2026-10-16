// js/modules/exportManager.js — Orkestrasi pipeline ekspor.
// Tahap vektorisasi (VE-1) kini berjalan nyata: mask dihitung ulang dari gambar
// dan pengaturan saat tombol ditekan (tanpa state kedaluwarsa), lalu divectorisasi.
// Tahap adapter XML (AM-1) dan validasi (XV-1) masih stub eksplisit yang melempar
// PipelineNotAvailableError; pesannya diteruskan ke pengguna apa adanya.
// Tidak ada berkas XML palsu yang dihasilkan.

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
    const xml = buildAlightMotionXml(vectorData);
    validateAlightMotionXml(xml);
    return { ok: true, xml };
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
