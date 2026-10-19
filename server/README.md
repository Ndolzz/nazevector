# Naze Vector Render Server

Server render MP4 untuk Naze Vector: menerima proyek animasi v1 (kanvas 1280x720, 30 fps, durasi 200..15000 ms, 1..8 layer gambar), merender bingkai demi bingkai di server, lalu meng-enkode hasilnya menjadi H.264 melalui FFmpeg. Dibangun hanya dengan modul bawaan Node.js; tidak ada dependensi npm.

## Persyaratan

- Node.js >= 18.15 (memakai fs.promises.statfs dan server.closeAllConnections).
- FFmpeg dan FFprobe terpasang dan dapat dipanggil dari PATH (atau set NAZE_FFMPEG_PATH / NAZE_FFPROBE_PATH), dengan encoder libx264.

## Menjalankan

```bash
cd server
npm start
```

Server memeriksa FFmpeg saat mulai. Bila tidak tersedia, server tetap berjalan namun setiap permintaan render ditolak dengan kode FFMPEG_UNAVAILABLE (503).

## Konfigurasi

Semua variabel lingkungan bersifat opsional kecuali NAZE_API_KEY yang wajib di produksi. Nilai tidak valid membuat server menolak menyala dan mencantumkan seluruh galatnya.

| Variabel | Bawaan | Rentang | Keterangan |
| --- | --- | --- | --- |
| NAZE_PORT | 3000 | 1..65535 | Port HTTP. |
| NAZE_JOBS_DIR | ./jobs | - | Direktori penyimpanan job. |
| NAZE_SOURCE_ALLOWLIST | (kosong) | - | Host yang diizinkan untuk sourceUrl, dipisah koma, mendukung wildcard *.example.org. |
| NAZE_VIDEO_TTL_MS | 3600000 | > 0 | Umur video hasil sebelum dihapus. |
| NAZE_MIN_FREE_DISK_BYTES | 536870912 | > 0 | Ruang disk bebas minimal sebelum menerima job. |
| NAZE_FFMPEG_PATH | ffmpeg | - | Path binary ffmpeg. |
| NAZE_FFPROBE_PATH | ffprobe | - | Path binary ffprobe. |
| NAZE_RENDER_TIMEOUT_MS | 300000 | > 0 | Batas waktu satu job render. |
| NAZE_DOWNLOAD_TIMEOUT_MS | 15000 | > 0 | Batas waktu unduhan satu aset. |
| NAZE_MAX_REQUEST_BODY_BYTES | 16777216 | > 0 | Batas ukuran body permintaan. |
| NAZE_MAX_ASSET_BYTES | 5242880 | > 0 | Batas ukuran satu aset unduhan. |
| NAZE_MAX_ACTIVE_RENDERS | 1 | 1..8 | Render aktif bersamaan. |
| NAZE_MAX_QUEUED_RENDERS | 20 | 1..100 | Panjang antrean tunggu. |
| NAZE_ALLOWED_ORIGIN | (kosong) | http(s)://host | Asal CORS yang diizinkan, dipisah koma, tanpa path. |
| NAZE_API_KEY | (kosong) | >= 16 karakter | Kunci API untuk header Authorization: Bearer. |
| NAZE_ALLOW_NO_AUTH | 0 | 0/1 | Hanya untuk pengembangan: 1 menonaktifkan autentikasi. |

## Kontrak API

Amplop galat konsisten: JSON {error:{code,message}}.

- GET /health - publik. Menampilkan {status, ffmpeg, uptime, active, queueLength}.
- POST /api/render-jobs - butuh autentikasi. Body {project:{...}} sesuai kontrak proyek v1. Sukses 201 dengan {jobId, status, position, createdAt} dan header Location.
- GET /api/render-jobs/:id - status job {id, status, position, progress, error, createdAt, video}.
- GET /api/render-jobs/:id/video - MP4 setelah completed; mendukung header Range (206/416).

Kode galat: VALIDATION_ERROR (400), BAD_JSON (400), UNAUTHORIZED (401), NOT_FOUND (404), METHOD_NOT_ALLOWED (405), CONFLICT (409, video belum siap), GONE (410, failed/expired), PAYLOAD_TOO_LARGE (413), RANGE_NOT_SATISFIABLE (416), QUEUE_FULL (429), RATE_LIMITED (429), FFMPEG_UNAVAILABLE (503), DISK_FULL (503), INTERNAL_ERROR (500).

Pembatas laju per klien: pembuatan job 5 per 5 menit, status 120 per menit, video 30 per menit.

Contoh membuat job:

```bash
curl -X POST http://localhost:3000/api/render-jobs \
  -H "Authorization: Bearer $NAZE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project":{"version":1,"durationMs":1000,"layers":[{"type":"image","asset":{"dataUri":"data:image/png;base64,..."},"tracks":{"x":[{"t":0,"value":640},{"t":1000,"value":900}]}}]}}'
```

Contoh mengambil hasil:

```bash
curl -H "Authorization: Bearer $NAZE_API_KEY" \
  http://localhost:3000/api/render-jobs/<jobId>/video -o hasil.mp4
```

## Keamanan

- Autentikasi Bearer dibandingkan dengan sha256 + timingSafeEqual; tanpa kunci terpasang (dan tanpa mode pengembangan), semua endpoint terlindungi ditolak (fail closed).
- Semua sourceUrl wajib https, tanpa userinfo, port 443/kosong, host di allowlist, dan bukan IP literal. Setiap redirect divalidasi ulang; seluruh alamat hasil resolusi DNS diperiksa terhadap daftar blokir (privat, loopback, link-local, metadata cloud) sebelum koneksi; koneksi dipinkan ke alamat tervalidasi.
- Body permintaan, aset unduhan, durasi, jumlah layer, dan keyframe dibatasi; FFmpeg dijalankan dengan argumen terpisah tanpa shell dan batas waktu.

## Pengujian

```bash
cd server
npm test
```

Uji integrasi FFmpeg otomatis ter-skip bila FFmpeg tidak tersedia. Harness peramban untuk modul murni berada di tests/index.html pada akar repositori.

## Deploy di Pterodactyl

1. Buat server dengan egg Node.js versi 18.15 atau lebih baru.
2. Unggah repositori (atau git clone) lalu pastikan direktori server/ ada.
3. Pastikan FFmpeg tersedia: gunakan image Docker yang menyertakan ffmpeg, atau unggah binary statis lalu set NAZE_FFMPEG_PATH dan NAZE_FFPROBE_PATH ke path lengkapnya.
4. Set variabel lingkungan sesuai tabel konfigurasi; NAZE_API_KEY wajib diisi dan NAZE_SOURCE_ALLOWLIST disesuaikan dengan CDN gambar.
5. Startup command: cd server && node src/index.js
6. Alokasikan disk beberapa ratus MB untuk NAZE_JOBS_DIR; video dihapus otomatis setelah NAZE_VIDEO_TTL_MS.

## Batas MVP

- Satu render aktif secara bawaan (NAZE_MAX_ACTIVE_RENDERS=1); antrean tunggu 20.
- Memori terkendali: satu penyangga bingkai 1280x720 RGBA dipakai ulang dan aset didekode maksimum seukuran kanvas.
- UI klien belum diintegrasikan; API ini untuk memvalidasi pipeline render terlebih dahulu.
