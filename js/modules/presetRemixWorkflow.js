// js/modules/presetRemixWorkflow.js
// IPR-3: orkestrasi MURNI alur Instant Preset Remixer untuk antarmuka.
// Modul ini merangkai presetParser (IPR-1) dan presetRemixer (IPR-2) menjadi
// alur yang dapat diuji tanpa DOM: validasi berkas masukan, analisis slot,
// perakitan penggantian per slot, pemanggilan replaceAssets, penamaan
// unduhan, dan perhitungan keadaan antarmuka.
// Batas jujur: modul TIDAK membaca berkas (tugas panel peramban) dan TIDAK
// menjamin keberhasilan impor di Alight Motion (uji lapangan tetap wajib).

import { parseAlightMotionProject } from './presetParser.js';
import { replaceAssets } from './presetRemixer.js';

export const PRESET_MAX_BYTES = 15 * 1024 * 1024;
export const PRESET_ACCEPTED_EXTENSIONS = ['xml'];
export const REMIX_URI_MAX_LENGTH = 2048;

const FORBIDDEN_URI_CHARS = /["<>&]/;

// Validasi masukan berkas preset. Ekstensi .xml adalah jalur utama karena
// pemilih berkas Android sering melaporkan tipe MIME kosong; MIME XML/teks
// diterima sebagai jalur alternatif bila ekstensi tidak tersedia.
export function validatePresetFileInput(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: 'Berkas tidak terbaca.' };
  }
  const name = typeof file.name === 'string' ? file.name : '';
  const size = Number(file.size);
  const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';
  const ext = name.includes('.')
    ? name.slice(name.lastIndexOf('.') + 1).toLowerCase()
    : '';
  const extOk = PRESET_ACCEPTED_EXTENSIONS.includes(ext);
  const typeOk = type === 'application/xml' || type === 'text/xml' || type === 'text/plain';
  if (!extOk && !typeOk) {
    return {
      ok: false,
      error: 'Format tidak didukung. Gunakan berkas proyek Alight Motion berekstensi .xml.',
    };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: 'Berkas kosong atau tidak terbaca.' };
  }
  if (size > PRESET_MAX_BYTES) {
    return { ok: false, error: 'Ukuran berkas melebihi batas 15 MB.' };
  }
  return { ok: true, error: '' };
}

// Analisis teks proyek menjadi ringkasan, daftar slot, dan laporan struktur
// belum didukung. Mengembalikan ok:false (bukan lemparan) bila parse gagal.
export function analyzePresetText(text) {
  const parsed = parseAlightMotionProject(text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, summary: null, slots: [], unsupported: [] };
  }
  const scene = parsed.scene || {};
  const attrs = scene.attrs || {};
  return {
    ok: true,
    error: '',
    summary: {
      title: typeof attrs.title === 'string' ? attrs.title : null,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      totalTime: scene.totalTime,
      layerCount: parsed.layers.length,
      mediaCount: parsed.media.length,
      keyframeCount: parsed.keyframeSummary ? parsed.keyframeSummary.keyframeCount : 0,
    },
    slots: parsed.assetSlots.map((slot) => ({
      uri: slot.uri,
      kind: slot.kind,
      declared: slot.declared,
      filename: slot.filename,
      mediaType: slot.mediaType,
      layerCount: Array.isArray(slot.layers) ? slot.layers.length : 0,
      declarationCount: slot.declarationCount,
    })),
    unsupported: parsed.unsupported.map((item) => ({
      kind: item.kind,
      detail: item.detail,
      note: item.note,
    })),
  };
}

// Normalisasi URI pengganti yang dimasukkan pengguna. Tidak ada pembuatan URI
// otomatis: peramban tidak dapat memperoleh ID MediaStore (content://) dan
// semantik URI am: belum terverifikasi — format URI tidak diarang.
export function normalizeReplacementUri(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'URI pengganti tidak valid.', uri: '' };
  }
  const uri = raw.trim();
  if (uri.length === 0) {
    return { ok: false, error: 'URI pengganti kosong. Isi URI aset tujuan terlebih dahulu.', uri: '' };
  }
  if (FORBIDDEN_URI_CHARS.test(uri)) {
    return {
      ok: false,
      error: 'URI pengganti memuat karakter terlarang (kutip ganda, <, >, &).',
      uri: '',
    };
  }
  if (uri.length > REMIX_URI_MAX_LENGTH) {
    return { ok: false, error: 'URI pengganti terlalu panjang (maksimum 2048 karakter).', uri: '' };
  }
  return { ok: true, error: '', uri };
}

// Perakitan satu butir penggantian dari slot, URI pengganti, dan (opsional)
// info berkas gambar lokal: filename (nama berkas), size (File.size),
// width/height (dimensi hasil dekode lokal). Atribut title sengaja tidak
// disentuh alur ini; replaceAssets hanya menulis metadata pada atribut yang
// sudah ada pada deklarasi media.
export function buildReplacement(slotUri, replacementUri, fileInfo) {
  const uriCheck = normalizeReplacementUri(replacementUri);
  if (!uriCheck.ok) {
    return { ok: false, error: uriCheck.error, replacement: null };
  }
  const replacement = { fromUri: slotUri, toUri: uriCheck.uri };
  if (fileInfo && typeof fileInfo === 'object') {
    if (typeof fileInfo.name === 'string' && fileInfo.name.length > 0) {
      replacement.filename = fileInfo.name;
    }
    if (Number.isFinite(Number(fileInfo.size))) {
      replacement.size = Number(fileInfo.size);
    }
    if (Number.isFinite(Number(fileInfo.width))) {
      replacement.width = Number(fileInfo.width);
    }
    if (Number.isFinite(Number(fileInfo.height))) {
      replacement.height = Number(fileInfo.height);
    }
  }
  return { ok: true, error: '', replacement };
}

// Eksekusi penggantian (diteruskan ke replaceAssets IPR-2 beserta seluruh
// penolakan eksplisit, pengecekan ulang, dan validasi struktur hasilnya).
export function remixPreset(text, replacements) {
  return replaceAssets(text, replacements);
}

// Nama unduhan diturunkan dari nama berkas sumber: huruf kecil, karakter
// selain alfanumerik menjadi tanda hubung, dibatasi 60 karakter, akhiran
// '-remix'. Berkas diunduh sebagai <nama>-remix.xml oleh panel.
export function buildRemixDownloadName(sourceFileName) {
  const base =
    typeof sourceFileName === 'string' ? sourceFileName.replace(/\.[^.]+$/, '') : '';
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return (cleaned || 'preset') + '-remix';
}

// Perhitungan keadaan antarmuka (murni, teruji): delapan keadaan Gate 2.
// Panel peramban memakai keluaran ini untuk mengatur visibilitas bagian.
//   empty | fileSelected | parsing | analysis | replacementSelected
//   | validationFailed | ready | processingError
export function computeRemixerUiState(model) {
  const m = model || {};
  if (m.parsing === true) return 'parsing';
  if (m.error) return 'processingError';
  if (m.analysis && m.analysis.ok === true) {
    if (m.result) {
      return m.result.ok === true ? 'ready' : 'validationFailed';
    }
    return m.replacementCount > 0 ? 'replacementSelected' : 'analysis';
  }
  if (m.fileName) return 'fileSelected';
  return 'empty';
}
