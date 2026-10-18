// js/modules/presetRemixer.js
// Gate 4A-2 / IPR-2: penggantian aset individual pada preset Alight Motion.
// replaceAssets(xml, replacements) mengganti uri aset terpilih beserta
// metadata (filename/title/size/width/height) HANYA pada atribut yang sudah
// ada pada deklarasi <media>, serta fillImage pada tag pembuka layer pemakai;
// aset lain, keyframe, durasi, urutan layer, dan struktur lainnya dipertahankan
// apa adanya. Perubahan dilakukan sebagai splice teks presisi dari posisi
// sumber parser (bukan render ulang), lalu hasil diparse ulang, dibandingkan
// dengan masukan, dan divalidasi. Validitas struktur XML bukan jaminan
// keberhasilan impor di Alight Motion (uji lapangan tetap wajib).

import { parseAlightMotionProject } from './presetParser.js';
import { validateAlightMotionXml } from './xmlValidation.js';

const EDITABLE_ATTRS = ['filename', 'title', 'size', 'width', 'height'];
const FORBIDDEN_CHARS = /["<>&]/;

function fail(error) {
  return { ok: false, error, xml: null, replacements: [], untouchedSlots: [], warnings: [], validation: null };
}

function findAttrSpan(tagText, attrName) {
  const needle = ' ' + attrName + '=';
  let from = 0;
  while (true) {
    const nameStart = tagText.indexOf(needle, from);
    if (nameStart === -1) return null;
    let i = nameStart + needle.length;
    while (tagText[i] === ' ') i += 1;
    const quote = tagText[i];
    if (quote !== '"' && quote !== "'") {
      from = nameStart + 1;
      continue;
    }
    const valueStart = i;
    let end = i + 1;
    while (end < tagText.length && tagText[end] !== quote) end += 1;
    if (end >= tagText.length) return null;
    return { valueStart, valueEnd: end + 1 };
  }
}

export function replaceAssets(xml, replacements) {
  if (typeof xml !== 'string' || xml.length === 0) return fail('Masukan kosong atau bukan teks.');
  if (!Array.isArray(replacements) || replacements.length === 0) return fail('Daftar penggantian kosong atau bukan array.');

  const parsed = parseAlightMotionProject(xml);
  if (!parsed.ok) return fail('XML tidak dapat dibaca: ' + parsed.error);

  const seenFrom = new Set();
  const seenTo = new Set();
  for (const rep of replacements) {
    if (!rep || typeof rep !== 'object') return fail('Butir penggantian tidak valid.');
    if (typeof rep.fromUri !== 'string' || rep.fromUri.length === 0) return fail('fromUri kosong atau bukan teks.');
    if (typeof rep.toUri !== 'string' || rep.toUri.length === 0) return fail('toUri kosong pada penggantian ' + rep.fromUri + '.');
    const slot = parsed.assetSlots.find(function (s) { return s.uri === rep.fromUri; });
    if (!slot) return fail('fromUri tidak dikenal (bukan slot aset preset): ' + rep.fromUri + '.');
    if (!slot.declared) return fail('Aset ' + rep.fromUri + ' tidak dideklarasikan pada <media>; penggantian ditolak demi keamanan.');
    if (seenFrom.has(rep.fromUri)) return fail('fromUri duplikat pada daftar penggantian: ' + rep.fromUri + '.');
    seenFrom.add(rep.fromUri);
    if (seenTo.has(rep.toUri)) return fail('toUri duplikat pada daftar penggantian: ' + rep.toUri + '.');
    seenTo.add(rep.toUri);
    if (parsed.assetSlots.some(function (s) { return s.uri === rep.toUri; })) return fail('toUri bertabrakan dengan uri aset yang sudah ada: ' + rep.toUri + '.');
    if (FORBIDDEN_CHARS.test(rep.toUri)) return fail('toUri memuat karakter terlarang (kutip ganda, <, >, &).');
    if (rep.filename !== undefined && (typeof rep.filename !== 'string' || rep.filename.length === 0 || FORBIDDEN_CHARS.test(rep.filename))) return fail('filename tidak valid untuk ' + rep.fromUri + '.');
    if (rep.title !== undefined && (typeof rep.title !== 'string' || rep.title.length === 0 || FORBIDDEN_CHARS.test(rep.title))) return fail('title tidak valid untuk ' + rep.fromUri + '.');
    for (const attrName of ['size', 'width', 'height']) {
      if (rep[attrName] !== undefined && !Number.isFinite(Number(rep[attrName]))) return fail(attrName + ' harus angka untuk ' + rep.fromUri + '.');
    }
  }

  const normalized = replacements.map(function (rep) {
    const out = { fromUri: rep.fromUri, toUri: rep.toUri };
    for (const attrName of EDITABLE_ATTRS) {
      if (rep[attrName] === undefined) continue;
      out[attrName] = attrName === 'filename' || attrName === 'title' ? rep[attrName] : Math.round(Number(rep[attrName]));
    }
    return out;
  });
  const replacedUris = new Set(normalized.map(function (r) { return r.fromUri; }));

  const warnings = [];
  const edits = [];
  for (const rep of normalized) {
    const slot = parsed.assetSlots.find(function (s) { return s.uri === rep.fromUri; });
    if (slot.mediaIndexes.length > 1) {
      warnings.push('Aset ' + rep.fromUri + ' dideklarasikan ' + slot.mediaIndexes.length + ' kali; seluruh deklarasi <media> diperbarui.');
    }
    for (const mediaIndex of slot.mediaIndexes) {
      const mediaEntry = parsed.media[mediaIndex];
      const source = mediaEntry._source;
      if (!source) return fail('Posisi sumber deklarasi media tidak tersedia.');
      const spanStart = source.start;
      const tagText = xml.slice(spanStart, source.openEnd + 1);
      const uriSpan = findAttrSpan(tagText, 'uri');
      if (!uriSpan) return fail('Atribut uri tidak ditemukan pada deklarasi media ' + rep.fromUri + '.');
      edits.push({ from: spanStart + uriSpan.valueStart, to: spanStart + uriSpan.valueEnd, text: '"' + rep.toUri + '"' });
      for (const attrName of EDITABLE_ATTRS) {
        if (rep[attrName] === undefined) continue;
        const attrSpan = findAttrSpan(tagText, attrName);
        if (!attrSpan) {
          warnings.push('Atribut ' + attrName + ' tidak ada pada deklarasi media ' + rep.fromUri + '; penggantian ' + attrName + ' dilewati.');
          continue;
        }
        edits.push({ from: spanStart + attrSpan.valueStart, to: spanStart + attrSpan.valueEnd, text: '"' + String(rep[attrName]) + '"' });
      }
    }
    for (const layerIndex of slot.layerIndexes) {
      const layer = parsed.layers[layerIndex];
      const source = layer._source;
      if (!source) return fail('Posisi sumber layer tidak tersedia.');
      const spanStart = source.start;
      const tagText = xml.slice(spanStart, source.openEnd + 1);
      const span = findAttrSpan(tagText, 'fillImage');
      if (!span) return fail('Atribut fillImage tidak ditemukan pada layer ' + (layer.id || 'tanpa id') + '.');
      edits.push({ from: spanStart + span.valueStart, to: spanStart + span.valueEnd, text: '"' + rep.toUri + '"' });
    }
  }

  edits.sort(function (a, b) { return b.from - a.from; });
  let out = xml;
  let cursor = Infinity;
  for (const edit of edits) {
    if (edit.to > cursor) return fail('Edit penggantian tumpang tindih; operasi dibatalkan.');
    out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
    cursor = edit.from;
  }

  const recheck = parseAlightMotionProject(out);
  if (!recheck.ok) return fail('Hasil penggantian gagal dibaca ulang: ' + recheck.error);
  if (recheck.media.length !== parsed.media.length) return fail('Jumlah deklarasi media berubah.');
  if (recheck.layers.length !== parsed.layers.length) return fail('Jumlah layer berubah.');
  if (JSON.stringify(recheck.scene) !== JSON.stringify(parsed.scene)) return fail('Atribut scene berubah di luar kendali.');

  const stripSource = function (obj) {
    const copy = Object.assign({}, obj);
    delete copy._source;
    return copy;
  };
  for (let i = 0; i < parsed.layers.length; i += 1) {
    const before = stripSource(parsed.layers[i]);
    const after = stripSource(recheck.layers[i]);
    const rep = normalized.find(function (r) { return r.fromUri === before.fillImage; });
    if (rep) before.fillImage = rep.toUri;
    if (JSON.stringify(before) !== JSON.stringify(after)) return fail('Layer ' + (before.id || i) + ' berubah di luar fillImage.');
  }
  for (let i = 0; i < parsed.media.length; i += 1) {
    const before = stripSource(parsed.media[i]);
    const after = stripSource(recheck.media[i]);
    const rep = normalized.find(function (r) { return r.fromUri === before.uri; });
    if (rep) {
      if (after.uri !== rep.toUri) return fail('uri media ke-' + i + ' tidak sesuai penggantian.');
      for (const attrName of EDITABLE_ATTRS) {
        if (rep[attrName] === undefined || before[attrName] === null) continue;
        if (String(after[attrName]) !== String(rep[attrName])) return fail('Atribut ' + attrName + ' media ke-' + i + ' tidak sesuai penggantian.');
      }
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      return fail('Deklarasi media ke-' + i + ' yang tidak diganti berubah.');
    }
  }
  if (recheck.assetSlots.length !== parsed.assetSlots.length) return fail('Jumlah slot aset berubah.');
  for (const rep of normalized) {
    const slot = recheck.assetSlots.find(function (s) { return s.uri === rep.toUri; });
    if (!slot || slot.declared !== true) return fail('Slot hasil penggantian ' + rep.toUri + ' tidak utuh.');
  }
  const untouchedSlots = [];
  for (const slot of parsed.assetSlots) {
    if (replacedUris.has(slot.uri)) continue;
    untouchedSlots.push(slot.uri);
    if (!recheck.assetSlots.some(function (s) { return s.uri === slot.uri; })) return fail('Slot aset ' + slot.uri + ' yang tidak diganti hilang.');
  }

  const validation = validateAlightMotionXml(out);
  if (!validation || validation.valid !== true) {
    const firstIssue = validation && validation.issues && validation.issues.length > 0 ? validation.issues[0] : 'masalah tidak diketahui.';
    return { ok: false, error: 'Hasil tidak lulus validasi struktur: ' + firstIssue, xml: out, replacements: normalized, untouchedSlots, warnings, validation };
  }
  return { ok: true, error: '', xml: out, replacements: normalized, untouchedSlots, warnings, validation: { valid: validation.valid, issues: validation.issues } };
}
