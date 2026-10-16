// js/ui/previewPanel.js — Pratinjau gambar asli, siluet raster, dan pemutaran animasi.

import { qs } from '../dom.js';
import { computeSilhouetteMask, renderSilhouetteToCanvas } from '../modules/silhouette.js';
import { applyAnimationToElement, getPresetById } from '../modules/animation.js';
import { releaseImage } from '../modules/imageImport.js';

export function initPreviewPanel(store) {
  const uploadZone = qs('#upload-zone');
  const fileInput = qs('#file-input');
  const originalImg = qs('#original-preview');
  const silhouetteCanvas = qs('#silhouette-canvas');
  const emptyState = qs('#silhouette-empty');
  const processingOverlay = qs('#silhouette-processing');
  const meta = qs('#preview-meta');
  const btnReplace = qs('#btn-replace');
  const btnClear = qs('#btn-clear');

  let maskData = null;
  let lastImage = null;
  let lastMode = null;
  let lastThreshold = null;
  let lastColor = null;
  let localComputing = false;
  let computeScheduled = false;
  let lastAnimKey = '';
  let lastPlayback = 'idle';

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
      lastImage = null;
      silhouetteCanvas.hidden = true;
      silhouetteCanvas.style.animation = 'none';
    } else {
      silhouetteCanvas.hidden = false;
      const modeChanged = state.vector.mode !== lastMode;
      const thresholdChanged = state.vector.threshold !== lastThreshold;
      if (image !== lastImage || modeChanged || thresholdChanged) {
        scheduleCompute();
      } else if (state.vector.color !== lastColor && maskData) {
        renderSilhouetteToCanvas(silhouetteCanvas, maskData, state.vector.color);
        lastColor = state.vector.color;
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
      maskData = computeSilhouetteMask(
        state.image.canvas,
        state.vector.mode,
        state.vector.threshold
      );
      renderSilhouetteToCanvas(silhouetteCanvas, maskData, state.vector.color);
      lastImage = state.image;
      lastMode = state.vector.mode;
      lastThreshold = state.vector.threshold;
      lastColor = state.vector.color;
      localComputing = false;
      processingOverlay.hidden = !store.get().isProcessing;
    }, 30);
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
    } else {
      silhouetteCanvas.style.animationPlayState =
        playback === 'playing' ? 'running' : 'paused';
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
