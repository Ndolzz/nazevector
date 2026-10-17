// js/ui/previewPanel.js — Pratinjau gambar asli, siluet raster, hasil vektor, dan animasi.
//
// P1 (v0.4.3): mask pratinjau dihitung pada resolusi kerja pratinjau
// (PREVIEW_MAX_DIMENSION, lihat silhouette.js) dari kanvas yang diperkecil pada
// kanvas luar layar yang dipakai ulang antar penghitungan. Jalur ekspor tidak
// terpengaruh: exportManager tetap menghitung mask pada resolusi penuh.
// Kanvas pratinjau ditampilkan dengan object-fit: contain sehingga ukuran
// tampilan tidak berubah; hanya resolusi kerjanya yang mengecil.
// Debounce penghitungan mask dinaikkan menjadi 150 ms agar geser slider ambang
// pada perangkat lambat tidak mengantrekan penghitungan berat berulang; state
// selalu dibaca ulang saat eksekusi sehingga pekerjaan lama yang tertinggal
// otomatis digantikan oleh parameter terkini (docs/SDD.md bagian 13).

import { qs } from '../dom.js';
import {
  computeSilhouetteMask,
  computePreviewDimensions,
  PREVIEW_MAX_DIMENSION,
  renderSilhouetteToCanvas,
} from '../modules/silhouette.js';
import { vectorizeSilhouette, buildSvgDocument } from '../modules/vectorEngine.js';
import { applyAnimationToElement, getPresetById } from '../modules/animation.js';
import { releaseImage } from '../modules/imageImport.js';

const MASK_COMPUTE_DEBOUNCE_MS = 150;
const VECTOR_COMPUTE_DEBOUNCE_MS = 30;

export function initPreviewPanel(store) {
  const uploadZone = qs('#upload-zone');
  const fileInput = qs('#file-input');
  const originalImg = qs('#original-preview');
  const silhouetteCanvas = qs('#silhouette-canvas');
  const emptyState = qs('#silhouette-empty');
  const processingOverlay = qs('#silhouette-processing');
  const vectorOutput = qs('#vector-output');
  const vectorEmpty = qs('#vector-empty');
  const vectorStats = qs('#vector-stats');
  const vectorProcessing = qs('#vector-processing');
  const meta = qs('#preview-meta');
  const btnReplace = qs('#btn-replace');
  const btnClear = qs('#btn-clear');

  let maskData = null;
  let vectorData = null;
  let lastImage = null;
  let lastMode = null;
  let lastThreshold = null;
  let lastColor = null;
  let lastSimplification = null;
  let localComputing = false;
  let computeScheduled = false;
  let vectorScheduled = false;
  let lastAnimKey = '';
  let lastPlayback = 'idle';
  let previewCanvas = null; // kanvas luar layar untuk pengecilan pratinjau (dipakai ulang)
  let previewContext = null;

  btnReplace.addEventListener('click', () => fileInput.click());
  btnClear.addEventListener('click', () => {
    const current = store.get().image;
    if (current) {
      releaseImage(current);
    }
    store.set({
      image: null,
      importError: null,
      playback: 'idle',
      playbackEpoch: store.get().playbackEpoch + 1,
    });
  });

  store.subscribe(render);
  render(store.get());

  function render(state) {
    const { image } = state;

    uploadZone.hidden = !!image;
    btnReplace.disabled = !image;
    btnClear.disabled = !image;

    if (image) {
      meta.textContent =
        image.name + ' — ' + image.originalWidth + '\u00D7' + image.originalHeight +
        ' px — ' + formatBytes(image.size);
      originalImg.hidden = false;
      if (originalImg.getAttribute('src') !== image.url) {
        originalImg.setAttribute('src', image.url);
        originalImg.setAttribute('alt', 'Pratinjau ' + image.name);
      }
      emptyState.hidden = true;
    } else {
      meta.textContent = 'Belum ada gambar.';
      originalImg.hidden = true;
      originalImg.removeAttribute('src');
      emptyState.hidden = false;
    }

    if (!image) {
      maskData = null;
      vectorData = null;
      silhouetteCanvas.hidden = true;
      silhouetteCanvas.style.animation = 'none';
      vectorOutput.hidden = true;
      vectorOutput.textContent = '';
      vectorStats.textContent = '';
      vectorEmpty.hidden = false;
      vectorEmpty.textContent = 'Unggah gambar untuk melihat hasil vektor.';
    } else {
      silhouetteCanvas.hidden = false;
      const maskKeyChanged =
        image !== lastImage ||
        state.vector.mode !== lastMode ||
        state.vector.threshold !== lastThreshold;
      if (maskKeyChanged) {
        // Mask, pratinjau raster, dan vektor dihitung ulang dari state terkini
        // di dalam scheduleCompute (dibaca ulang saat eksekusi, bukan saat penjadwalan).
        scheduleCompute();
      } else {
        if (state.vector.color !== lastColor) {
          if (maskData) {
            renderSilhouetteToCanvas(silhouetteCanvas, maskData, state.vector.color);
          }
          if (vectorData && !vectorData.empty) {
            renderVectorSvg();
          }
          lastColor = state.vector.color;
        }
        if (state.vector.simplification !== lastSimplification && maskData) {
          scheduleVectorCompute();
        }
      }
    }

    processingOverlay.hidden = !(state.isProcessing || localComputing);
    applyAnimation(state);
  }

  function scheduleCompute() {
    if (computeScheduled) return;
    computeScheduled = true;
    setTimeout(() => {
      computeScheduled = false;
      const state = store.get();
      if (!state.image) return;
      localComputing = true;
      processingOverlay.hidden = false;
      vectorProcessing.hidden = false;
      maskData = computePreviewMask(state.image.canvas, state.vector.mode, state.vector.threshold);
      renderSilhouetteToCanvas(silhouetteCanvas, maskData, state.vector.color);
      computeVector(state);
      lastImage = state.image;
      lastMode = state.vector.mode;
      lastThreshold = state.vector.threshold;
      lastColor = state.vector.color;
      localComputing = false;
      processingOverlay.hidden = !store.get().isProcessing;
      vectorProcessing.hidden = true;
    }, MASK_COMPUTE_DEBOUNCE_MS);
  }

  function scheduleVectorCompute() {
    if (vectorScheduled) return;
    vectorScheduled = true;
    setTimeout(() => {
      vectorScheduled = false;
      const state = store.get();
      if (!state.image || !maskData) return;
      vectorProcessing.hidden = false;
      computeVector(state);
      vectorProcessing.hidden = true;
    }, VECTOR_COMPUTE_DEBOUNCE_MS);
  }

  // Mask pratinjau: gambar diperkecil ke dimensi kerja pratinjau pada kanvas
  // luar layar yang dipakai ulang, lalu mask dihitung dari pikselnya. Gambar
  // yang sudah di bawah batas tidak diperkecil (mask identik jalur resolusi penuh).
  function computePreviewMask(sourceCanvas, mode, threshold) {
    const dims = computePreviewDimensions(
      sourceCanvas.width,
      sourceCanvas.height,
      PREVIEW_MAX_DIMENSION
    );
    if (dims.width === sourceCanvas.width && dims.height === sourceCanvas.height) {
      return computeSilhouetteMask(sourceCanvas, mode, threshold);
    }
    if (!previewCanvas) {
      previewCanvas = document.createElement('canvas');
      previewContext = previewCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (previewCanvas.width !== dims.width || previewCanvas.height !== dims.height) {
      previewCanvas.width = dims.width; // pengaturan ukuran sekaligus menghapus isi
      previewCanvas.height = dims.height;
    } else {
      previewContext.clearRect(0, 0, dims.width, dims.height);
    }
    previewContext.drawImage(sourceCanvas, 0, 0, dims.width, dims.height);
    return computeSilhouetteMask(previewCanvas, mode, threshold);
  }

  function computeVector(state) {
    try {
      vectorData = vectorizeSilhouette(maskData, state.vector);
    } catch (error) {
      vectorData = null;
      vectorOutput.hidden = true;
      vectorOutput.textContent = '';
      vectorStats.textContent = '';
      vectorEmpty.hidden = false;
      vectorEmpty.textContent =
        'Vektorisasi gagal: ' +
        (error instanceof Error ? error.message : 'kesalahan tidak diketahui.');
      return;
    }
    lastSimplification = state.vector.simplification;
    renderVectorResult(state);
  }

  function renderVectorResult(state) {
    if (!vectorData || vectorData.empty) {
      vectorOutput.hidden = true;
      vectorOutput.textContent = '';
      vectorStats.textContent = '';
      vectorEmpty.hidden = false;
      vectorEmpty.textContent = vectorData && vectorData.empty
        ? 'Tidak ada siluet yang terdeteksi. Ubah ambang atau mode siluet.'
        : 'Unggah gambar untuk melihat hasil vektor.';
      return;
    }
    vectorEmpty.hidden = true;
    vectorOutput.innerHTML = buildSvgDocument(vectorData, state.vector.color);
    vectorOutput.hidden = false;
    vectorStats.textContent =
      vectorData.componentCount +
      ' komponen — ' +
      vectorData.pathCount +
      ' kontur — ' +
      vectorData.vertexCount +
      ' titik';
    // Elemen svg baru dibuat: terapkan kembali animasi dari state terkini.
    applyAnimationToVector(state);
  }

  function renderVectorSvg() {
    if (!vectorData || vectorData.empty) return;
    const state = store.get();
    vectorOutput.innerHTML = buildSvgDocument(vectorData, state.vector.color);
    applyAnimationToVector(state);
  }

  function applyAnimationToVector(state) {
    const svgElement = vectorOutput.querySelector('svg');
    if (!svgElement) return;
    applyAnimationToElement(
      svgElement,
      getPresetById(state.animation.preset),
      state.animation.duration,
      state.animation.intensity,
      state.playback
    );
  }

  function applyAnimation(state) {
    const { image, animation, playback } = state;
    const configKey = [
      image ? image.name : '',
      animation.preset,
      animation.duration,
      animation.intensity,
      state.playbackEpoch,
    ].join('|');
    const transitionNeedsFullApply = lastPlayback === 'idle' || playback === 'idle';

    if (!image) {
      lastAnimKey = configKey;
      lastPlayback = playback;
      silhouetteCanvas.style.animation = 'none';
      return;
    }

    if (configKey !== lastAnimKey || transitionNeedsFullApply) {
      const preset = getPresetById(animation.preset);
      applyAnimationToElement(
        silhouetteCanvas,
        preset,
        animation.duration,
        animation.intensity,
        playback
      );
      applyAnimationToVector(state);
    } else {
      const playState = playback === 'playing' ? 'running' : 'paused';
      silhouetteCanvas.style.animationPlayState = playState;
      const svgElement = vectorOutput.querySelector('svg');
      if (svgElement) {
        svgElement.style.animationPlayState = playState;
      }
    }
    lastAnimKey = configKey;
    lastPlayback = playback;
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
