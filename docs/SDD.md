# SDD — Naze Vector Website MVP

Dokumen: Spesifikasi dan Desain (SDD) untuk Naze Vector.
Repositori: Ndolzz/nazevector. Diperbarui: 2026-10-16.

## 1. Ringkasan

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dan mengekspornya sebagai XML untuk Alight Motion. Tahap pertama (MVP) berfokus pada desain website, navigasi, unggah gambar, pratinjau, kontrol antarmuka, dan status aplikasi yang benar-benar berfungsi. Mesin vektorisasi, adapter XML, validasi XML, dan ekspor ditandai secara eksplisit sebagai belum diimplementasikan.

## 2. Hasil Audit (P0)

### 2.1 Kondisi repositori (bukti aktual)

Diverifikasi langsung melalui GitHub API pada 2026-10-16:

- Repositori Ndolzz/nazevector berstatus kosong: tidak ada cabang, tidak ada berkas, ukuran 0 KB.
- Tidak ada kode, dependensi, konfigurasi deployment, atau riwayat commit yang perlu dipertahankan.

Keputusan: proyek dikerjakan greenfield. Tidak ada risiko regresi terhadap kode yang ada.

### 2.2 Referensi Lizier Tools (https://lizier.pages.dev/)

Referensi alur SVG ke XML Alight Motion. Temuan dari halaman utama dan FAQ:

- Mendukung elemen SVG: path, rect, circle, ellipse, polyline, polygon.
- Fitur relevan: dukungan warna CSS, grup bertingkat, akumulasi transformasi matrix, konversi arc ke Bezier, deteksi bentuk (persegi, lingkaran, segitiga) menjadi primitif bawaan Alight Motion, dan posisi tengah otomatis.
- Batasan penting: Alight Motion tidak dapat menyematkan gambar raster langsung di dalam XML; raster tertanam dikirim sebagai .zip berisi XML plus berkas gambar terpisah yang harus ditautkan ulang secara manual (Ganti Media).
- Font/teks dan gambar yang ditautkan dari luar (URL) tidak didukung oleh konverter tersebut.
- Alur impor di Alight Motion: tombol + lalu Import, lalu pilih berkas .xml.

### 2.3 Riset format XML Alight Motion

- Alight Creative tidak mempublikasikan spesifikasi resmi format XML proyek/preset. Klaim kompatibilitas tidak dapat didasarkan pada dokumentasi resmi.
- Sumber dokumentasi komunitas paling terstruktur: https://github.com/kuchingneko28/alight-motion-docs (dibangun dari dekompilasi APK; secara eksplisit tidak berafiliasi dengan Alight Creative). Cakupan: scene XML, nilai bawaan, alokasi ID, penamaan layer, elemen, efek, properti/keyframe, dan media.
- Artikel-artikel blog komunitas hanya menjelaskan alur impor (umumnya di Android), bukan struktur XML.
- Dukungan impor XML penuh umumnya ada di Android; iOS terbatas (sering memerlukan solusi tidak langsung).

### 2.4 Keterbatasan dan risiko kompatibilitas

1. Format XML Alight Motion adalah format komunitas hasil rekayasa balik, bukan spesifikasi resmi, dan dapat berubah antar versi aplikasi.
2. Belum ada bukti keberhasilan impor nyata untuk XML yang dihasilkan Naze Vector; karena itu MVP ini tidak mengklaim kompatibilitas apa pun.
3. Fitur tertentu (misalnya deteksi bentuk) terikat versi aplikasi Alight Motion tertentu.
4. Raster tidak dapat disematkan dalam XML; alur ekspor tahap berikutnya harus menangani representasi vektor murni.
5. Dukungan impor iOS terbatas; pengujian awal harus dilakukan di Android.

### 2.5 Keputusan teknis (P1)

1. Situs statis tanpa langkah build: HTML + CSS + JavaScript ES Modules murni. Alasan: tanpa dependensi berbayar, tanpa toolchain, mudah diverifikasi, dan sesuai prinsip pemrosesan lokal.
2. Seluruh pemrosesan gambar berjalan lokal di peramban melalui Canvas 2D. Tidak ada akun, backend, atau API AI berbayar.
3. SVG ditetapkan sebagai representasi vektor perantara antara mesin siluet dan adapter XML.
4. Antarmuka modul pipeline disiapkan sebagai kontrak eksplisit; tahap yang belum tersedia melempar PipelineNotAvailableError dengan pesan yang dapat dipahami pengguna, bukan menghasilkan keluaran palsu.
5. Tumpukan UI: satu halaman dengan tiga rute lokal (Studio, Preset, Tentang), status fitur ditampilkan secara jujur di strip status dan panel ekspor.

## 3. Spesifikasi kebutuhan (P1)

### 3.1 Kebutuhan fungsional

| ID | Kebutuhan | Status |
|----|-----------|--------|
| RF-01 | Navigasi Studio, Preset, Tentang berfungsi dengan status aktif yang jelas | Diimplementasikan |
| RF-02 | Unggah gambar melalui pemilih berkas dan drag-and-drop; mendukung PNG, JPG, WebP; batas 15 MB | Diimplementasikan |
| RF-03 | Pratinjau gambar asli dengan metadata (nama, dimensi, ukuran) | Diimplementasikan |
| RF-04 | Tombol ganti dan hapus gambar berfungsi penuh | Diimplementasikan |
| RF-05 | Kontrol siluet (mode, warna, ambang) menghasilkan pratinjau siluet raster yang benar-benar dihitung lokal | Diimplementasikan (raster) |
| RF-06 | Kontrol penyederhanaan path tersimpan di state, dengan keterangan bahwa efeknya berlaku setelah mesin vektor tersedia | Diimplementasikan (state) |
| RF-07 | Preset animasi Silhouette Reveal, Scale Pulse, Rotation Motion dengan durasi dan intensitas, kontrol putar, jeda, ulangi | Diimplementasikan (pratinjau lokal) |
| RF-08 | Panel ekspor: nama berkas, format target, status validasi, informasi kompatibilitas, pesan kesalahan yang jelas | Diimplementasikan (panel); ekspor ditandai belum tersedia |
| RF-09 | Mesin vektorisasi (path SVG) | Belum diimplementasikan (VE-1) |
| RF-10 | Adapter XML Alight Motion | Belum diimplementasikan (AM-1) |
| RF-11 | Validasi XML | Belum diimplementasikan (XV-1) |
| RF-12 | Ekspor XML | Belum diimplementasikan (EX-1) |

### 3.2 Kebutuhan non-fungsional

- NFR-01: Responsif untuk layar HP Android dan desktop.
- NFR-02: Identitas visual biru gelap dan biru elektrik, tipografi bersih, panel membulat, kontras nyaman, tanpa emoji dekoratif.
- NFR-03: Tanpa dependensi eksternal (CSS/JS lokal sepenuhnya).
- NFR-04: Menghormati preferensi prefers-reduced-motion.
- NFR-05: Keterampilan aksesibilitas dasar: label kontrol, status aria-current pada navigasi, tombol asli untuk semua aksi.

### 3.3 Arsitektur modul

| Berkas | Tanggung jawab |
|--------|----------------|
| index.html | Struktur halaman, panel, dan konten statis |
| styles/main.css | Token desain, tata letak, komponen, animasi keyframes |
| js/main.js | Orkestrasi: membuat store dan memasang modul UI |
| js/state.js | Store status aplikasi (pub/sub sederhana) |
| js/dom.js | Pembantu kueri DOM |
| js/modules/imageImport.js | Impor dan normalisasi gambar (nyata) |
| js/modules/silhouette.js | Komputasi mask siluet raster (nyata) |
| js/modules/vectorEngine.js | Pembangkit path SVG (stub eksplisit) |
| js/modules/animation.js | Definisi preset dan mesin pratinjau animasi lokal (nyata) |
| js/modules/amAdapter.js | Serializer XML Alight Motion (stub eksplisit) |
| js/modules/xmlValidation.js | Validasi dokumen XML (stub eksplisit) |
| js/modules/exportManager.js | Orkestrasi pipeline ekspor; mengembalikan pesan kesalahan terstruktur |
| js/modules/pipelineErrors.js | Tipe kesalahan PipelineNotAvailableError |
| js/ui/statusStrip.js | Strip status fitur |
| js/ui/uploadZone.js | Zona unggah: pemilih berkas dan drag-and-drop |
| js/ui/previewPanel.js | Pratinjau asli dan siluet, siklus hidup animasi |
| js/ui/vectorPanel.js | Kontrol pengaturan vektor |
| js/ui/animationPanel.js | Kontrol pengaturan animasi dan pemutaran |
| js/ui/exportPanel.js | Panel ekspor dan pesan status |
| js/ui/pages.js | Perutean lokal antar halaman |

Alur data: imageImport menghasilkan ImageDescriptor (kanvas ternormalisasi) ke store; silhouette menghitung mask dari kanvas; pratinjau dirasterisasi. Saat VE-1 tersedia, vectorEngine mengubah mask menjadi VectorPathData (SVG), lalu animation menghasilkan AnimationClipData, amAdapter membuat XML, xmlValidation memverifikasi, dan exportManager mengunduh. Setiap tahap memancarkan pesan status yang jujur.

### 3.4 Kriteria penerimaan

| ID | Kriteria | Status |
|----|----------|--------|
| AC-01 | Website responsif dan nyaman digunakan di Android | Desain responsif diimplementasikan; uji perangkat aktual belum dijalankan |
| AC-02 | Pengguna dapat mengunggah, melihat, mengganti, dan menghapus gambar | Diimplementasikan |
| AC-03 | Kontrol antarmuka berperilaku konsisten | Diimplementasikan; verifikasi peramban manual masih diperlukan |
| AC-04 | Status fitur yang belum tersedia terlihat jelas | Diimplementasikan (strip status, panel ekspor, catatan panel) |
| AC-05 | Tidak ada klaim ekspor XML valid tanpa implementasi dan bukti pengujian | Dipenuhi: tombol ekspor menghasilkan pesan "belum tersedia", tidak ada berkas XML palsu |
| AC-06 | Struktur kode modular dan mudah dikembangkan | Diimplementasikan (lihat 3.3) |
| AC-07 | Tidak ada dependensi atau API berbayar | Dipenuhi: nol dependensi |
| AC-08 | Build dan pengujian yang tersedia dijalankan dan dilaporkan faktual | Tidak ada toolchain build (situs statis). Pemeriksaan sintaks statis dijalankan; uji runtime peramban belum dijalankan di lingkungan ini (lihat 6) |

## 4. Batas implementasi tahap 1

Diimplementasikan: desain, navigasi, unggah, pratinjau (asli + siluet raster), kontrol UI, state aplikasi, pratinjau animasi lokal.

Belum diimplementasikan (ditandai eksplisit di UI): mesin vektorisasi, pembangkit SVG, adapter XML, validasi XML, unduhan ekspor.

## 5. Backlog

| ID | Butir | Catatan teknis |
|----|-------|----------------|
| VE-1 | Mesin vektorisasi mask ke path SVG | Kandidat: marching squares untuk kontur + penyederhanaan Ramer-Douglas-Peucker; atau potrace-wasm (menambah dependensi, perlu justifikasi) |
| VE-2 | Penyederhanaan path bertingkat | Hubungkan dengan kontrol "tingkat penyederhanaan" yang sudah tersimpan di state |
| AM-1 | Adapter XML Alight Motion | Basis: alight-motion-docs komunitas; butuh verifikasi uji impor nyata sebelum klaim kompatibel |
| AN-1 | Penerapan keyframe preset ke properti AM (scale, rotation, opacity) | Bergantung AM-1 |
| XV-1 | Validasi XML (well-formedness, atribut wajib, referensi ID) | Jalankan sebelum unduhan |
| EX-1 | Unduh .xml + proses unduhan multi-berkas bila diperlukan | Bergantung AM-1 dan XV-1 |
| TS-1 | Uji impor nyata di Alight Motion (Android) | Bukti keberhasilan wajib sebelum klaim kompatibilitas apa pun |
| GT-1 | Aktifkan GitHub Pages / deployment statis | Konfigurasi manual di pengaturan repositori |
| TS-2 | Uji otomatis ringan (parsing modul, unit silhouette) | Perlu Node; tambahkan hanya jika dikelola |

## 6. Catatan verifikasi

- Lingkungan pengerjaan tidak memiliki Node.js; karena itu tidak ada build yang dapat dijalankan dan tidak ada uji runtime otomatis. Situs sengaja tidak menggunakan toolchain agar dapat diverifikasi langsung di peramban.
- Verifikasi yang dijalankan: audit repositori melalui GitHub API, pemeriksaan sintaks statis seluruh modul JS, pemeriksaan keseimbangan tanda kurung CSS, dan peninjauan manual.
- Uji lanjutan yang wajib: buka halaman di Chrome/Android, unggah PNG/JPG/WebP, geser kontrol, dan jalankan pratinjau animasi.
