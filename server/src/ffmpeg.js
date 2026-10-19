// Pembungkus proses FFmpeg/FFprobe untuk Naze Vector Render Server.
// Semua proses dijalankan dengan argumen terpisah (tanpa shell), batas
// waktu, dan pembatas ukuran keluaran. computeScaledDims adalah bagian murni
// yang dapat diverifikasi tanpa Node.

import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

// @pure-start
// Menghitung dimensi dekode gambar: bila jumlah piksel melebihi maxPixels,
// gambar diperkecil proporsional agar memori RGBA per aset tetap terbatas.
export function computeScaledDims(width, height, maxPixels) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }
  const cap = (Number.isInteger(maxPixels) && maxPixels > 0) ? maxPixels : 1280 * 720;
  const pixels = width * height;
  if (pixels <= cap) {
    return { width, height, scaled: false };
  }
  const factor = Math.sqrt(cap / pixels);
  let scaledWidth = Math.max(1, Math.floor(width * factor));
  let scaledHeight = Math.max(1, Math.floor(height * factor));
  while (scaledWidth * scaledHeight > cap && (scaledWidth > 1 || scaledHeight > 1)) {
    if (scaledWidth >= scaledHeight && scaledWidth > 1) {
      scaledWidth -= 1;
    } else if (scaledHeight > 1) {
      scaledHeight -= 1;
    } else {
      scaledWidth -= 1;
    }
  }
  return { width: scaledWidth, height: scaledHeight, scaled: true };
}
// @pure-end

function runProcess(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    child.stdout.on('data', (chunk) => {
      if (stdoutBytes < MAX_OUTPUT_BYTES) {
        stdoutChunks.push(chunk);
        stdoutBytes += chunk.length;
      }
    });
    child.stderr.on('data', (chunk) => {
      if (stderrBytes < 65536) {
        stderrChunks.push(chunk);
        stderrBytes += chunk.length;
      }
    });
    child.on('error', (err) => {
      finish({ ok: false, reason: 'spawn_failed', message: err.message });
    });
    child.on('close', (code) => {
      if (timedOut) {
        finish({ ok: false, reason: 'timeout' });
        return;
      }
      if (code === 0) {
        finish({ ok: true, stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks) });
        return;
      }
      finish({ ok: false, reason: 'exit_' + code, stderr: Buffer.concat(stderrChunks).toString('utf8').slice(0, 512) });
    });
  });
}

function firstVersionLine(text) {
  const line = String(text).split('\n')[0] || '';
  const match = /\bversion\s+([0-9][^\s-]*)/.exec(line);
  return match ? match[1] : 'tidak diketahui';
}

// Memeriksa ketersediaan ffmpeg dan ffprobe beserta versinya.
export async function probeFfmpeg(paths, timeoutMs) {
  const opts = paths || {};
  const timeout = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : 10000;
  const ffmpeg = await runProcess(opts.ffmpegPath || 'ffmpeg', ['-version'], timeout);
  if (!ffmpeg.ok) {
    return { ok: false, reason: 'ffmpeg ' + (ffmpeg.reason || 'gagal') };
  }
  const ffprobe = await runProcess(opts.ffprobePath || 'ffprobe', ['-version'], timeout);
  if (!ffprobe.ok) {
    return { ok: false, reason: 'ffprobe ' + (ffprobe.reason || 'gagal') };
  }
  return {
    ok: true,
    versions: {
      ffmpeg: firstVersionLine(ffmpeg.stdout),
      ffprobe: firstVersionLine(ffprobe.stdout),
    },
  };
}

// Membaca dimensi gambar melalui ffprobe (keluaran JSON).
export async function ffprobeImageSize(ffprobePath, filePath, timeoutMs) {
  const result = await runProcess(ffprobePath, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'json',
    filePath,
  ], (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : 10000);
  if (!result.ok) {
    return { ok: false, reason: 'ffprobe gagal: ' + (result.reason || 'keluaran tidak valid') };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(String(result.stdout));
  } catch (e) {
    return { ok: false, reason: 'keluaran ffprobe bukan JSON' };
  }
  const stream = (parsed && Array.isArray(parsed.streams)) ? parsed.streams[0] : null;
  const width = stream ? Number(stream.width) : NaN;
  const height = stream ? Number(stream.height) : NaN;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ok: false, reason: 'dimensi gambar tidak terbaca' };
  }
  return { ok: true, width, height };
}

// Mendekode gambar menjadi RGBA mentah dengan ukuran target tertentu.
export async function decodeImageToRgba(options) {
  const opts = options || {};
  const timeout = (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) ? opts.timeoutMs : 30000;
  const result = await runProcess(opts.ffmpegPath || 'ffmpeg', [
    '-v', 'error',
    '-i', opts.inputPath,
    '-vf', 'scale=' + opts.width + ':' + opts.height,
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    'pipe:1',
  ], timeout);
  if (!result.ok) {
    return { ok: false, reason: 'ffmpeg gagal mendekode: ' + (result.reason || 'gagal') };
  }
  const expected = opts.width * opts.height * 4;
  if (result.stdout.length !== expected) {
    return { ok: false, reason: 'ukuran RGBA tidak sesuai (' + result.stdout.length + ' != ' + expected + ')' };
  }
  return { ok: true, pixels: result.stdout };
}

// Membuat encoder H.264 yang membaca RGBA dari stdin. wait() dapat dipanggil
// berkali-kali dan menyelesaikan dengan hasil yang sama; batas waktu proses
// dijaga dengan SIGKILL.
export function createEncoder(options) {
  const opts = options || {};
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-video_size', opts.width + 'x' + opts.height,
    '-framerate', String(opts.fps),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    opts.destPath,
  ];
  const child = spawn(opts.ffmpegPath || 'ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  const stderrChunks = [];
  let stderrBytes = 0;
  let settled = false;
  let timedOut = false;
  let outcome = null;
  const waiters = [];
  const timer = setTimeout(() => {
    timedOut = true;
    try { child.stdin.end(); } catch (e) { /* stdin mungkin sudah tertutup */ }
    child.kill('SIGKILL');
  }, (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) ? opts.timeoutMs : 300000);
  child.stderr.on('data', (chunk) => {
    if (stderrBytes < 65536) {
      stderrChunks.push(chunk);
      stderrBytes += chunk.length;
    }
  });
  child.stdin.on('error', () => { /* dicatat lewat exit code pada wait() */ });
  const settle = (result) => {
    if (settled) return;
    settled = true;
    outcome = result;
    clearTimeout(timer);
    for (const waiter of waiters.splice(0)) waiter(result);
  };
  child.on('error', (err) => {
    settle({ ok: false, reason: 'spawn_failed', message: err.message });
  });
  child.on('close', (code) => {
    if (timedOut) {
      settle({ ok: false, reason: 'timeout' });
      return;
    }
    if (code === 0) {
      settle({ ok: true });
      return;
    }
    settle({ ok: false, reason: 'exit_' + code, stderr: Buffer.concat(stderrChunks).toString('utf8').slice(0, 512) });
  });
  const wait = () => new Promise((resolve) => {
    if (settled) { resolve(outcome); return; }
    waiters.push(resolve);
  });
  return { stdin: child.stdin, wait };
}
