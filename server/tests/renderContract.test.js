// Uji kontrak sisi server: jalur galat createJob dan siklus job render
// dengan dependensi FFmpeg dipalsukan (tanpa proses nyata).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobManager } from '../src/jobManager.js';
import { createRenderService } from '../src/renderService.js';

function baseConfig(extra) {
  return Object.assign({
    sourceAllowlist: ['cdn.example.org'],
    minFreeDiskBytes: 0,
    videoTtlMs: 3600000,
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    renderTimeoutMs: 5000,
    downloadTimeoutMs: 5000,
    maxAssetBytes: 1024 * 1024,
    maxActiveRenders: 1,
    maxQueuedRenders: 20,
  }, extra || {});
}

function instantDeps(overrides) {
  return Object.assign({
    downloadImage: async () => ({ ok: false, code: 'SOURCE_URL_REJECTED', message: 'tidak dipakai' }),
    ffprobeImageSize: async () => ({ ok: true, width: 2, height: 2 }),
    decodeImageToRgba: async () => ({ ok: true, pixels: Buffer.alloc(16, 255) }),
    createEncoder: () => ({
      stdin: { write: () => true, once: () => {}, end: () => {}, destroy: () => {} },
      wait: async () => ({ ok: true }),
    }),
    writeFile: async () => {},
    unlink: async () => {},
    statFile: async () => ({ size: 1234 }),
  }, overrides || {});
}

function sampleProject() {
  const payload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  return {
    version: 1,
    durationMs: 200,
    layers: [{
      type: 'image',
      asset: { dataUri: 'data:image/png;base64,' + payload.toString('base64') },
      tracks: { x: [{ t: 0, value: 100 }] },
    }],
  };
}

async function withService(configExtra, deps, fn) {
  const root = await mkdtemp(join(tmpdir(), 'naze-rc-'));
  const jobManager = new JobManager({ jobsDir: join(root, 'jobs') });
  await jobManager.init();
  const renderService = createRenderService({
    config: baseConfig(configExtra),
    jobManager,
    deps,
  });
  renderService.setFfmpegProbe({ ok: true, versions: { ffmpeg: 'uji', ffprobe: 'uji' } });
  try {
    await fn({ renderService, jobManager, root });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function waitForStatus(renderService, jobId, statuses, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 5000);
  for (;;) {
    const summary = await renderService.jobSummary(jobId);
    if (summary && statuses.indexOf(summary.status) !== -1) return summary;
    if (Date.now() > deadline) throw new Error('job belum mencapai status yang ditunggu');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('rc-1 proyek tidak valid menghasilkan VALIDATION_ERROR 400', async () => {
  await withService(null, instantDeps(), async ({ renderService }) => {
    const result = await renderService.createJob({});
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 400);
    assert.equal(result.code, 'VALIDATION_ERROR');
    assert.ok(result.details.length >= 1);
  });
});

test('rc-2 sourceUrl di luar allowlist ditolak', async () => {
  await withService(null, instantDeps(), async ({ renderService }) => {
    const project = {
      version: 1,
      durationMs: 200,
      layers: [{
        type: 'image',
        asset: { sourceUrl: 'https://musuh.example.org/a.png' },
        tracks: {},
      }],
    };
    const result = await renderService.createJob(project);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'VALIDATION_ERROR');
  });
});

test('rc-3 FFmpeg belum diprobe menghasilkan FFMPEG_UNAVAILABLE 503', async () => {
  const root = await mkdtemp(join(tmpdir(), 'naze-rc-'));
  try {
    const jobManager = new JobManager({ jobsDir: join(root, 'jobs') });
    await jobManager.init();
    const renderService = createRenderService({
      config: baseConfig(),
      jobManager,
      deps: instantDeps(),
    });
    const result = await renderService.createJob(sampleProject());
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 503);
    assert.equal(result.code, 'FFMPEG_UNAVAILABLE');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rc-4 disk tidak tersedia menghasilkan DISK_FULL 503', async () => {
  const root = await mkdtemp(join(tmpdir(), 'naze-rc-'));
  try {
    const jobManager = new JobManager({ jobsDir: join(root, 'tidak-ada-jobs') });
    const renderService = createRenderService({
      config: baseConfig(),
      jobManager,
      deps: instantDeps(),
    });
    renderService.setFfmpegProbe({ ok: true, versions: { ffmpeg: 'uji', ffprobe: 'uji' } });
    const result = await renderService.createJob(sampleProject());
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 503);
    assert.equal(result.code, 'DISK_FULL');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rc-5 antrean penuh menghasilkan QUEUE_FULL 429', async () => {
  const hangingDeps = instantDeps({
    createEncoder: () => ({
      stdin: { write: () => true, once: () => {}, end: () => {}, destroy: () => {} },
      wait: () => new Promise(() => {}),
    }),
  });
  await withService({ maxActiveRenders: 1, maxQueuedRenders: 1 }, hangingDeps, async ({ renderService }) => {
    const first = await renderService.createJob(sampleProject());
    assert.equal(first.ok, true);
    const second = await renderService.createJob(sampleProject());
    assert.equal(second.ok, true);
    assert.equal(second.position, 1);
    const third = await renderService.createJob(sampleProject());
    assert.equal(third.ok, false);
    assert.equal(third.httpStatus, 429);
    assert.equal(third.code, 'QUEUE_FULL');
  });
});

test('rc-6 kegagalan dekode menandai job failed dan meta tersimpan', async () => {
  const failingDeps = instantDeps({
    decodeImageToRgba: async () => ({ ok: false, reason: 'uji gagal' }),
  });
  await withService(null, failingDeps, async ({ renderService, jobManager }) => {
    const created = await renderService.createJob(sampleProject());
    assert.equal(created.ok, true);
    const summary = await waitForStatus(renderService, created.jobId, ['failed']);
    assert.equal(summary.status, 'failed');
    assert.ok(summary.error.indexOf('dekode') !== -1);
    const meta = await jobManager.readMeta(created.jobId);
    assert.equal(meta.status, 'failed');
  });
});

test('rc-7 jobSummary untuk id asing mengembalikan null', async () => {
  await withService(null, instantDeps(), async ({ renderService }) => {
    const summary = await renderService.jobSummary('f'.repeat(32));
    assert.equal(summary, null);
  });
});

test('rc-8 keyframe t tidak meningkat ditolak', async () => {
  await withService(null, instantDeps(), async ({ renderService }) => {
    const project = {
      version: 1,
      durationMs: 200,
      layers: [{
        type: 'image',
        asset: { dataUri: sampleProject().layers[0].asset.dataUri },
        tracks: { x: [{ t: 10, value: 1 }, { t: 5, value: 2 }] },
      }],
    };
    const result = await renderService.createJob(project);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'VALIDATION_ERROR');
  });
});

test('rc-9 job selesai penuh: progress 1 dan video terdaftar', async () => {
  await withService(null, instantDeps(), async ({ renderService, jobManager }) => {
    const created = await renderService.createJob(sampleProject());
    assert.equal(created.ok, true);
    assert.equal(created.httpStatus, 201);
    assert.match(created.jobId, /^[0-9a-f]{32}$/);
    const summary = await waitForStatus(renderService, created.jobId, ['completed', 'failed']);
    assert.equal(summary.status, 'completed');
    assert.equal(summary.progress, 1);
    assert.equal(summary.video.bytes, 1234);
    assert.equal(summary.video.path, jobManager.videoPath(created.jobId));
  });
});
