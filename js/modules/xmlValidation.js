// js/modules/xmlValidation.js — Validasi dokumen XML (stub eksplisit, XV-1 di backlog).
// Kontrak tahap berikutnya:
//   validateAlightMotionXml(xmlString) -> { valid: boolean, issues: string[] }

import { PipelineNotAvailableError } from './pipelineErrors.js';

export const XML_VALIDATION_STATUS = {
  id: 'XV',
  label: 'Validasi XML',
  reason:
    'Validator akan memeriksa well-formedness dan atribut wajib setelah adapter XML tersedia.',
};

export function validateAlightMotionXml() {
  throw new PipelineNotAvailableError(XML_VALIDATION_STATUS.label, XML_VALIDATION_STATUS.reason);
}
