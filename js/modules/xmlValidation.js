// js/modules/xmlValidation.js — Validasi dokumen XML Alight Motion (XV-1, v0.4.0).
// Validator murni tanpa DOMParser (agar berjalan di semua peramban dan di harness
// uji tanpa Node): well-formedness, akar scene, atribut wajib, ID unik positif,
// rentang waktu, warna #AARRGGBB, dan kontur tidak kosong.
// Hasil: { valid: boolean, issues: string[] } dengan pesan berbahasa Indonesia.

export const XML_VALIDATION_STATUS = {
  id: 'XV',
  label: 'Validasi XML',
  reason:
    'Validasi lokal: well-formedness, atribut wajib scene, ID unik, rentang waktu, format warna, dan kontur. Bukan bukti kompatibilitas impor (TS-1).',
};

const SCENE_REQUIRED_ATTRS = [
  'title',
  'width',
  'height',
  'exportWidth',
  'exportHeight',
  'bgcolor',
  'totalTime',
  'fps',
  'modifiedTime',
  'amver',
  'ffver',
];

const INT_ATTRS = [
  'width',
  'height',
  'exportWidth',
  'exportHeight',
  'totalTime',
  'modifiedTime',
  'amver',
  'ffver',
];

export function validateAlightMotionXml(xmlString) {
  const issues = [];
  const parsed = parseXml(xmlString, issues);
  if (!parsed) {
    return { valid: false, issues };
  }
  checkScene(parsed, issues);
  checkElements(parsed, issues);
  return { valid: issues.length === 0, issues };
}

/* ---------- Parser well-formedness ---------- */

function parseXml(text, issues) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    issues.push('Dokumen XML kosong atau bukan string.');
    return null;
  }
  let i = 0;
  let root = null;
  let rootCount = 0;
  const stack = [];
  const n = text.length;

  while (i < n) {
    if (isWhitespace(text[i])) {
      i += 1;
      continue;
    }
    if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i);
      if (end === -1) {
        issues.push('Prolog XML tidak ditutup dengan "?>".');
        return null;
      }
      i = end + 2;
      continue;
    }
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i);
      if (end === -1) {
        issues.push('Komentar tidak ditutup dengan "-->".');
        return null;
      }
      i = end + 3;
      continue;
    }
    if (text[i] !== '<') {
      issues.push('Teks di luar tag tidak diizinkan: "' + text.slice(i, i + 24).trim() + '".');
      return null;
    }
    const tagEnd = findTagEnd(text, i);
    if (tagEnd === -1) {
      issues.push('Tag tidak ditutup dengan ">".');
      return null;
    }
    const raw = text.slice(i + 1, tagEnd);
    i = tagEnd + 1;

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const open = stack.pop();
      if (!open) {
        issues.push('Tag penutup "</' + name + '>" tanpa tag pembuka.');
      } else if (open.name !== name) {
        issues.push('Tag tidak cocok: dibuka "<' + open.name + '>", ditutup "</' + name + '>".');
      }
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const match = body.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)\s*([\s\S]*)$/);
    if (!match) {
      issues.push('Nama tag tidak valid: "<' + body.slice(0, 24).trim() + '>".');
      return null;
    }
    const node = {
      name: match[1],
      attrs: parseAttrs(match[2], issues),
      children: [],
    };
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      rootCount += 1;
      if (rootCount > 1) {
        issues.push('Dokumen harus memiliki tepat satu elemen akar.');
        return null;
      }
      root = node;
    }
    if (!selfClosing) stack.push(node);
  }

  if (stack.length > 0) {
    issues.push('Tag "<' + stack[stack.length - 1].name + '>" tidak ditutup.');
    return null;
  }
  if (!root) {
    issues.push('Dokumen tidak memiliki elemen akar.');
    return null;
  }
  return root;
}

function findTagEnd(text, start) {
  let quote = null;
  for (let j = start + 1; j < text.length; j += 1) {
    const c = text[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return j;
    }
  }
  return -1;
}

function parseAttrs(attrText, issues) {
  const attrs = {};
  const pattern = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(attrText)) !== null) {
    if (attrText.slice(lastIndex, match.index).trim().length > 0) {
      issues.push('Atribut rusak dekat: "' + attrText.slice(lastIndex, match.index).trim().slice(0, 24) + '".');
    }
    attrs[match[1]] = match[2] !== undefined ? match[2] : match[3];
    lastIndex = pattern.lastIndex;
  }
  if (attrText.slice(lastIndex).trim().length > 0) {
    issues.push('Atribut tanpa nilai: "' + attrText.slice(lastIndex).trim().slice(0, 24) + '".');
  }
  return attrs;
}

/* ---------- Pemeriksaan semantik scene Alight Motion ---------- */

function checkScene(root, issues) {
  if (root.name !== 'scene') {
    issues.push('Elemen akar harus "scene", ditemukan "' + root.name + '".');
    return;
  }
  for (const attr of SCENE_REQUIRED_ATTRS) {
    if (root.attrs[attr] === undefined) {
      issues.push('Atribut wajib scene hilang: "' + attr + '".');
    }
  }
  for (const attr of INT_ATTRS) {
    const value = root.attrs[attr];
    if (value !== undefined && !/^\d+$/.test(value)) {
      issues.push('Atribut "' + attr + '" harus bilangan bulat non-negatif, ditemukan "' + value + '".');
    }
  }
  const totalTime = Number(root.attrs.totalTime);
  if (root.attrs.totalTime !== undefined && (!Number.isInteger(totalTime) || totalTime <= 0)) {
    issues.push('Atribut "totalTime" harus bilangan bulat positif.');
  }
  if (root.attrs.bgcolor !== undefined && !/^#[0-9A-Fa-f]{8}$/.test(root.attrs.bgcolor)) {
    issues.push('Atribut "bgcolor" harus format #AARRGGBB, ditemukan "' + root.attrs.bgcolor + '".');
  }
}

function checkElements(root, issues) {
  const elements = collectElements(root);
  if (elements.length === 0) {
    issues.push('Scene tidak memiliki elemen apa pun.');
    return;
  }
  const seenIds = new Set();
  let totalTime = Number(root.attrs.totalTime);
  if (!Number.isInteger(totalTime) || totalTime <= 0) totalTime = Infinity;

  for (const element of elements) {
    const id = element.attrs.id;
    if (id === undefined) {
      issues.push('Elemen <' + element.name + '> tanpa atribut "id".');
    } else if (!/^\d+$/.test(id) || Number(id) <= 0) {
      issues.push('ID elemen harus bilangan bulat positif, ditemukan "' + id + '".');
    } else if (seenIds.has(id)) {
      issues.push('ID elemen duplikat: ' + id + '.');
    } else {
      seenIds.add(id);
    }
    checkTiming(element, totalTime, issues);
    checkFillColor(element, issues);
  }
  checkContours(elements, issues);
}

function collectElements(root) {
  const elements = [];
  for (const child of root.children) {
    if (['shape', 'text', 'drawing', 'embedScene', 'audio', 'camera', 'nullobj'].includes(child.name)) {
      elements.push(child);
    }
    elements.push(...collectElements(child));
  }
  return elements;
}

function checkTiming(element, totalTime, issues) {
  const startTime = element.attrs.startTime;
  const endTime = element.attrs.endTime;
  if (startTime === undefined || endTime === undefined) {
    issues.push('Elemen <' + element.name + ' id="' + element.attrs.id + '"> memerlukan startTime dan endTime.');
    return;
  }
  if (!isNumber(startTime) || !isNumber(endTime)) {
    issues.push('startTime/endTime elemen id="' + element.attrs.id + '" harus angka.');
    return;
  }
  if (Number(startTime) < 0) {
    issues.push('startTime elemen id="' + element.attrs.id + '" tidak boleh negatif.');
  }
  if (Number(endTime) < Number(startTime)) {
    issues.push('endTime elemen id="' + element.attrs.id + '" lebih kecil dari startTime.');
  }
  if (Number(endTime) > totalTime) {
    issues.push('endTime elemen id="' + element.attrs.id + '" melebihi totalTime scene.');
  }
}

function checkFillColor(element, issues) {
  const fill = element.children.find((child) => child.name === 'fillColor');
  if (fill && (fill.attrs.value === undefined || !/^#[0-9A-Fa-f]{8}$/.test(fill.attrs.value))) {
    issues.push('fillColor elemen id="' + element.attrs.id + '" harus format #AARRGGBB.');
  }
}

function checkContours(elements, issues) {
  let shapeCount = 0;
  let importedShapeCount = 0;
  let contourCount = 0;
  for (const element of elements) {
    if (element.name !== 'shape') continue;
    shapeCount += 1;
    if (element.attrs.s === undefined) {
      importedShapeCount += 1;
      if (!hasContourWithD(element)) {
        issues.push('Bentuk imported (id="' + element.attrs.id + '") tanpa kontur d yang tidak kosong.');
      }
    }
    contourCount += countContours(element);
  }
  if (shapeCount === 0) {
    issues.push('Scene tidak memiliki elemen <shape> apa pun.');
  } else if (importedShapeCount > 0 && contourCount === 0) {
    issues.push('Tidak ada elemen <contour> pada bentuk imported.');
  }
}

function hasContourWithD(element) {
  return findContours(element).some((c) => typeof c.attrs.d === 'string' && c.attrs.d.trim().length > 0);
}

function countContours(element) {
  return findContours(element).length;
}

function findContours(node) {
  const found = [];
  for (const child of node.children) {
    if (child.name === 'contour') found.push(child);
    found.push(...findContours(child));
  }
  return found;
}

function isNumber(value) {
  return /^\d+(\.\d+)?$/.test(value);
}

function isWhitespace(char) {
  return char === ' ' || char === '\n' || char === '\t' || char === '\r';
}
