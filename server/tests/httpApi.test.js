// Uji HTTP API dengan server nyata (port acak) dan renderService yang
// dependensi FFmpeg-nya dipalsukan. Tidak ada proses FFmpeg nyata di sini.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobManager } from '../src/jobManager.js';
import { createRenderService } from '../src/renderService.js';
import { createRenderServer } from '../src/httpServer.js';

const API_KEY = 'naze-kunci-uji-0123456789';

function baseConfig(jobsDir, extra) {
  return Object.assign({
    apiKey: API_KEY,
    allowNoAuth: false,
    maxRequestBodyBytes: 16 * 1024 * 1024,
    sourceAllowlist: ['cdn.example.org'],
    allowedOrigins: ['http://localhost:5173'],
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

function fakeDeps() {
  return {
    downloadImage: async () => ({ ok: false, code: 'SOURCE_URL_REJECTED', message: 'tidak dipakai' }),
    ffprobeImageSize: async () => ({ ok: true, width: 2, height: 2 }),
    decodeImageToRgba: async () => ({ ok: true, pixels: Buffer.alloc(16, 255) }),
    createEncoder: () => ({
      stdin: { write: () => true, once: () => {}, end: () => {}, destroy: () => {} },
      wait: async () => ({ ok: true }),
    }),
    writeFile: async () => {},
    unlink: async () => {},
    statFile: async () => ({ size: 8 }),
  };
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

async function withServer(configExtra, fn) {
  const root = await mkdtemp(join(tmpdir(), 'naze-http-'));
  const jobsDir = join(root, 'jobs');
  const config = baseConfig(jobsDir, configExtra);
  const jobManager = new JobManager({ jobsDir });
  await jobManager.init();
  const renderService = createRenderService({ config, jobManager, deps: fakeDeps() });
  renderService.setFfmpegProbe({ ok: true, versions: { ffmpeg: 'uji', ffprobe: 'uji' } });
  const server = createRenderServer({ config, renderService, jobManager });
  try {
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    await fn({ base: 'http://127.0.0.1:' + port, jobManager, renderService, root });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    await rm(root, { recursive: true, force: true });
  }
}

function authHeaders(extra) {
  return Object.assign({
    authorization: 'Bearer ' + API_KEY,
    'content-type': 'application/json',
  }, extra || {});
}

async function waitForCompleted(base, id) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const res = await fetch(base + '/api/render-jobs/' + id, { headers: authHeaders() });
    const body = await res.json();
    if (body.job && body.job.status === 'completed') return body.job;
    if (Date.now() > deadline) throw new Error('job belum selesai sebelum batas waktu');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('h-1 health publik menampilkan status dan ffmpeg', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.ffmpeg, true);
    assert.equal(typeof body.active, 'number');
    assert.equal(typeof body.queueLength, 'number');
  });
});

test('h-2 POST tanpa autentikasi ditolak 401', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: sampleProject() }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});

test('h-3 POST dengan kunci salah ditolak 401', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer kunci-salah' },
      body: JSON.stringify({ project: sampleProject() }),
    });
    assert.equal(res.status, 401);
  });
});

test('h-4 POST body bukan JSON ditolak 400', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: '{bukan json',
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_JSON');
  });
});

test('h-5 POST proyek valid diterima 201 dengan Location', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: sampleProject() }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.jobId, /^[0-9a-f]{32}$/);
    assert.ok(body.status === 'queued' || body.status === 'rendering');
    assert.equal(res.headers.get('location'), '/api/render-jobs/' + body.jobId);
  });
});

test('h-6 status job menampilkan completed setelah render palsu', async () => {
  await withServer(null, async ({ base }) => {
    const created = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: sampleProject() }),
    });
    const createdBody = await created.json();
    const job = await waitForCompleted(base, createdBody.jobId);
    assert.equal(job.progress, 1);
    assert.ok(job.video);
  });
});

test('h-7 status job asing 404', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs/' + 'a'.repeat(32), { headers: authHeaders() });
    assert.equal(res.status, 404);
  });
});

test('h-8 video job yang masih rendering 409', async () => {
  await withServer(null, async ({ base, jobManager }) => {
    const id = jobManager.newJobId();
    await jobManager.createJobRecord(id, { status: 'rendering' });
    const res = await fetch(base + '/api/render-jobs/' + id + '/video', { headers: authHeaders() });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });
});

test('h-9 video job failed 410', async () => {
  await withServer(null, async ({ base, jobManager }) => {
    const id = jobManager.newJobId();
    await jobManager.createJobRecord(id, { status: 'failed', error: 'uji' });
    const res = await fetch(base + '/api/render-jobs/' + id + '/video', { headers: authHeaders() });
    assert.equal(res.status, 410);
  });
});

test('h-10 video job completed 200 dengan isi benar', async () => {
  await withServer(null, async ({ base, jobManager }) => {
    const created = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: sampleProject() }),
    });
    const createdBody = await created.json();
    await waitForCompleted(base, createdBody.jobId);
    await writeFile(jobManager.videoPath(createdBody.jobId), Buffer.alloc(8, 7));
    const res = await fetch(base + '/api/render-jobs/' + createdBody.jobId + '/video', { headers: authHeaders() });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'video/mp4');
    assert.equal(res.headers.get('content-length'), '8');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.length, 8);
  });
});

test('h-11 range video sebagian 206', async () => {
  await withServer(null, async ({ base, jobManager }) => {
    const created = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: sampleProject() }),
    });
    const createdBody = await created.json();
    await waitForCompleted(base, createdBody.jobId);
    await writeFile(jobManager.videoPath(createdBody.jobId), Buffer.alloc(8, 7));
    const res = await fetch(base + '/api/render-jobs/' + createdBody.jobId + '/video', {
      headers: authHeaders({ range: 'bytes=0-3' }),
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-length'), '4');
    assert.equal(res.headers.get('content-range'), 'bytes 0-3/8');
  });
});

test('h-12 range tidak terpenuhi 416', async () => {
  await withServer(null, async ({ base, jobManager }) => {
    const created = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: sampleProject() }),
    });
    const createdBody = await created.json();
    await waitForCompleted(base, createdBody.jobId);
    await writeFile(jobManager.videoPath(createdBody.jobId), Buffer.alloc(8, 7));
    const res = await fetch(base + '/api/render-jobs/' + createdBody.jobId + '/video', {
      headers: authHeaders({ range: 'bytes=999-1000' }),
    });
    assert.equal(res.status, 416);
  });
});

test('h-13 body melebihi batas ditolak 413', async () => {
  await withServer({ maxRequestBodyBytes: 64 }, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: 'x'.repeat(200),
    });
    assert.equal(res.status, 413);
  });
});

test('h-14 metode tidak didukung 405 dengan Allow', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs/' + 'a'.repeat(32), {
      method: 'PUT',
      headers: authHeaders(),
    });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET');
  });
});

test('h-15 pembatas laju createJob menolak permintaan ke-6', async () => {
  await withServer(null, async ({ base }) => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(base + '/api/render-jobs', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ project: sampleProject() }),
      });
      assert.equal(res.status, 201);
    }
    const res = await fetch(base + '/api/render-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: sampleProject() }),
    });
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
  });
});

test('h-16 CORS asal terdaftar diizinkan pada health', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/health', {
      headers: { origin: 'http://localhost:5173' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
});

test('h-17 preflight OPTIONS menjawab 204 dengan header CORS', async () => {
  await withServer(null, async ({ base }) => {
    const res = await fetch(base + '/api/render-jobs', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
  });
});
