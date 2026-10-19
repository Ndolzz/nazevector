// Antrean render FIFO untuk Naze Vector Render Server.
// Modul murni: tidak memakai API Node sehingga dapat diuji di harness peramban.

export const JOB_STATUS = {
  QUEUED: 'queued',
  RENDERING: 'rendering',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const DEFAULT_QUEUE_LIMITS = { maxActive: 1, maxQueued: 20 };

// Membuat antrean render. Handler dipanggil via microtask agar enqueue
// tetap sinkron; finish bersifat idempoten. Job pertama langsung
// berstatus rendering (dispatch sinkron) selama slot aktif tersedia.
export function createRenderQueue(options) {
  const limits = Object.assign({}, DEFAULT_QUEUE_LIMITS, options || {});
  const jobs = new Map();
  const waiting = [];
  const listeners = [];
  let handler = null;

  function emit(event, job) {
    for (const listener of listeners.slice()) {
      try {
        listener({ event, job });
      } catch (e) {
        // listener tidak boleh merusak antrean
      }
    }
  }

  function activeCount() {
    let count = 0;
    for (const job of jobs.values()) {
      if (job.status === JOB_STATUS.RENDERING) count++;
    }
    return count;
  }

  function positionOf(id) {
    const job = jobs.get(id);
    if (!job || job.status !== JOB_STATUS.QUEUED) return 0;
    return waiting.indexOf(id) + 1;
  }

  function dispatch() {
    while (activeCount() < limits.maxActive && waiting.length > 0 && handler !== null) {
      const id = waiting.shift();
      const job = jobs.get(id);
      if (!job || job.status !== JOB_STATUS.QUEUED) continue;
      job.status = JOB_STATUS.RENDERING;
      emit('started', job);
      const captured = job;
      Promise.resolve().then(() => {
        try {
          handler(captured);
        } catch (e) {
          finish(captured.id, {
            status: JOB_STATUS.FAILED,
            error: 'handler melempar pengecualian: ' + (e && e.message ? e.message : String(e)),
          });
        }
      });
    }
  }

  function enqueue(record) {
    if (record === null || typeof record !== 'object' || typeof record.id !== 'string' || record.id === '') {
      return { accepted: false, reason: 'job record tidak valid' };
    }
    if (jobs.has(record.id)) return { accepted: false, reason: 'id sudah terdaftar' };
    if (waiting.length >= limits.maxQueued) return { accepted: false, reason: 'queue_full' };
    const job = Object.assign({}, record, { status: JOB_STATUS.QUEUED, error: null });
    jobs.set(job.id, job);
    waiting.push(job.id);
    emit('enqueued', job);
    dispatch();
    return { accepted: true, job: jobs.get(job.id) };
  }

  function finish(id, result) {
    const job = jobs.get(id);
    if (!job) return { ok: false, reason: 'job tidak dikenal' };
    if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
      return { ok: false, reason: 'already_finished' };
    }
    const res = result || {};
    if (res.status === JOB_STATUS.COMPLETED) {
      job.status = JOB_STATUS.COMPLETED;
    } else if (res.status === JOB_STATUS.FAILED) {
      job.status = JOB_STATUS.FAILED;
      job.error = typeof res.error === 'string' ? res.error : 'galat tidak diketahui';
    } else {
      return { ok: false, reason: 'status hasil tidak valid' };
    }
    emit('finished', job);
    dispatch();
    return { ok: true, job };
  }

  function registerHandler(fn) {
    if (typeof fn !== 'function') throw new Error('handler harus fungsi');
    handler = fn;
    dispatch();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function unsubscribe() {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  }

  function get(id) {
    return jobs.get(id) || null;
  }

  function queueLength() {
    return waiting.length;
  }

  function snapshot() {
    const out = [];
    for (const job of jobs.values()) {
      out.push(Object.assign({}, job, { position: positionOf(job.id) }));
    }
    return out;
  }

  return { registerHandler, subscribe, enqueue, finish, get, positionOf, activeCount, queueLength, snapshot };
}
