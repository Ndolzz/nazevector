// Uji konfigurasi lingkungan (node:test), cermin dari verifikasi sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, CONFIG_DEFAULTS } from '../src/config.js';

test('c-1 nilai bawaan saat lingkungan kosong', () => {
  const result = loadConfig({});
  assert.equal(result.errors, undefined);
  assert.equal(result.config.port, 3000);
  assert.equal(result.config.jobsDir, './jobs');
  assert.equal(result.config.maxActiveRenders, 1);
  assert.equal(result.config.maxQueuedRenders, 20);
  assert.deepEqual(result.config.sourceAllowlist, []);
  assert.deepEqual(result.config.allowedOrigins, []);
  assert.equal(result.config.allowNoAuth, false);
  assert.equal(result.config.apiKey, null);
});

test('c-2 NAZE_PORT valid diterapkan', () => {
  const result = loadConfig({ NAZE_PORT: '8080' });
  assert.equal(result.config.port, 8080);
});

test('c-3 NAZE_PORT tidak valid ditolak', () => {
  assert.ok(loadConfig({ NAZE_PORT: '70000' }).errors.length >= 1);
  assert.ok(loadConfig({ NAZE_PORT: 'abc' }).errors.length >= 1);
});

test('c-4 batas rentang render aktif dan antrean', () => {
  assert.equal(loadConfig({ NAZE_MAX_ACTIVE_RENDERS: '4' }).config.maxActiveRenders, 4);
  assert.ok(loadConfig({ NAZE_MAX_ACTIVE_RENDERS: '9' }).errors.length >= 1);
  assert.ok(loadConfig({ NAZE_MAX_QUEUED_RENDERS: '101' }).errors.length >= 1);
});

test('c-5 allowlist sumber dipisah koma', () => {
  const result = loadConfig({ NAZE_SOURCE_ALLOWLIST: 'a.org, *.b.org' });
  assert.deepEqual(result.config.sourceAllowlist, ['a.org', '*.b.org']);
});

test('c-6 asal CORS divalidasi tanpa path', () => {
  const okResult = loadConfig({ NAZE_ALLOWED_ORIGIN: 'https://app.example.org' });
  assert.deepEqual(okResult.config.allowedOrigins, ['https://app.example.org']);
  assert.ok(loadConfig({ NAZE_ALLOWED_ORIGIN: 'https://app.example.org/x' }).errors.length >= 1);
  assert.ok(loadConfig({ NAZE_ALLOWED_ORIGIN: 'ftp://x' }).errors.length >= 1);
});

test('c-7 kunci API minimal 16 karakter', () => {
  assert.ok(loadConfig({ NAZE_API_KEY: 'pendek' }).errors.length >= 1);
  const result = loadConfig({ NAZE_API_KEY: 'kunci-api-yang-cukup-panjang' });
  assert.equal(result.config.apiKey, 'kunci-api-yang-cukup-panjang');
});

test('c-8 NAZE_ALLOW_NO_AUTH hanya 0 atau 1', () => {
  assert.equal(loadConfig({ NAZE_ALLOW_NO_AUTH: '1' }).config.allowNoAuth, true);
  assert.equal(loadConfig({ NAZE_ALLOW_NO_AUTH: '0' }).config.allowNoAuth, false);
  assert.equal(loadConfig({}).config.allowNoAuth, false);
  assert.ok(loadConfig({ NAZE_ALLOW_NO_AUTH: 'ya' }).errors.length >= 1);
});

test('c-9 nilai numerik divalidasi', () => {
  assert.ok(loadConfig({ NAZE_VIDEO_TTL_MS: 'x' }).errors.length >= 1);
  assert.equal(loadConfig({ NAZE_VIDEO_TTL_MS: '120000' }).config.videoTtlMs, 120000);
});

test('c-10 beberapa galat dikumpulkan sekaligus', () => {
  const result = loadConfig({ NAZE_PORT: 'abc', NAZE_MAX_ACTIVE_RENDERS: '9' });
  assert.ok(result.errors.length >= 2);
});
