// js/modules/pipelineErrors.js — Kesalahan tahap pipeline yang belum tersedia.

export class PipelineNotAvailableError extends Error {
  constructor(featureLabel, reason) {
    super(featureLabel + ' belum diimplementasikan. ' + reason);
    this.name = 'PipelineNotAvailableError';
    this.featureLabel = featureLabel;
  }
}
