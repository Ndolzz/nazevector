// Pembatas laju jendela tetap untuk Naze Vector Render Server.
// Modul murni: kunci dan waktu diinjeksi sehingga dapat diuji deterministik.

export function createRateLimiter(options) {
  const opts = options || {};
  const limit = opts.limit;
  const windowMs = opts.windowMs;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit harus bilangan bulat positif');
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error('windowMs harus bilangan bulat positif');
  }
  const buckets = new Map();

  function check(key, now) {
    if (typeof key !== 'string' || key === '') {
      throw new Error('kunci pembatas laju harus string tidak kosong');
    }
    if (typeof now !== 'number' || !Number.isFinite(now)) {
      throw new Error('waktu harus angka');
    }
    let bucket = buckets.get(key);
    if (bucket === undefined || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterMs: bucket.start + windowMs - now };
    }
    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
  }

  function prune(now) {
    for (const entry of Array.from(buckets.entries())) {
      if (now - entry[1].start >= windowMs) buckets.delete(entry[0]);
    }
  }

  function size() {
    return buckets.size;
  }

  return { check, prune, size };
}
