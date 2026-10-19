// Orkestrasi job render: validasi proyek, pemuatan aset (dataUri/sourceUrl),
// streaming bingkai ke encoder FFmpeg dengan satu penyangga yang dipakai ulang
// dan backpressure, pelacakan kemajuan, serta pembaruan meta pada tonggak.

import { writeFile, rm, stat } from 'node:fs/promises';
import { validateRenderProject } from './validation/renderProject.js';
import { checkSourceUrl } from './security/urlGuard.js';
import { createRenderQueue, JOB_STATUS } from './queue/renderQueue.js';
import { FRAME_WIDTH, FRAME_HEIGHT, totalFrames, createFrameBuffer, renderFrame } from './render/frameRenderer.js';
import { computeScaledDims, ffprobeImageSize, decodeImageToRgba, createEncoder } from './ffmpeg.js';
import { downloadImage } from './downloader.js';
import { sniffImageMime } from './mimeType.js';

const MAX_DECODED_PIXELS = FRAME_WIDTH * FRAME_HEIGHT;

export function createRenderService(options) {
  const opts = options || {};
  const config = opts.config;
  if (config === null || typeof config !== 'object') throw new Error('config wajib diberikan');
  const jobManager = opts.jobManager;
  if (jobManager === null || typeof jobManager !== 'object') throw new Error('jobManager wajib diberikan');
  const deps = Object.assign({
    downloadImage: (url, downloadOptions) => downloadImage(url, downloadOptions),
    ffprobeImageSize: (assetPath) => ffprobeImageSize(config.ffprobePath, assetPath, config.downloadTimeoutMs),
    decodeImageToRgba: (decodeOptions) => decodeImageToRgba(decodeOptions),
    createEncoder: (encoderOptions) => createEncoder(encoderOptions),
    writeFile,
    unlink: (path) => rm(path, { force: true }),
    statFile: stat,
  }, opts.deps || {});

  const queue = createRenderQueue({
    maxActive: config.maxActiveRenders,
    maxQueued: config.maxQueuedRenders,
  });
  queue.registerHandler((job) => { runJob(job.id); });

  const jobs = new Map();
  const projects = new Map();
  let ffmpegProbe = null;

  function setFfmpegProbe(probe) {
    ffmpegProbe = probe;
  }

  function isFfmpegAvailable() {
    return !!(ffmpegProbe && ffmpegProbe.ok === true);
  }

  function sourceUrlChecker() {
    return (rawUrl) => checkSourceUrl(rawUrl, { allowlist: config.sourceAllowlist });
  }

  function updateMemory(id, patch) {
    const record = jobs.get(id);
    if (!record) return;
    Object.assign(record, patch);
  }

  async function persist(id, patch) {
    const meta = await jobManager.readMeta(id);
    if (meta === null) return null;
    const next = Object.assign({}, meta, patch);
    await jobManager.writeMeta(id, next);
    return next;
  }

  async function createJob(input) {
    const validation = validateRenderProject(input, { checkSourceUrl: sourceUrlChecker() });
    if (!validation.ok) {
      return { ok: false, httpStatus: 400, code: 'VALIDATION_ERROR', details: validation.errors };
    }
    if (!isFfmpegAvailable()) {
      return { ok: false, httpStatus: 503, code: 'FFMPEG_UNAVAILABLE', message: 'FFmpeg belum tersedia di server' };
    }
    const hasSpace = await jobManager.hasFreeDisk(config.minFreeDiskBytes);
    if (!hasSpace) {
      return { ok: false, httpStatus: 503, code: 'DISK_FULL', message: 'ruang disk bebas tidak mencukupi' };
    }
    const id = jobManager.newJobId();
    const createdAt = Date.now();
    await jobManager.createJobRecord(id, { status: JOB_STATUS.QUEUED, createdAt, progress: 0 });
    const accepted = queue.enqueue({ id, createdAt });
    if (!accepted.accepted) {
      await jobManager.removeJob(id);
      return { ok: false, httpStatus: 429, code: 'QUEUE_FULL', message: 'antrean render penuh, coba lagi nanti' };
    }
    projects.set(id, validation.project);
    jobs.set(id, { id, createdAt, progress: 0, error: null, video: null });
    const queueJob = queue.get(id);
    return {
      ok: true,
      httpStatus: 201,
      jobId: id,
      status: queueJob ? queueJob.status : JOB_STATUS.QUEUED,
      position: queue.positionOf(id),
      createdAt,
    };
  }

  async function loadAssets(id, project) {
    const images = [];
    const tempFiles = [];
    try {
      for (let i = 0; i < project.layers.length; i++) {
        const asset = project.layers[i].asset;
        let assetPath = null;
        if (asset.dataUri) {
          assetPath = jobManager.assetPath(id, i);
          const payload = Buffer.from(asset.dataUri.slice(asset.dataUri.indexOf(',') + 1), 'base64');
          if (sniffImageMime(payload) === null) {
            throw new Error('layers[' + i + '] magic byte gambar tidak dikenali');
          }
          await deps.writeFile(assetPath, payload);
        } else {
          const downloaded = await deps.downloadImage(asset.sourceUrl, {
            allowlist: config.sourceAllowlist,
            maxBytes: config.maxAssetBytes,
            timeoutMs: config.downloadTimeoutMs,
            destPath: jobManager.assetPath(id, i),
          });
          if (!downloaded.ok) {
            throw new Error('layers[' + i + '] unduhan gagal: ' + downloaded.code + ' (' + downloaded.message + ')');
          }
          assetPath = downloaded.path;
        }
        tempFiles.push(assetPath);
        const probe = await deps.ffprobeImageSize(assetPath);
        if (!probe.ok) {
          throw new Error('layers[' + i + '] ffprobe gagal: ' + probe.reason);
        }
        const dims = computeScaledDims(probe.width, probe.height, MAX_DECODED_PIXELS);
        if (dims === null) {
          throw new Error('layers[' + i + '] dimensi gambar tidak valid');
        }
        const decoded = await deps.decodeImageToRgba({
          ffmpegPath: config.ffmpegPath,
          inputPath: assetPath,
          width: dims.width,
          height: dims.height,
          timeoutMs: config.downloadTimeoutMs,
        });
        if (!decoded.ok) {
          throw new Error('layers[' + i + '] dekode gagal: ' + decoded.reason);
        }
        images.push({ width: dims.width, height: dims.height, pixels: decoded.pixels });
      }
      return images;
    } finally {
      for (const tempFile of tempFiles) {
        await deps.unlink(tempFile).catch(() => {});
      }
    }
  }

  async function runJob(id) {
    const project = projects.get(id);
    if (!project) {
      queue.finish(id, { status: JOB_STATUS.FAILED, error: 'proyek job tidak ditemukan' });
      return;
    }
    try {
      updateMemory(id, { status: JOB_STATUS.RENDERING });
      await persist(id, { status: JOB_STATUS.RENDERING });
      const images = await loadAssets(id, project);
      const frames = totalFrames(project);
      const encoder = deps.createEncoder({
        ffmpegPath: config.ffmpegPath,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        fps: project.canvas.fps,
        destPath: jobManager.videoPath(id),
        timeoutMs: config.renderTimeoutMs,
      });
      let loopError = null;
      const writeLoop = (async () => {
        const frame = createFrameBuffer();
        for (let index = 0; index < frames; index++) {
          renderFrame(frame, project, images, index);
          const canContinue = encoder.stdin.write(frame);
          if (!canContinue) {
            await new Promise((resolveDrain) => encoder.stdin.once('drain', resolveDrain));
          }
          if ((index + 1) % 30 === 0 || index + 1 === frames) {
            const progress = (index + 1) / frames;
            updateMemory(id, { progress });
            await persist(id, { progress });
          }
        }
        encoder.stdin.end();
      })();
      writeLoop.catch((err) => {
        loopError = err;
        try { encoder.stdin.destroy(); } catch (e) { /* sudah tertutup */ }
      });
      const encoded = await Promise.race([
        writeLoop.then(() => encoder.wait()),
        encoder.wait(),
      ]);
      if (loopError) throw loopError;
      if (!encoded.ok) {
        throw new Error('encoder gagal: ' + (encoded.reason || 'tidak diketahui')
          + (encoded.stderr ? ' | ' + encoded.stderr : ''));
      }
      const videoStats = await deps.statFile(jobManager.videoPath(id));
      const videoInfo = {
        path: jobManager.videoPath(id),
        bytes: (videoStats && typeof videoStats.size === 'number') ? videoStats.size : null,
        completedAt: Date.now(),
      };
      await jobManager.registerVideo(id, { bytes: videoInfo.bytes });
      updateMemory(id, { status: JOB_STATUS.COMPLETED, progress: 1, video: videoInfo });
      await persist(id, { status: JOB_STATUS.COMPLETED, progress: 1 });
      queue.finish(id, { status: JOB_STATUS.COMPLETED });
    } catch (err) {
      const message = (err && err.message) ? err.message : String(err);
      updateMemory(id, { status: JOB_STATUS.FAILED, error: message });
      await persist(id, { status: JOB_STATUS.FAILED, error: message }).catch(() => {});
      await deps.unlink(jobManager.videoPath(id)).catch(() => {});
      queue.finish(id, { status: JOB_STATUS.FAILED, error: message });
    } finally {
      projects.delete(id);
    }
  }

  async function jobSummary(id) {
    const meta = await jobManager.readMeta(id);
    if (meta === null) return null;
    const queueJob = queue.get(id);
    const record = jobs.get(id) || {};
    return {
      id: meta.id || id,
      status: queueJob ? queueJob.status : (meta.status || JOB_STATUS.QUEUED),
      position: queueJob ? queue.positionOf(id) : 0,
      progress: (typeof record.progress === 'number')
        ? record.progress
        : (typeof meta.progress === 'number' ? meta.progress : 0),
      error: (queueJob && queueJob.error) || meta.error || null,
      createdAt: (typeof meta.createdAt === 'number') ? meta.createdAt : null,
      video: meta.video || null,
    };
  }

  function queueStats() {
    return { active: queue.activeCount(), queued: queue.queueLength() };
  }

  return { createJob, jobSummary, setFfmpegProbe, isFfmpegAvailable, queueStats };
}
