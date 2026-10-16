// js/ui/exportPanel.js — Panel ekspor: nama berkas, format, status validasi, unduhan.
// Ekspor XML (EX-1): hasil pipeline diunduh sebagai .xml via Blob lokal.
// Status validasi lokal disimpan pada variabel closure (bukan state store) agar
// kontrak state.js tidak berubah; nilai reset saat gambar atau pengaturan berganti
// tidak diperlukan karena badge hanya menampilkan hasil ekspor terakhir.

import { qs } from '../dom.js';
import { requestXmlExport } from '../modules/exportManager.js';

export function initExportPanel(store) {
  const nameInput = qs('#export-name');
  const validationBadge = qs('#export-validation-badge');
  const btnExport = qs('#btn-export');
  const messageBox = qs('#export-message');
  const messageText = qs('#export-message-text');
  const messageClose = qs('#export-message-close');

  let lastValidation = null; // { valid: boolean } | null — hasil validasi lokal ekspor terakhir.

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
    // State dibaca dari store saat tombol ditekan; pipeline menghitung ulang
    // mask dan vektor dari state terkini, tanpa hasil yang kedaluwarsa.
    const result = requestXmlExport(state);
    if (result.ok) {
      lastValidation = { valid: true };
      downloadXmlFile(sanitizeFileName(state.exportName), result.xml);
      store.set({
        exportMessage: {
          kind: 'success',
          text:
            'Ekspor berhasil. Berkas XML diunduh dan lulus validasi lokal. ' +
            'Kompatibilitas impor di Alight Motion belum diuji (lihat catatan panel).',
        },
      });
    } else {
      if (result.validation) {
        lastValidation = { valid: false };
      }
      store.set({
        exportMessage: {
          kind: 'error',
          text: result.message,
        },
      });
    }
  });

  store.subscribe(render);
  render(store.get());

  function render(state) {
    if (nameInput.value !== state.exportName) {
      nameInput.value = state.exportName;
    }
    const sanitized = sanitizeFileName(state.exportName);
    btnExport.disabled = !state.image || !sanitized;
    validationBadge.textContent = lastValidation
      ? lastValidation.valid
        ? 'Validasi lokal lulus'
        : 'Validasi lokal gagal'
      : 'Belum divalidasi';
    validationBadge.classList.toggle(
      'badge-ok',
      !!(lastValidation && lastValidation.valid)
    );
    validationBadge.classList.toggle(
      'badge-pending',
      !(lastValidation && lastValidation.valid)
    );
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

function downloadXmlFile(name, xml) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name + '.xml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
