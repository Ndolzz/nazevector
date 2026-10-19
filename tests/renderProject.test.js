// Uji validasi kontrak proyek render v1 (RV-1).
// Dijalankan melalui harness tests/index.html (butuh server HTTP lokal).

import {
  RENDER_PROJECT_VERSION,
  RENDER_CONSTRAINTS,
  decodedBase64Bytes,
  validateRenderProject,
} from '../server/src/validation/renderProject.js';

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assert gagal');
}

function runCase(name, fn) {
  try {
    fn();
    return { name, ok: true, error: null };
  } catch (error) {
    return { name, ok: false, error: error && error.message ? error.message : String(error) };
  }
}

function summarize(cases) {
  return {
    total: cases.length,
    passed: cases.filter((entry) => entry.ok).length,
    failed: cases.filter((entry) => !entry.ok).length,
    failures: cases.filter((entry) => !entry.ok).map((entry) => ({ name: entry.name, error: entry.error })),
  };
}

// Enkoder base64 murni agar uji tidak bergantung pada btoa (peramban) / Buffer (Node).
function makeBase64(byteValues) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < byteValues.length; i += 3) {
    const b0 = byteValues[i];
    const b1 = i + 1 < byteValues.length ? byteValues[i + 1] : null;
    const b2 = i + 2 < byteValues.length ? byteValues[i + 2] : null;
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 3) << 4) | (b1 === null ? 0 : b1 >> 4)];
    out += b1 === null ? '==' : alphabet[((b1 & 15) << 2) | (b2 === null ? 0 : b2 >> 6)];
    out += b2 === null ? '=' : alphabet[b2 & 63];
  }
  return out;
}

function makeDataUri(mime, byteValues) {
  return 'data:' + mime + ';base64,' + makeBase64(byteValues);
}

function tinyPng() {
  return makeDataUri('image/png', [137, 80, 78, 71, 13, 10, 26, 10]);
}

function validProject() {
  return {
    version: RENDER_PROJECT_VERSION,
    durationMs: 1000,
    layers: [
      {
        type: 'image',
        asset: { dataUri: tinyPng() },
        tracks: { opacity: [{ t: 0, value: 1 }] },
      },
    ],
  };
}

export function runRenderProjectTests() {
  const cases = [];

  cases.push(runCase('decodedBase64Bytes menghitung byte hasil dekode', () => {
    assert(decodedBase64Bytes('QUJD') === 3, 'QUJD seharusnya 3 byte');
    assert(decodedBase64Bytes('QQ==') === 1, 'QQ== seharusnya 1 byte');
    assert(decodedBase64Bytes('QUI=') === 2, 'QUI= seharusnya 2 byte');
    assert(decodedBase64Bytes(' QUJD\r\n') === 3, 'spasi putih seharusnya diabaikan');
    assert(Number.isNaN(decodedBase64Bytes('A')), 'panjang tidak valid seharusnya NaN');
    assert(decodedBase64Bytes('') === 0, 'string kosong seharusnya 0');
    assert(Number.isNaN(decodedBase64Bytes('####')), 'karakter tidak valid seharusnya NaN');
  }));

  cases.push(runCase('proyek minimal valid dan dinormalisasi', () => {
    const res = validateRenderProject(validProject(), {});
    assert(res.ok === true, 'seharusnya valid, galat: ' + JSON.stringify(res.errors));
    assert(res.project.canvas.width === 1280 && res.project.canvas.height === 720 && res.project.canvas.fps === 30, 'canvas salah');
    assert(res.project.layers[0].asset.dataUri === tinyPng(), 'dataUri tidak dipertahankan');
    assert(res.project.layers[0].tracks.opacity.length === 1, 'trek tidak dipertahankan');
  }));

  cases.push(runCase('input null atau array ditolak', () => {
    assert(validateRenderProject(null, {}).ok === false, 'null seharusnya ditolak');
    assert(validateRenderProject([], {}).ok === false, 'array seharusnya ditolak');
  }));

  cases.push(runCase('version salah ditolak', () => {
    const project = validProject();
    project.version = 2;
    const res = validateRenderProject(project, {});
    assert(res.ok === false && res.errors[0].indexOf('version') !== -1, 'version 2 seharusnya ditolak');
  }));

  cases.push(runCase('durationMs di luar rentang ditolak', () => {
    const low = validProject();
    low.durationMs = RENDER_CONSTRAINTS.minDurationMs - 1;
    const high = validProject();
    high.durationMs = RENDER_CONSTRAINTS.maxDurationMs + 1;
    assert(validateRenderProject(low, {}).ok === false, '199 ms seharusnya ditolak');
    assert(validateRenderProject(high, {}).ok === false, '15001 ms seharusnya ditolak');
  }));

  cases.push(runCase('durationMs pada batas diterima', () => {
    const low = validProject();
    low.durationMs = RENDER_CONSTRAINTS.minDurationMs;
    const high = validProject();
    high.durationMs = RENDER_CONSTRAINTS.maxDurationMs;
    assert(validateRenderProject(low, {}).ok === true, '200 ms seharusnya diterima');
    assert(validateRenderProject(high, {}).ok === true, '15000 ms seharusnya diterima');
  }));

  cases.push(runCase('durationMs bukan bilangan bulat ditolak', () => {
    const project = validProject();
    project.durationMs = 500.5;
    assert(validateRenderProject(project, {}).ok === false, '500.5 seharusnya ditolak');
  }));

  cases.push(runCase('layers bukan array atau kosong ditolak', () => {
    const notArray = validProject();
    notArray.layers = 'x';
    const empty = validProject();
    empty.layers = [];
    assert(validateRenderProject(notArray, {}).ok === false, 'layers string seharusnya ditolak');
    assert(validateRenderProject(empty, {}).ok === false, 'layers kosong seharusnya ditolak');
  }));

  cases.push(runCase('lebih dari 8 layer ditolak', () => {
    const project = validProject();
    project.layers = [];
    for (let i = 0; i < RENDER_CONSTRAINTS.maxLayers + 1; i++) {
      project.layers.push({ type: 'image', asset: { dataUri: tinyPng() } });
    }
    assert(validateRenderProject(project, {}).ok === false, '9 layer seharusnya ditolak');
  }));

  cases.push(runCase('layer bukan objek ditolak', () => {
    const project = validProject();
    project.layers = ['bukan objek'];
    assert(validateRenderProject(project, {}).ok === false, 'layer string seharusnya ditolak');
  }));

  cases.push(runCase('layer.type selain image ditolak', () => {
    const project = validProject();
    project.layers[0].type = 'shape';
    const res = validateRenderProject(project, {});
    assert(res.ok === false && res.errors[0].indexOf('type') !== -1, 'type shape seharusnya ditolak');
  }));

  cases.push(runCase('asset tidak ada atau bukan objek ditolak', () => {
    const missing = validProject();
    delete missing.layers[0].asset;
    const notObject = validProject();
    notObject.layers[0].asset = 'x';
    assert(validateRenderProject(missing, {}).ok === false, 'asset hilang seharusnya ditolak');
    assert(validateRenderProject(notObject, {}).ok === false, 'asset string seharusnya ditolak');
  }));

  cases.push(runCase('asset dengan dataUri dan sourceUrl sekaligus ditolak', () => {
    const project = validProject();
    project.layers[0].asset.sourceUrl = 'https://cdn.example.org/a.png';
    assert(validateRenderProject(project, {}).ok === false, 'kedua aset sekaligus seharusnya ditolak');
  }));

  cases.push(runCase('dataUri mime tidak didukung ditolak', () => {
    const project = validProject();
    project.layers[0].asset.dataUri = makeDataUri('image/gif', [71, 73, 70]);
    assert(validateRenderProject(project, {}).ok === false, 'gif seharusnya ditolak');
  }));

  cases.push(runCase('dataUri tanpa base64 atau bukan data URI ditolak', () => {
    const noBase64 = validProject();
    noBase64.layers[0].asset.dataUri = 'data:image/png,ABCDE';
    const notData = validProject();
    notData.layers[0].asset.dataUri = 'https://cdn.example.org/a.png';
    assert(validateRenderProject(noBase64, {}).ok === false, 'tanpa base64 seharusnya ditolak');
    assert(validateRenderProject(notData, {}).ok === false, 'bukan data URI seharusnya ditolak');
  }));

  cases.push(runCase('dataUri payload tidak valid ditolak', () => {
    const project = validProject();
    project.layers[0].asset.dataUri = 'data:image/png;base64,####';
    assert(validateRenderProject(project, {}).ok === false, 'payload #### seharusnya ditolak');
    const empty = validProject();
    empty.layers[0].asset.dataUri = 'data:image/png;base64,';
    assert(validateRenderProject(empty, {}).ok === false, 'payload kosong seharusnya ditolak');
  }));

  cases.push(runCase('dataUri melebihi 2 MB setelah dekode ditolak', () => {
    const project = validProject();
    project.layers[0].asset.dataUri = 'data:image/png;base64,' + 'A'.repeat(2796208);
    assert(validateRenderProject(project, {}).ok === false, 'payload > 2 MB seharusnya ditolak');
  }));

  cases.push(runCase('dataUri di bawah batas diterima', () => {
    const project = validProject();
    project.layers[0].asset.dataUri = 'data:image/png;base64,' + 'A'.repeat(2796200);
    assert(validateRenderProject(project, {}).ok === true, 'payload < 2 MB seharusnya diterima');
  }));

  cases.push(runCase('sourceUrl diterima melalui checkSourceUrl', () => {
    const project = validProject();
    project.layers[0].asset = { sourceUrl: 'https://cdn.example.org/a.png' };
    const res = validateRenderProject(project, { checkSourceUrl: () => ({ ok: true, hostname: 'cdn.example.org' }) });
    assert(res.ok === true, 'sourceUrl valid seharusnya diterima, galat: ' + JSON.stringify(res.errors));
    assert(res.project.layers[0].asset.sourceUrl === 'https://cdn.example.org/a.png', 'sourceUrl tidak dipertahankan');
  }));

  cases.push(runCase('sourceUrl ditolak bila checker menolak beserta alasannya', () => {
    const project = validProject();
    project.layers[0].asset = { sourceUrl: 'https://evil.com/a.png' };
    const res = validateRenderProject(project, { checkSourceUrl: () => ({ ok: false, reason: 'host tidak ada di allowlist' }) });
    assert(res.ok === false, 'sourceUrl terblokir seharusnya ditolak');
    assert(res.errors[0].indexOf('host tidak ada di allowlist') !== -1, 'alasan penolakan hilang');
  }));

  cases.push(runCase('sourceUrl tanpa checker ditolak', () => {
    const project = validProject();
    project.layers[0].asset = { sourceUrl: 'https://cdn.example.org/a.png' };
    const res = validateRenderProject(project, {});
    assert(res.ok === false && res.errors[0].indexOf('checkSourceUrl') !== -1, 'tanpa checker seharusnya ditolak');
  }));

  cases.push(runCase('canvas tidak cocok ditolak, canvas cocok diterima', () => {
    const wrong = validProject();
    wrong.canvas = { width: 1920, height: 1080 };
    const right = validProject();
    right.canvas = { width: 1280, height: 720, fps: 30 };
    assert(validateRenderProject(wrong, {}).ok === false, 'canvas 1920 seharusnya ditolak');
    assert(validateRenderProject(right, {}).ok === true, 'canvas cocok seharusnya diterima');
  }));

  cases.push(runCase('keyframe t tidak meningkat ketat ditolak', () => {
    const project = validProject();
    project.layers[0].tracks.x = [{ t: 0, value: 1 }, { t: 500, value: 2 }, { t: 500, value: 3 }];
    assert(validateRenderProject(project, {}).ok === false, 't duplikat seharusnya ditolak');
    const decreasing = validProject();
    decreasing.layers[0].tracks.x = [{ t: 600, value: 1 }, { t: 500, value: 2 }];
    assert(validateRenderProject(decreasing, {}).ok === false, 't menurun seharusnya ditolak');
  }));

  cases.push(runCase('keyframe t di luar durationMs ditolak', () => {
    const project = validProject();
    project.layers[0].tracks.x = [{ t: 0, value: 1 }, { t: 1500, value: 2 }];
    assert(validateRenderProject(project, {}).ok === false, 't 1500 > 1000 seharusnya ditolak');
    const negative = validProject();
    negative.layers[0].tracks.x = [{ t: -1, value: 1 }];
    assert(validateRenderProject(negative, {}).ok === false, 't negatif seharusnya ditolak');
  }));

  cases.push(runCase('keyframe value di luar rentang ditolak', () => {
    const project = validProject();
    project.layers[0].tracks.scale = [{ t: 0, value: 20 }];
    assert(validateRenderProject(project, {}).ok === false, 'scale 20 seharusnya ditolak');
    const opacity = validProject();
    opacity.layers[0].tracks.opacity = [{ t: 0, value: 1.5 }];
    assert(validateRenderProject(opacity, {}).ok === false, 'opacity 1.5 seharusnya ditolak');
  }));

  cases.push(runCase('lebih dari 64 keyframe ditolak', () => {
    const project = validProject();
    const keyframes = [];
    for (let i = 0; i <= RENDER_CONSTRAINTS.maxKeyframesPerTrack; i++) keyframes.push({ t: i * 10, value: 1 });
    project.layers[0].tracks.x = keyframes;
    assert(validateRenderProject(project, {}).ok === false, '65 keyframe seharusnya ditolak');
  }));

  cases.push(runCase('nama trek tidak dikenal ditolak sebagai pelindung salah tik', () => {
    const project = validProject();
    project.layers[0].tracks.opaciti = [{ t: 0, value: 1 }];
    const res = validateRenderProject(project, {});
    assert(res.ok === false && res.errors[0].indexOf('opaciti') !== -1, 'trek salah tik seharusnya ditolak');
  }));

  cases.push(runCase('field tidak dikenal diabaikan', () => {
    const project = validProject();
    project.author = 'uji';
    project.layers[0].zIndex = 3;
    project.layers[0].asset.extra = true;
    const res = validateRenderProject(project, {});
    assert(res.ok === true, 'field asing seharusnya diabaikan, galat: ' + JSON.stringify(res.errors));
    assert(JSON.stringify(Object.keys(res.project)) === JSON.stringify(['version', 'durationMs', 'canvas', 'layers']), 'proyek memuat field asing');
    assert(JSON.stringify(Object.keys(res.project.layers[0])) === JSON.stringify(['type', 'asset', 'tracks']), 'layer memuat field asing');
  }));

  return summarize(cases);
}
