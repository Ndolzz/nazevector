// Pengunduh gambar tervalidasi untuk Naze Vector Render Server.
// Setiap hop (termasuk redirect) melewati pemeriksaan URL penuh dan seluruh
// alamat hasil resolusi DNS diperiksa sebelum koneksi dibuat (anti-SSRF).
// Koneksi dipinkan ke alamat tervalidasi dengan servername hostname asli.
// Isi unduhan dibatasi maxBytes sehingga penyangga memori tetap terkendali.

import { lookup as dnsLookup } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { writeFile, rename, rm } from 'node:fs/promises';
import { checkSourceUrl, validateRedirect, checkResolvedAddresses } from './security/urlGuard.js';
import { sniffImageMime, isAllowedImageContentType } from './mimeType.js';

export const MAX_REDIRECT_HOPS = 3;

export const DOWNLOAD_ERROR_CODES = [
  'SOURCE_URL_REJECTED',
  'DNS_BLOCKED',
  'TOO_MANY_REDIRECTS',
  'ASSET_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INVALID_IMAGE',
  'DOWNLOAD_TIMEOUT',
  'DOWNLOAD_FAILED',
];

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

function failure(code, message) {
  return { ok: false, code, message };
}

export async function downloadImage(rawUrl, options, deps) {
  const opts = options || {};
  const allowlist = Array.isArray(opts.allowlist) ? opts.allowlist : [];
  const maxBytes = (typeof opts.maxBytes === 'number' && opts.maxBytes > 0) ? opts.maxBytes : 5 * 1024 * 1024;
  const timeoutMs = (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) ? opts.timeoutMs : 15000;
  const hopsLeft = (typeof opts.hopsLeft === 'number') ? opts.hopsLeft : MAX_REDIRECT_HOPS;
  if (typeof opts.destPath !== 'string' || opts.destPath === '') {
    throw new Error('destPath wajib diisi');
  }
  const injected = deps || {};
  const lookup = injected.lookup || dnsLookup;
  const request = injected.request || httpsRequest;

  const urlCheck = checkSourceUrl(rawUrl, { allowlist });
  if (!urlCheck.ok) return failure('SOURCE_URL_REJECTED', urlCheck.reason);
  const url = urlCheck.url;

  const resolved = await new Promise((resolve) => {
    lookup(url.hostname, { all: true }, (err, result) => {
      if (err) {
        resolve(failure('DOWNLOAD_FAILED', 'resolusi DNS gagal: ' + err.message));
        return;
      }
      const list = (Array.isArray(result) ? result : []).map((entry) => entry.address);
      const addressCheck = checkResolvedAddresses(list);
      if (!addressCheck.ok) {
        resolve(failure('DNS_BLOCKED', addressCheck.reason));
        return;
      }
      resolve({ ok: true, address: list[0] });
    });
  });
  if (!resolved.ok) return failure(resolved.code, resolved.message);

  return await new Promise((resolve) => {
    let settled = false;
    let failed = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const req = request({
      host: resolved.address,
      servername: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'user-agent': 'nazevector-render/1.0',
        accept: 'image/png,image/jpeg,image/webp',
      },
      timeout: timeoutMs,
    }, (res) => {
      if (REDIRECT_STATUSES.indexOf(res.statusCode) !== -1) {
        res.resume();
        if (hopsLeft <= 0) {
          finish(failure('TOO_MANY_REDIRECTS', 'melebihi ' + MAX_REDIRECT_HOPS + ' redirect'));
          return;
        }
        const target = validateRedirect(url.href, res.headers.location, { allowlist });
        if (!target.ok) {
          finish(failure('SOURCE_URL_REJECTED', target.reason));
          return;
        }
        downloadImage(target.href, {
          allowlist,
          maxBytes,
          timeoutMs,
          destPath: opts.destPath,
          hopsLeft: hopsLeft - 1,
        }, deps).then(finish);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        finish(failure('DOWNLOAD_FAILED', 'status HTTP ' + res.statusCode));
        return;
      }
      if (!isAllowedImageContentType(String(res.headers['content-type'] || ''))) {
        res.resume();
        finish(failure('UNSUPPORTED_MEDIA_TYPE', 'content-type tidak diizinkan'));
        return;
      }
      const contentLength = Number(res.headers['content-length']);
      if (Number.isInteger(contentLength) && contentLength > maxBytes) {
        res.resume();
        finish(failure('ASSET_TOO_LARGE', 'melebihi ' + maxBytes + ' byte'));
        return;
      }
      const chunks = [];
      let bytes = 0;
      res.on('data', (chunk) => {
        if (failed) return;
        if (bytes + chunk.length > maxBytes) {
          failed = true;
          req.destroy();
          finish(failure('ASSET_TOO_LARGE', 'melebihi ' + maxBytes + ' byte'));
          return;
        }
        bytes += chunk.length;
        chunks.push(chunk);
      });
      res.on('error', (err) => {
        if (failed) return;
        failed = true;
        finish(failure('DOWNLOAD_FAILED', err.message));
      });
      res.on('end', () => {
        if (failed) return;
        const body = Buffer.concat(chunks, bytes);
        const mime = sniffImageMime(body);
        if (mime === null) {
          finish(failure('INVALID_IMAGE', 'magic byte gambar tidak dikenali'));
          return;
        }
        const partPath = opts.destPath + '.part';
        (async () => {
          try {
            await writeFile(partPath, body);
            await rename(partPath, opts.destPath);
          } catch (err) {
            await rm(partPath, { force: true }).catch(() => {});
            finish(failure('DOWNLOAD_FAILED', 'gagal menyimpan aset: ' + err.message));
            return;
          }
          finish({ ok: true, path: opts.destPath, bytes, mime });
        })();
      });
    });
    req.on('timeout', () => {
      timedOut = true;
      req.destroy(new Error('batas waktu unduhan terlampaui'));
    });
    req.on('error', (err) => {
      if (failed || settled) return;
      failed = true;
      finish(timedOut
        ? failure('DOWNLOAD_TIMEOUT', 'batas waktu unduhan terlampaui')
        : failure('DOWNLOAD_FAILED', err.message));
    });
    req.end();
  });
}
