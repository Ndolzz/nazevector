// Uji penyimpanan job pada berkas nyata (direktori sementara).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobManager, JOB_ID_PATTERN } from '../src/jobManager.js';

async function withManager(fn) {
  const root = await mkdtemp(join(tmpdir(), 'naze-jm-'));
  const manager = new JobManager({ jobsDir: join(root, 'jobs') });
  await manager.init();
  try {
    await fn(manager, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('j-1 id baru berupa heksadesimal 32 dan tervalidasi', async () => {
  await withManager(async (manager) => {
    const id = manager.newJobId();
    assert.match(id, JOB_ID_PATTERN);
    assert.equal(manager.isValidId(id), true);
    assert.equal(manager.isValidId('bukan-id'), false);
    assert.equal(manager.isValidId('ABC'), false);
  });
});

test('j-2 catatan job tersimpan dan terbaca kembali', async () => {
  await withManager(async (manager) => {
    const id = manager.newJobId();
    const record = await manager.createJobRecord(id, {});
    assert.equal(record.status, 'queued');
    assert.equal(record.progress, 0);
    const meta = await manager.readMeta(id);
    assert.equal(meta.id, id);
    assert.equal(meta.status, 'queued');
  });
});

test('j-3 id tidak valid ditolak saat membuat catatan', async () => {
  await withManager(async (manager) => {
    await assert.rejects(() => manager.createJobRecord('bukan-id', {}));
    assert.throws(() => manager.jobDir('bukan-id'));
  });
});

test('j-4 removeJob menghapus direktori job', async () => {
  await withManager(async (manager) => {
    const id = manager.newJobId();
    await manager.createJobRecord(id, {});
    assert.equal(await manager.removeJob(id), true);
    assert.equal(await manager.readMeta(id), null);
  });
});

test('j-5 registerVideo menandai selesai dengan info video', async () => {
  await withManager(async (manager) => {
    const id = manager.newJobId();
    await manager.createJobRecord(id, {});
    await manager.registerVideo(id, { bytes: 42 });
    const meta = await manager.readMeta(id);
    assert.equal(meta.status, 'completed');
    assert.equal(meta.video.bytes, 42);
    assert.equal(meta.video.path, manager.videoPath(id));
  });
});

test('j-6 sapuan menghapus video kedaluwarsa saja', async () => {
  await withManager(async (manager) => {
    const oldId = manager.newJobId();
    const freshId = manager.newJobId();
    const queuedId = manager.newJobId();
    await manager.createJobRecord(oldId, {});
    await manager.createJobRecord(freshId, {});
    await manager.createJobRecord(queuedId, {});
    await writeFile(manager.videoPath(oldId), Buffer.alloc(4));
    await writeFile(manager.videoPath(freshId), Buffer.alloc(4));
    await manager.registerVideo(oldId, { bytes: 4 });
    await manager.registerVideo(freshId, { bytes: 4 });
    const now = Date.now();
    const oldMeta = await manager.readMeta(oldId);
    oldMeta.video.completedAt = now - 7200000;
    await manager.writeMeta(oldId, oldMeta);
    const swept = await manager.sweepExpiredVideos(3600000, now);
    assert.equal(swept.length, 1);
    assert.equal(swept[0], oldId);
    assert.equal((await manager.readMeta(oldId)).status, 'expired');
    assert.equal((await manager.readMeta(oldId)).video, null);
    assert.equal((await manager.readMeta(freshId)).status, 'completed');
    assert.equal((await manager.readMeta(queuedId)).status, 'queued');
  });
});

test('j-7 pembersihan yatim menghapus direktori tanpa meta', async () => {
  await withManager(async (manager) => {
    await mkdir(join(manager.jobsDir, 'bukan-id-yatim'), { recursive: true });
    const validId = manager.newJobId();
    await manager.createJobRecord(validId, {});
    const noMetaId = manager.newJobId();
    await mkdir(manager.jobDir(noMetaId), { recursive: true });
    const removed = await manager.cleanupOrphans();
    assert.ok(removed.indexOf('bukan-id-yatim') !== -1);
    assert.ok(removed.indexOf(noMetaId) !== -1);
    assert.equal(removed.indexOf(validId), -1);
    assert.notEqual(await manager.readMeta(validId), null);
  });
});

test('j-8 pemeriksaan ruang disk bebas', async () => {
  await withManager(async (manager) => {
    const free = await manager.freeDiskBytes();
    assert.ok(free === null || free > 0);
    assert.equal(await manager.hasFreeDisk(0), true);
  });
});
