// Titik masuk Naze Vector Render Server: memuat konfigurasi, menyiapkan
// penyimpanan job, memeriksa FFmpeg, menyalakan server HTTP, sapuan video
// kedaluwarsa berkala, dan pematian tertib saat sinyal terminasi diterima.

import { loadConfig } from './config.js';
import { JobManager } from './jobManager.js';
import { createRenderService } from './renderService.js';
import { createRenderServer } from './httpServer.js';
import { probeFfmpeg } from './ffmpeg.js';

const SWEEP_INTERVAL_MS = 60000;

async function main() {
  const loaded = loadConfig(process.env);
  if (loaded.errors) {
    for (const error of loaded.errors) {
      console.error('[naze] konfigurasi tidak valid: ' + error);
    }
    process.exitCode = 1;
    return;
  }
  const config = loaded.config;
  const jobManager = new JobManager({ jobsDir: config.jobsDir });
  await jobManager.init();
  const orphans = await jobManager.cleanupOrphans();
  if (orphans.length > 0) {
    console.warn('[naze] membersihkan ' + orphans.length + ' direktori job yatim');
  }
  const renderService = createRenderService({ config, jobManager });
  const probe = await probeFfmpeg({ ffmpegPath: config.ffmpegPath, ffprobePath: config.ffprobePath }, 10000);
  renderService.setFfmpegProbe(probe);
  if (!probe.ok) {
    console.warn('[naze] FFmpeg tidak tersedia (' + probe.reason + '); permintaan render akan ditolak 503');
  }
  const server = createRenderServer({ config, renderService, jobManager });
  const sweeper = setInterval(() => {
    jobManager.sweepExpiredVideos(config.videoTtlMs).catch((err) => {
      console.error('[naze] sapuan video kedaluwarsa gagal: ' + err.message);
    });
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();
  server.listen(config.port, () => {
    console.log('[naze] render server aktif di port ' + config.port
      + ' (ffmpeg: ' + (probe.ok ? probe.versions.ffmpeg : 'tidak tersedia') + ')');
  });
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[naze] menerima ' + signal + ', mematikan server');
    clearInterval(sweeper);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[naze] kegagalan saat memulai: ' + (err && err.message ? err.message : err));
  process.exitCode = 1;
});
