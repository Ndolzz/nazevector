// Konfigurasi lingkungan untuk Naze Vector Render Server.
// Modul murni: tidak memakai API Node sehingga dapat diverifikasi di mana pun.
// Semua galat dikumpulkan; hasil berupa {errors:[...]} atau {config:{...}}.

export const CONFIG_DEFAULTS = Object.freeze({
  port: 3000,
  jobsDir: './jobs',
  sourceAllowlist: [],
  videoTtlMs: 3600000,
  minFreeDiskBytes: 512 * 1024 * 1024,
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',
  renderTimeoutMs: 300000,
  downloadTimeoutMs: 15000,
  maxRequestBodyBytes: 16 * 1024 * 1024,
  maxAssetBytes: 5 * 1024 * 1024,
  allowedOrigins: [],
  maxActiveRenders: 1,
  maxQueuedRenders: 20,
});

const ORIGIN_PATTERN = /^https?:\/\/[^\/]+$/i;

function readString(env, name, errors) {
  const raw = env[name];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string' || raw.trim() === '') {
    errors.push(name + ' harus string tidak kosong');
    return null;
  }
  return raw.trim();
}

function readPositiveInt(env, name, errors) {
  const raw = env[name];
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(name + ' harus bilangan bulat positif');
    return null;
  }
  return value;
}

function readBoundedInt(env, name, min, max, errors) {
  const value = readPositiveInt(env, name, errors);
  if (value === null) return null;
  if (value < min || value > max) {
    errors.push(name + ' harus antara ' + min + ' dan ' + max);
    return null;
  }
  return value;
}

function readStringList(env, name, errors) {
  const raw = env[name];
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    errors.push(name + ' harus string dipisah koma');
    return null;
  }
  const entries = raw.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '');
  if (entries.length === 0) {
    errors.push(name + ' tidak memuat entri valid');
    return null;
  }
  return entries;
}

function readOrigins(env, name, errors) {
  const entries = readStringList(env, name, errors);
  if (entries === null) return null;
  const origins = [];
  let valid = true;
  for (const entry of entries) {
    if (!ORIGIN_PATTERN.test(entry)) {
      errors.push(name + ' entri tidak valid (harus http(s)://host tanpa path): ' + entry);
      valid = false;
    } else {
      origins.push(entry.toLowerCase());
    }
  }
  return valid ? origins : null;
}

// Memuat konfigurasi dari objek lingkungan. Mengembalikan {errors} bila ada
// nilai tidak valid, atau {config} bila semua nilai bersih.
export function loadConfig(env) {
  const source = env || {};
  const errors = [];

  const port = readBoundedInt(source, 'NAZE_PORT', 1, 65535, errors);
  const jobsDir = readString(source, 'NAZE_JOBS_DIR', errors);
  const sourceAllowlist = readStringList(source, 'NAZE_SOURCE_ALLOWLIST', errors);
  const videoTtlMs = readPositiveInt(source, 'NAZE_VIDEO_TTL_MS', errors);
  const minFreeDiskBytes = readPositiveInt(source, 'NAZE_MIN_FREE_DISK_BYTES', errors);
  const ffmpegPath = readString(source, 'NAZE_FFMPEG_PATH', errors);
  const ffprobePath = readString(source, 'NAZE_FFPROBE_PATH', errors);
  const renderTimeoutMs = readPositiveInt(source, 'NAZE_RENDER_TIMEOUT_MS', errors);
  const downloadTimeoutMs = readPositiveInt(source, 'NAZE_DOWNLOAD_TIMEOUT_MS', errors);
  const maxRequestBodyBytes = readPositiveInt(source, 'NAZE_MAX_REQUEST_BODY_BYTES', errors);
  const maxAssetBytes = readPositiveInt(source, 'NAZE_MAX_ASSET_BYTES', errors);
  const maxActiveRenders = readBoundedInt(source, 'NAZE_MAX_ACTIVE_RENDERS', 1, 8, errors);
  const maxQueuedRenders = readBoundedInt(source, 'NAZE_MAX_QUEUED_RENDERS', 1, 100, errors);
  const allowedOrigins = readOrigins(source, 'NAZE_ALLOWED_ORIGIN', errors);

  const rawApiKey = source.NAZE_API_KEY;
  if (rawApiKey !== undefined && rawApiKey !== null && rawApiKey !== '') {
    if (typeof rawApiKey !== 'string' || rawApiKey.length < 16) {
      errors.push('NAZE_API_KEY harus minimal 16 karakter');
    }
  }
  const rawAllowNoAuth = source.NAZE_ALLOW_NO_AUTH;
  if (rawAllowNoAuth !== undefined && rawAllowNoAuth !== null && rawAllowNoAuth !== ''
    && rawAllowNoAuth !== '0' && rawAllowNoAuth !== '1') {
    errors.push('NAZE_ALLOW_NO_AUTH hanya menerima 0 atau 1');
  }

  if (errors.length > 0) return { errors };

  const config = Object.assign({}, CONFIG_DEFAULTS, {
    apiKey: (typeof rawApiKey === 'string' && rawApiKey !== '') ? rawApiKey : null,
    allowNoAuth: rawAllowNoAuth === '1',
  });
  if (port !== null) config.port = port;
  if (jobsDir !== null) config.jobsDir = jobsDir;
  if (sourceAllowlist !== null) config.sourceAllowlist = sourceAllowlist;
  if (videoTtlMs !== null) config.videoTtlMs = videoTtlMs;
  if (minFreeDiskBytes !== null) config.minFreeDiskBytes = minFreeDiskBytes;
  if (ffmpegPath !== null) config.ffmpegPath = ffmpegPath;
  if (ffprobePath !== null) config.ffprobePath = ffprobePath;
  if (renderTimeoutMs !== null) config.renderTimeoutMs = renderTimeoutMs;
  if (downloadTimeoutMs !== null) config.downloadTimeoutMs = downloadTimeoutMs;
  if (maxRequestBodyBytes !== null) config.maxRequestBodyBytes = maxRequestBodyBytes;
  if (maxAssetBytes !== null) config.maxAssetBytes = maxAssetBytes;
  if (maxActiveRenders !== null) config.maxActiveRenders = maxActiveRenders;
  if (maxQueuedRenders !== null) config.maxQueuedRenders = maxQueuedRenders;
  if (allowedOrigins !== null) config.allowedOrigins = allowedOrigins;
  return { config };
}
