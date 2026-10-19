// Uji integrasi NYATA dengan FFmpeg. Setiap kasus memeriksa ketersediaan
// FFmpeg lebih dahulu dan otomatis ter-skip bila tidak tersedia, sehingga
// tidak pernah mengklaim render MP4 berhasil tanpa proses nyata.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { probeFfmpeg, ffprobeImageSize, decodeImageToRgba } from '../src/ffmpeg.js';
import { JobManager } from '../src/jobManager.js';
import { createRenderService } from '../src/renderService.js';

async function ensureFfmpeg(t) {
  const probe = await probeFfmpeg({ ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' }, 10000);
  if (!probe.ok) {
    t.skip('FFmpeg tidak tersedia: ' + probe.reason);
    return null;
  }
  return probe;
}

async function withRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), 'naze-ff-'));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function writeSamplePng(root) {
  const pngPath = join(root, 'aset.png');
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=red:s=320x240',
    '-frames:v', '1',
    pngPath,
  ]);
  return pngPath;
}

test('p-1 probe versi dan pembacaan dimensi PNG', async (t) => {
  const probe = await ensureFfmpeg(t);
  if (!probe) return;
  assert.equal(probe.ok, true);
  assert.equal(typeof probe.versions.ffmpeg, 'string');
  await withRoot(async (root) => {
    const pngPath = writeSamplePng(root);
    const size = await ffprobeImageSize('ffprobe', pngPath, 10000);
    assert.equal(size.ok, true);
    assert.equal(size.width, 320);
    assert.equal(size.height, 240);
  });
});

test('p-2 dekode PNG ke RGBA dengan piksel merah', async (t) => {
  const probe = await ensureFfmpeg(t);
  if (!probe) return;
  await withRoot(async (root) => {
    const pngPath = writeSamplePng(root);
    const decoded = await decodeImageToRgba({
      ffmpegPath: 'ffmpeg',
      inputPath: pngPath,
      width: 320,
      height: 240,
      timeoutMs: 15000,
    });
    assert.equal(decoded.ok, true);
    assert.equal(decoded.pixels.length, 320 * 240 * 4);
    const offset = (10 * 320 + 10) * 4;
    assert.ok(decoded.pixels[offset] > 200, 'kanal merah pada piksel (10,10)');
  });
});

async function renderSampleVideo(probe) {
  const root = await mkdtemp(join(tmpdir(), 'naze-ff-'));
  const pngPath = writeSamplePng(root);
  const png = await readFile(pngPath);
  const project = {
    version: 1,
    durationMs: 500,
    layers: [{
      type: 'image',
      asset: { dataUri: 'data:image/png;base64,' + png.toString('base64') },
      tracks: {
        x: [{ t: 0, value: 640 }],
        y: [{ t: 0, value: 360 }],
      },
    }],
  };
  const jobManager = new JobManager({ jobsDir: join(root, 'jobs') });
  await jobManager.init();
  const renderService = createRenderService({
    config: {
      sourceAllowlist: [],
      minFreeDiskBytes: 0,
      videoTtlMs: 3600000,
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe',
      renderTimeoutMs: 120000,
      downloadTimeoutMs: 15000,
      maxAssetBytes: 5 * 1024 * 1024,
      maxActiveRenders: 1,
      maxQueuedRenders: 5,
    },
    jobManager,
  });
  renderService.setFfmpegProbe({ ok: true, versions: probe.versions });
  const created = await renderService.createJob(project);
  assert.equal(created.ok, true);
  const deadline = Date.now() + 90000;
  let summary = null;
  for (;;) {
    summary = await renderService.jobSummary(created.jobId);
    if (summary.status === 'completed' || summary.status === 'failed') break;
    if (Date.now() > deadline) throw new Error('render melebihi batas waktu');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { root, jobManager, summary, jobId: created.jobId };
}

test('p-3 render MP4 end-to-end melalui renderService', async (t) => {
  const probe = await ensureFfmpeg(t);
  if (!probe) return;
  const ctx = await renderSampleVideo(probe);
  try {
    assert.equal(ctx.summary.status, 'completed', 'job selesai: ' + JSON.stringify(ctx.summary.error));
    const video = await readFile(ctx.jobManager.videoPath(ctx.jobId));
    assert.ok(video.length > 100, 'video tidak kosong');
    assert.equal(String.fromCharCode(video[4], video[5], video[6], video[7]), 'ftyp');
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('p-4 verifikasi kodek dan dimensi MP4 hasil', async (t) => {
  const probe = await ensureFfmpeg(t);
  if (!probe) return;
  const ctx = await renderSampleVideo(probe);
  try {
    assert.equal(ctx.summary.status, 'completed');
    const videoPath = ctx.jobManager.videoPath(ctx.jobId);
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height',
      '-show_entries', 'format=duration',
      '-of', 'json',
      videoPath,
    ]).toString();
    const info = JSON.parse(out);
    assert.equal(info.streams[0].codec_name, 'h264');
    assert.equal(info.streams[0].width, 1280);
    assert.equal(info.streams[0].height, 720);
    const duration = Number(info.format.duration);
    assert.ok(duration > 0.4 && duration < 0.7, 'durasi sekitar 0,5 detik');
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
