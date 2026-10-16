// js/modules/exportManager.js — Orkestrasi pipeline ekspor.
// Menjalankan tahap pipeline sesuai urutan. Tahap yang belum diimplementasikan
// melempar PipelineNotAvailableError; pesannya diteruskan ke pengguna apa adanya.
// Tidak ada berkas XML palsu yang dihasilkan.

import { vectorizeSilhouette } from './vectorEngine.js';
import { buildAlightMotionXml } from './amAdapter.js';
import { validateAlightMotionXml } from './xmlValidation.js';

export function requestXmlExport() {
  try {
    const vectorPathData = vectorizeSilhouette();
    const xml = buildAlightMotionXml(vectorPathData);
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
