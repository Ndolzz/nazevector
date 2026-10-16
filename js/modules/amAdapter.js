// js/modules/amAdapter.js — Serializer XML Alight Motion (stub eksplisit, AM-1 di backlog).
// Kontrak tahap berikutnya:
//   buildAlightMotionXml(vectorPathData, animationClipData) -> string XML
// Basis rujukan: dokumentasi komunitas (lihat docs/SDD.md 2.3). Tidak ada klaim
// kompatibilitas sebelum lulus uji impor nyata (backlog TS-1).

import { PipelineNotAvailableError } from './pipelineErrors.js';

export const AM_ADAPTER_STATUS = {
  id: 'AM',
  label: 'Adapter XML Alight Motion',
  reason:
    'Format XML Alight Motion belum terverifikasi melalui uji impor nyata. Rincian risiko ada di docs/SDD.md.',
};

export function buildAlightMotionXml() {
  throw new PipelineNotAvailableError(AM_ADAPTER_STATUS.label, AM_ADAPTER_STATUS.reason);
}
