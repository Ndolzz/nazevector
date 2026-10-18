// js/modules/presetParser.js
// Gate 4A-1 / IPR-1: parser teks XML proyek/preset Alight Motion.
// Murni (tanpa DOM, tanpa dependensi): membaca node teks XML, memetakan aset,
// layer, keyframe, dan struktur yang belum didukung. Parser ini TIDAK menilai
// validitas impor - itu tugas xmlValidation dan uji lapangan (TS-1).

function parseAttrs(raw) {
  const attrs = {};
  const re = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return attrs;
}

export function parseXmlTree(text) {
  const empty = { ok: false, error: '', root: null };
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'Masukan kosong atau bukan teks.', root: null };
  }
  const root = { tag: '#document', attrs: {}, children: [] };
  const stack = [root];
  let i = 0;
  const len = text.length;
  while (i < len) {
    const lt = text.indexOf('<', i);
    if (lt === -1) break;
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      if (end === -1) return { ok: false, error: 'Komentar tidak tertutup pada posisi ' + lt + '.', root: null };
      i = end + 3;
      continue;
    }
    if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt);
      if (end === -1) return { ok: false, error: 'Deklarasi/prolog tidak tertutup pada posisi ' + lt + '.', root: null };
      i = end + 1;
      continue;
    }
    if (text[lt + 1] === '/') {
      const gt = text.indexOf('>', lt);
      if (gt === -1) return { ok: false, error: 'Tag penutup tidak selesai pada posisi ' + lt + '.', root: null };
      const name = text.slice(lt + 2, gt).trim();
      const top = stack[stack.length - 1];
      if (stack.length === 1 || top.tag !== name) {
        return { ok: false, error: 'Tag penutup </' + name + '> tidak cocok dengan <' + (stack.length > 1 ? top.tag : '#document') + '> yang masih terbuka.', root: null };
      }
      stack.pop();
      i = gt + 1;
      continue;
    }
    let gt = -1;
    let quote = null;
    for (let j = lt + 1; j < len; j += 1) {
      const c = text[j];
      if (quote !== null) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') { gt = j; break; }
    }
    if (gt === -1) return { ok: false, error: 'Tag tidak tertutup mulai posisi ' + lt + '.', root: null };
    let raw = text.slice(lt + 1, gt);
    const selfClose = /\/\s*$/.test(raw);
    if (selfClose) raw = raw.replace(/\/\s*$/, '');
    const nameMatch = raw.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)/);
    if (!nameMatch) return { ok: false, error: 'Nama tag tidak valid pada posisi ' + lt + '.', root: null };
    const node = { tag: nameMatch[1], attrs: parseAttrs(raw.slice(nameMatch[1].length)), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
    i = gt + 1;
  }
  if (stack.length !== 1) {
    return { ok: false, error: 'Tag <' + stack[stack.length - 1].tag + '> tidak memiliki penutup.', root: null };
  }
  return { ok: true, error: '', root };
}

function num(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const UNSUPPORTED_NOTE = {
  effect: 'Efek Alight Motion belum didukung untuk pengubahan pada tahap ini; direkomendasikan dipertahankan apa adanya.',
  blending: 'Mode blending tidak didukung untuk pengubahan; dipertahankan apa adanya.',
  pathStroke: 'Elemen path-stroke tidak didukung untuk pengubahan; dipertahankan apa adanya.',
  border: 'Elemen border tidak didukung untuk pengubahan; dipertahankan apa adanya.',
  shadow: 'Elemen shadow tidak didukung untuk pengubahan; dipertahankan apa adanya.',
  group: 'Grup/composition bersarang tidak didukung penuh; layer di dalamnya dipetakan datar sebagai informasi.',
  unknownElement: 'Elemen tidak dikenali; dilaporkan apa adanya tanpa penafsiran.',
  textLayer: 'Layer teks tidak didukung; dilaporkan tanpa penafsiran.',
  undeclaredAsset: 'Aset fillImage tidak dideklarasikan pada <media>; penggantian tidak disarankan.',
  missingSceneAttr: 'Atribut scene wajib tidak ditemukan.',
};

function readKeyframes(propNode) {
  const keyframes = [];
  for (const child of propNode.children) {
    if (child.tag === 'kf') {
      keyframes.push({
        property: propNode.tag,
        t: child.attrs.t !== undefined ? child.attrs.t : null,
        v: child.attrs.v !== undefined ? child.attrs.v : null,
        e: child.attrs.e !== undefined ? child.attrs.e : null,
      });
    }
  }
  return keyframes;
}

function readShape(node, groups, unsupported) {
  const a = node.attrs;
  const layer = {
    kind: 'shape',
    id: a.id !== undefined ? String(a.id) : null,
    label: a.label || null,
    startTime: num(a.startTime, null),
    endTime: num(a.endTime, null),
    fillType: a.fillType || null,
    fillImage: a.fillImage || null,
    mediaFillMode: a.mediaFillMode || null,
    template: a.s || null,
    blending: a.blending || null,
    groups,
    keyframes: [],
    effects: [],
    pathD: null,
    hasPathStroke: false,
    hasBorder: false,
    hasShadow: false,
    fillColor: null,
    staticTransform: {},
    properties: [],
  };
  for (const child of node.children) {
    if (child.tag === 'transform') {
      for (const prop of child.children) {
        if (prop.attrs.value !== undefined) {
          layer.staticTransform[prop.tag] = prop.attrs.value;
        } else {
          layer.keyframes = layer.keyframes.concat(readKeyframes(prop));
        }
      }
    } else if (child.tag === 'effect') {
      layer.effects.push({
        id: child.attrs.id || null,
        locallyApplied: child.attrs.locallyApplied || null,
        properties: child.children.filter((p) => p.tag === 'property').map((p) => ({ name: p.attrs.name || null, type: p.attrs.type || null, value: p.attrs.value !== undefined ? p.attrs.value : null })),
      });
      unsupported.push({ kind: 'effect', detail: 'Efek "' + (child.attrs.id || 'tanpa id') + '" pada layer ' + (layer.id || 'tanpa id') + '.', note: UNSUPPORTED_NOTE.effect });
    } else if (child.tag === 'path') {
      layer.pathD = child.attrs.d !== undefined ? child.attrs.d : null;
    } else if (child.tag === 'path-stroke') {
      layer.hasPathStroke = true;
      unsupported.push({ kind: 'pathStroke', detail: 'path-stroke pada layer ' + (layer.id || 'tanpa id') + '.', note: UNSUPPORTED_NOTE.pathStroke });
    } else if (child.tag === 'border') {
      layer.hasBorder = true;
      unsupported.push({ kind: 'border', detail: 'border pada layer ' + (layer.id || 'tanpa id') + '.', note: UNSUPPORTED_NOTE.border });
    } else if (child.tag === 'shadow') {
      layer.hasShadow = true;
      unsupported.push({ kind: 'shadow', detail: 'shadow pada layer ' + (layer.id || 'tanpa id') + '.', note: UNSUPPORTED_NOTE.shadow });
    } else if (child.tag === 'fillColor') {
      layer.fillColor = child.attrs.value || null;
    } else if (child.tag === 'property') {
      layer.properties.push({ name: child.attrs.name || null, type: child.attrs.type || null, value: child.attrs.value !== undefined ? child.attrs.value : null });
    } else {
      unsupported.push({ kind: 'unknownElement', detail: 'Elemen <' + child.tag + '> pada shape ' + (layer.id || 'tanpa id') + '.', note: UNSUPPORTED_NOTE.unknownElement });
    }
  }
  if (layer.blending !== null) {
    unsupported.push({ kind: 'blending', detail: 'blending="' + layer.blending + '" pada layer ' + (layer.id || 'tanpa id') + '.', note: UNSUPPORTED_NOTE.blending });
  }
  return layer;
}

export function parseAlightMotionProject(text) {
  const result = { ok: false, error: '', scene: null, media: [], layers: [], assetSlots: [], unsupported: [], keyframeSummary: null };
  const tree = parseXmlTree(text);
  if (!tree.ok) { result.error = tree.error; return result; }
  const sceneNode = tree.root.children.find((c) => c.tag === 'scene');
  if (!sceneNode) { result.error = 'Elemen root <scene> tidak ditemukan. Berkas bukan proyek/preset Alight Motion yang dikenal.'; return result; }

  const scene = { attrs: { ...sceneNode.attrs } };
  for (const attr of ['title', 'width', 'height', 'fps', 'totalTime']) {
    if (sceneNode.attrs[attr] === undefined) {
      result.unsupported.push({ kind: 'missingSceneAttr', detail: 'Atribut scene "' + attr + '" tidak ditemukan.', note: UNSUPPORTED_NOTE.missingSceneAttr });
    }
  }
  scene.width = num(sceneNode.attrs.width, null);
  scene.height = num(sceneNode.attrs.height, null);
  scene.fps = num(sceneNode.attrs.fps, null);
  scene.totalTime = num(sceneNode.attrs.totalTime, null);

  const layers = [];
  const walk = (node, inheritedGroups) => {
    for (const child of node.children) {
      if (child.tag === 'media') {
        result.media.push({
          uri: child.attrs.uri !== undefined ? child.attrs.uri : null,
          filename: child.attrs.filename || null,
          title: child.attrs.title || null,
          type: child.attrs.type || null,
          size: num(child.attrs.size, null),
          width: num(child.attrs.width, null),
          height: num(child.attrs.height, null),
        });
      } else if (child.tag === 'shape') {
        layers.push(readShape(child, inheritedGroups, result.unsupported));
      } else if (child.tag === 'group' || child.tag === 'composition') {
        result.unsupported.push({ kind: 'group', detail: 'Elemen <' + child.tag + '> ditemukan; layer di dalamnya dipetakan datar.', note: UNSUPPORTED_NOTE.group });
        walk(child, inheritedGroups.concat(child.tag));
      } else if (child.tag === 'text') {
        result.unsupported.push({ kind: 'textLayer', detail: 'Elemen <text> ditemukan pada scene.', note: UNSUPPORTED_NOTE.textLayer });
      } else {
        result.unsupported.push({ kind: 'unknownElement', detail: 'Elemen <' + child.tag + '> tidak dikenali pada scene.', note: UNSUPPORTED_NOTE.unknownElement });
      }
    }
  };
  walk(sceneNode, []);
  result.layers = layers;

  const byUri = new Map();
  for (const layer of layers) {
    const uri = layer.fillImage;
    if (!uri) continue;
    if (!byUri.has(uri)) {
      byUri.set(uri, { uri, media: result.media.find((m) => m.uri === uri) || null, layerIds: [] });
    }
    byUri.get(uri).layerIds.push(layer.id !== null ? String(layer.id) : '(tanpa id)');
  }
  const slots = [];
  for (const entry of byUri.values()) {
    const type = entry.media && entry.media.type ? entry.media.type : '';
    const isImage = type.startsWith('image/') || entry.uri.startsWith('content://') || entry.uri.startsWith('am:');
    const isMedia = type.startsWith('video/') || type.startsWith('audio/');
    const slot = {
      uri: entry.uri,
      declared: entry.media !== null,
      kind: isImage ? 'image' : (isMedia ? 'media' : 'unknown'),
      filename: entry.media ? (entry.media.filename || entry.media.title) : null,
      mediaType: type || null,
      layers: entry.layerIds,
    };
    if (!slot.declared) {
      result.unsupported.push({ kind: 'undeclaredAsset', detail: 'fillImage "' + entry.uri + '" tidak memiliki deklarasi <media>.', note: UNSUPPORTED_NOTE.undeclaredAsset });
    }
    slots.push(slot);
  }
  result.assetSlots = slots;

  const layersWithKeyframes = layers.filter((l) => l.keyframes.length > 0).length;
  result.keyframeSummary = {
    layersWithKeyframes,
    keyframeCount: layers.reduce((sum, l) => sum + l.keyframes.length, 0),
    note: 'Nilai easing e (mis. cubicBezier) dipertahankan apa adanya; tidak ada klaim pemeliharaan semantik sebelum uji lapangan.',
  };
  result.scene = scene;
  result.ok = true;
  return result;
}
