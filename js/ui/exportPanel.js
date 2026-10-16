// js/ui/exportPanel.js — Panel ekspor: nama berkas, format, status validasi, pesan.
// Ekspor XML belum diimplementasikan; tombol menghasilkan pesan status yang jujur.

import { qs } from '../dom.js';
import { requestXmlExport } from '../modules/exportManager.js';

export function initExportPanel(store) {
  const nameInput = qs('#export-name');
  const validationBadge = qs('#export-validation-badge');
  const btnExport = qs('#btn-export');
  const messageBox = qs('#export-message');
  const messageText = qs('#export-message-text');
  const messageClose = qs('#export-message-close');

  nameInput.addEventListener('input', () => {
    store.set({ exportName: nameInput.value });
  });
  messageClose.addEventListener('click', () => {
    store.set({ exportMessage: null });
  });
  btnExport.addEventListener('click', () => {
    const state = store.get();
    if (!state.image) {
      store.set({
        exportMessage: {
          kind: 'info',
          text: 'Unggah gambar terlebih dahulu sebelum mengekspor.',
        },
      });
      return;
    }
    if (!sanitizeFileName(state.exportName)) {
      store.set({
        exportMessage: {
          kind: 'error',
          text: 'Nama berkas tidak valid. Isi nama berkas terlebih dahulu.',
        },
      });
      return;
    }
    const result = requestXmlExport();
    store.set({
      exportMessage: {
        kind: result.ok ? 'success' : 'error',
        text: result.ok
          ? 'Ekspor berhasil. Berkas XML diunduh.'
          : result.message,
      },
    });
  });

  store.subscribe(render);
  render(store.get());

  function render(state) {
    if (nameInput.value !== state.exportName) {
      nameInput.value = state.exportName;
    }
    const sanitized = sanitizeFileName(state.exportName);
    btnExport.disabled = !state.image || !sanitized;
    validationBadge.textContent = state.image
      ? 'Belum divalidasi — generator XML belum tersedia'
      : 'Belum divalidasi';
    messageBox.hidden = !state.exportMessage;
    if (state.exportMessage) {
      messageText.textContent = state.exportMessage.text;
      messageBox.classList.toggle(
        'export-message-success',
        state.exportMessage.kind === 'success'
      );
    }
  }
}

function sanitizeFileName(name) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 60);
}
