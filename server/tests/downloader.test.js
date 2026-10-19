// Uji pengunduh aset: SSRF, redirect, DNS terblokir, ukuran, tipe konten,
// dan magic byte. Dependensi DNS dan HTTP diinjeksi (tanpa jaringan nyata).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadImage } from '../src/downloader.js';

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4];

function dnsWith(address) {
  return (hostname, options, callback) => {
    callback(null, [{ address, family: 4 }]);
  };
}

function makeResponse(step) {
  const listeners = {};
  const res = {
    statusCode: step.status,
    headers: step.headers || {},
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return res;
    },
    resume() {},
    emit(event, arg) {
      for (const fn of listeners[event] || []) fn(arg);
    },
  };
  if (step.body !== undefined) {
    queueMicrotask(() => {
      res.emit('data', Buffer.from(step.body));
      res.emit('end');
    });
  }
  return res;
}

function transportWith(steps) {
  const queue = steps.slice();
  return (options, onResponse) => {
    const step = queue.shift() || { status: 500 };
    const res = makeResponse(step);
    const handlers = {};
    const req = {
      on(event, fn) { handlers[event] = fn; return req; },
      end() {
        queueMicrotask(() => {
          if (step.errorOnEnd) {
            if (handlers.error) handlers.error(new Error('ECONNRESET'));
            return;
          }
          onResponse(res);
        });
      },
      destroy(err) {
        if (handlers.error) handlers.error(err || new Error('destroyed'));
      },
      setTimeout() { return req; },
    };
    return req;
  };
}

async function withDest(fn) {
  const root = await mkdtemp(join(tmpdir(), 'naze-dl-'));
  try {
    await fn(join(root, 'aset.png'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const OPTIONS = { allowlist: ['cdn.example.org'], maxBytes: 100, timeoutMs: 15000 };

test('d-1 URL non-https ditolak SOURCE_URL_REJECTED', async () => {
  await withDest(async (destPath) => {
    const result = await downloadImage('http://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith([]), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SOURCE_URL_REJECTED');
  });
});

test('d-2 host di luar allowlist ditolak', async () => {
  await withDest(async (destPath) => {
    const result = await downloadImage('https://bukan-cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith([]), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SOURCE_URL_REJECTED');
  });
});

test('d-3 DNS ke loopback ditolak DNS_BLOCKED', async () => {
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith([]), lookup: dnsWith('127.0.0.1') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DNS_BLOCKED');
  });
});

test('d-4 DNS ke alamat privat ditolak DNS_BLOCKED', async () => {
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith([]), lookup: dnsWith('10.0.0.5') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DNS_BLOCKED');
  });
});

test('d-5 DNS tanpa alamat ditolak DNS_BLOCKED', async () => {
  const emptyDns = (hostname, options, callback) => callback(null, []);
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith([]), lookup: emptyDns });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DNS_BLOCKED');
  });
});

test('d-6 DNS ke IPv6 loopback ditolak DNS_BLOCKED', async () => {
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith([]), lookup: dnsWith('::1') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DNS_BLOCKED');
  });
});

test('d-7 redirect satu hop ke host terdaftar berhasil', async () => {
  const steps = [
    { status: 302, headers: { location: 'https://cdn.example.org/b.png' } },
    { status: 200, headers: { 'content-type': 'image/png' }, body: PNG_BYTES },
  ];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, true);
    assert.equal(result.mime, 'image/png');
    assert.equal(result.bytes, PNG_BYTES.length);
    const stored = await readFile(destPath);
    assert.deepEqual([...stored], PNG_BYTES);
  });
});

test('d-8 rantai redirect terlalu panjang ditolak TOO_MANY_REDIRECTS', async () => {
  const steps = [0, 1, 2, 3].map(() => (
    { status: 302, headers: { location: 'https://cdn.example.org/a.png' } }
  ));
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'TOO_MANY_REDIRECTS');
  });
});

test('d-9 redirect ke host tidak terdaftar ditolak', async () => {
  const steps = [{ status: 302, headers: { location: 'https://jahat.example.org/x.png' } }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SOURCE_URL_REJECTED');
  });
});

test('d-10 status HTTP bukan 200 ditolak DOWNLOAD_FAILED', async () => {
  const steps = [{ status: 404, headers: { 'content-type': 'image/png' } }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DOWNLOAD_FAILED');
  });
});

test('d-11 content-type bukan gambar ditolak UNSUPPORTED_MEDIA_TYPE', async () => {
  const steps = [{ status: 200, headers: { 'content-type': 'text/html' }, body: PNG_BYTES }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'UNSUPPORTED_MEDIA_TYPE');
  });
});

test('d-12 content-length melebihi batas ditolak ASSET_TOO_LARGE', async () => {
  const steps = [{ status: 200, headers: { 'content-type': 'image/png', 'content-length': '999' } }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'ASSET_TOO_LARGE');
  });
});

test('d-13 isi unduhan melebihi batas ditolak ASSET_TOO_LARGE', async () => {
  const bigBody = [];
  for (let i = 0; i < 150; i++) bigBody.push(7);
  const steps = [{ status: 200, headers: { 'content-type': 'image/png' }, body: bigBody }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'ASSET_TOO_LARGE');
  });
});

test('d-14 isi bukan gambar ditolak INVALID_IMAGE', async () => {
  const text = [];
  for (let i = 0; i < 30; i++) text.push(65);
  const steps = [{ status: 200, headers: { 'content-type': 'image/png' }, body: text }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_IMAGE');
  });
});

test('d-15 galat jaringan ditolak DOWNLOAD_FAILED', async () => {
  const steps = [{ status: 200, errorOnEnd: true }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DOWNLOAD_FAILED');
  });
});

test('d-16 unduhan langsung sukses tersimpan ke destPath', async () => {
  const steps = [{ status: 200, headers: { 'content-type': 'image/png' }, body: PNG_BYTES }];
  await withDest(async (destPath) => {
    const result = await downloadImage('https://cdn.example.org/a.png',
      Object.assign({ destPath }, OPTIONS),
      { request: transportWith(steps), lookup: dnsWith('93.184.216.34') });
    assert.equal(result.ok, true);
    const stored = await readFile(destPath);
    assert.deepEqual([...stored], PNG_BYTES);
  });
});
