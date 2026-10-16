// js/ui/uploadZone.js — Zona unggah: pemilih berkas, drag-and-drop, pesan kesalahan.

import { qs } from '../dom.js';
import { importImageFile, releaseImage } from '../modules/imageImport.js';

export function initUploadZone(store) {
  const zone = qs('#upload-zone');
  const input = qs('#file-input');
  const importAlert = qs('#import-alert');
  const importAlertText = qs('#import-alert-text');
  const importAlertClose = qs('#import-alert-close');

  let importing = false;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    handleFiles(input.files);
    input.value = '';
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('drag-active');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-active'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('drag-active');
    handleFiles(event.dataTransfer.files);
  });
  importAlertClose.addEventListener('click', () => store.set({ importError: null }));

  store.subscribe(render);
  render(store.get());

  function render(state) {
    zone.hidden = !!state.image;
    importAlert.hidden = !state.importError;
    if (state.importError) {
      importAlertText.textContent = state.importError;
    }
  }

  async function handleFiles(fileList) {
    if (importing) return;
    const file = fileList && fileList.length > 0 ? fileList[0] : null;
    if (!file) return;
    importing = true;
    store.set({ importError: null, isProcessing: true });
    try {
      const image = await importImageFile(file);
      const previous = store.get().image;
      if (previous) {
        releaseImage(previous);
      }
      store.set({
        image,
        isProcessing: false,
        exportName: buildDefaultExportName(image.name),
        playback: 'idle',
        playbackEpoch: store.get().playbackEpoch + 1,
      });
    } catch (error) {
      store.set({
        importError: error instanceof Error ? error.message : 'Gagal mengimpor gambar.',
        isProcessing: false,
      });
    } finally {
      importing = false;
    }
  }
}

function buildDefaultExportName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return 'naze-vector-' + (cleaned || 'siluet');
}
