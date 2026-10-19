// Uji antrean render FIFO (RV-1).
// Dijalankan melalui harness tests/index.html (butuh server HTTP lokal).

import {
  JOB_STATUS,
  DEFAULT_QUEUE_LIMITS,
  createRenderQueue,
} from '../server/src/queue/renderQueue.js';

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assert gagal');
}

async function runCase(name, fn) {
  try {
    await fn();
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

async function flush(times) {
  for (let i = 0; i < (times || 10); i++) await Promise.resolve();
}

export async function runRenderQueueTests() {
  const cases = [];

  cases.push(await runCase('enqueue job pertama langsung berstatus rendering', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    queue.registerHandler(() => {});
    const res = queue.enqueue({ id: 'job-1', label: 'a' });
    assert(res.accepted === true, 'job pertama seharusnya diterima');
    assert(res.job.status === JOB_STATUS.RENDERING, 'job pertama seharusnya langsung rendering');
    assert(queue.activeCount() === 1, 'activeCount seharusnya 1');
    assert(queue.queueLength() === 0, 'antrean tunggu seharusnya kosong');
  }));

  cases.push(await runCase('handler dipanggil di microtask dengan job yang benar', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    const handled = [];
    queue.registerHandler((job) => {
      handled.push(job.id);
      queue.finish(job.id, { status: JOB_STATUS.COMPLETED });
    });
    queue.enqueue({ id: 'job-1' });
    await flush();
    assert(JSON.stringify(handled) === JSON.stringify(['job-1']), 'handler seharusnya menerima job-1');
    assert(queue.get('job-1').status === JOB_STATUS.COMPLETED, 'job-1 seharusnya selesai');
  }));

  cases.push(await runCase('antrean penuh menolak job baru', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 2 });
    queue.registerHandler(() => {});
    assert(queue.enqueue({ id: 'a' }).accepted === true, 'a seharusnya diterima');
    assert(queue.enqueue({ id: 'b' }).accepted === true, 'b seharusnya diterima');
    assert(queue.enqueue({ id: 'c' }).accepted === true, 'c seharusnya diterima');
    const rejected = queue.enqueue({ id: 'd' });
    assert(rejected.accepted === false && rejected.reason === 'queue_full', 'd seharusnya ditolak queue_full');
    assert(queue.queueLength() === 2, 'antrean tunggu seharusnya 2');
  }));

  cases.push(await runCase('urutan FIFO dipertahankan setelah job selesai', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 10 });
    const handled = [];
    queue.registerHandler((job) => {
      handled.push(job.id);
      queue.finish(job.id, { status: JOB_STATUS.COMPLETED });
    });
    queue.enqueue({ id: 'j1' });
    queue.enqueue({ id: 'j2' });
    queue.enqueue({ id: 'j3' });
    await flush();
    assert(JSON.stringify(handled) === JSON.stringify(['j1', 'j2', 'j3']), 'urutan FIFO salah: ' + JSON.stringify(handled));
    assert(queue.get('j3').status === JOB_STATUS.COMPLETED, 'j3 seharusnya selesai');
  }));

  cases.push(await runCase('finish completed menandai status dan idempoten', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    queue.registerHandler(() => {});
    queue.enqueue({ id: 'a' });
    await flush();
    const first = queue.finish('a', { status: JOB_STATUS.COMPLETED });
    assert(first.ok === true, 'finish pertama seharusnya berhasil');
    const second = queue.finish('a', { status: JOB_STATUS.COMPLETED });
    assert(second.ok === false && second.reason === 'already_finished', 'finish kedua seharusnya already_finished');
    assert(queue.get('a').status === JOB_STATUS.COMPLETED, 'status seharusnya completed');
  }));

  cases.push(await runCase('finish failed menyimpan pesan galat', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    queue.registerHandler(() => {});
    queue.enqueue({ id: 'a' });
    await flush();
    const res = queue.finish('a', { status: JOB_STATUS.FAILED, error: 'contoh galat' });
    assert(res.ok === true, 'finish failed seharusnya berhasil');
    assert(queue.get('a').status === JOB_STATUS.FAILED, 'status seharusnya failed');
    assert(queue.get('a').error === 'contoh galat', 'pesan galat tidak tersimpan');
  }));

  cases.push(await runCase('finish dengan status tidak dikenal ditolak', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    queue.registerHandler(() => {});
    queue.enqueue({ id: 'a' });
    await flush();
    const res = queue.finish('a', { status: 'lain' });
    assert(res.ok === false, 'status asing seharusnya ditolak');
    assert(queue.get('a').status === JOB_STATUS.RENDERING, 'status tidak boleh berubah');
  }));

  cases.push(await runCase('handler melempar pengecualian menandai job gagal', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    queue.registerHandler(() => {
      throw new Error('ledakan');
    });
    queue.enqueue({ id: 'a' });
    await flush();
    const job = queue.get('a');
    assert(job.status === JOB_STATUS.FAILED, 'job seharusnya gagal');
    assert(job.error.indexOf('ledakan') !== -1, 'pesan galat hilang: ' + job.error);
  }));

  cases.push(await runCase('subscriber menerima urutan event enqueued, started, finished', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    const events = [];
    queue.subscribe((e) => events.push(e.event));
    queue.registerHandler((job) => queue.finish(job.id, { status: JOB_STATUS.COMPLETED }));
    queue.enqueue({ id: 'a' });
    await flush();
    assert(JSON.stringify(events) === JSON.stringify(['enqueued', 'started', 'finished']), 'urutan event salah: ' + JSON.stringify(events));
  }));

  cases.push(await runCase('unsubscribe menghentikan pengiriman event', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    const events = [];
    const unsubscribe = queue.subscribe((e) => events.push(e.event));
    queue.registerHandler(() => {});
    queue.enqueue({ id: 'a' });
    await flush();
    unsubscribe();
    queue.enqueue({ id: 'b' });
    await flush();
    assert(events.length === 2, 'event setelah unsubscribe seharusnya tidak terkirim: ' + JSON.stringify(events));
  }));

  cases.push(await runCase('positionOf 1-based untuk job antre, 0 untuk rendering/selesai', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 10 });
    queue.registerHandler(() => {});
    queue.enqueue({ id: 'a' });
    queue.enqueue({ id: 'b' });
    queue.enqueue({ id: 'c' });
    assert(queue.positionOf('a') === 0, 'job rendering seharusnya posisi 0');
    assert(queue.positionOf('b') === 1, 'job b seharusnya posisi 1');
    assert(queue.positionOf('c') === 2, 'job c seharusnya posisi 2');
    queue.finish('a', { status: JOB_STATUS.COMPLETED });
    assert(queue.positionOf('b') === 0, 'setelah a selesai, b rendering posisi 0');
    assert(queue.positionOf('c') === 1, 'c seharusnya naik ke posisi 1');
  }));

  cases.push(await runCase('get mengembalikan null untuk id asing', async () => {
    const queue = createRenderQueue();
    assert(queue.get('tidak-ada') === null, 'id asing seharusnya null');
  }));

  cases.push(await runCase('enqueue menolak record tidak valid dan id ganda', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 5 });
    queue.registerHandler(() => {});
    const invalid = queue.enqueue(null);
    assert(invalid.accepted === false && invalid.reason === 'job record tidak valid', 'record null seharusnya ditolak');
    queue.enqueue({ id: 'a' });
    const duplicate = queue.enqueue({ id: 'a' });
    assert(duplicate.accepted === false && duplicate.reason === 'id sudah terdaftar', 'id ganda seharusnya ditolak');
  }));

  cases.push(await runCase('snapshot mencerminkan status dan posisi', async () => {
    const queue = createRenderQueue({ maxActive: 1, maxQueued: 10 });
    queue.registerHandler(() => {});
    queue.enqueue({ id: 'a' });
    queue.enqueue({ id: 'b' });
    const snapshot = queue.snapshot();
    const byId = {};
    for (const entry of snapshot) byId[entry.id] = entry;
    assert(byId.a.status === JOB_STATUS.RENDERING && byId.a.position === 0, 'snapshot a salah');
    assert(byId.b.status === JOB_STATUS.QUEUED && byId.b.position === 1, 'snapshot b salah');
  }));

  return summarize(cases);
}
