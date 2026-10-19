// Server HTTP untuk API render Naze Vector: health, pembuatan job, status,
// pengambilan MP4 (dengan dukungan Range), autentikasi kunci API, pembatas
// ukuran body, pembatas laju per endpoint, CORS allowlist, dan amplop galat
// konsisten {error:{code,message}}.

import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createRateLimiter } from './rateLimiter.js';

export const RATE_LIMITS = {
  createJob: { limit: 5, windowMs: 5 * 60 * 1000 },
  jobStatus: { limit: 120, windowMs: 60 * 1000 },
  jobVideo: { limit: 30, windowMs: 60 * 1000 },
};

const STATUS_ROUTE = /^\/api\/render-jobs\/([0-9a-f]{32})$/;
const VIDEO_ROUTE = /^\/api\/render-jobs\/([0-9a-f]{32})\/video$/;
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

function sendJson(res, statusCode, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  }, extraHeaders || {}));
  res.end(body);
}

function sendError(res, statusCode, code, message, extraHeaders) {
  sendJson(res, statusCode, { error: { code, message } }, extraHeaders);
}

export function createRenderServer(options) {
  const opts = options || {};
  const config = opts.config;
  const renderService = opts.renderService;
  const jobManager = opts.jobManager;
  if (!config || !renderService || !jobManager) {
    throw new Error('config, renderService, dan jobManager wajib diberikan');
  }
  const apiKeyHash = config.apiKey ? createHash('sha256').update(config.apiKey).digest() : null;
  const limiters = {
    createJob: createRateLimiter(RATE_LIMITS.createJob),
    jobStatus: createRateLimiter(RATE_LIMITS.jobStatus),
    jobVideo: createRateLimiter(RATE_LIMITS.jobVideo),
  };

  function authorize(req) {
    if (config.allowNoAuth === true) return true;
    if (apiKeyHash === null) return false;
    const header = req.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
    const tokenHash = createHash('sha256').update(header.slice(7)).digest();
    return tokenHash.length === apiKeyHash.length && timingSafeEqual(tokenHash, apiKeyHash);
  }

  function clientKey(req) {
    if (config.apiKey) return 'api-key';
    const address = (req.socket && req.socket.remoteAddress) ? req.socket.remoteAddress : 'unknown';
    return 'ip:' + address;
  }

  function readBody(req, maxBytes) {
    return new Promise((resolve) => {
      const chunks = [];
      let bytes = 0;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      req.on('data', (chunk) => {
        if (settled) return;
        if (bytes + chunk.length > maxBytes) {
          req.pause();
          finish({ ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' });
          return;
        }
        bytes += chunk.length;
        chunks.push(chunk);
      });
      req.on('end', () => {
        finish({ ok: true, body: Buffer.concat(chunks, bytes) });
      });
      req.on('error', (err) => {
        finish({ ok: false, status: 400, code: 'BAD_REQUEST', message: err.message });
      });
    });
  }

  function rateLimited(res, result) {
    if (result.allowed) return false;
    sendError(res, 429, 'RATE_LIMITED',
      'terlalu banyak permintaan; coba lagi dalam ' + result.retryAfterMs + ' ms',
      { 'retry-after': String(Math.ceil(result.retryAfterMs / 1000)) });
    return true;
  }

  async function handleVideo(req, res, id) {
    const summary = await renderService.jobSummary(id);
    if (summary === null) {
      sendError(res, 404, 'NOT_FOUND', 'job tidak ditemukan');
      return;
    }
    if (summary.status === 'failed' || summary.status === 'expired') {
      sendError(res, 410, 'GONE', 'video tidak tersedia (status: ' + summary.status + ')');
      return;
    }
    if (summary.status !== 'completed' || !summary.video) {
      sendError(res, 409, 'CONFLICT', 'video belum siap (status: ' + summary.status + ')');
      return;
    }
    const videoPath = jobManager.videoPath(id);
    let stats = null;
    try {
      stats = await stat(videoPath);
    } catch (e) {
      sendError(res, 410, 'GONE', 'berkas video tidak ada lagi');
      return;
    }
    const total = stats.size;
    const rangeHeader = req.headers.range;
    if (typeof rangeHeader === 'string' && rangeHeader !== '') {
      const match = RANGE_PATTERN.exec(rangeHeader.trim());
      if (match === null) {
        sendError(res, 416, 'RANGE_INVALID', 'header Range tidak valid');
        return;
      }
      let start = (match[1] === '') ? null : Number(match[1]);
      let end = (match[2] === '') ? null : Number(match[2]);
      if (start === null && end === null) {
        sendError(res, 416, 'RANGE_INVALID', 'header Range tidak valid');
        return;
      }
      if (start === null) {
        if (end === 0) {
          sendError(res, 416, 'RANGE_NOT_SATISFIABLE', 'rentang tidak terpenuhi',
            { 'content-range': 'bytes */' + total });
          return;
        }
        start = Math.max(0, total - end);
        end = total - 1;
      } else if (end === null || end > total - 1) {
        end = total - 1;
      }
      if (start >= total || start > end) {
        sendError(res, 416, 'RANGE_NOT_SATISFIABLE', 'rentang tidak terpenuhi',
          { 'content-range': 'bytes */' + total });
        return;
      }
      res.writeHead(206, {
        'content-type': 'video/mp4',
        'content-length': String(end - start + 1),
        'content-range': 'bytes ' + start + '-' + end + '/' + total,
        'accept-ranges': 'bytes',
      });
      createReadStream(videoPath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': String(total),
      'accept-ranges': 'bytes',
    });
    createReadStream(videoPath).pipe(res);
  }

  const server = createServer(async (req, res) => {
    try {
      const pathname = (req.url || '/').split('?')[0];
      const origin = req.headers.origin;
      const originAllowed = typeof origin === 'string'
        && Array.isArray(config.allowedOrigins)
        && config.allowedOrigins.indexOf(origin.toLowerCase()) !== -1;
      if (originAllowed) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        if (originAllowed) {
          res.writeHead(204, {
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'authorization, content-type',
            'access-control-max-age': '600',
          });
        } else {
          res.writeHead(204);
        }
        res.end();
        return;
      }
      if (pathname === '/health' && req.method === 'GET') {
        const stats = renderService.queueStats();
        sendJson(res, 200, {
          status: 'ok',
          ffmpeg: renderService.isFfmpegAvailable(),
          uptime: Math.floor(process.uptime()),
          active: stats.active,
          queueLength: stats.queued,
        });
        return;
      }
      if (pathname === '/api/render-jobs' && req.method === 'POST') {
        if (!authorize(req)) {
          sendError(res, 401, 'UNAUTHORIZED', 'kunci API tidak valid atau tidak disertakan');
          return;
        }
        if (rateLimited(limiters.createJob.check(clientKey(req), Date.now()))) return;
        const bodyResult = await readBody(req, config.maxRequestBodyBytes);
        if (!bodyResult.ok) {
          sendError(res, bodyResult.status || 400, bodyResult.code,
            'body permintaan melebihi batas atau tidak terbaca', { connection: 'close' });
          res.on('finish', () => { req.destroy(); });
          return;
        }
        let parsed = null;
        try {
          parsed = JSON.parse(bodyResult.body.toString('utf8'));
        } catch (e) {
          sendError(res, 400, 'BAD_JSON', 'body bukan JSON valid');
          return;
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          sendError(res, 400, 'BAD_JSON', 'body harus objek {project:{...}}');
          return;
        }
        const created = await renderService.createJob(parsed.project);
        if (!created.ok) {
          const message = (created.details && created.details.length > 0)
            ? created.details.join('; ')
            : (created.message || 'permintaan ditolak');
          sendError(res, created.httpStatus, created.code, message);
          return;
        }
        sendJson(res, created.httpStatus, {
          jobId: created.jobId,
          status: created.status,
          position: created.position,
          createdAt: created.createdAt,
        }, { location: '/api/render-jobs/' + created.jobId });
        return;
      }
      const videoMatch = VIDEO_ROUTE.exec(pathname);
      if (videoMatch && req.method === 'GET') {
        if (!authorize(req)) {
          sendError(res, 401, 'UNAUTHORIZED', 'kunci API tidak valid atau tidak disertakan');
          return;
        }
        if (rateLimited(limiters.jobVideo.check(clientKey(req), Date.now()))) return;
        await handleVideo(req, res, videoMatch[1]);
        return;
      }
      const statusMatch = STATUS_ROUTE.exec(pathname);
      if (statusMatch && req.method === 'GET') {
        if (!authorize(req)) {
          sendError(res, 401, 'UNAUTHORIZED', 'kunci API tidak valid atau tidak disertakan');
          return;
        }
        if (rateLimited(limiters.jobStatus.check(clientKey(req), Date.now()))) return;
        const summary = await renderService.jobSummary(statusMatch[1]);
        if (summary === null) {
          sendError(res, 404, 'NOT_FOUND', 'job tidak ditemukan');
          return;
        }
        sendJson(res, 200, { job: summary });
        return;
      }
      if ((statusMatch || videoMatch) && req.method !== 'GET') {
        sendError(res, 405, 'METHOD_NOT_ALLOWED', 'metode tidak didukung', { allow: 'GET' });
        return;
      }
      if (pathname === '/api/render-jobs' && req.method !== 'POST') {
        sendError(res, 405, 'METHOD_NOT_ALLOWED', 'metode tidak didukung', { allow: 'POST' });
        return;
      }
      sendError(res, 404, 'NOT_FOUND', 'endpoint tidak ditemukan');
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'kesalahan internal server');
    }
  });

  return server;
}
