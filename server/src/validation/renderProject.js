// Validasi kontrak proyek render v1 untuk Naze Vector Render Server.
// Modul murni: tidak memakai API Node maupun DOM sehingga dapat diuji
// di harness peramban (tests/index.html) dan dipakai di server Node.

export const RENDER_PROJECT_VERSION = 1;

export const RENDER_CONSTRAINTS = {
  canvasWidth: 1280,
  canvasHeight: 720,
  fps: 30,
  minDurationMs: 200,
  maxDurationMs: 15000,
  minLayers: 1,
  maxLayers: 8,
  maxKeyframesPerTrack: 64,
  maxDataUriDecodedBytes: 2 * 1024 * 1024,
  allowedImageMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  ranges: {
    x: [-2560, 2560],
    y: [-1440, 1440],
    scale: [0.01, 10],
    rotation: [-3600, 3600],
    opacity: [0, 1],
  },
};

const TRACK_NAMES = ['x', 'y', 'scale', 'rotation', 'opacity'];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Menghitung jumlah byte hasil dekode payload base64 tanpa memdekode-nya.
export function decodedBase64Bytes(base64) {
  if (typeof base64 !== 'string') return NaN;
  const compact = base64.replace(/\s+/g, '');
  if (compact.length === 0) return 0;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return NaN;
  if (compact.length % 4 !== 0) return NaN;
  let padding = 0;
  if (compact.endsWith('==')) padding = 2;
  else if (compact.endsWith('=')) padding = 1;
  return (compact.length / 4) * 3 - padding;
}

function validateCanvas(input, errors) {
  if (input.canvas === undefined) return;
  if (input.canvas === null || typeof input.canvas !== 'object' || Array.isArray(input.canvas)) {
    errors.push('project.canvas harus objek');
    return;
  }
  if (input.canvas.width !== undefined && input.canvas.width !== RENDER_CONSTRAINTS.canvasWidth) {
    errors.push('project.canvas.width harus ' + RENDER_CONSTRAINTS.canvasWidth);
  }
  if (input.canvas.height !== undefined && input.canvas.height !== RENDER_CONSTRAINTS.canvasHeight) {
    errors.push('project.canvas.height harus ' + RENDER_CONSTRAINTS.canvasHeight);
  }
  if (input.canvas.fps !== undefined && input.canvas.fps !== RENDER_CONSTRAINTS.fps) {
    errors.push('project.canvas.fps harus ' + RENDER_CONSTRAINTS.fps);
  }
}

function validateTrack(track, label, name, durationMs, errors) {
  if (!Array.isArray(track) || track.length === 0) {
    errors.push(label + ' harus array keyframe tidak kosong');
    return;
  }
  if (track.length > RENDER_CONSTRAINTS.maxKeyframesPerTrack) {
    errors.push(label + ' maksimal ' + RENDER_CONSTRAINTS.maxKeyframesPerTrack + ' keyframe');
    return;
  }
  const range = RENDER_CONSTRAINTS.ranges[name];
  let previousT = null;
  for (let i = 0; i < track.length; i++) {
    const keyframe = track[i];
    const keyframeLabel = label + '[' + i + ']';
    if (keyframe === null || typeof keyframe !== 'object' || Array.isArray(keyframe)) {
      errors.push(keyframeLabel + ' harus objek {t, value}');
      return;
    }
    if (!isFiniteNumber(keyframe.t)) {
      errors.push(keyframeLabel + '.t harus angka');
      return;
    }
    if (keyframe.t < 0 || (durationMs !== null && keyframe.t > durationMs)) {
      errors.push(keyframeLabel + '.t harus dalam rentang 0..' + durationMs + ' ms');
      return;
    }
    if (previousT !== null && keyframe.t <= previousT) {
      errors.push(label + ' harus memiliki t yang meningkat secara ketat');
      return;
    }
    previousT = keyframe.t;
    if (!isFiniteNumber(keyframe.value)) {
      errors.push(keyframeLabel + '.value harus angka');
      return;
    }
    if (keyframe.value < range[0] || keyframe.value > range[1]) {
      errors.push(keyframeLabel + '.value di luar rentang ' + range[0] + '..' + range[1]);
      return;
    }
  }
}

function validateDataUri(dataUri, label, errors) {
  const commaIndex = dataUri.indexOf(',');
  if (!dataUri.startsWith('data:') || commaIndex === -1) {
    errors.push(label + ' harus berupa data URI "data:<mime>;base64,<payload>"');
    return;
  }
  const header = dataUri.slice(0, commaIndex);
  const payload = dataUri.slice(commaIndex + 1);
  const parameters = header.slice(5).toLowerCase().split(';');
  const mime = parameters[0];
  if (RENDER_CONSTRAINTS.allowedImageMimeTypes.indexOf(mime) === -1) {
    errors.push(label + ' mime tidak didukung (hanya ' + RENDER_CONSTRAINTS.allowedImageMimeTypes.join(', ') + ')');
    return;
  }
  if (parameters.indexOf('base64') === -1) {
    errors.push(label + ' harus ber-enkode base64');
    return;
  }
  const decodedBytes = decodedBase64Bytes(payload);
  if (!Number.isFinite(decodedBytes) || decodedBytes <= 0) {
    errors.push(label + ' payload bukan base64 valid atau kosong');
    return;
  }
  if (decodedBytes > RENDER_CONSTRAINTS.maxDataUriDecodedBytes) {
    errors.push(label + ' melebihi ' + RENDER_CONSTRAINTS.maxDataUriDecodedBytes + ' byte setelah dekode');
  }
}

function validateSourceUrl(sourceUrl, label, options, errors) {
  if (typeof options.checkSourceUrl !== 'function') {
    errors.push(label + ' memerlukan pemeriksa allowlist (checkSourceUrl) pada opsi validasi');
    return;
  }
  const result = options.checkSourceUrl(sourceUrl);
  if (!result || result.ok !== true) {
    errors.push(label + ' ditolak: ' + ((result && result.reason) || 'alasan tidak diketahui'));
  }
}

function validateLayerTracks(tracks, label, durationMs, errors) {
  if (tracks === undefined || tracks === null) return;
  if (typeof tracks !== 'object' || Array.isArray(tracks)) {
    errors.push(label + '.tracks harus objek');
    return;
  }
  for (const name of Object.keys(tracks)) {
    if (TRACK_NAMES.indexOf(name) === -1) {
      errors.push(label + '.tracks memiliki trek tidak dikenal: ' + name);
      continue;
    }
    validateTrack(tracks[name], label + '.tracks.' + name, name, durationMs, errors);
  }
}

function validateLayer(layer, index, durationMs, options, errors) {
  const label = 'layers[' + index + ']';
  if (layer === null || typeof layer !== 'object' || Array.isArray(layer)) {
    errors.push(label + ' harus objek');
    return;
  }
  if (layer.type !== 'image') {
    errors.push(label + '.type harus "image"');
  }
  const asset = layer.asset;
  if (asset === null || typeof asset !== 'object' || Array.isArray(asset)) {
    errors.push(label + '.asset harus objek');
    return;
  }
  const hasDataUri = typeof asset.dataUri === 'string' && asset.dataUri.length > 0;
  const hasSourceUrl = typeof asset.sourceUrl === 'string' && asset.sourceUrl.length > 0;
  if (hasDataUri && hasSourceUrl) {
    errors.push(label + '.asset tidak boleh memuat dataUri dan sourceUrl sekaligus');
    return;
  }
  if (!hasDataUri && !hasSourceUrl) {
    errors.push(label + '.asset harus memuat dataUri atau sourceUrl');
    return;
  }
  if (hasDataUri) validateDataUri(asset.dataUri, label + '.asset.dataUri', errors);
  else validateSourceUrl(asset.sourceUrl, label + '.asset.sourceUrl', options, errors);
  validateLayerTracks(layer.tracks, label, durationMs, errors);
}

// Memvalidasi proyek render v1. Mengembalikan {ok, errors, project};
// project adalah salinan ternormalisasi (hanya field dikenal) bila valid.
// Field asing diabaikan; nama trek tidak dikenal ditolak (pelindung salah tik).
export function validateRenderProject(input, options) {
  const opts = options || {};
  const errors = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['project harus objek'], project: null };
  }
  if (input.version !== RENDER_PROJECT_VERSION) {
    errors.push('project.version harus ' + RENDER_PROJECT_VERSION);
  }
  const durationOk = isFiniteNumber(input.durationMs) && Number.isInteger(input.durationMs);
  if (!durationOk) {
    errors.push('project.durationMs harus bilangan bulat');
  } else if (input.durationMs < RENDER_CONSTRAINTS.minDurationMs || input.durationMs > RENDER_CONSTRAINTS.maxDurationMs) {
    errors.push('project.durationMs harus antara ' + RENDER_CONSTRAINTS.minDurationMs + ' dan ' + RENDER_CONSTRAINTS.maxDurationMs + ' ms');
  }
  const durationMs = durationOk ? input.durationMs : null;
  validateCanvas(input, errors);
  if (!Array.isArray(input.layers) || input.layers.length < RENDER_CONSTRAINTS.minLayers) {
    errors.push('project.layers harus array dengan minimal ' + RENDER_CONSTRAINTS.minLayers + ' layer');
  } else if (input.layers.length > RENDER_CONSTRAINTS.maxLayers) {
    errors.push('project.layers maksimal ' + RENDER_CONSTRAINTS.maxLayers + ' layer');
  } else {
    for (let i = 0; i < input.layers.length; i++) {
      validateLayer(input.layers[i], i, durationMs, opts, errors);
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors, project: null };
  }
  const project = {
    version: RENDER_PROJECT_VERSION,
    durationMs: input.durationMs,
    canvas: {
      width: RENDER_CONSTRAINTS.canvasWidth,
      height: RENDER_CONSTRAINTS.canvasHeight,
      fps: RENDER_CONSTRAINTS.fps,
    },
    layers: input.layers.map((layer) => {
      const asset = (typeof layer.asset.dataUri === 'string' && layer.asset.dataUri.length > 0)
        ? { dataUri: layer.asset.dataUri }
        : { sourceUrl: layer.asset.sourceUrl };
      const tracks = {};
      const sourceTracks = layer.tracks || {};
      for (const name of TRACK_NAMES) {
        if (Array.isArray(sourceTracks[name]) && sourceTracks[name].length > 0) {
          tracks[name] = sourceTracks[name].map((keyframe) => ({ t: keyframe.t, value: keyframe.value }));
        }
      }
      return { type: 'image', asset, tracks };
    }),
  };
  return { ok: true, errors: [], project };
}
