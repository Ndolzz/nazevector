// Penyimpanan job render pada berkas: direktori per job (id heksadesimal 32),
// meta.json ditulis atomik (tmp + rename), pendaftaran video hasil, sapuan
// video kedaluwarsa, pembersihan direktori yatim, dan pemeriksaan ruang disk.

import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const JOB_ID_PATTERN = /^[0-9a-f]{32}$/;

export class JobManager {
  constructor(options) {
    const opts = options || {};
    if (typeof opts.jobsDir !== 'string' || opts.jobsDir === '') {
      throw new Error('jobsDir wajib diisi');
    }
    this.jobsDir = opts.jobsDir;
  }

  isValidId(id) {
    return typeof id === 'string' && JOB_ID_PATTERN.test(id);
  }

  newJobId() {
    return randomBytes(16).toString('hex');
  }

  jobDir(id) {
    if (!this.isValidId(id)) throw new Error('id job tidak valid');
    return join(this.jobsDir, id);
  }

  videoPath(id) {
    return join(this.jobDir(id), 'video.mp4');
  }

  metaPath(id) {
    return join(this.jobDir(id), 'meta.json');
  }

  assetPath(id, index) {
    return join(this.jobDir(id), 'asset-' + index);
  }

  async init() {
    await mkdir(this.jobsDir, { recursive: true });
  }

  async writeMeta(id, meta) {
    const target = this.metaPath(id);
    const temp = target + '.tmp';
    await writeFile(temp, JSON.stringify(meta, null, 2));
    await rename(temp, target);
    return meta;
  }

  async createJobRecord(id, overrides) {
    if (!this.isValidId(id)) throw new Error('id job tidak valid');
    await mkdir(this.jobDir(id), { recursive: true });
    const base = overrides || {};
    const record = Object.assign({
      id,
      status: 'queued',
      createdAt: Date.now(),
      progress: 0,
      error: null,
      video: null,
    }, base, { id });
    return await this.writeMeta(id, record);
  }

  async readMeta(id) {
    try {
      const text = await readFile(this.metaPath(id), 'utf8');
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async removeJob(id) {
    if (!this.isValidId(id)) return false;
    await rm(this.jobDir(id), { recursive: true, force: true });
    return true;
  }

  async registerVideo(id, info) {
    const meta = await this.readMeta(id);
    if (meta === null) return null;
    meta.status = 'completed';
    meta.video = {
      path: this.videoPath(id),
      bytes: (info && typeof info.bytes === 'number') ? info.bytes : null,
      completedAt: Date.now(),
    };
    return await this.writeMeta(id, meta);
  }

  async sweepExpiredVideos(ttlMs, now) {
    const currentTime = (typeof now === 'number') ? now : Date.now();
    const swept = [];
    const entries = await readdir(this.jobsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !this.isValidId(entry.name)) continue;
      const meta = await this.readMeta(entry.name);
      if (meta === null) continue;
      if (meta.status !== 'completed' || !meta.video) continue;
      const completedAt = (typeof meta.video.completedAt === 'number')
        ? meta.video.completedAt
        : (typeof meta.createdAt === 'number' ? meta.createdAt : 0);
      if (currentTime - completedAt < ttlMs) continue;
      meta.status = 'expired';
      meta.video = null;
      await this.writeMeta(entry.name, meta);
      await rm(this.videoPath(entry.name), { force: true });
      swept.push(entry.name);
    }
    return swept;
  }

  async cleanupOrphans() {
    const removed = [];
    const entries = await readdir(this.jobsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!this.isValidId(entry.name)) {
        await rm(join(this.jobsDir, entry.name), { recursive: true, force: true });
        removed.push(entry.name);
        continue;
      }
      const meta = await this.readMeta(entry.name);
      if (meta === null) {
        await rm(this.jobDir(entry.name), { recursive: true, force: true });
        removed.push(entry.name);
      }
    }
    return removed;
  }

  async freeDiskBytes() {
    try {
      const stats = await statfs(this.jobsDir);
      return stats.bavail * stats.bsize;
    } catch (e) {
      return null;
    }
  }

  async hasFreeDisk(minBytes) {
    const free = await this.freeDiskBytes();
    if (free === null) return false;
    return free >= minBytes;
  }
}
