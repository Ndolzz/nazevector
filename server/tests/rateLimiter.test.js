// Uji pembatas laju jendela tetap (node:test), cermin dari verifikasi sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/rateLimiter.js';

test('rl-1 batas 2 menolak permintaan ketiga dalam jendela', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });
  assert.equal(limiter.check('a', 1000).allowed, true);
  assert.equal(limiter.check('a', 2000).allowed, true);
  const third = limiter.check('a', 3000);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterMs, 58000);
});

test('rl-2 kunci berbeda saling bebas', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60000 });
  assert.equal(limiter.check('a', 1000).allowed, true);
  assert.equal(limiter.check('b', 1000).allowed, true);
  assert.equal(limiter.check('a', 2000).allowed, false);
});

test('rl-3 sisa kuota berkurang', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });
  assert.equal(limiter.check('a', 1000).remaining, 1);
  assert.equal(limiter.check('a', 1500).remaining, 0);
});

test('rl-4 batas jendela: 60999 ditolak, 61000 diizinkan', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60000 });
  assert.equal(limiter.check('c', 1000).allowed, true);
  const denied = limiter.check('c', 60999);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 1);
  assert.equal(limiter.check('c', 61000).allowed, true);
});

test('rl-5 prune menghapus ember kedaluwarsa', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });
  limiter.check('a', 1000);
  assert.equal(limiter.size(), 1);
  limiter.prune(61000);
  assert.equal(limiter.size(), 0);
});
