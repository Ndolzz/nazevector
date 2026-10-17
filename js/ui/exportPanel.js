// js/ui/exportPanel.js — Panel ekspor: nama berkas, format, mode representasi
// (AM-5/AM-6: isi/garis/kontur), mode warna (CV-1/CV-2: pilihan/asli), status
// validasi, unduhan.
// Ekspor XML (EX-1): hasil pipeline diunduh sebagai .xml via Blob lokal.
// Status validasi lokal disimpan pada variabel closure (bukan state store) agar
// kontrak state.js tidak berubah; nilai reset saat gambar atau pengaturan berganti
// tidak diperlukan karena badge hanya menampilkan hasil ekspor terakhir.

import { qs } from '../dom.js';
import { requestXmlExport } from '../modules/exportManager.js';

export function initExportPanel(store) {
  const nameInput = qs('#export-name');
  const representationSelect = qs('#export-representation');
  const colorModeSelect = qs('#export-color-mode');
  const validationBadge = qs('#export-validation-badge');
  const btnExport = qs('#btn-export');
  const messageBox = qs('#export-message');
  const messageText = qs('#export-message-text');
  const messageClose = qs('#export-message-close');

  let lastValidation = null; // { valid: boolean } | null — hasil validasi lokal ekspor terakhir.

  nameInput.addEventListener('input', () => {
    store.set({ exportName: nameInput.value });
  });
  representationSelect.addEventListener('change', () => {
    store.set({ exportRepresentation: representationSelect.value });
  });
  colorModeSelect.addEventListener('change', () => {
    store.set({ exportColorMode: colorModeSelect.value });
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
          text: buildSuccessMessage(state),
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
    if (representationSelect.value !== state.exportRepresentation) {
      representationSelect.value = state.exportRepresentation;
    }
    if (colorModeSelect.value !== state.exportColorMode) {
      colorModeSelect.value = state.exportColorMode;
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

function buildSuccessMessage(state) {
  const representation = state.exportRepresentation;
  const isCenterline = representation === 'garis';
  const isContour = representation === 'kontur';
  const isOriginalColor = state.exportColorMode === 'asli';
  let text =
    'Ekspor berhasil. Berkas XML diunduh dan lulus validasi struktur lokal. ';
  if (isCenterline) {
    text +=
      'Mode garis (VE-3): setiap goresan ditulis sebagai satu layer shape berisi centerline dengan path-stroke — tebal garis diperkirakan dari lebar pita sumber dan warna layer ' +
      (isOriginalColor
        ? 'mengikuti warna asli gambar (CV-1). '
        : 'mengikuti warna pilihan. ') +
      'Batas jujur: struktur path-stroke tanpa penutup Z pada mode garis belum diuji pada perangkat nyata — mohon periksa hasil impor di Alight Motion dan laporkan bila garis tampil salah. ';
  } else if (isContour) {
    text +=
      'Mode kontur (AM-6): setiap kontur — termasuk setiap lubang yang sebelumnya bergabung pada layer komponennya — ditulis sebagai satu layer shape tersendiri (1 layer = 1 kontur), sehingga setiap entri pada panel "Tambahkan Kontur" Alight Motion kini berada pada layer tersendiri dan dapat dipilih, digeser, diputar, diskalakan, serta diberi warna sendiri. Warna layer ' +
      (isOriginalColor
        ? 'mengikuti warna asli gambar per kontur (CV-2): kontur luar memakai warna area siluetnya, kontur lubang memakai warna latar di dalam lubang. '
        : 'mengikuti warna pilihan untuk seluruh layer — dengan demikian tampilan menyatu; gunakan mode warna asli bila tiap layer ingin diwarnai sesuai area aslinya. ') +
      'Batas jujur: mode kontur belum diuji pada perangkat nyata — mohon periksa bahwa setiap kontur berada pada layer tersendiri (Shape 1, Shape 2, dst.) dan laporkan bila ada kontur yang bergabung, tumpang-tindih salah, atau tampil kosong. ';
  } else {
    text +=
      'Mode isi: setiap komponen siluet ditulis sebagai shape (layer) tersendiri — pemisah layer (AM-4) — sehingga tiap bagian dapat dipilih, digeser, diputar, dan diskalakan sendiri di timeline; ' +
      (isOriginalColor
        ? 'warna tiap layer mengikuti warna asli gambar per komponen (CV-1). '
        : 'warna tiap layer mengikuti warna pilihan. ') +
      'Impor dan tampilan shape terbukti pada perangkat nyata (TS-1, tangkapan layar pengguna pada Alight Motion 5.0.273 Android). ' +
      'Mohon periksa bahwa tiap bagian siluet berada pada layer tersendiri (Shape 1, Shape 2, dst.); bila ada bagian yang bergabung atau tampil salah, mohon laporkan. ';
  }
  if (isOriginalColor) {
    text +=
      'Batas jujur warna asli: warna diambil dari piksel dominan per komponen atau per kontur (tepat untuk desain warna datar, perkiraan untuk gradien/foto). ';
  }
  text += 'Keyframe animasi menyusul (AN-1).';
  return text;
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
