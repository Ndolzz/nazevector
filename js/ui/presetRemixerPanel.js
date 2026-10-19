// js/ui/presetRemixerPanel.js — Panel DOM Instant Preset Remixer (IPR-3).
// Menghubungkan orkestrasi murni js/modules/presetRemixWorkflow.js ke halaman
// Remixer: pemilihan berkas proyek, analisis slot aset, pengisian uri pengganti
// (opsional disertai berkas gambar untuk metadata), perakitan ulang, validasi,
// dan unduhan. Berkas dibaca lokal via FileReader dan diunduh via Blob; tidak
// ada permintaan jaringan, autentikasi, atau unggahan ke server.
// Batas jujur: panel ini membutuhkan peramban sehingga TIDAK diuji di sandbox —
// hanya modul orkestrasi murni yang diuji otomatis (lihat docs/SDD.md bagian
// 19). Penerimaan hasil unduhan oleh Alight Motion pada perangkat nyata belum
// pernah diuji; validitas struktur bukan jaminan keberhasilan impor.

import { qs } from '../dom.js';
import {
  validatePresetFileInput,
  analyzePresetText,
  buildReplacement,
  remixPreset,
  buildRemixDownloadName,
  computeRemixerUiState,
} from '../modules/presetRemixWorkflow.js';

export function initPresetRemixerPanel() {
  const zone = qs('#remixer-upload-zone');
  const input = qs('#remixer-preset-input');
  const alertBox = qs('#remixer-alert');
  const alertText = qs('#remixer-alert-text');
  const alertClose = qs('#remixer-alert-close');
  const panel = qs('#remixer-panel');
  const fileMeta = qs('#remixer-file-meta');
  const btnReplace = qs('#btn-remix-replace');
  const btnClear = qs('#btn-remix-clear');
  const parsing = qs('#remixer-parsing');
  const analysis = qs('#remixer-analysis');
  const summary = qs('#remixer-summary');
  const unsupported = qs('#remixer-unsupported');
  const slotTitle = qs('#remixer-slot-title');
  const slots = qs('#remixer-slots');
  const btnRemix = qs('#btn-remix');
  const result = qs('#remixer-result');
  const validationBadge = qs('#remixer-validation-badge');
  const btnDownload = qs('#btn-remix-download');
  const messageBox = qs('#remixer-message');
  const messageText = qs('#remixer-message-text');
  const messageClose = qs('#remixer-message-close');

  // Model keadaan sesuai kontrak computeRemixerUiState (delapan keadaan Gate 2).
  const model = {
    fileName: '',
    fileBytes: 0,
    fileText: '',
    parsing: false,
    error: '',
    analysis: null,
    replacementCount: 0,
    result: null,
    message: null,
  };
  // Satu entri per slot terdeteksi: uriInput (null bila slot tidak diganti),
  // fileInfo metadata gambar opsional, dan elemen info slot.
  const slotEntries = [];
  let reading = false;
  let imageTarget = -1;

  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.hidden = true;
  imageInput.addEventListener('change', function () {
    handleSlotImage(imageInput.files);
    imageInput.value = '';
  });
  analysis.appendChild(imageInput);

  zone.addEventListener('click', function () {
    input.click();
  });
  zone.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', function () {
    handlePresetFiles(input.files);
    input.value = '';
  });
  zone.addEventListener('dragover', function (event) {
    event.preventDefault();
    zone.classList.add('drag-active');
  });
  zone.addEventListener('dragleave', function () {
    zone.classList.remove('drag-active');
  });
  zone.addEventListener('drop', function (event) {
    event.preventDefault();
    zone.classList.remove('drag-active');
    handlePresetFiles(event.dataTransfer.files);
  });
  alertClose.addEventListener('click', function () {
    model.error = '';
    render();
  });
  btnReplace.addEventListener('click', function () {
    input.click();
  });
  btnClear.addEventListener('click', function () {
    resetModel();
    render();
  });
  btnRemix.addEventListener('click', function () {
    runRemix();
  });
  btnDownload.addEventListener('click', function () {
    downloadResult();
  });
  messageClose.addEventListener('click', function () {
    model.message = null;
    render();
  });

  render();

  function resetModel() {
    model.fileName = '';
    model.fileBytes = 0;
    model.fileText = '';
    model.parsing = false;
    model.error = '';
    model.analysis = null;
    model.replacementCount = 0;
    model.result = null;
    model.message = null;
    slotEntries.length = 0;
    slots.textContent = '';
    summary.textContent = '';
    unsupported.textContent = '';
    unsupported.hidden = true;
    input.value = '';
  }

  function handlePresetFiles(fileList) {
    if (reading || model.parsing) return;
    const file = fileList && fileList.length > 0 ? fileList[0] : null;
    if (!file) return;
    const check = validatePresetFileInput(file);
    if (!check.ok) {
      resetModel();
      model.error = check.error;
      render();
      return;
    }
    reading = true;
    model.parsing = true;
    model.error = '';
    model.message = null;
    render();
    readTextFile(file)
      .then(function (text) {
        const analysisResult = analyzePresetText(text);
        reading = false;
        model.parsing = false;
        if (!analysisResult.ok) {
          resetModel();
          model.error =
            'Proyek tidak dapat dibaca: ' + analysisResult.error +
            ' Periksa bahwa berkas benar-benar ekspor XML Alight Motion.';
          render();
          return;
        }
        model.fileName = file.name;
        model.fileBytes = file.size;
        model.fileText = text;
        model.analysis = analysisResult;
        model.result = null;
        model.replacementCount = 0;
        model.message = null;
        slotEntries.length = 0;
        renderAnalysis();
        render();
      })
      .catch(function (error) {
        reading = false;
        model.parsing = false;
        resetModel();
        model.error =
          'Berkas tidak terbaca: ' +
          (error && error.message ? error.message : 'galat tidak diketahui.');
        render();
      });
  }

  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = function () {
        reject(new Error('peramban gagal membaca isi berkas.'));
      };
      reader.readAsText(file);
    });
  }

  function renderAnalysis() {
    const data = model.analysis;
    summary.textContent = '';
    appendSummaryItem('Judul', data.summary.title || '(tanpa judul)');
    appendSummaryItem('Dimensi', data.summary.width + ' × ' + data.summary.height);
    appendSummaryItem('FPS', String(data.summary.fps));
    appendSummaryItem('Durasi total', data.summary.totalTime + ' ms');
    appendSummaryItem('Layer', String(data.summary.layerCount));
    appendSummaryItem('Media', String(data.summary.mediaCount));
    appendSummaryItem('Keyframe', String(data.summary.keyframeCount));

    unsupported.textContent = '';
    if (data.unsupported.length > 0) {
      unsupported.hidden = false;
      const title = document.createElement('p');
      title.className = 'remixer-unsupported-title';
      title.textContent =
        'Struktur belum didukung — ' + data.unsupported.length + ' laporan ditampilkan apa adanya:';
      unsupported.appendChild(title);
      const list = document.createElement('ul');
      list.className = 'remixer-unsupported-list';
      for (const item of data.unsupported) {
        const li = document.createElement('li');
        li.textContent =
          item.kind + ': ' + item.detail + (item.note ? ' (' + item.note + ')' : '');
        list.appendChild(li);
      }
      unsupported.appendChild(list);
    } else {
      unsupported.hidden = true;
    }

    const slotCount = data.slots.length;
    slotTitle.textContent =
      slotCount === 0
        ? 'Tidak ada slot aset terdeteksi pada proyek ini.'
        : slotCount + ' slot aset terdeteksi — isi uri pengganti untuk slot yang ingin diganti:';

    slots.textContent = '';
    slotEntries.length = 0;
    data.slots.forEach(function (slot, index) {
      slots.appendChild(buildSlotCard(slot, index));
    });
  }

  function appendSummaryItem(label, value) {
    const item = document.createElement('span');
    item.className = 'remixer-summary-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'remixer-summary-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'remixer-summary-value';
    valueEl.textContent = value;
    item.appendChild(labelEl);
    item.appendChild(valueEl);
    summary.appendChild(item);
  }

  function buildSlotCard(slot, index) {
    const entry = { uriInput: null, fileInfo: null, info: null };
    slotEntries[index] = entry;

    const card = document.createElement('div');
    card.className = 'remixer-slot-card';

    const head = document.createElement('div');
    head.className = 'remixer-slot-head';
    const declaredBadge = document.createElement('span');
    declaredBadge.className = slot.declared ? 'badge badge-ok' : 'badge badge-pending';
    declaredBadge.textContent = slot.declared
      ? 'Dideklarasikan pada <media>'
      : 'Tidak dideklarasikan';
    const kindText = document.createElement('span');
    kindText.className = 'remixer-slot-kind';
    kindText.textContent =
      slot.kind +
      ' — dipakai ' + slot.layerCount + ' layer' +
      (slot.declarationCount > 1
        ? ' — ' + slot.declarationCount + ' deklarasi <media>'
        : '');
    head.appendChild(declaredBadge);
    head.appendChild(kindText);
    card.appendChild(head);

    const uri = document.createElement('code');
    uri.className = 'remixer-slot-uri';
    uri.textContent = slot.uri;
    card.appendChild(uri);

    if (slot.filename) {
      const fileNameEl = document.createElement('p');
      fileNameEl.className = 'remixer-slot-file';
      fileNameEl.textContent = 'Nama berkas: ' + slot.filename;
      card.appendChild(fileNameEl);
    }

    if (slot.declared) {
      const row = document.createElement('div');
      row.className = 'remixer-replace-row';
      const uriInput = document.createElement('input');
      uriInput.type = 'text';
      uriInput.className = 'remixer-uri-input';
      uriInput.placeholder = 'URI pengganti (content:// atau am:…)';
      uriInput.setAttribute('aria-label', 'URI pengganti untuk slot ' + slot.uri);
      uriInput.autocomplete = 'off';
      uriInput.addEventListener('input', function () {
        onSlotUriChange(index);
      });
      entry.uriInput = uriInput;
      row.appendChild(uriInput);
      const imageButton = document.createElement('button');
      imageButton.type = 'button';
      imageButton.className = 'btn btn-secondary btn-compact';
      imageButton.textContent = 'Pilih Gambar (opsional)';
      imageButton.addEventListener('click', function () {
        imageTarget = index;
        imageInput.click();
      });
      row.appendChild(imageButton);
      card.appendChild(row);
    } else {
      const note = document.createElement('p');
      note.className = 'remixer-slot-info';
      note.textContent =
        'Slot ini tidak dideklarasikan pada <media>; penggantian ditolak demi keamanan ' +
        'sehingga tidak dapat diisi.';
      card.appendChild(note);
    }

    const info = document.createElement('p');
    info.className = 'remixer-slot-info';
    entry.info = info;
    card.appendChild(info);

    return card;
  }

  function onSlotUriChange(index) {
    const entry = slotEntries[index];
    const slot = model.analysis.slots[index];
    const raw = entry.uriInput.value;
    let valid = false;
    if (raw.trim() !== '') {
      const built = buildReplacement(slot.uri, raw, entry.fileInfo);
      valid = built.ok;
      if (!built.ok) {
        entry.info.textContent = built.error;
      } else {
        entry.info.textContent = fileInfoText(entry.fileInfo);
      }
    } else {
      entry.info.textContent = fileInfoText(entry.fileInfo);
    }
    entry.valid = valid;
    recountReplacements();
  }

  function recountReplacements() {
    let count = 0;
    for (const entry of slotEntries) {
      if (entry && entry.valid) count += 1;
    }
    model.replacementCount = count;
    // Perubahan masukan menghanguskan hasil sebelumnya: badge kembali
    // "Belum divalidasi" dan unduhan dinonaktifkan sampai dirakit ulang.
    model.result = null;
    model.message = null;
    render();
  }

  function fileInfoText(fileInfo) {
    if (!fileInfo) return '';
    let text = 'Metadata gambar: ' + fileInfo.name + ' — ' + formatBytes(fileInfo.size);
    if (fileInfo.width && fileInfo.height) {
      text += ' — ' + fileInfo.width + ' × ' + fileInfo.height + ' px';
    } else {
      text += ' — dimensi tidak terbaca';
    }
    return text;
  }

  function handleSlotImage(fileList) {
    const entry = slotEntries[imageTarget];
    const index = imageTarget;
    imageTarget = -1;
    const file = fileList && fileList.length > 0 ? fileList[0] : null;
    if (!entry || !file) return;
    entry.fileInfo = { name: file.name, size: file.size };
    entry.info.textContent =
      'Memuat metadata gambar…';
    decodeImageSize(file)
      .then(function (size) {
        entry.fileInfo.width = size.width;
        entry.fileInfo.height = size.height;
        entry.info.textContent = fileInfoText(entry.fileInfo);
        // Validasi ulang masukan uri slot ini bila sudah terisi, agar jumlah
        // penggantian siap rakit tetap akurat.
        if (entry.uriInput && entry.uriInput.value.trim() !== '') {
          onSlotUriChange(index);
        }
      })
      .catch(function () {
        entry.info.textContent =
          'Metadata gambar tidak terbaca sepenuhnya; hanya nama dan ukuran berkas ' +
          'yang akan dipakai.';
      });
  }

  function decodeImageSize(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        const size = { width: image.naturalWidth, height: image.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(size);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('gambar tidak terdekode.'));
      };
      image.src = url;
    });
  }

  function runRemix() {
    if (!model.analysis || !model.analysis.ok) return;
    const replacements = [];
    for (let i = 0; i < model.analysis.slots.length; i += 1) {
      const slot = model.analysis.slots[i];
      const entry = slotEntries[i];
      if (!entry || !entry.uriInput) continue;
      const raw = entry.uriInput.value;
      if (raw.trim() === '') continue;
      const built = buildReplacement(slot.uri, raw, entry.fileInfo);
      if (!built.ok) {
        model.message = {
          kind: 'error',
          text: built.error + ' (slot: ' + slot.uri + ')',
        };
        render();
        return;
      }
      replacements.push(built.replacement);
    }
    if (replacements.length === 0) {
      model.message = {
        kind: 'error',
        text: 'Isi uri pengganti pada minimal satu slot terlebih dahulu.',
      };
      render();
      return;
    }
    let remixResult;
    try {
      remixResult = remixPreset(model.fileText, replacements);
    } catch (error) {
      model.result = null;
      model.message = {
        kind: 'error',
        text:
          'Kesalahan tak terduga saat merakit ulang: ' +
          (error && error.message ? error.message : 'galat tidak diketahui.'),
      };
      render();
      return;
    }
    model.result = remixResult;
    if (remixResult.ok) {
      model.message = { kind: 'success', text: buildSuccessMessage(remixResult) };
    } else {
      model.message = { kind: 'error', text: remixResult.error };
    }
    render();
  }

  function buildSuccessMessage(remixResult) {
    let text =
      'Penggantian selesai: ' + remixResult.replacements.length + ' slot diganti, ' +
      remixResult.untouchedSlots.length + ' slot tidak tersentuh. Hasil lulus ' +
      'pemeriksaan ulang dan validasi struktur lokal, siap diunduh sebagai ' +
      buildRemixDownloadName(model.fileName) + '.xml.';
    if (remixResult.warnings.length > 0) {
      text += ' Peringatan: ' + remixResult.warnings.join(' ');
    }
    text +=
      ' Batas jujur: validitas struktur bukan jaminan keberhasilan impor; ' +
      'penerimaan uri pengganti oleh Alight Motion menunggu uji lapangan.';
    return text;
  }

  function downloadResult() {
    if (!model.result || !model.result.ok) return;
    downloadXmlFile(buildRemixDownloadName(model.fileName), model.result.xml);
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

  function render() {
    const state = computeRemixerUiState(model);
    zone.hidden = !!model.fileName;
    alertBox.hidden = state !== 'processingError';
    if (model.error) {
      alertText.textContent = model.error;
    }
    parsing.hidden = state !== 'parsing';
    panel.hidden = !model.fileName;
    if (model.fileName) {
      fileMeta.textContent = model.fileName + ' — ' + formatBytes(model.fileBytes);
    }
    const analysisVisible =
      state === 'analysis' ||
      state === 'replacementSelected' ||
      state === 'ready' ||
      state === 'validationFailed';
    analysis.hidden = !analysisVisible;
    const resultVisible = state === 'ready' || state === 'validationFailed';
    result.hidden = !resultVisible;
    btnRemix.disabled = model.replacementCount === 0;
    btnDownload.disabled = state !== 'ready';
    if (state === 'ready') {
      validationBadge.textContent = 'Validasi lulus';
      validationBadge.className = 'badge badge-ok';
    } else if (state === 'validationFailed') {
      validationBadge.textContent = 'Validasi gagal';
      validationBadge.className = 'badge badge-pending';
    } else {
      validationBadge.textContent = 'Belum divalidasi';
      validationBadge.className = 'badge badge-pending';
    }
    messageBox.hidden = !model.message;
    if (model.message) {
      messageText.textContent = model.message.text;
      messageBox.classList.toggle(
        'export-message-success',
        model.message.kind === 'success'
      );
    }
  }
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value >= 1024 * 1024) {
    return (value / (1024 * 1024)).toFixed(1) + ' MB';
  }
  return (value / 1024).toFixed(1) + ' KB';
}
