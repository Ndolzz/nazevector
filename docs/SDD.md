# SDD — Naze Vector Website MVP

Dokumen: Spesifikasi dan Desain (SDD) untuk Naze Vector.
Repositori: Ndolzz/nazevector. Diperbarui: 2026-10-19.

## 1. Ringkasan

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dan mengekspornya sebagai XML untuk Alight Motion. Tahap pertama (MVP) berfokus pada desain website, navigasi, unggah gambar, pratinjau, kontrol antarmuka, dan status aplikasi yang benar-benar berfungsi. Pembaruan v0.2.0 menambahkan mesin vektorisasi yang berfungsi (backlog VE-1 dan VE-2): mask siluet diubah menjadi path SVG tertutup dengan kontur luar, lubang internal, beberapa komponen terpisah, dan penyederhanaan bertingkat. Pembaruan v0.3.0 (backlog DS-1) merombak identitas visual situs ke arah "Imperfect by Design" tanpa mengubah perilaku pipeline (lihat bagian 8). Pembaruan v0.4.0 memperbaiki bug navigasi "Buka Studio" (backlog NB-1, lihat bagian 9) dan menyelesaikan adapter XML, validasi XML, serta unduhan ekspor lokal berupa bentuk statis tanpa keyframe (backlog AM-1, XV-1, EX-1; lihat bagian 10). Pembaruan v0.4.1 (backlog AM-2, XV-2) menyelaraskan struktur keluaran dengan pola ekspor asli Alight Motion (lihat bagian 11). Pembaruan v0.4.2 (backlog AM-3, XV-3) memperbaiki bukti lapangan baru — berkas v0.4.1 berhasil diimpor namun kanvas tampak kosong — dengan memindahkan outline ke tag path sesuai parser asli Alight Motion dan menambah regresi geometri (lihat bagian 12). Pembaruan v0.4.3 (backlog PF-1) memperbaiki performa pratinjau siluet dan vektorisasi berdasarkan pengukuran: tabel tepi terlacak kini bit-packed, mask pratinjau dihitung pada resolusi kerja terbatas, dan debounce penghitungan dinaikkan — tanpa mengubah geometri kontur maupun jalur ekspor resolusi penuh (lihat bagian 13). Pembaruan v0.4.4 (backlog AM-4) menambahkan pemisah layer: setiap komponen siluet ditulis sebagai satu elemen shape (satu layer Alight Motion) tersendiri dengan pivot pada pusat bounding box komponennya (lihat bagian 14), berdasarkan bukti lapangan baru — ekspor v0.4.2/v0.4.3 terbukti diimpor dan menampilkan shape di Alight Motion 5.0.273 (Android), namun seluruh komponen bergabung pada satu layer "Shape 1" — yang juga menuntaskan TS-1 untuk bentuk statis. Pembaruan v0.5.0 (backlog VE-3 + CV-1 + AM-5) menambahkan dua mode ekspor atas permintaan pengguna yang mengolah mentahan jersey line art: representasi "garis" — satu kurva centerline per goresan (skeletonisasi Zhang-Suen, perunututan rantai, `path-stroke`) menggantikan pita dua tepi yang tampak berganda — dan mode warna "asli" — sampling warna dominan piksel sumber per komponen sebagai fillColor layer (lihat bagian 15). Pembaruan v0.5.1 (backlog AM-6 + CV-2) menambahkan representasi "kontur" atas permintaan pengguna (tangkapan layar editor titik Alight Motion: satu layer shape memuat "Kontur 1".."Kontur 9"): setiap subpath — kontur luar maupun lubang — ditulis sebagai shape (layer) tersendiri sehingga 1 layer = 1 kontur, dengan warna asli per kontur bila mode warna asli dipilih (lihat bagian 16). Penerapan keyframe preset (AN-1) tetap tertunda dan ditandai secara jujur di antarmuka; keluaran multi-layer v0.4.4, mode garis dan warna asli v0.5.0, serta mode kontur v0.5.1 menunggu verifikasi lapangan lanjutan.

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
- Batasan penting: Alight Motion tidak dapat menyematkan gambar raster langsung di dalam XML; raster tertanam dikirim sebagai .zip berisi XML plus berkas gambar terpisah yang harus dikaitkan ulang secara manual (Ganti Media).
- Font/teks dan gambar yang ditautkan dari luar (URL) tidak didukung oleh konverter tersebut.
- Alur impor di Alight Motion: tombol + lalu Import, lalu pilih berkas .xml.

### 2.3 Riset format XML Alight Motion

- Alight Creative tidak memublikasikan spesifikasi resmi format XML proyek/preset. Klaim kompatibilitas tidak dapat didasarkan pada dokumentasi resmi.
- Sumber dokumentasi komunitas paling terstruktur: https://github.com/kuchingneko28/alight-motion-docs (dibangun dari dekompilasi APK; secara eksplisit tidak berafiliasi dengan Alight Creative). Cakupan: scene XML, nilai bawaan, alokasi ID, penamaan layer, elemen, efek, properti/keyframe, dan media.
- Artikel-artikel blog komunitas hanya menjelaskan alur impor (umumnya di Android), bukan struktur XML.
- Dukungan impor XML penuh umumnya ada di Android; iOS terbatas (sering memerlukan solusi tidak langsung).

### 2.4 Keterbatasan dan risiko kompatibilitas

1. Format XML Alight Motion adalah format komunitas hasil rekayasa balik, bukan spesifikasi resmi, dan dapat berubah antar versi aplikasi.
2. Uji impor nyata v0.4.0 di Alight Motion (Android) GAGAL dengan pesan "Gagal mengunggah. Formatnya tidak benar atau file rusak." Ekspor v0.4.1 BERHASIL diimpor namun kanvas tampak kosong: outline pada tag parameter/contour tidak dibaca parser asli (lihat bagian 12). Bukti lapangan 2026-10-17 (TS-1): ekspor v0.4.2/v0.4.3 terbukti diimpor dan MENAMPILKAN shape dengan titik sunting di Alight Motion 5.0.273 (Android), namun seluruh komponen bergabung pada satu layer — kekurangan yang diperbaiki AM-4 (v0.4.4, lihat bagian 14). Keluaran multi-layer v0.4.4 belum diuji di perangkat nyata; karena itu proyek ini tidak mengklaim kompatibilitas untuk pemisah layer hingga uji lapangan lanjutan lulus. Mode garis (VE-3, path-stroke dengan path tanpa penutup Z) dan warna asli per layer (CV-1) pada v0.5.0, serta mode kontur per subpath (AM-6) pada v0.5.1, juga belum diuji di perangkat nyata — pola path stroke ditiru dari ekspor asli Proyek Baru 19.xml dan urutan tumpukan layer lubang pada mode kontur mengikuti asumsi urutan elemen, namun keduanya belum diverifikasi pada perangkat nyata.
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
| RF-01 | Navigasi Studio, Preset, Tentang berfungsi dengan status aktif yang jelas | Tidak berubah; NB-1 (bagian 9) memperbaiki CTA "Buka Studio" dan reset gulir |
| RF-02 | Unggah gambar melalui pemilih berkas dan drag-and-drop; mendukung PNG, JPG, WebP; batas 15 MB | Diimplementasikan |
| RF-03 | Pratinjau gambar asli dengan metadata (nama, dimensi, ukuran) | Diimplementasikan |
| RF-04 | Tombol ganti dan hapus gambar berfungsi penuh | Diimplementasikan |
| RF-05 | Kontrol siluet (mode, warna, ambang) menghasilkan pratinjau siluet raster yang benar-benar dihitung lokal | Diimplementasikan (raster); P1 (v0.4.3) menghitung mask pratinjau pada resolusi kerja terbatas tanpa mengubah hasil ekspor (lihat bagian 13) |
| RF-06 | Kontrol penyederhanaan path memengaruhi jumlah titik kontur hasil vektorisasi | Diimplementasikan (VE-2) |
| RF-07 | Preset animasi Silhouette Reveal, Scale Pulse, Rotation Motion dengan durasi dan intensitas, kontrol putar, jeda, ulangi | Diimplementasikan (pratinjau lokal) |
| RF-08 | Panel ekspor: nama berkas, format target, status validasi, informasi kompatibilitas, pesan kesalahan yang jelas | Diimplementasikan (panel); ekspor ditandai belum tersedia |
| RF-09 | Mesin vektorisasi (path SVG) | Diimplementasikan (VE-1; uji 18/18 lulus, lihat bagian 7; P1 mengganti struktur data internal tanpa mengubah keluaran, lihat bagian 13) |
| RF-10 | Adapter XML Alight Motion | Diimplementasikan (AM-1 + AM-2 + AM-3 + AM-4 + AM-5 + AM-6, v0.5.1): bentuk statis tanpa keyframe; satu layer shape per komponen siluet dengan pivot per bounding box, satu layer garis centerline per goresan (path-stroke), atau satu layer per kontur termasuk lubang (AM-6); struktur mengikuti pola ekspor asli; outline pada tag path sesuai parser asli; tampilan shape statis mode isi terbukti di lapangan (TS-1), keluaran multi-layer, mode garis, dan mode kontur menunggu uji lanjutan |
| RF-11 | Validasi XML | Diimplementasikan (XV-1 + XV-2 + XV-3, v0.4.2): validasi lokal termasuk pola struktural ekspor asli, syarat outline path, dan fixture regresi; bukan bukti kompatibilitas |
| RF-12 | Ekspor XML | Diimplementasikan (EX-1, v0.4.0; AM-4, v0.4.4; AM-5, v0.5.0; AM-6, v0.5.1): unduhan .xml lokal berupa bentuk statis dengan satu layer per komponen, satu layer per goresan, atau satu layer per kontur; tampilan shape statis mode isi terbukti di lapangan (TS-1) |
| RF-13 | Mode representasi garis: satu centerline per goresan line art pada ekspor XML (permintaan pengguna 2026-10-17) | Diimplementasikan (VE-3 + AM-5, v0.5.0): skeletonisasi Zhang-Suen per region, perunututan rantai (ujung/simpang/loop) dengan penekanan diagonal semu, RDP, layer path-stroke tanpa Z; menunggu uji lapangan |
| RF-14 | Mode warna asli: warna dominan piksel sumber per komponen sebagai fillColor layer (permintaan pengguna 2026-10-17, hasil 1:1 dengan aslinya) | Diimplementasikan (CV-1 + AM-5, v0.5.0): sampling keranjang kuantisasi 16 tingkat per kanal dengan rata-rata tepat keranjang dominan; tepat untuk desain warna datar, perkiraan untuk gradien/foto; menunggu uji lapangan |
| RF-15 | Mode representasi kontur: satu layer per kontur — kontur luar maupun lubang — sehingga 1 layer = 1 kontur dan setiap entri panel "Tambahkan Kontur" Alight Motion dapat disunting terpisah (permintaan pengguna 2026-10-17) | Diimplementasikan (AM-6 + CV-2, v0.5.1): setiap subpath menjadi shape tersendiri dengan pivot pusat bbox kontur; warna asli per kontur (kontur lubang memakai warna latar di dalam lubang); menunggu uji lapangan |

### 3.2 Kebutuhan non-fungsional

- NFR-01: Responsif untuk layar HP Android dan desktop.
- NFR-02: Identitas visual "Imperfect by Design" (v0.3.0, DS-1): latar krem #F7F6F0 bergaris grid tipis, tipografi hitam editorial tebal, outline hitam tegas pada kartu dan tombol, bayangan solid pendek, aksen konsisten kuning #FFC531 / oranye #FF7A29 / ungu #8C6CFF / hijau #3BB05C sebagai penanda fungsi, sudut membulat secukupnya, tanpa emoji dekoratif. Identitas biru gelap v0.2.0 digantikan sepenuhnya.
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
| js/modules/silhouette.js | Komputasi mask siluet raster (nyata); P1 (v0.4.3): inti murni computeSilhouetteMaskFromPixels plus pembantu resolusi kerja pratinjau (computePreviewDimensions, PREVIEW_MAX_DIMENSION); v0.5.0: getCanvasPixelData (baca piksel sekali untuk mask + sampling warna), labelMaskRegions (flood fill 4-tetangga deterministik untuk region komponen), findRegionLabel (pemetaan kontur ke region) |
| js/modules/vectorEngine.js | Vektorisasi mask menjadi path SVG tertutup: marching squares pada crack boundary + penyederhanaan RDP (nyata); P1 (v0.4.3): tabel tepi terlacak bit-packed Uint8Array menggantikan Set kunci numerik tanpa mengubah keluaran geometri; v0.5.0: simplifyPolyline diekspor untuk dipakai ekstraksi centerline |
| js/modules/centerline.js | Ekstraksi garis centerline per goresan (VE-3, v0.5.0): skeletonisasi Zhang-Suen pada crop bbox region, perunututan rantai (ujung derajat 1, simpang >= 3, loop tertutup derajat 2) dengan penekanan diagonal semu pada sudut siku, pembuangan rantai < 3 piksel, lebar = luas region / panjang skeleton, RDP via simplifyPolyline |
| js/modules/colorSampling.js | Sampling warna asli per komponen (CV-1, v0.5.0) dan per kontur (CV-2, v0.5.1): keranjang kuantisasi 16 tingkat per kanal, keranjang terbanyak dipilih, rata-rata tepat piksel keranjang itu menjadi warna '#RRGGBB'; per komponen seurut urutan kontur luar (region mask), atau per kontur seurut urutan subpath — kontur lubang memakai piksel latar (mask 0) yang pusatnya berada di dalam poligon lubang (ray casting) |
| js/modules/animation.js | Definisi preset dan mesin pratinjau animasi lokal (nyata) |
| js/modules/amAdapter.js | Serializer XML Alight Motion (AM-1 + AM-3 + AM-4 + AM-5 + AM-6): scene berisi satu shape imported statis per komponen siluet (pemisah layer) dengan pivot pada pusat bbox komponen dan outline pada tag path sesuai pola parser asli, satu shape garis centerline per goresan (path-stroke + path tanpa Z), atau satu shape per kontur termasuk lubang (AM-6, 1 layer = 1 kontur, pivot pusat bbox kontur); fillColor per layer dari warna global, componentColors (CV-1), atau contourColors (CV-2) |
| js/modules/xmlValidation.js | Validasi dokumen XML (XV-1 + XV-3): well-formedness, atribut wajib, pola ekspor asli, ID unik, rentang waktu, warna, outline shape |
| js/modules/exportManager.js | Orkestrasi pipeline ekspor (v0.5.1): baca piksel sekali (getCanvasPixelData) → mask (computeSilhouetteMaskFromPixels) → vektorisasi → mode warna asli: sampleComponentColors (isi/garis) atau sampleContourColors (kontur); mode garis: extractCenterlines (gagal jujur bila kosong) → XML (AM-1) → validasi (XV-1); mengembalikan hasil atau pesan kesalahan terstruktur |
| js/modules/pipelineErrors.js | Tipe kesalahan PipelineNotAvailableError |
| js/ui/statusStrip.js | Strip status fitur |
| js/ui/uploadZone.js | Zona unggah: pemilih berkas dan drag-and-drop |
| js/ui/previewPanel.js | Pratinjau asli dan siluet, siklus hidup animasi; P1 (v0.4.3): mask pratinjau dihitung pada resolusi kerja pratinjau lewat kanvas luar layar yang dipakai ulang, debounce penghitungan mask 150 ms |
| js/ui/vectorPanel.js | Kontrol pengaturan vektor |
| js/ui/animationPanel.js | Kontrol pengaturan animasi dan pemutaran |
| js/ui/exportPanel.js | Panel ekspor dan pesan status; v0.5.0: kontrol mode representasi (isi/garis) dan mode warna (pilihan/asli) tersambung ke store, pesan sukses menjelaskan mode aktif dan batas uji lapangannya |
| js/ui/pages.js | Perutean lokal antar halaman |
| tests/vectorEngine.test.js | Rangkaian uji murni mesin vektorisasi (18 kasus) plus suite pembantu pratinjau P1 (5 kasus) plus suite ekstraksi centerline VE-3 (8 kasus: pelabelan region, pita lurus, loop tertutup, componentIndex, simpang T, bercak tanpa garis, persegi besar; tanpa DOM, dapat dijalankan di peramban) |
| tests/amAdapter.test.js | Rangkaian uji murni adapter XML, validasi, dan integrasi ekspor (31 kasus termasuk 3 pemisah layer AM-4, 4 mode garis/warna AM-5, dan 3 integrasi EX warna asli + mode garis; tanpa DOM) |
| tests/amImportFixture.test.js | Rangkaian uji regresi impor dan tampilan (11 kasus: fixture ekspor asli, penolakan pola gagal v0.4.0 dan v0.4.1, fixture ekspor asli berpath, regresi geometri lingkaran dan cincin, geometri multi-layer dua disk dan cincin+pulau AM-4) |
| tests/index.html | Harness peramban untuk menjalankan seluruh rangkaian uji (73 kasus) |

Alur data: imageImport menghasilkan ImageDescriptor (kanvas ternormalisasi) ke store; silhouette menghitung mask dari kanvas; pratinjau raster dirasterisasi. vectorEngine mengubah mask menjadi VectorPathData (SVG) yang ditampilkan sebagai pratinjau vektor beserta statistiknya; perubahan gambar, mode, ambang, penyederhanaan, dan warna memicu penghitungan ulang dari state terkini (lihat 7.3). Sejak v0.4.3 pratinjau menghitung mask pada resolusi kerja terbatas (maks 700 px, tanpa pembesaran), sedangkan ekspor tetap menghitung mask resolusi penuh dari kanvas ternormalisasi. Saat tombol ekspor ditekan, exportManager membaca piksel sumber sekali (getCanvasPixelData), menghitung ulang mask dan vektor dari state terkini, lalu sesuai mode: representasi "isi" membangun XML scene statis dengan satu layer shape per komponen siluet (pemisah layer AM-4, lubang bergabung pada layer komponennya, pivot per bbox komponen) dan mode "garis" membangun satu layer shape per goresan centerline (VE-3: path-stroke tanpa Z); mode warna "pilihan" menulis satu fillColor global, mode "asli" mensampling warna dominan piksel sumber per komponen (CV-1) sebagai fillColor per layer; xmlValidation memverifikasi hasil sebelum unduhan (lihat bagian 10, 14, dan 15). Tahap yang masih belum tersedia: penerapan AnimationClipData preset menjadi keyframe XML (AN-1). Setiap tahap memancarkan pesan status yang jujur.

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

Diimplementasikan: desain, navigasi, unggah, pratinjau (asli + siluet raster + hasil vektor SVG), kontrol UI, state aplikasi, pratinjau animasi lokal, mesin vektorisasi dengan penyederhanaan bertingkat (VE-1, VE-2), adapter XML statis (AM-1), validasi XML lokal (XV-1), dan unduhan ekspor .xml (EX-1).

Belum diimplementasikan (ditandai eksplisit di UI): penerapan keyframe preset ke properti Alight Motion (AN-1). Untuk TS-1, bentuk statis mode isi telah terbukti tampil di perangkat nyata (2026-10-17); sisa verifikasi lapangan menyangkut keluaran multi-layer v0.4.4 serta mode garis (VE-3) dan warna asli (CV-1) v0.5.0 (lihat bagian 14 dan 15).

## 5. Backlog

| ID | Butir | Catatan teknis |
|----|-------|----------------|
| VE-1 | Mesin vektorisasi mask ke path SVG | Selesai (v0.2.0): marching squares pada crack boundary + RDP per kontur tertutup; uji 18/18 lulus (lihat 7) |
| VE-2 | Penyederhanaan path bertingkat | Selesai (v0.2.0): toleransi rendah 0.3 px, sedang 1.5 px, tinggi 3.5 px; override tolerancePx didukung; terhubung ke kontrol state |
| AM-1 | Adapter XML Alight Motion | Selesai (v0.4.0): bentuk imported statis dari kontur vektor; lihat bagian 10. Tanpa klaim kompatibilitas sebelum TS-1 |
| AM-2 | Penyelarasan struktur XML dengan pola ekspor asli (prolog, precompose, retime/retimeAdaptFPS, mediaFillMode) | Selesai (v0.4.1): didasarkan pada tiga ekspor asli Alight Motion; lihat bagian 11. Impor nyata belum terbukti (TS-1) |
| AM-3 | Outline shape pada tag path sesuai parser asli (perbaikan impor berhasil namun kanvas kosong) | Selesai (v0.4.2): didasarkan pada dekompilasi parser (ShapeElementTypeImpl) dan ekspor asli Proyek Baru 19.xml; lihat bagian 12. Tampilan shape pada perangkat nyata terbukti (TS-1, uji lapangan 2026-10-17) |
| AM-4 | Pemisah layer: satu shape (layer) per komponen siluet pada ekspor XML | Selesai (v0.4.4): pengelompokan kontur per komponen (lubang ke kontur luar terkecil yang memuat titik pertamanya, ray casting + fallback bbox), satu elemen shape per komponen dengan pivot pusat bbox; lihat bagian 14. Keluaran multi-layer belum diuji di perangkat nyata |
| AM-5 | Mode representasi ekspor: isi per komponen atau garis centerline per goresan (path-stroke) | Selesai (v0.5.0): satu layer shape per garis dengan path-stroke tebal perkiraan pita dan path tanpa penutup Z mengikuti pola path stroke ekspor asli Proyek Baru 19.xml; guard eksplisit bila data garis kosong; lihat bagian 15. Semantik path-stroke pada perangkat nyata belum terverifikasi |
| VE-3 | Ekstraksi garis centerline per goresan line art (skeletonisasi + perunututan) | Selesai (v0.5.0): Zhang-Suen per region crop bbox, perunututan rantai dengan penekanan diagonal semu (agar loop tertutup dikenali), pembuangan rantai < 3 piksel, RDP, lebar = luas/panjang skeleton; modul js/modules/centerline.js; lihat bagian 15 |
| CV-1 | Sampling warna asli per komponen sebagai fillColor layer | Selesai (v0.5.0): keranjang kuantisasi 16 tingkat per kanal, rata-rata tepat keranjang dominan, per komponen seurut kontur luar; modul js/modules/colorSampling.js; lihat bagian 15. Tepat untuk warna datar, perkiraan untuk gradien/foto |
| AM-6 | Mode representasi kontur: satu shape (layer) per kontur — termasuk lubang — pada ekspor XML | Selesai (v0.5.1): setiap subpath menjadi shape tersendiri dengan pivot pusat bbox kontur tersebut dan pathD tertutup Z; urutan layer mengikuti urutan subpath (luar, lubang, pulau); lihat bagian 16. Urutan tumpukan layer pada perangkat nyata belum diverifikasi |
| CV-2 | Sampling warna asli per kontur sebagai fillColor layer mode kontur | Selesai (v0.5.1): kontur luar memakai warna dominan region mask pemiliknya, kontur lubang memakai warna dominan piksel latar (mask 0) di dalam poligon lubang (ray casting); fallback #000000 bila tidak ada piksel layak; lihat bagian 16 |
| AN-1 | Penerapan keyframe preset ke properti AM (scale, rotation, opacity) | Bergantung TS-1: semantik keyframe pada bentuk imported harus diverifikasi lewat uji impor nyata sebelum diimplementasikan |
| XV-1 | Validasi XML (well-formedness, atribut wajib, referensi ID) | Selesai (v0.4.0): dijalankan sebelum unduhan; lihat bagian 10 |
| XV-2 | Pengetatan validator + fixture regresi kegagalan impor | Selesai (v0.4.1): validator menolak dokumen tanpa prolog/pola ekspor asli; lihat bagian 11 |
| XV-3 | Pengetatan validator outline (tag path) + regresi geometri path nonkosong | Selesai (v0.4.2): validator menolak shape tanpa outline path; 9 kasus fixture termasuk geometri; lihat bagian 12 |
| EX-1 | Unduh .xml + proses unduhan multi-berkas bila diperlukan | Selesai (v0.4.0): unduhan satu .xml lokal; multi-berkas tidak diperlukan untuk keluaran vektor murni; lihat bagian 10 |
| TS-1 | Uji impor nyata di Alight Motion (Android) | v0.4.0 terbukti gagal diimpor di lapangan; v0.4.1 terimpor namun kanvas kosong; v0.4.2/v0.4.3 TERBUKTI diimpor dan menampilkan shape dengan titik sunting (uji lapangan 2026-10-17, tangkapan layar pengguna, AM 5.0.273 Android) — terpenuhi untuk bentuk statis mode isi; sisa: verifikasi lapangan keluaran multi-layer v0.4.4 (tiap komponen muncul sebagai layer tersendiri), mode garis VE-3 dan warna asli CV-1 v0.5.0 (semantik path-stroke, tebal, dan warna per layer), serta mode kontur AM-6/CV-2 v0.5.1 (tiap kontur muncul sebagai layer tersendiri, urutan tumpukan lubang benar) sebelum klaim kompatibilitas masing-masing |
| DS-1 | Redesign visual "Imperfect by Design" | Selesai (v0.3.0): lihat bagian 8 |
| NB-1 | Perbaikan bug tombol "Buka Studio" (no-op) dan reset gulir saat pindah halaman | Selesai (v0.4.0): lihat bagian 9 |
| PF-1 | Performa pratinjau siluet dan vektorisasi | Selesai (v0.4.3): bottleneck terukur (operasi hash Set + panggilan closure per piksel pada pemindaian area penuh); perbaikan = tabel tepi bit-packed, resolusi kerja pratinjau maks 700 px, debounce 150 ms; keluaran geometri terbukti identik 66/66 perbandingan mesin lama vs baru; lihat bagian 13. Pengukuran waktu pada perangkat nyata belum tersedia |
| GT-1 | Aktifkan GitHub Pages / deployment statis | Konfigurasi manual di pengaturan repositori |
| TS-2 | Uji otomatis ringan (parsing modul, unit silhouette) | Terlayani sebagian (v0.5.1): 78 uji murni (18 VE + 36 AM/XV/EX termasuk 3 pemisah layer AM-4, 4 mode garis/warna AM-5, 3 integrasi EX v0.5.0, 3 mode kontur AM-6, 2 integrasi mode kontur EX/CV-2 + 11 fixture regresi termasuk 2 geometri multi-layer + 5 pembantu pratinjau P1 + 8 ekstraksi centerline VE-3 termasuk pelabelan region) berjalan via tests/index.html di peramban tanpa Node; uji runtime peramban belum tercakup |
| IPR-1 | Parser teks XML proyek/preset Alight Motion: pemetaan scene, media, layer, keyframe, slot aset, dan pelaporan struktur belum didukung (fondasi Instant Preset Remixer) | Selesai: js/modules/presetParser.js murni + 18 uji pada tests/presetParser.test.js lulus di sandbox tanpa peramban (2026-10-18); uji peramban (tests/index.html, kini 113 kasus) dan preset nyata pengguna menunggu (lihat bagian 17); IPR-2 (penggantian aset selektif) dituntaskan pada bagian 18 |
| IPR-2 | Penggantian aset individual: uri media dan fillImage diganti lewat splice teks presisi, metadata hanya pada atribut yang sudah ada, aset lain terjaga byte demi byte, hasil diparse ulang dan divalidasi | Selesai: js/modules/presetRemixer.js (replaceAssets) + parser aditif v2 (posisi sumber) + 17 uji pada tests/presetRemixer.test.js lulus di sandbox tanpa peramban (2026-10-18); uji peramban (tests/index.html, kini 113 kasus) dan penggantian aset nyata di Alight Motion menunggu uji lapangan (lihat bagian 18) |
| IPR-3 | Integrasi antarmuka Instant Preset Remixer: impor berkas proyek, analisis slot aset, pengisian uri pengganti per slot terpilih, perakitan ulang via replaceAssets, validasi, dan unduhan lokal | Selesai: js/modules/presetRemixWorkflow.js (orkestrasi murni) + js/ui/presetRemixerPanel.js + halaman Remixer + 11 uji pada tests/presetRemixWorkflow.test.js lulus di sandbox tanpa peramban (2026-10-19); panel DOM dan uji peramban (tests/index.html, kini 124 kasus) menunggu, penerimaan hasil oleh Alight Motion menunggu uji lapangan (lihat bagian 19) |

## 6. Catatan verifikasi

- Lingkungan pengerjaan tidak memiliki Node.js; karena itu tidak ada build yang dapat dijalankan dan tidak ada uji runtime otomatis. Situs sengaja tidak menggunakan toolchain agar dapat diverifikasi langsung di peramban.
- Verifikasi yang dijalankan: audit repositori melalui GitHub API, pemeriksaan sintaks statis seluruh modul JS, pemeriksaan keseimbangan tanda kurung CSS, dan peninjauan manual.
- Uji lanjutan yang wajib: buka halaman di Chrome/Android, unggah PNG/JPG/WebP, geser kontrol, dan jalankan pratinjau animasi.

## 7. Implementasi VE-1 (v0.2.0): vektorisasi mask siluet menjadi path SVG

### 7.1 Cakupan

VE-1 mengganti stub vectorEngine dengan mesin vektorisasi yang berfungsi: mask siluet biner (keluaran silhouette.js) diubah menjadi kumpulan kontur tertutup yang diserialisasi sebagai elemen path SVG dengan fill-rule evenodd. Tahap ini hanya bertanggung jawab atas geometri vektor yang siap dipakai modul animasi dan adapter XML. Adapter XML, validasi, ekspor, dan klaim kompatibilitas Alight Motion tetap di luar cakupan (AM-1, XV-1, EX-1, TS-1).

### 7.2 Algoritma dan kontrak modul

- Penelusuran kontur: marching squares pada crack boundary (grid sudut piksel) dengan aturan penerusan "belok kiri, lurus, belok kanan". Konvensi ini menjaga sisi dalam kontur selalu di kiri arah jalan dan memisahkan komponen yang bersentuhan diagonal (4-connectivity).
- Peran kontur ditentukan dari luas bertanda (shoelace): kontur luar dan lubang dinormalisasi dengan orientasi berlawanan; SVG diemit dengan fill-rule evenodd sehingga lubang dan pulau di dalam lubang ter-render benar tanpa uji kontainmen.
- Penyederhanaan: Ramer-Douglas-Peucker iteratif (berbasis tumpukan, bukan rekursif) per kontur tertutup dengan dua titik jangkar. Tingkat state (rendah/sedang/tinggi) dipetakan ke toleransi 0.3/1.5/3.5 px; parameter tolerancePx dapat diganti secara eksplisit; tingkat tak dikenal jatuh ke sedang.
- Kontrak: vectorizeSilhouette(maskData, vectorSettings) menghasilkan VectorPathData { ok, empty, svg, width, height, pathCount, componentCount, vertexCount, tolerancePx, subpaths }. Mask kosong menghasilkan empty tanpa kesalahan; input tidak valid melempar Error dengan pesan berbahasa Indonesia. buildSvgDocument(vectorPathData, colorHex) membangun ulang dokumen SVG saat warna berubah tanpa menghitung ulang geometri; warna disanitasi (fallback #3B82F6).
- Koordinat bulat pada sistem koordinat piksel mask; viewBox sesuai dimensi mask sehingga proporsi dan batas objek dipertahankan. Implementasi murni array tanpa DOM, tanpa dependensi eksternal, ringan untuk perangkat Android.

### 7.3 Integrasi pipeline

- previewPanel menambahkan kartu "Hasil Vektor (SVG)" dengan statistik komponen/kontur/titik. Perubahan gambar, mode, atau ambang menghitung ulang mask lalu vektor; perubahan penyederhanaan memvektorisasi ulang mask ter-cache; perubahan warna cukup membangun ulang SVG. Seluruh penghitungan membaca state terkini saat eksekusi (bukan saat penjadwalan) dan diberi debounce.
- exportManager kini menjalankan tahap nyata (mask + vektorisasi) saat tombol ekspor ditekan, lalu gagal jujur di stub AM-1 dengan PipelineNotAvailableError; tidak ada berkas XML palsu yang dihasilkan.
- statusStrip menandai "Mesin Vektorisasi (SVG)" sebagai tersedia; badge kompatibilitas dan strip status adapter XML tetap jujur.

### 7.4 Hasil pengujian (dijalankan 2026-10-16 sebelum push)

Rangkaian uji tests/vectorEngine.test.js (18 kasus murni tanpa DOM) lulus 18/18 di sandbox:

1. Persegi eksak: 4 titik sudut, luas 25, satu komponen.
2. Lingkaran: satu komponen, kontur valid.
3. Cincin: kontur luar plus lubang internal dengan orientasi berlawanan.
4. Dua komponen terpisah: dua kontur luar dengan luas masing-masing sesuai.
5. Pulau di dalam lubang: tiga kontur (luar, lubang, luar pulau).
6. Sentuhan diagonal: dua komponen terpisah (4-connectivity).
7. Mask kosong: empty tanpa svg dan tanpa kesalahan.
8-12. Lima varian input tidak valid (mask null, dimensi nol, dimensi bukan bilangan bulat, panjang mask tidak sesuai) melempar Error dengan pesan berbahasa Indonesia.
13. Monotonisitas penyederhanaan: jumlah titik rendah >= sedang >= tinggi; toleransi per level sesuai; tingkat tak dikenal jatuh ke sedang.
14. Override tolerancePx berlaku.
15. Validitas struktural SVG (namespace, viewBox, atribut d path, warna, koordinat bulat dalam batas mask) pada pola mask deterministik 60x40.
16. Sanitasi warna: masukan tidak valid (contoh payload skrip) jatuh ke warna default.
17. Deterministik: hasil identik untuk input identik.
18. Integrasi ekspor: kanvas berisi siluet gelap menghasilkan kegagalan jujur di AM-1 dengan pesan adapter (bukti tahap mask dan vektor lulus); siluet kosong menghasilkan pesan "tidak ada siluet".

Verifikasi tambahan sebelum push: kompilasi sintaks 19 berkas JS lulus; keseimbangan tag index.html dan tests/index.html; keseimbangan kurung main.css (158/158).

### 7.5 Keterbatasan

- Uji dijalankan pada sandbox tanpa DOM dan tanpa peramban; runtime peramban (pemuatan modul, rendering SVG, interaksi panel pratinjau, Chrome/Android) belum diuji dan wajib diverifikasi manual.
- Validitas SVG diverifikasi struktural (regex dan batas koordinat), bukan parsing DOM penuh; DOMParser tidak tersedia di sandbox.
- Batas performa pada perangkat Android nyata belum diukur; algoritma bekerja O(piksel) dengan himpunan kunci tepi, pada gambar ternormalisasi maksimum 1400 px.
- previewPanel dan exportPanel diverifikasi lewat kompilasi sintaks serta peninjauan kode, bukan uji runtime.
- Rangkaian uji harus dijalankan ulang di peramban melalui tests/index.html sebelum klaim yang lebih luas.

### 7.6 Traceability

| Backlog / Kebutuhan | Kewajiban | Bukti | Status |
|---------------------|-----------|-------|--------|
| VE-1 | Mesin vektorisasi mask ke path SVG | js/modules/vectorEngine.js; uji 18/18 (7.4) | Selesai |
| VE-2 | Penyederhanaan bertingkat terhubung ke kontrol state | Uji monotonisasi dan override; previewPanel memvektorisasi ulang saat tingkat berubah | Selesai |
| RF-09 | Mesin vektorisasi (path SVG) | 7.2-7.4 | Diimplementasikan |
| RF-06 | Kontrol penyederhanaan berpengaruh nyata | Uji monotonisasi (7.4 kasus 13-14) | Diimplementasikan |
| TS-2 | Uji otomatis ringan | tests/vectorEngine.test.js + tests/index.html (peramban, tanpa Node) | Terlayani sebagian; unit silhouette dan uji runtime peramban belum tercakup |

## 8. Implementasi DS-1 (v0.3.0): redesign visual "Imperfect by Design"

### 8.1 Tujuan dan ruang lingkup

DS-1 merombak identitas visual situs menjadi khas, modern, kreatif, dan profesional dengan arah desain "Imperfect by Design" (karakter studio kreatif eksperimental), berdasarkan referensi visual yang diberikan pengguna tanpa menyalin nama, logo, teks, atau ilustrasi referensi secara persis. Ruang lingkup terbatas pada presentasi: index.html dan styles/main.css. Perilaku pipeline, kontrak modul, ID DOM, struktur state, algoritma marching squares dan Ramer-Douglas-Peucker, serta rangkaian uji tidak boleh berubah. Adapter XML tetap stub dan statusnya tetap ditampilkan secara jujur.

### 8.2 Keputusan desain

- Token desain baru di styles/main.css: latar krem #F7F6F0 dengan grid tipis 32 px kontras rendah, permukaan putih #FFFFFF, tinta hitam #14120D untuk teks dan outline, aksen kuning #FFC531, oranye #FF7A29, ungu #8C6CFF, hijau #3BB05C, merah #E5484D untuk status kesalahan. Radius 8/12/16 px (tidak semua elemen berbentuk pil). Bayangan solid pendek (4px 4px 0) dengan interaksi geser pada hover/active. Identitas biru gelap v0.2.0 digantikan sepenuhnya; color-scheme berubah dari dark ke light.
- Tipografi editorial: bobot tebal (hero hingga 800), ukuran hero dengan clamp 2,1-3,3 rem, letter-spacing rapat, sorotan kuning pada penekanan judul hero.
- Aksen warna sebagai penanda fungsi: kuning untuk panel vektor dan aksi utama, ungu untuk panel animasi dan indikator fokus keyboard, oranye untuk panel ekspor dan status belum tersedia, hijau untuk status tersedia, merah untuk kesalahan. Kartu pratinjau diberi penanda titik warna sesuai fungsi (impor hijau, siluet ungu, vektor kuning).
- Hero baru: eyebrow versi, judul "Ubah gambar menjadi vektor beranimasi.", deskripsi fungsi produk, tombol "Buka Studio" dan "Lihat Preset" (memakai data-nav yang sudah didukung pages.js tanpa perubahan JavaScript), tiga label fitur (Siluet Vektor, Animasi Keyframe, XML Alight Motion) dengan label jujur "menyusul" pada XML karena adapter masih stub, plus strip status fitur yang sudah ada.
- Ilustrasi produk berupa satu SVG inline statis (role img dengan aria-label) yang menggambarkan alur Gambar sumber → Siluet → Kontur SVG → Linimasa animasi: outline hitam, panel putih, aksen kuning/oranye/ungu/hijau, keyframe berbentuk berlian, dan playhead merah. Ilustrasi ini bergaya flat, tidak menampilkan hasil pemrosesan palsu, dan tajam di berbagai resolusi.
- Marka brand geometris abstrak (kotak kuning, segitiga putih ber-outline, lingkaran ungu, node hijau berlian), bukan huruf N.
- Studio disusun ulang secara hierarkis menjadi lima langkah bernomor (chip 01-05): (01) impor gambar dan pratinjau sumber, (02) pratinjau siluet dan hasil vektor, (03) panel kontrol vektor, (04) panel preset animasi, (05) panel ekspor dan status. Urutan DOM dan seluruh ID DOM dipertahankan; kartu "Gambar Asli" dipindahkan ke langkah 01 dan preview-grid pada langkah 02 menjadi satu kolom — perubahan penampung ini tidak menyentuh kontrak modul karena previewPanel hanya membaca ID elemen.
- Teksur grain hanya aksen halus: satu lapisan feTurbulence data-URI dengan opasitas 0,08 pada hero, tidak mengganggu keterbacaan.
- Animasi: tidak ada animasi baru yang ditambahkan; keyframes preset (nv-reveal, nv-pulse, nv-rotation) dan variabel --nv-i/--nv-deg dipertahankan persis untuk animation.js; aturan prefers-reduced-motion tetap melumpuhkan seluruh transisi dan animasi dekoratif.
- Aksesibilitas: focus-visible global 3 px ungu, label kontrol dipertahankan, kontras teks utama #14120D dan sekunder #5A564B pada latar terang memenuhi ambang keterbacaan.

### 8.3 Berkas yang berubah

- index.html: struktur hero, ilustrasi, langkah studio 01-05, markup panel, halaman Preset dan Tentang, versi v0.3.0. Seluruh ID DOM dan hook perutean dipertahankan.
- styles/main.css: ditulis ulang penuh dengan sistem desain baru; keyframes dan variabel animasi lama dipertahankan.
- docs/SDD.md dan README.md: dokumentasi redesign ini.
- Tidak ada berkas JavaScript yang berubah.

### 8.4 Risiko regresi dan mitigasi

1. Risiko: JS merujuk ID/kelas yang hilang saat HTML ditulis ulang. Mitigasi: inventaris seluruh pemilih qs/qsa dari modul UI diverifikasi terhadap HTML baru secara otomatis; hasil: nol ID hilang, dua radio vector-mode, tujuh data-nav, tiga section .page.
2. Risiko: CSS baru lupa mendefinisikan kelas/keyframes yang direferensikan JS. Mitigasi: pemeriksaan otomatis keberadaan 20 kelas terpakai (termasuk .nav-link.active dan .preset-tile.active), empat keyframes, dua variabel animasi, dan aturan prefers-reduced-motion; seluruhnya ditemukan.
3. Risiko: perilaku pipeline berubah. Mitigasi: tidak ada berkas js/ yang diubah; 18 uji mesin vektorisasi dijalankan ulang dan lulus 18/18; sintaks seluruh 19 berkas JS diverifikasi ulang.
4. Risiko: overflow horizontal pada layar sempit. Mitigasi: layout grid satu kolom pada <=960 px, tidak ada lebar tetap di atas 400 px di CSS, grid template memakai minmax(0,1fr). Uji visual peramban aktual belum dijalankan (lihat 8.6).

### 8.5 Kriteria penerimaan dan hasil verifikasi (dijalankan 2026-10-16 sebelum push)

| ID | Kriteria | Hasil |
|----|----------|-------|
| AC-01 | Identitas visual: latar krem ber-grid, tipografi editorial tebal, outline hitam, palet aksen konsisten | Terpenuhi secara struktural: token dan komponen terverifikasi ada di CSS; render visual peramban belum diuji |
| AC-02 | Responsivitas desktop dan Android tanpa overflow horizontal | Struktur responsif terverifikasi (satu kolom <=960 px, tanpa lebar tetap >400 px); uji viewport peramban aktual belum tersedia di lingkungan ini |
| AC-03 | Integritas fitur: impor, siluet, penyederhanaan, warna, pratinjau SVG, preset tetap berfungsi | Hook DOM/event seluruh kontrol terverifikasi utuh (nol ID hilang); tidak ada perubahan JS; uji interaksi runtime peramban belum dijalankan |
| AC-04 | Integritas SVG: keluaran vektor, lubang kontur, batas koordinat, statistik tidak rusak | Terpenuhi: uji mesin vektorisasi 18/18 lulus dijalankan ulang; kelas vector-output/vector-stats dan container svg terdefinisi |
| AC-05 | Integritas ekspor: keterbatasan adapter XML tampil jujur, tanpa XML palsu | Terpenuhi: label "menyusul" di hero, panel-note dan uji integrasi kegagalan jujur AM-1 tetap lulus |
| AC-06 | Aksesibilitas: label, fokus keyboard terlihat, kontras memadai | Terpenuhi secara struktural: focus-visible 3 px, label dipertahankan, pasangan warna teks/latar berkontras tinggi; audit pembaca layar belum dijalankan |
| AC-07 | Performa: tanpa dependensi berat atau animasi tidak perlu | Terpenuhi: nol dependensi baru, nol animasi baru, grain satu lapisan statis |
| AC-08 | Tidak ada regresi: pengujian sebelumnya dipertahankan dan dijalankan ulang | Terpenuhi: 18/18 uji lulus ulang; sintaks 19/19 berkas JS lulus; keseimbangan kurung CSS 192/192; tag HTML seimbang |
| AC-09 | Dokumentasi SDD dan README diperbarui sesuai perubahan aktual | Terpenuhi: bagian 8 SDD ini, NFR-02, backlog DS-1, README v0.3.0 |

### 8.6 Keterbatasan

- Lingkungan pengerjaan tidak memiliki peramban; render visual, layout pada viewport sempit/lebar yang sebenarnya, interaksi kontrol, dan animasi runtime (Chrome/Android) belum diuji dan wajib diverifikasi manual sebelum klaim lebih lanjut.
- Verifikasi aksesibilitas bersifat struktural (label, fokus, kontras), bukan audit pembaca layar.
- Uji interaksi drag-and-drop dan unggahan berkas memerlukan peramban; tidak dapat dijalankan di sandbox.

### 8.7 Traceability

| Backlog / Kebutuhan | Kewajiban | Bukti | Status |
|---------------------|-----------|-------|--------|
| DS-1 | Redesign visual "Imperfect by Design" | index.html + styles/main.css v0.3.0; verifikasi 8.5 | Selesai |
| NFR-02 | Identitas visual baru terdefinisi sebagai token | styles/main.css :root; SDD 8.2 | Diimplementasikan |
| RF-01 | Navigasi tetap berfungsi | data-nav utuh (7 referensi), .page dan .nav-link.active terverifikasi | Tidak berubah |
| AC-04 | Keluaran SVG tidak rusak | Uji 18/18 lulus ulang (7.4) | Terpenuhi |

## 9. Implementasi NB-1 (v0.4.0): perbaikan bug navigasi "Buka Studio"

### 9.1 Akar masalah

Audit v0.3.0 menemukan dua cacat perilaku pada `js/ui/pages.js` (dibaca langsung dari HEAD `c71fca1`, bukan dari ingatan):

1. Handler klik `data-nav` hanya memanggil `store.set({ page })`. Tombol hero "Buka Studio" berada di dalam `#page-studio`; ketika halaman aktif sudah Studio (halaman awal), klik tombol tersebut tidak mengubah apa pun — no-op mutlak, tanpa umpan balik apa pun kepada pengguna. CTA pada header memiliki masalah yang sama ketika pengguna sudah berada di Studio.
2. Perpindahan halaman (misalnya Studio → Preset) mempertahankan posisi gulir halaman sebelumnya, sehingga halaman baru dapat terbuka pada posisi gulir di tengah dokumen.

### 9.2 Perbaikan (perubahan terkecil pada arsitektur existing)

`js/ui/pages.js` (satu-satunya berkas JS yang diubah):

- Atribut `data-nav-scroll` (opsional) pada tombol `data-nav`: setelah `store.set({ page })`, elemen target dicari dengan `qs('#' + nilai)` dan digulir via `element.scrollIntoView({ behavior, block: 'start' })`. Ketika target ditemukan, `window.scrollTo` tidak dipanggil (menghindari gulir ganda).
- Tombol tanpa `data-nav-scroll`: `window.scrollTo({ top: 0, behavior })` dipanggil hanya jika halaman benar-benar berubah (`pageChanged`), sehingga klik ulang pada halaman aktif tidak menggulir.
- `behavior` bernilai `auto` ketika `matchMedia('(prefers-reduced-motion: reduce)').matches`, selainnya `smooth` (menghormati preferensi aksesibilitas).
- Render, kelas `active`, `aria-current`, dan `page-hidden` tidak diubah.

`index.html`: `id="studio-workspace"` ditambahkan pada pembungkus area kerja Studio; dua tombol "Buka Studio" (header dan hero) diberi `data-nav-scroll="studio-workspace"`. `styles/main.css`: `scroll-margin-top: 84px` pada `.workspace` agar target gulir tidak tertutup header lengket. Tidak ada ID DOM lain, kontrak modul, atau state yang diubah.

### 9.3 Berkas yang berubah

- `index.html` (3 suntingan: 1 id baru, 2 atribut data-nav-scroll)
- `js/ui/pages.js` (penulisan ulang handler klik, API modul tidak berubah)
- `styles/main.css` (1 deklarasi scroll-margin-top)
- `docs/SDD.md` (bagian 9 ini, baris backlog NB-1, status RF-01)

### 9.4 Kriteria penerimaan bugfix dan hasil verifikasi (dijalankan 2026-10-16 sebelum push, sandbox tanpa peramban)

Kriteria penerimaan NB-1: (a) klik "Buka Studio" dari halaman mana pun mengaktifkan Studio dan menggulir ke area kerja; (b) tombol "Lihat Preset", navigasi utama, dan tautan merek tetap berfungsi; (c) pindah halaman menggulir ke atas; (d) `prefers-reduced-motion` menghasilkan `behavior: auto`; (e) seluruh ID DOM yang dirujuk JS tetap ada; (f) sintaks seluruh JS valid.

Metode: harness DOM-palsu (stub `document`, `window.matchMedia`, `classList`, `scrollIntoView`, `scrollTo`) yang menjalankan `dom.js` + `state.js` + `pages.js` asli hasil penghapusan awalan `export` (tanpa mengubah isi), ditambah pemeriksaan struktural `index.html`.

| Pemeriksaan | Hasil |
|-------------|-------|
| K0 Sintaks pages.js + dom.js + state.js (new Function) | Lulus |
| K1 Hero CTA dari halaman Preset: page=studio, scrollIntoView workspace 1x, tanpa window.scrollTo, .page-toggle benar | Lulus (4/4) |
| K2 Nav link pindah halaman: scrollTo top=0 1x behavior smooth; klik ulang halaman sama tidak menggulir; tanpa scrollIntoView | Lulus (5/5) |
| K3 Header CTA saat sudah di Studio: scrollIntoView dipanggil (bukan no-op) | Lulus (2/2) |
| K4 prefers-reduced-motion: behavior auto pada scrollIntoView dan scrollTo | Lulus (2/2) |
| K5 Merek dari Tentang: page=studio, scrollTo tepat 1x, tanpa scrollIntoView, .page-toggle benar | Lulus (5/5) |
| K6 Kelas active dan aria-current pada nav-link (termasuk non-nav-link tanpa active) | Lulus (5/5) |
| K7 "Lihat Preset": page=preset, scrollTo top 1x | Lulus (2/2) |
| Struktural HTML: 40/40 ID DOM wajib ada, 2 tombol data-nav-scroll, radio vector-mode utuh | Lulus |
| Uji mesin vektorisasi (regresi, 18 uji) | Lulus 18/18 (tidak terdampak: tidak ada modul pipeline yang diubah) |

Total: 25/25 asersi harness lulus; uji regresi 18/18 lulus.

### 9.5 Keterbatasan

- Harness menggunakan DOM palsu; perilaku gulir sebenarnya (Chrome/Android, header lengket, nilai `scroll-margin-top`) wajib diverifikasi manual di peramban nyata.
- Posisi `scroll-margin-top: 84px` disesuaikan dengan tinggi header v0.3.0; bila tinggi header berubah, nilai ini harus ditinjau ulang.

### 9.6 Traceability

| Backlog / Kebutuhan | Kewajiban | Bukti | Status |
|---------------------|-----------|-------|--------|
| NB-1 | Tombol "Buka Studio" tidak no-op; pindah halaman me-reset gulir | pages.js + index.html + main.css v0.4.0; verifikasi 9.4 | Selesai |
| RF-01 | Navigasi berfungsi dengan status aktif yang jelas | Harness K1–K7; aria-current terverifikasi | Diperbaiki (NB-1) |
| NFR-04 (aksesibilitas) | Hormati prefers-reduced-motion pada navigasi | K4 behavior auto | Terpenuhi |

## 10. Implementasi AM-1 + XV-1 + EX-1 (v0.4.0): ekspor XML lokal statis

### 10.1 Pemilihan tugas dan alasan

Sesuai urutan prioritas backlog: (1) tidak ditemukan bukti konkret kekurangan fungsional vektorisasi — 18 uji VE-1 lulus dan pratinjau vektor berfungsi, sehingga tidak ada dasar memodifikasi mesin; (2) pratinjau animasi lokal juga sudah berfungsi (AN-1 adalah konversi preset menjadi keyframe XML, yang bergantung pada keberadaan adapter XML dan, menurut riset, pada semantik keyframe yang hanya dapat dipercaya setelah uji impor nyata TS-1 — mengarang penerapan keyframe tanpa bukti bertentangan dengan prinsip kejujuran proyek); (3) adapter XML AM-1 memiliki basis terverifikasi: format scene XML konkret dari dokumentasi komunitas hasil dekompilasi (kuchingneko28/alight-motion-docs, docs/authoring.md, v5.0.273) yang memuat atribut scene, elemen shape imported dengan `<parameter><contour d>`, transform, fillColor #AARRGGBB, dan alokasi ID. Karena itu unit kerja yang dipilih adalah AM-1 + XV-1 + EX-1 sebagai satu unit koheren "ekspor XML lokal" yang dapat diuji mandiri; AN-1 dan TS-1 tetap di backlog dengan alasan tercatat.

### 10.2 Ruang lingkup

- AM-1 (`js/modules/amAdapter.js`): `buildAlightMotionXml(vectorPathData, options)` membangun dokumen `<scene>` berisi tepat satu elemen `<shape>` non-live (imported): transform dengan `location` di pusat kanvas, `fillColor` #AARRGGBB dari warna siluet, dan `<parameter><contour d>` berisi gabungan seluruh subpath (kontur luar dan lubang) yang digeser `(-width/2, -height/2)`. Opsi `{ title, totalTime, fps, modifiedTime, color }` tersedia untuk determinisme pengujian; `modifiedTime` default `Date.now()`. Input tidak valid melempar Error berbahasa Indonesia.
- XV-1 (`js/modules/xmlValidation.js`): `validateAlightMotionXml(xmlString)` mengembalikan `{ valid, issues }`. Validator murni tanpa DOMParser: well-formedness (tag berpasangan, atribut berkutip, satu akar), akar `scene` dengan atribut wajib, atribut bilangan bulat, bgcolor/fillColor #AARRGGBB, ID elemen unik positif, `startTime`/`endTime` dalam `[0, totalTime]`, dan kontur bentuk imported tidak kosong.
- EX-1: `js/modules/exportManager.js` menghitung ulang mask + vektor dari state saat tombol ditekan, memanggil AM-1, lalu XV-1; hasil gagal jujur bila tidak ada gambar atau siluet kosong. `js/ui/exportPanel.js` mengunduh hasil via Blob + `URL.createObjectURL` + anchor lokal (nama disanitasi + `.xml`), menampilkan badge "Validasi lokal lulus" (disimpan pada variabel closure, tanpa perubahan kontrak `state.js`), dan pesan sukses yang menyatakan bahwa kompatibilitas impor belum diuji.
- Antarmuka: strip status menandai adapter dan ekspor tersedia dengan catatan batas; panel ekspor, hero, halaman Preset, dan tabel status halaman Tentang diperbarui ke teks jujur v0.4.0. Nilai default (bentuk statis, tanpa keyframe) ditampilkan eksplisit.

### 10.3 Keputusan teknis

1. Scene memakai `bgcolor="#00000000"` (transparan), `totalTime` 5000 ms, `fps="30"`, `amver="1028425"`, `ffver="106"`, `am="com.alightcreative.motion/5.0.273.1028425"`, `amplatform="android"` — sesuai contoh minimal dan daftar atribut pada dokumentasi komunitas (SDD 2.3).
2. Asumsi belum terverifikasi (ditandai di kode dan menunggu TS-1): kontur bentuk imported diposisikan terpusat relatif terhadap `transform.location`. Bukti tidak langsung: template `.rect` berukuran 100×100 tergambar terpusat pada titik `location` (scale 1), dan konverter pihak ketiga menyebut posisi tengah otomatis. Konsekuensinya: `location` diisi pusat kanvas `(width/2, height/2, 0)` dan kontur digeser `(-width/2, -height/2)` sehingga siluet tampil penuh di tengah kanvas.
3. Keluaran sengaja statis: satu `<shape>` tanpa `<kf>` keyframe. Penerapan preset animasi (AN-1) tidak dikejar; semantik keyframe pada bentuk imported akan diverifikasi lewat uji impor nyata terlebih dahulu.
4. Validator ditulis sebagai parser kecil murni (tanpa DOMParser) agar identik di peramban dan di harness uji tanpa Node, dan validasi dijalankan sebelum unduhan (XV-1).
5. `exportName` dipakai sebagai judul scene (di-escape XML); nama berkas unduhan tetap disanitasi terpisah.
6. Status validasi lokal disimpan pada closure panel, bukan di store, agar kontrak `state.js` tidak berubah.

### 10.4 Risiko regresi dan mitigasi

1. Risiko: perubahan exportManager/statusStrip merusak uji lama. Mitigasi: dua asersi uji lama diperbarui sesuai perilaku baru (dijelaskan di 10.5), tidak ada uji yang dihapus; 16 uji lainnya tidak berubah.
2. Risiko: unduhan gagal di peramban tertentu. Mitigasi: alur memakai API standar (Blob, createObjectURL, anchor); bagian ini tidak dapat diuji di sandbox dan wajib diverifikasi manual di peramban (10.6).
3. Risiko: XML ditolak aplikasi Alight Motion. Mitigasi: seluruh teks antarmuka dan dokumentasi menyatakan kompatibilitas belum teruji; tidak ada klaim sebelum TS-1.
4. Risiko: asumsi penempatan kontur keliru. Mitigasi: asumsi ditandai eksplisit di kode dan SDD; bila TS-1 menunjukkan offset berbeda, perbaikan bersifat lokal pada amAdapter saja.

### 10.5 Hasil verifikasi (dijalankan 2026-10-16 sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Sintaks 20 berkas JS (modul + suite uji, kompilasi `new Function`) | Lulus 20/20 |
| Rangkaian uji vektorisasi (regresi, 18 kasus, 2 asersi integrasi ekspor diperbarui sesuai fitur baru) | Lulus 18/18 |
| Rangkaian uji baru tests/amAdapter.test.js (21 kasus: struktur scene, kontur terpusat, multi-subpath cincin, warna, ID, determinisme, escape, input invalid, validator valid/tidak-valid, id duplikat, endTime>totalTime, kontur kosong, integrasi exportManager 3 kasus) | Lulus 21/21 |
| Contoh keluaran XML (mask cincin 12×12) ditinjau manual terhadap dokumentasi format | Sesuai: atribut scene lengkap, satu shape imported, kontur gabungan luar+lubang terpusat, fillColor #FF3B82F6 |
| Struktural index.html v0.4.0: 41/41 ID DOM wajib ada (termasuk export-format dan studio-workspace), tag seimbang, 2 kemunculan v0.4.0, teks jujur (badge-pending hanya untuk batas yang benar-benar belum) | Lulus |
| Harness NB-1 (navigasi) dijalankan ulang setelah perubahan | Tidak terdampak: pages.js tidak disentuh pada unit ini |

Dua asersi uji lama yang diperbarui (bukan dihapus): (a) kasus 17 "requestXmlExport … gagal jujur di adapter XML" menjadi "menghasilkan XML statis yang lulus validasi lokal" — karena fitur kini nyata, kegagalan jujur AM-1 tidak lagi menjadi perilaku yang benar; (b) kasus 18 statusStrip kini memeriksa ketersediaan beserta catatan batas. Kasus tanpa gambar dan siluet kosong tetap gagal jujur dan tetap lulus.

### 10.6 Keterbatasan

- Tidak ada uji impor nyata di aplikasi Alight Motion (TS-1): seluruh kesesuaian format didasarkan pada dokumentasi komunitas; kompatibilitas TIDAK diklaim.
- Unduhan berkas (Blob, createObjectURL, anchor) dan alur tombol ekspor di peramban belum dapat diuji di sandbox; wajib diverifikasi manual di Chrome/Android.
- Asumsi penempatan kontur terpusat belum terverifikasi (lihat 10.3 butir 2).
- Validator memeriksa struktur, bukan semantik penuh format Alight Motion (misalnya validitas nilai easing atau efek tidak diperiksa karena di luar keluaran adapter).

### 10.7 Traceability

| Backlog / Kebutuhan | Kewajiban | Bukti | Status |
|---------------------|-----------|-------|--------|
| AM-1 | Adapter XML Alight Motion | js/modules/amAdapter.js; uji 21/21 (10.5) | Selesai (statis; tanpa klaim kompatibilitas) |
| XV-1 | Validasi XML sebelum unduhan | js/modules/xmlValidation.js; uji validator 10.5 | Selesai |
| EX-1 | Unduh .xml | js/ui/exportPanel.js + exportManager.js; uji integrasi 10.5 | Selesai (unduhan peramban wajib diverifikasi manual) |
| RF-10 | Adapter XML Alight Motion | 10.2–10.5 | Diimplementasikan |
| RF-11 | Validasi XML | 10.2–10.5 | Diimplementasikan |
| RF-12 | Ekspor XML | 10.2–10.5 | Diimplementasikan |
| AC-05 | Tidak ada klaim ekspor XML valid tanpa bukti | Badge dan pesan menyatakan "validasi lokal" dan "kompatibilitas belum diuji"; klaim kompatibilitas ditunda hingga TS-1 | Terpenuhi |
| AN-1 | Keyframe preset | Tidak dikerjakan — prasyarat TS-1 (lihat 10.1) | Tetap backlog |
| TS-1 | Uji impor nyata | Tidak dapat dijalankan di lingkungan ini | Tetap backlog |

## 11. Implementasi AM-2 + XV-2 (v0.4.1): perbaikan kegagalan impor XML

### 11.1 Bukti kegagalan

Pengguna melaporkan Alight Motion (Android) menolak berkas XML hasil ekspor v0.4.0 dengan pesan persis: "Gagal mengunggah. Formatnya tidak benar atau file rusak." Berkas yang ditolak (533 byte, direkonstruksi dari kode v0.4.0 yang berjalan) tidak memiliki empat hal: prolog XML; atribut scene precompose; atribut scene retime dan retimeAdaptFPS; atribut mediaFillMode pada elemen shape. Validator v0.4.0 (XV-1) meluluskannya karena hanya memeriksa atribut wajib versi dokumentasi komunitas — bukti bahwa validasi sintaks saja tidak cukup membuktikan kompatibilitas.

### 11.2 Pembanding berbukti

Tiga ekspor asli Alight Motion diperiksa langsung melalui GitHub: afrizz19/LyricsMusicAM (base.xml, AM 5.0.272.1028383), andikachan/alight-web-editor (preset/Proyek Baru 1.xml, AM 5.0.273.1028425), dan Rahmadfirdiansyah/Alight-motion (XML/Gambling.xml, AM 5.0.260). Ketiganya konsisten: dokumen diawali deklarasi prolog; scene memuat precompose="dynamicResolution", retime="freeze", retimeAdaptFPS="false" (scene bersarang memakai retime="off"); setiap elemen memuat mediaFillMode="fill". Dokumentasi komunitas alight-motion-docs menyatakan mediaFillMode selalu ditulis (always written). Tidak ada atribut atau struktur lain yang ditambahkan berdasarkan dugaan.

### 11.3 Perbaikan (hanya penyebab yang didukung bukti)

js/modules/amAdapter.js (AM-2): prolog XML ditulis di awal dokumen; atribut precompose="dynamicResolution" pada scene sebelum bgcolor; atribut retime="freeze" dan retimeAdaptFPS="false" setelah amplatform; atribut mediaFillMode="fill" pada shape. Urutan atribut mengikuti ekspor asli. Geometri kontur, transform, fillColor, alokasi ID, dan opsi adapter tidak berubah.

### 11.4 Fixture regresi dan pengetatan validator

- tests/amImportFixture.test.js (baru, 5 kasus): keluaran v0.4.0 yang gagal diimpor kini DITOLAK validator (isu prolog, precompose, retime, mediaFillMode) sehingga pola gagal tidak dapat terunduh lagi; fixture kutipan ekspor asli Alight Motion 5.0.273 LULUS validasi; keluaran adapter v0.4.1 mengikuti pola struktural ekspor asli; atribut scene konstan (amver, ffver, am, amplatform, fps, precompose, retime, retimeAdaptFPS) bernilai sama dengan ekspor asli; requestXmlExport menghasilkan keluaran berpola dan lulus validasi.
- js/modules/xmlValidation.js (XV-2): menolak dokumen tanpa prolog; mensyaratkan atribut pola ekspor asli pada scene; mensyaratkan mediaFillMode pada setiap elemen; pesan isu menyebut atribut yang hilang.
- js/ui/statusStrip.js dan js/ui/exportPanel.js: catatan serta pesan sukses diperbarui menjadi "impor nyata belum terbukti (TS-1)" dan meminta pengguna melaporkan pesan kesalahan bila impor gagal.
- tests/amAdapter.test.js dan tests/vectorEngine.test.js: aseri diperbarui (bukan dihapus) sesuai perilaku baru; tests/index.html menjalankan ketiga suite (18 + 21 + 5 kasus).

### 11.5 Hasil verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Rangkaian uji vektorisasi (regresi) | Lulus 18/18 |
| Rangkaian uji adapter/validasi/ekspor (aseri diperbarui) | Lulus 21/21 |
| Rangkaian uji regresi impor baru (fixture) | Lulus 5/5 |
| Kompilasi sintaks modul dan suite uji | Lulus |
| Total | 44/44 lulus |

### 11.6 Keterbatasan

- Impor nyata v0.4.1 ke Alight Motion pada perangkat nyata BELUM diuji ulang; tidak ada klaim kompatibilitas. Hasil validasi otomatis dipisahkan dari hasil impor nyata (TS-1).
- Unduhan berkas di peramban (Blob, createObjectURL, anchor) tetap tidak dapat diuji di sandbox dan wajib diverifikasi manual.
- Asumsi penempatan kontur terpusat relatif terhadap transform.location tetap belum terverifikasi (lihat 10.3 butir 2); bila uji impor nyata v0.4.1 masih gagal, penyebab berikutnya harus ditelusuri dari pesan kesalahan aktual, bukan dugaan.
- Pembanding mewakili Alight Motion 5.0.260-5.0.273 di Android; versi lain belum diperiksa.

### 11.7 Traceability

| Backlog / Kebutuhan | Kewajiban | Bukti | Status |
|---------------------|-----------|-------|--------|
| AM-2 | Struktur XML mengikuti pola ekspor asli | amAdapter.js v0.4.1; fixture 11.4 | Selesai (struktural; impor nyata belum terbukti) |
| XV-2 | Validator menolak pola gagal; fixture regresi | xmlValidation.js; tests/amImportFixture.test.js 5/5 | Selesai |
| RF-10 | Adapter XML Alight Motion | 11.3 | Diimplementasikan (AM-1 + AM-2) |
| RF-11 | Validasi XML | 11.4 | Diimplementasikan (XV-1 + XV-2) |
| AC-05 | Tidak ada klaim ekspor XML valid tanpa bukti | Validasi otomatis dipisahkan dari impor nyata; antarmuka menyatakan impor nyata belum terbukti (TS-1) | Terpenuhi |
| TS-1 | Uji impor nyata | v0.4.0 gagal diimpor di lapangan; v0.4.1 wajib diuji ulang di perangkat nyata | Tetap backlog |


## 12. Implementasi AM-3 + XV-3 (v0.4.2): perbaikan impor berhasil namun kanvas kosong

### 12.1 Bukti masalah

Bukti lapangan pengguna: berkas XML hasil v0.4.1 BERHASIL diimpor ke Alight Motion 5.0.273 (Android), namun preset menampilkan kanvas kosong — bentuk vector yang diharapkan tidak tampak. Keberhasilan impor tidak dianggap bukti bahwa objek shape berhasil dibuat.

### 12.2 Bukti akar masalah (tiga sumber independen)

1. Dekompilasi APK Alight Motion (boiniArun2006/am-xml, jadx-src, ShapeElementTypeImpl.java, AM 5.0.273): `unserializeElement` membaca outline shape imported HANYA dari anak shape bernama `path` (konstanta `JavetError.PARAMETER_PATH` yang terverifikasi bernilai `"path"`); tag lain yang tidak dikenal diabaikan tanpa kesalahan. Konsekuensi: outline pada `<parameter><contour d/></parameter>` (struktur v0.4.1, mengikuti dokumentasi komunitas) TIDAK pernah dibaca — shape dibuat tanpa outline sehingga kanvas tampak kosong meski impor berhasil.
2. Serializer asli (CubicBSplineKt.toSVGPath pada CompoundCubicBSpline): outline non-keyed ditulis sebagai `startTag("path")` + `attribute("d", ...)` langsung di bawah shape setelah common child tags; per kontur polanya `"M x y"` + `"L x y"` per knot + pengulangan knot pertama sebelum penutup `"Z"`; antar kontur digabung `joinToString` dengan separator kosong sehingga pola `"Z" + "M"` menjadi token `"ZM"` yang didukung parser (hashCode khusus). Parser mendukung perintah M, L, C, Z/z, dan ZM; angka integer maupun pecahan diterima.
3. Ekspor asli nyata yang terbukti menampilkan shape (andikachan/alight-web-editor, preset/Proyek Baru 19.xml, AM 5.0.273.1028425): `<path d="M -360.0 -640.0L 360.0 -640.0L 360.0 640.0L -360.0 640.0L -360.0 -640.0Z" />` — anak langsung `<shape>` tanpa template `s`, setelah fillColor; koordinat lokal terpusat (0,0) dengan `transform.location` menempatkan bentuk di kanvas.

Koreksi bukti: dokumentasi komunitas kuchingneko28/alight-motion-docs (authoring.md) menulis outline pada `<parameter><contour d>` — TERBUKTI KELIRU terhadap kode asli dan ekspor asli; kode dekompilasi dan ekspor asli diberi bobot lebih tinggi. Bukti v0.4.1 (geometri terpusat pada transform.location) tetap konsisten dengan ekspor asli dan tidak diubah.

### 12.3 Penelusuran pipeline (tahap wajib 2, dijalankan sebelum perbaikan)

Lingkaran uji 20×20 (r=8, mode gelap, ambang 50, penyederhanaan sedang): mask 197 piksel; 1 kontur (outer) 8 titik, luas 205, bbox (2,2)–(19,19); 1 objek shape; kontur terkirim utuh ke XML (tidak kosong, tidak terpotong). Cincin uji 21×21 (r 6–10): 2 kontur (outer 8 titik luas 317 bbox (0,0)–(21,21); hole 8 titik luas 113 bbox (5,5)–(16,16), di dalam bbox outer); 1 objek shape; kedua kontur digabung dalam satu atribut d dengan token ZM. Kesimpulan: kontur selalu sampai XML — masalah v0.4.1 murni struktur tag, bukan geometri.

### 12.4 Perbaikan (hanya penyebab berbasis bukti)

- js/modules/amAdapter.js (AM-3): outline kini ditulis sebagai `<path d="..."/>` (anak langsung shape, setelah fillColor) menggantikan `<parameter><contour/></parameter>`; format d meniru serializer asli persis (`M x y` + `L x y` per titik + pengulangan titik awal + `Z`; antar kontur digabung tanpa separator → token ZM; koordinat = titik − (width/2, height/2)). Kontur vectorEngine berupa cincin titik tanpa duplikat penutup (traceLoop membuang titik terakhir), sehingga pengulangan titik awal oleh adapter menghasilkan pola yang identik dengan toSVGPath. Atribut scene, shape, transform, fillColor, mediaFillMode, dan alokasi ID tidak berubah.
- js/modules/xmlValidation.js (XV-3): shape tanpa template `s` wajib memiliki anak `path` dengan atribut `d` non-kosong, atau `path` berisi anak `contour`/`knot` (bentuk keyed pada ekspor asli); pesan isu menyebut tag `path` dan struktur parameter/contour yang tidak dibaca parser. Shape template (`s`, misalnya `.rect`) dibebaskan dari syarat outline — ekspor asli Proyek Baru 1.xml hanya berisi shape template dan tetap tampil normal. Validasi tetap berjalan sebelum unduhan di exportManager (tidak diubah).

### 12.5 Regresi dan hasil verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

tests/amImportFixture.test.js diperluas menjadi 9 kasus: (1) keluaran v0.4.0 tetap DITOLAK (isu prolog/precompose/retime/mediaFillMode); (2) fixture ekspor asli Proyek Baru 1.xml LULUS; (3) BARU: rekonstruksi keluaran v0.4.1 (terimpor namun kosong) DITOLAK dengan tepat satu isu yang menyebut tag path dan struktur parameter/contour; (4) BARU: fixture utuh ekspor asli Proyek Baru 19.xml (shape imported dengan path d nyata) LULUS; (5) keluaran adapter v0.4.2 mengikuti pola struktural ekspor asli (outline pada tag path, tanpa parameter/contour); (6) atribut scene konstan sama dengan ekspor asli; (7) requestXmlExport menghasilkan keluaran berpola dengan outline path; (8) BARU: regresi geometri lingkaran — tepat satu shape, satu tag path, d nonkosong, jumlah subpath == jumlah kontur vektorisasi, setiap subpath ditutup Z, jumlah pasangan == jumlah titik + pengulangan titik awal, semua koordinat dalam rentang terpusat, pasangan koordinat identik kontur tergeser, bbox d == bbox kontur tergeser, luas kontur masuk akal; (9) BARU: regresi geometri cincin — dua subpath pada satu tag path, keduanya tertutup, bbox lubang di dalam bbox kontur luar.

Hasil uji otomatis (dijalankan di sandbox sebelum push): VE 18/18, AM 21/21 (termasuk aseri baru: outline pada tag path, token ZM, satu tag path untuk multi-kontur, penolakan `<path d=""/>`), fixture 9/9 — total 48/48 lulus. Kompilasi sintaks (new Function) lulus untuk amAdapter.js, xmlValidation.js, exportPanel.js, statusStrip.js, dan seluruh berkas uji. Contoh keluaran terverifikasi: `<path d="M -8 0L -6 6L 0 9L 6 7L 9 1L 7 -5L 1 -8L -5 -6L -8 0Z"/>`.

### 12.6 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Impor nyata v0.4.2 ke Alight Motion pada perangkat nyata BELUM diuji; khususnya belum ada bukti visual bahwa shape tampil di kanvas. Tidak ada klaim kompatibilitas. Hasil validasi otomatis dipisahkan dari hasil impor nyata (TS-1 tetap backlog).
- Kriteria penerimaan visual (bentuk, posisi, skala, warna masuk akal; multi-kontur dan lubang tampil benar) hanya dapat diverifikasi oleh uji perangkat nyata; lingkungan pengerjaan tidak memiliki perangkat Android.
- Unduhan Blob/anchor dan runtime peramban tidak teruji di sandbox; uji dijalankan pada modul murni tanpa DOM.
- Asumsi penempatan kontur terpusat relatif terhadap transform.location tetap berbasis bukti tidak langsung (kini diperkuat ekspor asli Proyek Baru 19.xml: rect 720×1280 digambar dari (−360,−640) hingga (360,640) terpusat (0,0)); bila uji nyata menunjukkan offset berbeda, perbaikan bersifat lokal pada amAdapter.
- Bila uji ulang v0.4.2 masih gagal atau kanvas tetap kosong, telusuri dari pesan kesalahan dan hasil visual aktual — jangan menambah atribut tanpa pembanding baru.

### 12.7 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| AM-3 | Outline pada tag path sesuai parser asli | amAdapter.js v0.4.2; dekompilasi ShapeElementTypeImpl + CubicBSplineKt; ekspor asli Proyek Baru 19.xml (fixture 12.5) | Selesai (struktural; tampilan pada perangkat nyata belum terbukti) |
| XV-3 | Validator mensyaratkan outline path; regresi geometri | xmlValidation.js; tests/amImportFixture.test.js 9/9 | Selesai |
| RF-10 | Adapter XML Alight Motion | 12.4 | Diimplementasikan (AM-1 + AM-2 + AM-3) |
| RF-11 | Validasi XML | 12.4 | Diimplementasikan (XV-1 + XV-2 + XV-3) |
| AC-05 | Tidak ada klaim ekspor XML valid tanpa bukti | Validasi otomatis dipisahkan dari impor nyata; antarmuka menyatakan tampilan shape belum terbukti (TS-1) | Terpenuhi |
| AN-1 | Keyframe preset | Tidak dikerjakan — shape statis harus terbukti tampil lebih dulu (TS-1) | Tetap backlog |
| TS-1 | Uji impor nyata + verifikasi visual | v0.4.0 gagal diimpor; v0.4.1 terimpor namun kosong; v0.4.2 menunggu uji ulang di perangkat nyata | Tetap backlog |

## 13. Implementasi P1 (v0.4.3): performa pratinjau siluet dan vektorisasi

### 13.1 Bukti masalah dan audit awal

Pengguna melaporkan pratinjau siluet dan hasil vektor sangat lambat. Audit dijalankan sebelum mengubah kode: HEAD diverifikasi `1702f3d` (v0.4.2, perbaikan AM-3/XV-3 — dipertahankan utuh, tidak ada perubahan pada amAdapter.js, xmlValidation.js, dan exportManager.js). Pipeline ditelusuri dari sumber: unggah (imageImport, normalisasi maks 1400 px) → computeSilhouetteMask (getImageData + loop luminansi) → vectorizeSilhouette (marching squares pada crack boundary + RDP) → render raster (putImageData) dan SVG (innerHTML). Cache pratinjau per gambar/mode/ambang/warna/penyederhanaan sudah ada sebelumnya; sumber kelambatan dicari dengan pengukuran per tahap, bukan asumsi.

### 13.2 Metode pengukuran dan keterbatasannya

Lingkungan pengerjaan (sandbox tanpa peramban) terverifikasi tidak menyediakan waktu wall-clock yang bergerak selama komputasi (performance.now()/Date.now() menghasilkan waktu logis yang tidak bertambah), dan tidak memiliki perangkat Android; benchmark waktu nyata karenanya tidak mungkin. Mekanisme benchmark yang dipakai: penghitungan operasi deterministik per tahap (jumlah evaluasi piksel mask, panggilan closure, operasi hash Set, operasi bit). Angka op-count adalah bukti kuantitatif perbaikan algoritmik, namun bukan pengganti pengukuran waktu pada perangkat nyata (lihat 13.6).

### 13.3 Hasil pengukuran (bottleneck terukur, gambar sintetis, mode gelap, ambang 50, penyederhanaan sedang)

Gambar 1400×1400 (1,96 juta piksel; 4482 subpath, 4481 komponen, 18.067 titik, ~25% piksel dalam):

- Mesin lama selama pemindaian: 3.994.096 panggilan closure isInside + 23.708 Set.has + 23.708 Set.add (47.416 operasi hash pada kunci numerik edgeKey).
- Pasca-proses (mergeCollinear 28.193, RDP 26.113 operasi) kecil dibanding pemindaian → bukan bottleneck. Bottleneck = pemindaian area penuh (closure per piksel) + operasi hash Set pada tabel tepi terlacak.
- Gambar 720×960: 1.415.128 isInside + 20.120 operasi Set-hash. Gambar 240×320: 160.192 isInside + 3.704 Set-hash. Pola konsisten antar ukuran.

### 13.4 Optimasi terarah (perubahan minimal, keluaran geometri identik)

1. js/modules/vectorEngine.js — tabel tepi terlacak diganti: Set dengan kunci numerik edgeKey → Uint8Array berbit per arah ((width+1)×(height+1) byte; bit 0-3 menandai arah yang sudah dilalui pada tiap sudut grid). Sandungan (x, y, dir) → byte bijektif terhadap kunci lama sehingga urutan, peran, dan geometri kontur identik. Pemindaian membaca empat tetangga langsung dari mask (tanpa panggilan closure per piksel; hasil terukur: 3.935.090 pembacaan langsung + hanya 58.992 panggilan closure tersisa pada traceLoop; 0 operasi Set — 23.708 uji bit + 23.708 set bit). traceLoop, nextDir, dan hasOutgoing tidak diubah.
2. js/modules/silhouette.js — inti perhitungan dipisah menjadi fungsi murni computeSilhouetteMaskFromPixels(pixels, width, height, mode, threshold) (validasi + loop luminansi; mode di-hoist keluar loop); computeSilhouetteMask tidak berubah perilakunya dan tetap menjadi jalur resolusi penuh untuk ekspor. Pembantu baru computePreviewDimensions + PREVIEW_MAX_DIMENSION = 700: dimensi kerja pratinjau dengan rasio aspek terjaga, tidak pernah memperbesar gambar kecil, dan bukan batas resolusi ekspor.
3. js/ui/previewPanel.js — mask pratinjau dihitung pada resolusi kerja pratinjau melalui kanvas luar layar yang dipakai ulang (drawImage menurunkan resolusi → mask dari pikselnya). Gambar 1400×1400 → 700×700: 490.000 evaluasi piksel (4× lebih sedikit dari 1,96 juta); 720×960 → 525×700: 367.500 evaluasi. Debounce penghitungan mask dinaikkan 30 → 150 ms (konstanta MASK_COMPUTE_DEBOUNCE_MS) agar geser slider ambang pada perangkat lambat tidak mengantrekan penghitungan berat berulang; debounce vektor tetap 30 ms. State selalu dibaca ulang saat eksekusi sehingga pekerjaan terjadwal dengan parameter basi otomatis digantikan parameter terkini (penggantian gambar/mode saat timer tertunda tidak memakai state lama). Cache per gambar/mode/ambang/warna/penyederhanaan dipertahankan. Tampilan tidak berubah: CSS sudah memakai object-fit contain pada kanvas siluet dan SVG vektor.
4. Web Worker dipertimbangkan dan ditolak: dengan resolusi kerja 700 px dan mesin teroptimasi, beban penghitungan pratinjau kembali dalam batas interaktif (op-count kecil); worker menambah kompleksitas arsitektur (berkas terpisah, transfer state, penjadwalan ulang) yang bertentangan dengan batasan proyek (tanpa dependensi berat, perubahan minimal) tanpa bukti kebutuhan.
5. Ekspor tidak diubah: exportManager tetap memhitung mask dari kanvas ternormalisasi resolusi penuh; resolusi pratinjau tidak otomatis menjadi batas resolusi ekspor. Statistik vektor pada panel mengikuti geometri pratinjau — dicatat sebagai catatan disengaja (13.6).

### 13.5 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Rangkaian uji mesin vektorisasi (18 kasus, tidak berubah) | Lulus 18/18 |
| Rangkaian uji adapter/validasi/ekspor (21 kasus, tidak berubah) | Lulus 21/21 |
| Rangkaian uji regresi impor/fixture (9 kasus, tidak berubah) | Lulus 9/9 |
| Suite baru pembantu pratinjau P1 (5 kasus: dimensi kerja tanpa pembesaran/limit, penolakan masukan tidak valid, ekuivalensi inti murni vs jalur kanvas termasuk piksel transparan dan kedua mode, penolakan data piksel tidak sesuai) | Lulus 5/5 |
| Total rangkaian uji (tests/index.html menjalankan empat suite) | 53/53 lulus |
| Baterai kesetaraan mesin lama (1702f3d) vs mesin baru: 22 mask (kasus uji, 8 mask acak deterministik, menabrak bingkai, kanvas penuh, garis 1 px, pulau-dalam-lubang, kosong, sintetis 120/240 berlubang dan penuh) × 3 tingkat penyederhanaan = 66 perbandingan; SVG dan JSON subpath (peran, urutan, titik, luas) identik | 66/66 identik, 0 ketidakcocokan (4.387 subpath pada tingkat sedang) |
| Regresi jalur ekspor: amAdapter.js, xmlValidation.js, exportManager.js byte-identik dengan 1702f3d; seluruh uji ekspor lulus tanpa perubahan aseri | Lulus |
| Kompilasi previewPanel.js (salinan tanpa awalan import/export; berkas asli tetap modul ES) | Lulus |

### 13.6 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Tidak ada pengukuran waktu wall-clock: lingkungan pengerjaan tidak menyediakan jam berjalan selama komputasi dan tidak memiliki perangkat Android nyata. Perbaikan dibuktikan dengan penurunan op-count deterministik dan kesetaraan keluaran, bukan detik. Responsivitas nyata pada HP Android berspesifikasi rendah wajib diverifikasi manual (buka Studio, unggah gambar besar, geser ambang, amati debounce).
- previewPanel.js tidak diuji runtime (butuh DOM nyata: debounce setTimeout, kanvas luar layar, drawImage, innerHTML). Diverifikasi lewat peninjauan kode, uji pembantu murni, dan kompilasi; harness peramban tests/index.html juga wajib dijalankan ulang secara manual.
- Statistik vektor (jumlah komponen/kontur/titik) mengikuti geometri pratinjau, bukan resolusi ekspor penuh — perilaku disengaja agar statistik mencerminkan apa yang dilihat pengguna; tercantum di sini agar tidak disalahartikan sebagai regresi.
- Penghitungan pratinjau tetap sinkron pada utas utama; bila verifikasi perangkat nyata nanti menunjukkan jank, Web Worker menjadi kandidat berikutnya dengan bukti.
- TS-1 (uji impor nyata) dan AN-1 (keyframe) tetap backlog; perubahan ini tidak menyentuh keduanya.

### 13.7 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| PF-1 | Performa pratinjau siluet dan vektorisasi | 13.3–13.5: op-count turun (0 operasi Set, 4× lebih sedikit piksel pratinjau), 66/66 keluaran identik, 53/53 uji lulus | Selesai (bukti op-count; waktu perangkat nyata belum diukur) |
| RF-05 | Pratinjau siluet raster responsif | 13.4 butir 2-3 | Diimplementasikan (verifikasi perangkat nyata wajib) |
| RF-09 | Mesin vektorisasi tanpa regresi keluaran | Baterai kesetaraan 66/66 (13.5) | Terpenuhi |
| NFR-01 | Responsif untuk HP Android | Op-count pratinjau menurun orde magnitudo pada gambar besar; uji perangkat nyata belum tersedia | Terlayani sebagian |
| TS-2 | Uji otomatis ringan | 53 uji murni termasuk 5 unit pratinjau P1 baru | Terlayani sebagian |

## 14. Implementasi AM-4 (v0.4.4): pemisah layer — satu shape per komponen siluet

### 14.1 Bukti lapangan dan masalah satu layer

Pengguna menguji ekspor v0.4.3 pada Alight Motion 5.0.273 (Android, tangkapan layar 2026-10-17) dan melaporkan hasil "sudah hampir sempurna": dua region siluet biru terpisah tampil di kanvas dengan titik sunting masing-masing — bukti lapangan bahwa TS-1 untuk bentuk statis terpenuhi (impor berhasil, shape tampil, geometri terbaca). Namun timeline hanya menampilkan SATU layer "Shape 1": adapter v0.4.2/v0.4.3 menulis seluruh kontur (semua komponen) ke dalam satu elemen shape dengan satu transform.location di pusat kanvas, sehingga bagian-bagian siluet tidak dapat dipilih atau dianimasikan terpisah di Alight Motion. Pengguna meminta pemisah layer per bagian.

### 14.2 Keputusan desain (perubahan terkecil pada adapter saja)

1. Satu komponen siluet = satu elemen `<shape>` = satu layer Alight Motion (id 1..n, label "Shape 1".."Shape n"). Urutan komponen mengikuti urutan kontur luar pada subpaths (urutan pindai mesin vektorisasi, deterministik).
2. Lubang tetap bergabung dengan kontur luarnya dalam satu atribut d (token "ZM", pola serializer asli AM-3) pada layer yang sama; pulau di dalam lubang menjadi komponen (dan layer) tersendiri. Alasan: memisahkan lubang ke layer sendiri akan mengubah tampilan isi (fill) siluet; even-odd fill pada satu layer mempertahankan tampilan identik dengan pratinjau SVG.
3. Pengelompokan: lubang dimiliki kontur luar TERKECIL yang memuat titik pertama lubang (ray casting dengan aturan paritas). Titik pertama lubang berada pada pita terisi antara lubang dan kontur luarnya serta di luar pulau apa pun di dalam lubang, sehingga aturan "terkecil yang memuat" tidak pernah memilih pulau sebagai pemilik. Fallback pertahanan: kontainmen bbox (bila RDP menggeser titik keluar cincin). Bila keduanya gagal, Error eksplisit dilempar — tidak pernah ada penyerahan lubang secara diam-diam.
4. Pivot per layer: transform.location = pusat bbox kontur luar komponen; kontur digeser ke pivot itu (pathD memakai offset pivot). Posisi visual keseluruhan tidak berubah (verifikasi regresi geometri), namun tiap bagian kini dapat diputar/diskalakan pada pusatnya sendiri di Alight Motion. Ini menggantikan pusat kanvas global v0.4.2/v0.4.3.
5. Berkas lain tidak berubah: xmlValidation.js sudah mendukung multi-shape (ID unik lintas elemen dan outline path per shape sejak XV-3); exportManager.js, vectorEngine.js, silhouette.js, previewPanel.js tidak disentuh. statusStrip.js dan exportPanel.js hanya diperbarui teks kejujurannya (TS-1 terbukti; pemisah layer).

### 14.3 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Rangkaian uji mesin vektorisasi (18 kasus, tidak berubah) + suite pembantu pratinjau P1 (5 kasus, tidak berubah; hanya aseri catatan statusStrip ekspor diperbarui sesuai bukti lapangan) | Lulus 23/23 |
| Rangkaian uji adapter/validasi/ekspor: 21 kasus lama tidak berubah + 3 kasus AM-4 baru (regresi satu komponen; dua komponen menjadi dua shape dengan pivot masing-masing dan lubang tetap di layer A; pulau-dalam-lubang menjadi layer tersendiri) | Lulus 24/24 |
| Rangkaian uji regresi impor/fixture: 7 kasus struktural tidak berubah + uji geometri lingkaran diperbarui ke kontrak pivot bbox (location = pusat bbox kontur luar, pasangan == titik - pivot, bbox d == bbox kontur tergeser) + 2 kasus geometri multi-layer baru (dua disk → dua layer ber-id unik, total pasangan == titik + 1 per kontur; cincin+pulau → dua layer, lubang di layer cincin, bbox pulau di dalam bbox lubang) | Lulus 11/11 |
| Total rangkaian uji (tests/index.html menjalankan empat suite) | 58/58 lulus |
| Regresi jalur inti: vectorEngine.js, silhouette.js, xmlValidation.js, exportManager.js, previewPanel.js tidak berubah dari v0.4.3 | Lulus |
| Kompilasi statusStrip.js dan exportPanel.js (salinan tanpa awalan import/export; berkas asli tetap modul ES; sandbox tanpa DOM) | Lulus |

### 14.4 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Keluaran multi-layer AM-4 BELUM diuji di perangkat nyata. Bukti lapangan hanya membuktikan shape tunggal tampil; klaim "tiap komponen muncul sebagai layer tersendiri" menunggu uji impor lanjutan oleh pengguna.
- Gambar kompleks dapat menghasilkan ribuan komponen → ribuan layer shape pada timeline Alight Motion; jumlah layer besar belum diuji dampaknya pada performa impor aplikasi.
- statusStrip.js dan exportPanel.js tidak diuji runtime (butuh DOM nyata); diverifikasi lewat peninjauan kode dan kompilasi. Harness tests/index.html wajib dijalankan ulang secara manual di peramban.
- Semantik pivot (kontur terpusat relatif transform.location) kini dipakai per komponen namun tetap merupakan asumsi berbasis ekspor asli (Proyek Baru 19.xml), bukan dokumentasi resmi.
- AN-1 (keyframe) tetap backlog; perubahan ini tidak menyentuhnya.

### 14.5 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| AM-4 | Pemisah layer per komponen | 14.2: satu shape per komponen, pivot bbox, grouping lubang; 58/58 uji termasuk 5 kasus AM-4/multi-layer | Selesai (uji lapangan multi-layer menunggu) |
| TS-1 | Uji impor nyata | Bukti lapangan 2026-10-17: v0.4.2/v0.4.3 diimpor dan shape tampil dengan titik sunting (AM 5.0.273 Android) | Terpenuhi untuk bentuk statis; sisa verifikasi multi-layer |
| RF-10 | Adapter XML | Satu layer per komponen dengan pivot per bbox | Diimplementasikan (v0.4.4) |
| RF-12 | Ekspor XML | Unduhan .xml multi-layer; pesan sukses ekspor menjelaskan pemisah layer | Diimplementasikan (v0.4.4) |
| TS-2 | Uji otomatis ringan | 58 uji murni termasuk 3 kasus AM-4 dan 2 regresi geometri multi-layer | Terlayani sebagian |

## 15. Implementasi VE-3 + CV-1 + AM-5 (v0.5.0): mode garis centerline dan warna asli per komponen

### 15.1 Bukti lapangan dan permintaan pengguna

Pengguna mengolah mentahan jersey berupa line art (goresan hitam ±2 piksel pada latar putih, analisis tangkapan layar 2026-10-17) dan melaporkan dua kebutuhan: (1) hasil mode isi merepresentasikan setiap goresan sebagai pita dengan dua tepi hampir sejajar sehingga pada tampilan sunting tiap garis visual tampak ganda — pengguna menginginkan "1 garis yang mungkin dilengkungkan"; (2) pengguna menginginkan hasil ekspor "1 banding 1 dengan aslinya dari warna maupun garis". Pengguna juga mengusulkan tombol "buka di Alight Motion" — ditolak karena Alight Motion tidak memublikasikan URL scheme/.intent publik untuk membuka berkas XML dari tautan; jalur tetap unduhan berkas lalu impor manual. Fitur yang diminta pengguna mengenai pemisah bagian (kerah, lengan, dada) dan pilihan dengan/tanpa keyframe: pemisah per komponen telah tersedia sejak AM-4 (v0.4.4); keyframe tetap backlog AN-1.

### 15.2 Keputusan desain

1. Dua mode disusun sebagai pilihan eksplisit pada panel ekspor, bukan penggantian perilaku lama: select `#export-representation` (isi/garis, default isi) dan `#export-color-mode` (pilihan/asli, default pilihan), disimpan pada state (`exportRepresentation`, `exportColorMode`).
2. Ekstraksi centerline (VE-3, modul baru js/modules/centerline.js): region mask per komponen (labelMaskRegions, flood fill 4-tetangga deterministik) dirapatkan pada crop bbox dengan bingkai nol; skeletonisasi Zhang-Suen dua fase; perunututan rantai dari ujung (derajat 1) dan simpang (derajat >= 3), loop murni derajat 2 dirunut tertutup; rantai < 3 piksel dibuang; titik pusat piksel dipakai (+0.5); RDP memakai simplifyPolyline (diekspor dari vectorEngine.js) dengan toleransi tingkat penyederhanaan yang sama dengan mode isi; lebar garis = luas region / panjang total skeleton (min 1).
3. Perbaikan perunututan berbasis bukti pengujian: tanpa penekanan tepi diagonal, sudut siku-siku hasil Zhang-Suen menghasilkan simpul semu derajat 3 sehingga bingkai persegi terpecah menjadi 7 rantai terbuka dan loop tertutup tidak pernah dikenali. Tepi diagonal yang dijembatani piksel 4-tetangga kini diabaikan (isConnected); setelah perbaikan bingkai 20x20 dan cincin digital 21x21 masing-masing diekstraksi sebagai SATU loop tertutup (diuji langsung).
4. Sampling warna asli (CV-1, modul baru js/modules/colorSampling.js): piksel sumber dibaca SEKALI (getCanvasPixelData) dan dipakai bersama oleh mask dan sampling; per komponen (region kontur luarnya), piksel dikelompokkan ke keranjang kuantisasi 16 tingkat per kanal (>>4), keranjang terbanyak dipilih (warna inti menang atas piksel tepi anti-aliasing), rata-rata tepat keranjang itu menjadi warna '#RRGGBB'. Untuk desain warna datar hasilnya identik dengan warna sumber (diuji: disk [230,25,35] → #E61923, disk [40,70,225] → #2846E1, pita [20,30,30] → #141E1E).
5. Adapter (AM-5): mode garis menulis satu shape (layer) per garis dengan urutan child transform, fillColor, path-stroke, path — meniru pola shape path stroke pada ekspor asli Proyek Baru 19.xml (`<path-stroke direction="centered" end-size="1.500000"><size value="..."/></path-stroke>`, path d TANPA penutup Z dengan pengulangan titik awal). Pivot = pusat bbox garis. fillColor per layer: componentColors hasil CV-1 bila mode warna asli, warna global bila mode pilihan; componentIndex garis merujuk indeks kontur luar komponen sehingga warna dan garis sepadan. Guard eksplisit: mode garis tanpa data garis atau dengan data kosong melempar/mengembalikan pesan "Tidak ada garis..." — tidak pernah ada keluaran kosong yang didiamkan.
6. Pipeline exportManager: baca piksel sekali → computeSilhouetteMaskFromPixels → vectorizeSilhouette → (mode asli) sampleComponentColors → (mode garis) extractCenterlines → buildAlightMotionXml → validateAlightMotionXml (validator XV tidak diubah; ia menerima child tag apa pun termasuk path-stroke dan mensyaratkan path d nonkosong + fillColor #AARRGGBB + mediaFillMode).

### 15.3 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Rangkaian uji mesin vektorisasi (18 kasus, tidak berubah) + pembantu pratinjau P1 (5 kasus, tidak berubah) | Lulus 23/23 |
| Suite ekstraksi centerline VE-3 baru (8 kasus: pelabelan dua disk dan cincin+pulau; pita lurus 3 px → satu garis terbuka dua titik x=4.5 lebar 3–4; cincin → satu loop tertutup; dua pita → componentIndex berbeda; simpang T → 3 segmen; blok padat 4x4 → kosong jujur; persegi padat 40x40 → tanpa kegagalan dengan struktur valid) | Lulus 8/8 |
| Rangkaian uji adapter/validasi/ekspor: 24 kasus lama tidak berubah + 4 kasus AM-5 (fillColor per layer mode isi; mode garis path-stroke + path tanpa Z + pivot + warna global; mode garis tanpa data → Error "Data garis"; componentColors salah panjang → Error) + 3 kasus EX baru (warna asli dua disk; mode garis pita dengan warna asli dan tebal 3.6; bercak padat → pesan "Tidak ada garis") | Lulus 31/31 |
| Rangkaian uji regresi impor/fixture (11 kasus, tidak berubah dari v0.4.4) | Lulus 11/11 |
| Total rangkaian uji (tests/index.html menjalankan lima suite termasuk runCenterlineTests baru) | 73/73 lulus |
| Perbaikan bug ditemukan uji: pemeriksaan Array.isArray menolak mask Uint8ClampedArray hasil pipeline pada labelMaskRegions/extractCenterlines/sampleComponentColors — diganti pemeriksaan panjang terketik; tanpa perbaikan ini seluruh jalur v0.5.0 gagal | Diperbaiki, 73/73 lulus setelahnya |
| Kompilasi seluruh modul yang diubah (amAdapter, exportManager, silhouette, centerline, colorSampling, statusStrip, exportPanel, state; salinan tanpa awalan import/export; sandbox tanpa DOM) | Lulus |
| Pemeriksaan index.html: id select baru tunggal, hero/footer v0.5.0, panel-note diperbarui | Lulus |

### 15.4 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Mode garis (VE-3/AM-5) BELUM diuji di perangkat nyata: pola path-stroke ditiru dari ekspor asli Proyek Baru 19.xml, namun semantik tebal dan warna stroke pada perangkat nyata belum terverifikasi. Pesan sukses ekspor mode garis secara eksplisit meminta pengguna memeriksa hasil impor.
- Tebal garis adalah perkiraan (luas region / panjang skeleton): tepat untuk pita tebal seragam, meleset pada goresan meruncing; ujung goresan menyusut maksimal ±1 piksel akibat penipisan; duri skeleton < 3 piksel dibuang; tebal per segmen pada simpang memakai rata-rata komponen.
- Warna asli (CV-1) mengambil warna dominan per komponen: identik untuk desain warna datar, hanya perkiraan untuk gradien/foto (satu fillColor per layer, bukan gradien); piksel transparan diabaikan.
- Cincin digital sangat tipis (dinding 1–2 piksel dengan ketebalan tidak seragam) masih dapat terpecah menjadi beberapa rantai di simpul asli; penekanan diagonal semu hanya menghilangkan simpul pada sudut siku, bukan simpul akibat ketebalan tidak seragam.
- Runtime DOM (exportPanel, pratinjau peramban, unduhan Blob) tidak teruji di sandbox; harness tests/index.html wajib dijalankan ulang secara manual di peramban.
- Keluaran multi-layer AM-4 tetap menunggu uji lapangan; AN-1 (keyframe) tetap backlog.

### 15.5 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| VE-3 | Ekstraksi centerline per goresan | 15.2 butir 2-3: Zhang-Suen + perunututan dengan penekanan diagonal semu; 15.3: 8/8 suite baru termasuk loop tertutup bingkai dan cincin | Selesai (uji lapangan mode garis menunggu) |
| CV-1 | Warna asli per komponen | 15.2 butir 4: keranjang kuantisasi + rata-rata tepat; 15.3: disk #E61923/#2846E1 dan pita #141E1E tersampling tepat | Selesai (uji lapangan menunggu) |
| AM-5 | Mode representasi isi/garis pada adapter | 15.2 butir 5: path-stroke + path tanpa Z + pivot bbox + fillColor per komponen; 31/31 uji AM/EX | Selesai (semantik path-stroke perangkat nyata belum terverifikasi) |
| RF-13 | Mode garis ekspor | 15.2 butir 2-3 dan 5; panel ekspor memaparkan mode | Diimplementasikan (v0.5.0) |
| RF-14 | Mode warna asli | 15.2 butir 4; select #export-color-mode tersambung state | Diimplementasikan (v0.5.0) |
| TS-1 | Uji impor nyata | Sisa: mode garis dan warna asli belum diuji di perangkat nyata | Terpenuhi untuk mode isi statis; sisa menunggu uji lapangan |
| TS-2 | Uji otomatis ringan | 73 uji murni termasuk 8 kasus centerline dan 7 kasus AM-5/EX baru | Terlayani sebagian |

## 16. Implementasi AM-6 + CV-2 (v0.5.1): mode kontur — satu layer per kontur

### 16.1 Bukti lapangan dan permintaan pengguna

Tangkapan layar pengguna 2026-10-17 (Alight Motion 5.0.273 Android, editor titik "Edit Points"): panel "Tambahkan Kontur" pada satu layer shape hasil impor v0.5.0 memuat "Kontur 1" hingga "Kontur 9" — line art jersey tersambung menjadi satu komponen, sehingga mode isi AM-4 menulis satu layer berisi satu kontur luar plus delapan lubang. Pengguna meminta kontur-kontur tersebut dipecah per layer: "kontur-kontur ini saya mau bagi menjadi per layer, jadi 1 layer itu 1 kontur". Mode "garis" (VE-3, v0.5.0) telah memberi satu layer per goresan untuk line art; permintaan ini berbeda — memecah menurut KONTUR (subpath), bukan menurut goresan atau komponen.

### 16.2 Keputusan desain

1. Representasi ketiga "kontur" (AM-6, amAdapter.js): setiap subpath VectorPathData — kontur luar ATAU lubang — ditulis sebagai elemen `<shape>` (satu layer Alight Motion) tersendiri: id/label berurutan 1..n, transform.location = pusat bounding box kontur tersebut (pivot per kontur), fillColor per layer, dan outline pathD tertutup Z yang digeser ke pivot kontur itu. Urutan layer mengikuti urutan subpaths hasil pindai mesin vektorisasi (kontur luar, lalu lubangnya, lalu pulau) sehingga lubang dan pulau berada setelah kontur luarnya pada daftar layer — asumsi urutan tumpukan layer Alight Motion yang belum diverifikasi pada perangkat nyata (dilaporkan sebagai keterbatasan dan diperiksa lewat pesan sukses yang meminta pengguna memverifikasi). Validator XV tidak diubah: path d non-kosong, fillColor #AARRGGBB, dan ID unik sudah disyaratkan per shape, jadi keluaran mode kontur tervalidasi jalur yang sama.
2. Warna asli per kontur (CV-2, colorSampling.js): fungsi baru sampleContourColors(maskData, pixelData, vectorPathData) mengembalikan '#RRGGBB' seurut urutan subpaths. Kontur luar memakai warna dominan region mask pemiliknya (mekanisme CV-1: findRegionLabel + keranjang kuantisasi). Kontur lubang memakai warna dominan piksel LATAR di dalam poligon lubang: piksel pada bbox kontur dengan mask 0 (pulau di dalam lubang tidak ikut karena mask-nya bukan 0) dan pusat piksel (x+0.5, y+0.5) berada di dalam cincin kontur lubang (uji ray casting, pola yang sama dengan amAdapter.pointInRing). Akumulasi keranjang direfaktor menjadi colorFromPixelIndices sehingga CV-1 dan CV-2 berbagi satu logika dominan; fallback #000000 dipertahankan untuk himpunan kosong; validasi input sama dengan sampleComponentColors.
3. Adapter (AM-5 → AM-6): resolveRepresentation menerima 'isi' | 'garis' | 'kontur' (nilai tak dikenal tetap ditolak); resolveContourColors meniru pola resolveComponentColors (panjang wajib sama dengan jumlah subpath, tiap warna lewat resolveFillColor); buildPerContourShapes meniru struktur buildFilledShapes (urutan child: transform, fillColor, path) sehingga mode isi dan mode kontur hanya berbeda pada pengelompokan — tanpa mengubah mode isi dan mode garis yang sudah ada.
4. Pipeline (exportManager.js): representasi dipetakan eksplisit dari state ('garis' | 'kontur' | lainnya → 'isi'); mode warna asli pada mode kontur menghasilkan exportOptions.contourColors (sampleContourColors), sedangkan mode isi/garis tetap memakai componentColors (sampleComponentColors). Pembacaan piksel tetap sekali; mask dan vektorisasi tidak berubah.
5. UI: opsi ketiga pada select #export-representation ("Kontur — satu layer per kontur (1 layer = 1 kontur)"); pesan sukses mode kontur menjelaskan bahwa lubang kini menjadi layer sendiri, memperingatkan bahwa warna pilihan membuat seluruh layer satu warna (tampilan menyatu — sarankan warna asli bila tiap layer ingin diwarnai area aslinya), dan meminta pengguna memeriksa hasil impor (mode belum teruji perangkat nyata); strip status dan tabel Tentang diperbarui tanpa menghapus asersi kata kunci lama (catatan adapter memuat "keyframe", catatan ekspor memuat "terbukti" dan "AN-1").

### 16.3 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Rangkaian uji mesin vektorisasi (18 kasus), pembantu pratinjau P1 (5 kasus), ekstraksi centerline VE-3 (8 kasus), regresi fixture impor (11 kasus) — tidak berubah | Lulus 42/42 |
| Rangkaian uji adapter/validasi/ekspor: 31 kasus v0.5.0 tidak berubah + 3 kasus AM-6 (mode kontur tiga subpath dua komponen → tiga shape dengan pivot 15/10, 15/12.5, 75/50, path masing-masing digeser ke pivotnya, tanpa token ZM, lulus validator; contourColors per layer plus salah panjang → Error; representation tak dikenal → Error) + 2 kasus EX (kanvas cincin+pulau 21x21 mode kontur + warna asli → tiga layer fillColor #FF14141E / #FFF0F0F0 / #FF14141E; mode kontur warna pilihan → seluruh layer #FF3B82F6) | Lulus 36/36 |
| Total rangkaian uji (tests/index.html menjalankan lima suite) | 78/78 lulus |
| Kompilasi seluruh modul yang diubah (amAdapter, colorSampling, exportManager, exportPanel, statusStrip, state; salinan tanpa awalan import/export; sandbox tanpa DOM) | Lulus |
| Pemeriksaan index.html: opsi ketiga pada #export-representation tunggal, hero/footer v0.5.1, panel-note dan tabel Tentang diperbarui | Lulus |

### 16.4 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Mode kontur (AM-6) BELUM diuji di perangkat nyata: satu layer per kontur dan urutan tumpukan layer lubang (lubang dirender setelah kontur luarnya pada daftar layer) mengikuti asumsi urutan elemen XML, belum diverifikasi di Alight Motion. Pesan sukses mode kontur secara eksplisit meminta pengguna memeriksa bahwa setiap kontur berada pada layer tersendiri.
- Warna kontur lubang (CV-2) mengambil warna dominan piksel latar di dalam lubang: identik untuk desain warna datar, hanya perkiraan untuk gradien/foto; lubang tanpa satu pun piksel latar layak (misalnya lubang sangat kecil atau tertutup pulau) menghasilkan warna cadangan #000000; piksel transparan diabaikan.
- Dengan mode warna pilihan, seluruh layer kontur memakai satu warna global sehingga tampilan menyatu (lubang tidak terlihat sebagai lubang) — perilaku ini dijelaskan pada pesan sukses dan didukung rekomendasi memakai warna asli.
- Runtime DOM (exportPanel, pratinjau peramban, unduhan Blob) tidak teruji di sandbox; harness tests/index.html wajib dijalankan ulang secara manual di peramban.
- Keluaran multi-layer AM-4, mode garis VE-3, dan warna asli CV-1 tetap menunggu uji lapangan; AN-1 (keyframe) tetap backlog.

### 16.5 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| AM-6 | Mode kontur: satu layer per kontur (termasuk lubang) | 16.2 butir 1 dan 3: buildPerContourShapes + pivot per bbox kontur; 16.3: 36/36 uji AM/EX termasuk 3 kasus AM-6 | Selesai (urutan tumpukan layer pada perangkat nyata belum terverifikasi) |
| CV-2 | Warna asli per kontur | 16.2 butir 2: sampleContourColors dengan ray casting piksel latar lubang; 16.3: cincin+pulau → #14141E / #F0F0F0 / #14141E | Selesai (uji lapangan menunggu) |
| RF-15 | Mode kontur pada panel ekspor | 16.2 butir 5: opsi ketiga #export-representation + pesan sukses khusus; 16.3: 78/78 | Diimplementasikan (v0.5.1) |
| TS-1 | Uji impor nyata | Sisa: mode kontur (tiap kontur sebagai layer tersendiri, urutan tumpukan lubang) belum diuji di perangkat nyata | Terpenuhi untuk mode isi statis; sisa menunggu uji lapangan |
| TS-2 | Uji otomatis ringan | 78 uji murni termasuk 3 kasus AM-6 dan 2 kasus EX mode kontur | Terlayani sebagian |

## 17. Implementasi IPR-1: parser teks XML proyek Alight Motion (fondasi Instant Preset Remixer)

### 17.1 Konteks dan cakupan

Prioritas produk adalah Instant Preset Remixer (IPR): pengguna memasukkan preset/proyek Alight Motion, sistem mendeteksi slot aset, pengguna mengganti aset terpilih, aset lain dipertahankan, hasil divalidasi dan diekspor. IPR-1 hanya mencakup fondasi pembacaan: modul baru js/modules/presetParser.js (murni, tanpa DOM, tanpa dependensi baru) beserta tests/presetParser.test.js (18 kasus) dan pendaftarannya pada tests/index.html. Modul mengekspor parseXmlTree(text) dan parseAlightMotionProject(text). Tidak ada perubahan pada modul ekspor, vektorisasi, validasi ekspor, maupun UI; kartu Instant Preset Remixer pada beranda tetap berlabel "Dalam pengembangan".

### 17.2 Keputusan desain

1. Parser node teks tulisan tangan (bukan DOMParser) agar dapat diuji tanpa peramban dan berperilaku identik di semua lingkungan; menangani prolog, komentar, tag self-closing, atribut berkutip ganda/tunggal (termasuk nilai yang memuat karakter > atau /), CRLF, serta kesalahan struktural yang dilaporkan dengan nama tag dan posisi.
2. parseAlightMotionProject memetakan scene, media, layer shape (urutan dokumen dipertahankan), keyframe kf (t, v, e utuh tanpa penafsiran semantik), pathD, fillColor, transform statis, properti, efek, dan slot aset (uri, status deklarasi <media>, jenis, nama berkas, daftar layer pemakai).
3. Struktur yang belum didukung dilaporkan eksplisit pada result.unsupported beserta penjelasan per temuan: efek, blending, path-stroke, border, shadow, grup bersarang, layer teks, elemen tak dikenal, aset fillImage tanpa deklarasi <media>, dan atribut scene wajib yang hilang.
4. Parser tidak menilai validitas impor (tugas xmlValidation dan uji lapangan TS-1), tidak mengubah berkas sumber, dan tidak membuat klaim pemeliharaan keyframe/struktur; ia hanya memetakan dan melaporkan. Rencana IPR-2: penggantian aset selektif pada tingkat teks (atribut fillImage dan uri pada deklarasi media terkait) sehingga seluruh bagian berkas lain terjaga byte demi byte.
5. Fixture: REAL_AM_EXPORT_FIXTURE dan REAL_AM_IMPORTED_PATH_FIXTURE disalin apa adanya dari tests/amImportFixture.test.js tanpa perubahan data.

### 17.3 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| Rangkaian 18 uji parser dijalankan dari isi berkas tests/presetParser.test.js itu sendiri (bukan harness sementara), terhadap kedua fixture asli | Lulus 18/18 |
| Identitas fixture dengan tests/amImportFixture.test.js (diekstrak langsung dari berkas repositori) | Identik |
| Audit cakupan commit: tepat 4 berkas (js/modules/presetParser.js, tests/presetParser.test.js, tests/index.html, docs/SDD.md); modul ekspor, vektorisasi, dan UI tidak tersentuh | Lulus |

### 17.4 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- tests/index.html (78 uji lama + 18 uji parser = 96 kasus) BELUM dijalankan di peramban; sandbox tidak memiliki peramban. Pendaftaran suite pada harness diverifikasi secara statis, bukan melalui eksekusi runtime.
- Parser teruji hanya terhadap dua fixture ekspor asli AM 5.0.273 (Android) dan kasus sintetis; TIDAK diklaim valid untuk semua preset/proyek Alight Motion. Versi aplikasi lain, preset marketplace, grup bersarang nyata, layer teks nyata, dan media video/audio belum pernah diamati.
- Parser tidak menilai validitas impor; preset yang berhasil diparse belum tentu aman untuk penggantian aset - keamanannya ditentukan IPR-2 dan uji lapangan.
- Keyframe dibaca apa adanya (t, v, e); tidak ada klaim pemeliharaan semantik keyframe sebelum uji lapangan di Alight Motion.

### 17.5 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| IPR-1 | Parser teks XML proyek/preset Alight Motion: slot aset, keyframe, pelaporan struktur belum didukung | 17.2; 17.3: 18/18 sandbox dari isi berkas uji | Selesai (uji peramban dan preset nyata pengguna menunggu) |
| IPR-2 | Penggantian aset selektif dengan mempertahankan aset lain | Direncanakan sebagai penggantian tingkat teks (lihat 17.2 butir 4); terlaksana pada bagian 18 | Diimplementasikan (lihat bagian 18) |

## 18. Implementasi IPR-2: penggantian aset individual dengan mempertahankan aset lain

### 18.1 Konteks dan cakupan

IPR-2 melanjutkan fondasi IPR-1 menuju alur Instant Preset Remixer: pengguna memasukkan preset, sistem mendeteksi slot aset, pengguna mengganti aset terpilih, aset lain dipertahankan, hasil divalidasi, lalu diekspor. Tahap ini menambahkan modul baru js/modules/presetRemixer.js (replaceAssets) dan peningkatan aditif parser IPR-1 (v2): setiap node XML menyimpan posisi sumber _source {start, openEnd}, entri media/layer menyimpan _source, dan slot aset menyimpan mediaIndexes, layerIndexes, serta declarationCount. Perubahan TIDAK menyentuh modul ekspor, vektorisasi, validasi ekspor (xmlValidation hanya dibaca), maupun UI; belum ada antarmuka pengguna untuk fitur ini.

### 18.2 Keputusan desain

1. Penggantian dilakukan pada tingkat teks (splice presisi dari posisi sumber parser), bukan render ulang dokumen: hanya byte nilai uri pada deklarasi <media> terkait dan fillImage pada tag pembuka layer pemakai yang dipotong dan diganti. Uji round-trip byte membuktikan seluruh byte lain identik.
2. Kontrak replaceAssets(xml, replacements): replacements adalah daftar {fromUri, toUri, filename?, title?, size?, width?, height?}. Metadata hanya menimpa atribut yang SUDAH ADA pada deklarasi <media>; atribut yang tidak ada dilewati dengan warning (tidak menambah atribut baru agar pola ekspor asli tidak berubah). size/width/height dibulatkan ke bilangan bulat.
3. Penolakan eksplisit (ok false + pesan sebab, tanpa keluaran xml): fromUri yang bukan slot terdaftar; slot tanpa deklarasi <media>; fromUri atau toUri duplikat; toUri yang bertabrakan dengan uri aset yang sudah ada (termasuk penggantian tanpa efek); toUri/filename/title kosong atau memuat karakter terlarang (kutip ganda, <, >, &); size/width/height non-angka; daftar penggantian kosong/bukan array; XML masukan rusak.
4. Deklarasi <media> ganda dengan uri sama: seluruh deklarasi diperbarui disertai warning eksplisit (declarationCount dilaporkan pada slot).
5. Setelah splice, hasil SELALU diparse ulang dan dibandingkan dengan masukan: jumlah media/layer/slot harus sama; scene harus identik; setiap layer harus identik di luar fillImage (JSON compare); setiap media yang tidak diganti harus identik (JSON compare); slot hasil harus terdeklarasi; slot yang tidak diganti harus tetap ada. Hasil juga menjalani validateAlightMotionXml; ok hanya true bila seluruh pemeriksaan lulus. Validitas struktur XML dipisahkan secara eksplisit dari keberhasilan impor nyata di Alight Motion.
6. Kontrak hasil: {ok, error, xml, replacements, untouchedSlots, warnings, validation}. untouchedSlots berisi uri aset yang tidak diganti. Label layer tidak diubah (nama aset lama pada label dipertahankan apa adanya).

### 18.3 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| 17 uji baru tests/presetRemixer.test.js (penggantian tunggal dan ganda, round-trip byte, keyframe/durasi/urutan layer via JSON compare, metadata lengkap dengan pembulatan, media tanpa filename, deklarasi ganda, tujuh kasus penolakan, validator) dijalankan dari isi berkas uji itu sendiri | Lulus 17/17 |
| Regresi: 96 uji lama (ve 18, sp 5, cl 8, am 36, fx 11, pp 18) terhadap parser v2 - seluruh suite tetap dijalankan dari berkas repositori | Lulus 96/96 |
| Total kasus terdaftar tests/index.html (78 + 18 + 17) | 113 |
| Fixture PB1/PB19 diekstrak langsung dari tests/presetParser.test.js repositori tanpa perubahan data | Identik |
| Audit cakupan diff: 5 berkas (js/modules/presetParser.js, js/modules/presetRemixer.js, tests/presetRemixer.test.js, tests/index.html, docs/SDD.md); modul ekspor, vektorisasi, validasi ekspor, dan UI tidak tersentuh | Lulus |

### 18.4 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Seluruh pengujian di atas lulus di sandbox TANPA peramban; tests/index.html (113 kasus) belum dijalankan di peramban. Pendaftaran suite pr diverifikasi secara statis, bukan melalui eksekusi runtime.
- Penggantian teruji hanya terhadap dua fixture ekspor asli AM 5.0.273 (Android) dan kasus sintetis; TIDAK diklaim valid untuk semua preset Alight Motion. Media video/audio, grup bersarang nyata, dan preset marketplace belum pernah diamati.
- Validitas struktural (validator XV) BUKAN jaminan keberhasilan impor: apakah Alight Motion menerima uri aset baru (content:// atau am:) hasil penggantian belum pernah diuji pada perangkat nyata - uji lapangan wajib sebelum fitur ini diiklankan berfungsi.
- Keyframe, durasi, dan urutan layer terbukti terjaga pada kedua fixture melalui JSON compare dan round-trip byte; namun perilaku runtime Alight Motion terhadap hasil penggantian tetap menunggu uji lapangan.
- Belum ada antarmuka impor/ekspor untuk alur IPR; replaceAssets saat ini adalah API modul yang siap dirangkai pada tahap integrasi berikutnya (IPR-3). Kini tersedia melalui IPR-3; lihat bagian 19.

### 18.5 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| IPR-1 | Parser fondasi | Tidak berubah status (lihat bagian 17); parser v2 bersifat aditif dan 18 uji lama tetap lulus | Selesai (uji peramban + lapangan menunggu) |
| IPR-2 | Penggantian aset selektif dengan mempertahankan aset lain | 18.2; 18.3: 17/17 sandbox + regresi 96/96 | Selesai (uji peramban + penggantian aset nyata menunggu uji lapangan) |
| TS-2 | Uji otomatis ringan | 113 kasus terdaftar pada harness sandbox (kini 124 setelah IPR-3) | Terlayani sebagian (sandbox; peramban menunggu) |

## 19. Implementasi IPR-3: integrasi antarmuka Instant Preset Remixer

IPR-3 merangkai parser proyek (IPR-1, bagian 17) dan penggantian aset selektif (IPR-2, bagian 18) menjadi alur ujung-ke-ujung pada antarmuka: impor berkas proyek Alight Motion, analisis slot aset, pengisian uri pengganti untuk slot terpilih, perakitan ulang melalui replaceAssets, validasi struktur hasil, dan unduhan berkas proyek yang dimodifikasi. Seluruh pemrosesan berjalan lokal di peramban — tanpa unggahan ke server, tanpa autentikasi, tanpa dependensi baru, dan tanpa layanan latar belakang. Algoritma parser dan replaceAssets tidak diubah sama sekali pada tahap ini.

### 19.1 Konteks dan cakupan

- Alur terkecil yang lengkap: pilih berkas proyek, analisis slot, pilih slot dan isi uri pengganti, rakit ulang, validasi, unduh.
- Batas masukan: ekstensi .xml adalah jalur utama (pemilih berkas Android sering melaporkan tipe MIME kosong); MIME application/xml, text/xml, atau text/plain diterima sebagai jalur alternatif bila ekstensi tidak tersedia; ukuran berkas 1 byte hingga 15 MB (PRESET_MAX_BYTES); berkas kosong ditolak eksplisit.
- Tidak ada pembuatan uri otomatis. Peramban tidak dapat memperoleh ID MediaStore (content://) dan semantik uri am: belum terverifikasi, sehingga uri pengganti diisi manual oleh pengguna: wajib tidak kosong, maksimum 2048 karakter (REMIX_URI_MAX_LENGTH), dan menolak karakter kutip ganda, <, >, &.
- Berkas gambar per slot bersifat opsional dan hanya menyuplai metadata (filename, size, width, height) yang ditulis replaceAssets pada atribut yang sudah ada; atribut title tidak disentuh alur ini.
- Keluaran adalah berkas proyek XML yang dimodifikasi (<nama>-remix.xml); tidak ada perenderan video dan tidak ada ekspor MP4.

### 19.2 Keputusan desain

- Pemisahan murni/DOM: js/modules/presetRemixWorkflow.js (baru, 6909 byte) berisi orkestrasi tanpa DOM — validatePresetFileInput, analyzePresetText, normalizeReplacementUri, buildReplacement, remixPreset (diteruskan ke replaceAssets IPR-2), buildRemixDownloadName, dan computeRemixerUiState — sehingga seluruh logika alur dapat diuji otomatis di sandbox. Modul ini tidak membaca berkas (tugas panel peramban) dan tidak menjamin keberhasilan impor.
- Panel peramban: js/ui/presetRemixerPanel.js (baru, 18936 byte) menghubungkan orkestrasi ke halaman Remixer — pemilihan berkas (klik dan seret-letakkan), FileReader untuk pembacaan lokal, kartu per slot dengan uri pengganti opsional dan berkas gambar metadata, tombol "Rakit Ulang dan Validasi", dan unduhan via Blob. Tidak ada permintaan jaringan.
- Halaman: index.html menambahkan navigasi "Remixer", kartu menu, dan section page-remixer (22 id: unggah, analisis, hasil, pesan); footer menjadi v0.6.0. js/main.js (917 byte) mengimpor dan memanggil initPresetRemixerPanel(). js/ui/statusStrip.js (1640 byte) menambah chip ke-7 "Instant Preset Remixer". styles/main.css (27907 byte) menambah blok Remixer dengan token desain yang sudah ada; perbaikan responsif yang sudah berfungsi tidak disentuh.
- Kejujuran di antarmuka: catatan pada panel menyatakan bahwa uri pengganti diisi manual, slot tanpa deklarasi media tidak dapat diganti, dan penerimaan hasil oleh Alight Motion pada perangkat nyata menunggu uji lapangan.

### 19.3 Perilaku antarmuka (delapan keadaan Gate 2)

computeRemixerUiState(model) menghitung keadaan murni dengan prioritas: parsing menang atas galat; galat menang atas analisis; hasil penggantian menghasilkan ready (ok) atau validationFailed; tanpa hasil, replacementCount > 0 menghasilkan replacementSelected; analisis sukses tanpa penggantian menghasilkan analysis; hanya berkas terpilih menghasilkan fileSelected; tanpa berkas menghasilkan empty.

| Keadaan | Makna |
|---------|-------|
| empty | Belum ada berkas yang dipilih |
| fileSelected | Berkas valid terpilih, belum dianalisis |
| parsing | Berkas sedang dibaca dan dianalisis |
| analysis | Analisis selesai; ringkasan dan slot ditampilkan |
| replacementSelected | Minimal satu slot memiliki uri pengganti terisi |
| validationFailed | Penggantian ditolak replaceAssets atau validasi struktur gagal |
| ready | Hasil penggantian lulus validasi; unduhan diaktifkan |
| processingError | Galat pemrosesan dengan pesan eksplisit |

Struktur yang belum didukung dilaporkan parser (IPR-1) dan ditampilkan pada panel; slot tanpa deklarasi media ditandai dan tidak dapat diganti. Kegagalan pembacaan berkas, format tidak didukung, batas ukuran, dan penolakan replaceAssets semuanya dikomunikasikan dengan pesan eksplisit, bukan dipecahkan diam-diam.

### 19.4 Verifikasi (dijalankan sebelum push, sandbox tanpa peramban)

| Pemeriksaan | Hasil |
|-------------|-------|
| 11 uji baru tests/presetRemixWorkflow.test.js (IPR3-1..IPR3-11: validasi berkas masukan, analisis PB19 tiga slot, penolakan XML rusak dan tanpa scene, analisis tanpa media, normalisasi uri pengganti, perakitan metadata opsional, alur remix PB19 satu slot, alur penuh dengan metadata berkas, penerusan penolakan replaceAssets, delapan keadaan antarmuka, penamaan unduhan) dijalankan dari isi berkas uji itu sendiri | Lulus 11/11 |
| Regresi: 113 uji lama (ve 18, sp 5, cl 8, am 36, fx 11, pp 18, pr 17) dari berkas repositori | Lulus 113/113 |
| Total kasus terdaftar tests/index.html (113 + 11) | 124 |
| Fixture PB1/PB19 diekstrak langsung dari tests/presetParser.test.js repositori tanpa perubahan data | Identik |
| Strip status fitur | 7 chip; chip "Instant Preset Remixer" hadir |
| Audit cakupan diff: 9 berkas (js/modules/presetRemixWorkflow.js, js/ui/presetRemixerPanel.js, js/ui/statusStrip.js, js/main.js, index.html, styles/main.css, tests/presetRemixWorkflow.test.js, tests/index.html, docs/SDD.md); algoritma parser (IPR-1), replaceAssets (IPR-2), mesin vektorisasi, validasi ekspor, dan halaman studio tidak tersentuh | Lulus |

### 19.5 Keterbatasan (wajib dibaca sebelum klaim apa pun)

- Panel DOM (js/ui/presetRemixerPanel.js) TIDAK diuji di sandbox karena sandbox tidak memiliki peramban; hanya modul orkestrasi murni yang diuji otomatis. tests/index.html (124 kasus) dan panel harus diverifikasi pengguna melalui server HTTP lokal sebelum fitur dianggap bekerja di peramban.
- Validitas struktural (validator XV) BUKAN jaminan keberhasilan impor: penerimaan uri pengganti (content:// atau am:) oleh Alight Motion pada perangkat nyata belum pernah diuji — uji lapangan wajib sebelum fitur ini diiklankan berfungsi.
- TIDAK diklaim kompatibel dengan semua preset: penggantian teruji hanya pada dua fixture ekspor asli AM 5.0.273 (Android) dan kasus sintetis; media video/audio, grup bersarang nyata, dan preset marketplace belum pernah diamati.
- Tidak ada pembuatan uri otomatis; pengguna memasukkan uri tujuan secara manual. Metadata hanya ditulis pada atribut yang sudah ada; label layer tidak diubah.
- Fitur ini mengekspor berkas proyek XML yang dimodifikasi; tidak ada perenderan video dan tidak ada ekspor MP4.

### 19.6 Traceability

| ID | Butir | Bukti | Status |
|----|-------|-------|--------|
| IPR-1 | Parser fondasi | Tidak berubah (lihat bagian 17); 18 uji tetap lulus pada regresi | Selesai (uji peramban + lapangan menunggu) |
| IPR-2 | Penggantian aset selektif | Tidak berubah (lihat bagian 18); 17 uji tetap lulus pada regresi | Selesai (uji peramban + lapangan menunggu) |
| IPR-3 | Integrasi antarmuka Instant Preset Remixer | 19.2; 19.4: 11/11 sandbox + regresi 113/113 (total 124 kasus terdaftar) | Selesai (uji peramban + lapangan menunggu) |
| TS-2 | Uji otomatis ringan | 124 kasus terdaftar pada harness sandbox | Terlayani sebagian (sandbox; peramban menunggu) |

## 20. RV-4 - Node.js Render Server (API Render MP4)

Status: diimplementasikan pada cabang feat/server-render-mvp (2026-10-19). Bagian ini mendokumentasikan arsitektur, kontrak API, konfigurasi, dan status verifikasi implementasi server render pada direktori server/.

### 20.1 Arsitektur

Implementasi hanya memakai modul bawaan Node.js (node:http, node:fs, node:crypto, node:child_process, node:dns, node:path); tidak ada dependensi eksternal.

- server/src/index.js: titik masuk; memuat konfigurasi, membersihkan job yatim, memeriksa FFmpeg, menyalakan server, sapuan video kedaluwarsa tiap 60 detik, mati tertib saat SIGINT/SIGTERM.
- server/src/config.js: konfigurasi lingkungan tervalidasi penuh; galat dikumpulkan sekaligus (murni).
- server/src/rateLimiter.js: pembatas laju jendela tetap per kunci (murni).
- server/src/mimeType.js: deteksi magic byte PNG/JPEG/WebP dan pemeriksaan Content-Type (murni).
- server/src/ffmpeg.js: pembungkus proses FFmpeg/FFprobe; probe versi, pembacaan dimensi, dekode ke RGBA (dengan penurunan skala bila aset lebih besar dari kanvas), encoder H.264 dengan argumen terpisah (tanpa shell), batas waktu, dan pembatas keluaran.
- server/src/downloader.js: pengunduh aset anti-SSRF; setiap hop divalidasi checkSourceUrl, redirect divalidasi ulang validateRedirect, seluruh alamat DNS diperiksa checkResolvedAddresses sebelum koneksi, koneksi dipinkan ke alamat tervalidasi dengan servername hostname asli, batas ukuran, pemeriksaan Content-Type dan magic byte, penulisan atomik (part lalu rename).
- server/src/jobManager.js: penyimpanan job; id acak heksadesimal 32, meta.json atomik (tmp+rename), pendaftaran video, sapuan kedaluwarsa, pembersihan direktori yatim, pemeriksaan ruang disk via statfs.
- server/src/renderService.js: orkestrasi; validasi proyek, antrean render, pemuatan aset (dataUri atau sourceUrl), streaming bingkai ke stdin FFmpeg dengan satu penyangga yang dipakai ulang dan backpressure (drain), kemajuan dipersist pada tonggak, kegagalan dicatat dan video parsial dihapus.
- server/src/httpServer.js: API HTTP; autentikasi Bearer (sha256 + timingSafeEqual, fail closed), pembatas ukuran body, pembatas laju per endpoint, CORS allowlist, dukungan Range untuk MP4, amplop galat konsisten.

### 20.2 Kontrak API

- GET /health (publik): {status, ffmpeg, uptime, active, queueLength}.
- POST /api/render-jobs: body {project:{...}} sesuai kontrak proyek v1; sukses 201 {jobId, status, position, createdAt} dengan header Location.
- GET /api/render-jobs/:id: {id, status, position, progress, error, createdAt, video}.
- GET /api/render-jobs/:id/video: MP4 setelah completed; 409 bila belum selesai, 410 bila failed/expired, 404 bila tidak dikenal; Range didukung (206/416).
- Metode lain: 405 dengan header Allow. Amplop galat: {error:{code,message}}.
- Kode galat: VALIDATION_ERROR (400), BAD_JSON (400), UNAUTHORIZED (401), NOT_FOUND (404), METHOD_NOT_ALLOWED (405), CONFLICT (409), GONE (410), PAYLOAD_TOO_LARGE (413), RANGE_NOT_SATISFIABLE (416), QUEUE_FULL (429), RATE_LIMITED (429), FFMPEG_UNAVAILABLE (503), DISK_FULL (503), INTERNAL_ERROR (500).
- Pembatas laju per klien: pembuatan job 5 per 5 menit; status 120 per menit; video 30 per menit.

### 20.3 Konfigurasi

Variabel lingkungan (semua opsional kecuali NAZE_API_KEY di produksi): NAZE_PORT, NAZE_JOBS_DIR, NAZE_SOURCE_ALLOWLIST, NAZE_VIDEO_TTL_MS, NAZE_MIN_FREE_DISK_BYTES, NAZE_FFMPEG_PATH, NAZE_FFPROBE_PATH, NAZE_RENDER_TIMEOUT_MS, NAZE_DOWNLOAD_TIMEOUT_MS, NAZE_MAX_REQUEST_BODY_BYTES, NAZE_MAX_ASSET_BYTES, NAZE_MAX_ACTIVE_RENDERS (1..8), NAZE_MAX_QUEUED_RENDERS (1..100), NAZE_ALLOWED_ORIGIN (http(s)://host tanpa path), NAZE_API_KEY (minimal 16 karakter), NAZE_ALLOW_NO_AUTH (0/1, hanya pengembangan). Rincian lengkap ada di server/README.md dan server/.env.example.

### 20.4 Batas MVP

- 1280x720, 30 fps, durasi 200..15000 ms, 1..8 layer; satu render aktif secara bawaan.
- Memori: satu penyangga bingkai 1280x720 RGBA dipakai ulang; aset didekode ke RGBA dengan penurunan skala bila melebihi 1280x720 piksel (aset RGBA maksimal sekitar 8 x 3,7 MB).
- Disk bebas minimal 512 MB sebelum menerima job; video dihapus setelah NAZE_VIDEO_TTL_MS.
- UI klien belum diintegrasikan (sesuai arahan; menyusul setelah pipeline tervalidasi).

### 20.5 Status Verifikasi (jujur)

Sudah dilakukan di lingkungan verifikasi (tanpa Node.js/FFmpeg):

- Audit remote sebelum perubahan: HEAD feat/server-render-mvp = 4146bc3; main = b3b5aed (tidak tersentuh).
- Kompilasi sintaksis 17 berkas JS lulus (tanpa eksekusi).
- 19 kasus uji modul murni lulus: config 10, rateLimiter 5, mimeType 3, computeScaledDims 1.
- JSON.parse server/package.json lulus.

Belum dijalankan (jujur, butuh mesin target dengan Node.js dan FFmpeg):

- 72 kasus node:test pada server/tests/, termasuk uji integrasi FFmpeg nyata yang otomatis ter-skip bila FFmpeg tidak tersedia. Perintah: cd server && npm test.
- 75 kasus harness peramban pada tests/index.html.
- Render MP4 end-to-end belum dibuktikan tanpa FFmpeg nyata di mesin target.
