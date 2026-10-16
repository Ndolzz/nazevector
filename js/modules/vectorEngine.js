// js/modules/vectorEngine.js — Pembangkit path SVG (stub eksplisit, VE-1 di backlog).
// Kontrak tahap berikutnya:
//   vectorizeSilhouette(imageDescriptor, vectorSettings) -> VectorPathData
//   VectorPathData = { svg: string, pathCount: number, vertexCount: number }

import { PipelineNotAvailableError } from './pipelineErrors.js';

export const VECTOR_ENGINE_STATUS = {
  id: 'VE',
  label: 'Mesin vektorisasi (path SVG)',
  reason:
    'Pratinjau saat ini hanya raster. Konversi siluet menjadi path SVG dijadwalkan pada backlog VE-1.',
};

export function vectorizeSilhouette() {
  throw new PipelineNotAvailableError(VECTOR_ENGINE_STATUS.label, VECTOR_ENGINE_STATUS.reason);
}
