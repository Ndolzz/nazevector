// Uji deteksi MIME dan ekstensi (node:test), cermin dari verifikasi sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffImageMime, extensionForMime, isAllowedImageContentType } from '../src/mimeType.js';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

test('m-1 magic byte png, jpeg, webp dikenali', () => {
  assert.equal(sniffImageMime(PNG), 'image/png');
  assert.equal(sniffImageMime(JPEG), 'image/jpeg');
  assert.equal(sniffImageMime(WEBP), 'image/webp');
  assert.equal(sniffImageMime([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 33]), null);
  assert.equal(sniffImageMime(PNG.slice(0, 8)), null);
  assert.equal(sniffImageMime(null), null);
});

test('m-2 ekstensi dipetakan dari mime', () => {
  assert.equal(extensionForMime('image/png'), 'png');
  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('image/webp'), 'webp');
  assert.equal(extensionForMime('application/pdf'), null);
});

test('m-3 content-type case-insensitive dan parameter diabaikan', () => {
  assert.equal(isAllowedImageContentType('IMAGE/PNG'), true);
  assert.equal(isAllowedImageContentType('image/jpeg; charset=binary'), true);
  assert.equal(isAllowedImageContentType('image/webp '), true);
  assert.equal(isAllowedImageContentType('text/html'), false);
  assert.equal(isAllowedImageContentType(''), false);
  assert.equal(isAllowedImageContentType(null), false);
});
