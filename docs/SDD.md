# SDD — Naze Vector Website MVP

Dokumen: Spesifikasi dan Desain (SDD) untuk Naze Vector.
Repositori: Ndolzz/nazevector. Diperbarui: 2026-10-16.

## 1. Ringkasan

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dan mengekspornya sebagai XML untuk Alight Motion. Tahap pertama (MVP) berfokus pada desain website, navigasi, unggah gambar, pratinjau, kontrol antarmuka, dan status aplikasi yang benar-benar berfungsi. Pembaruan v0.2.0 menambahkan mesin vektorisasi yang berfungsi (backlog VE-1 dan VE-2): mask siluet diubah menjadi path SVG tertutup dengan kontur luar, lubang internal, beberapa komponen terpisah, dan penyederhanaan bertingkat. Pembaruan v0.3.0 (backlog DS-1) merombak identitas visual situs ke arah "Imperfect by Design" tanpa mengubah perilaku pipeline (lihat bagian 8). Pembaruan v0.4.0 memperbaiki bug navigasi "Buka Studio" (backlog NB-1, lihat bagian 9) dan menyelesaikan adapter XML, validasi XML, serta unduhan ekspor lokal berupa bentuk statis tanpa keyframe (backlog AM-1, XV-1, EX-1; lihat bagian 10). Pembaruan v0.4.1 (backlog AM-2, XV-2) menyelaraskan struktur keluaran dengan pola ekspor asli Alight Motion (lihat bagian 11). Pembaruan v0.4.2 (backlog AM-3, XV-3) memperbaiki bukti lapangan baru — berkas v0.4.1 berhasil diimpor namun kanvas tampak kosong — dengan memindahkan outline ke tag path sesuai parser asli Alight Motion dan menambah regresi geometri (lihat bagian 12). Penerapan keyframe preset (AN-1) dan bukti kompatibilitas impor nyata (TS-1) tetap tertunda dan ditandai secara jujur di antarmuka.

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

- Alight Creative tidak memublikasikan spesifikasi resmi format XML proyek/preset. Klaim kompatibilitas tidak dapat didasarkan pada dokumentasi resmi.
- Sumber dokumentasi komunitas paling terstruktur: https://github.com/kuchingneko28/alight-motion-docs (dibangun dari dekompilasi APK; secara eksplisit tidak berafiliasi dengan Alight Creative). Cakupan: scene XML, nilai bawaan, alokasi ID, penamaan layer, elemen, efek, properti/keyframe, dan media.
- Artikel-artikel blog komunitas hanya menjelaskan alur impor (umumnya di Android), bukan struktur XML.
- Dukungan impor XML penuh umumnya ada di Android; iOS terbatas (sering memerlukan solusi tidak langsung).

### 2.4 Keterbatasan dan risiko kompatibilitas

1. Format XML Alight Motion adalah format komunitas hasil rekayasa balik, bukan spesifikasi resmi, dan dapat berubah antar versi aplikasi.
2. Uji impor nyata v0.4.0 di Alight Motion (Android) GAGAL dengan pesan "Gagal mengunggah. Formatnya tidak benar atau file rusak." Ekspor v0.4.1 BERHASIL diimpor namun kanvas tampak kosong: outline pada tag parameter/contour tidak dibaca parser asli (lihat bagian 12). Perbaikan v0.4.2 (outline pada tag path) belum diuji ulang di perangkat nyata. Karena itu proyek ini tidak mengklaim kompatibilitas apa pun hingga TS-1 lulus — keberhasilan impor saja tidak dianggap bukti shape tampil.
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
| RF-05 | Kontrol siluet (mode, warna, ambang) menghasilkan pratinjau siluet raster yang benar-benar dihitung lokal | Diimplementasikan (raster) |
| RF-06 | Kontrol penyederhanaan path memengaruhi jumlah titik kontur hasil vektorisasi | Diimplementasikan (VE-2) |
| RF-07 | Preset animasi Silhouette Reveal, Scale Pulse, Rotation Motion dengan durasi dan intensitas, kontrol putar, jeda, ulangi | Diimplementasikan (pratinjau lokal) |
| RF-08 | Panel ekspor: nama berkas, format target, status validasi, informasi kompatibilitas, pesan kesalahan yang jelas | Diimplementasikan (panel); ekspor ditandai belum tersedia |
| RF-09 | Mesin vektorisasi (path SVG) | Diimplementasikan (VE-1; uji 18/18 lulus, lihat bagian 7) |
| RF-10 | Adapter XML Alight Motion | Diimplementasikan (AM-1 + AM-2 + AM-3, v0.4.2): bentuk statis tanpa keyframe; struktur mengikuti pola ekspor asli; outline pada tag path sesuai parser asli; tanpa klaim kompatibilitas impor (TS-1) |
| RF-11 | Validasi XML | Diimplementasikan (XV-1 + XV-2 + XV-3, v0.4.2): validasi lokal termasuk pola struktural ekspor asli, syarat outline path, dan fixture regresi; bukan bukti kompatibilitas |
| RF-12 | Ekspor XML | Diimplementasikan (EX-1, v0.4.0): unduhan .xml lokal berupa bentuk statis |

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
| js/modules/silhouette.js | Komputasi mask siluet raster (nyata) |
| js/modules/vectorEngine.js | Vektorisasi mask menjadi path SVG tertutup: marching squares pada crack boundary + penyederhanaan RDP (nyata) |
| js/modules/animation.js | Definisi preset dan mesin pratinjau animasi lokal (nyata) |
| js/modules/amAdapter.js | Serializer XML Alight Motion (AM-1 + AM-3): scene berisi satu bentuk imported statis dengan outline pada tag path sesuai pola parser asli |
| js/modules/xmlValidation.js | Validasi dokumen XML (XV-1 + XV-3): well-formedness, atribut wajib, pola ekspor asli, ID unik, rentang waktu, warna, outline shape |
| js/modules/exportManager.js | Orkestrasi pipeline ekspor: mask → vektorisasi → XML (AM-1) → validasi (XV-1); mengembalikan hasil atau pesan kesalahan terstruktur |
| js/modules/pipelineErrors.js | Tipe kesalahan PipelineNotAvailableError |
| js/ui/statusStrip.js | Strip status fitur |
| js/ui/uploadZone.js | Zona unggah: pemilih berkas dan drag-and-drop |
| js/ui/previewPanel.js | Pratinjau asli dan siluet, siklus hidup animasi |
| js/ui/vectorPanel.js | Kontrol pengaturan vektor |
| js/ui/animationPanel.js | Kontrol pengaturan animasi dan pemutaran |
| js/ui/exportPanel.js | Panel ekspor dan pesan status |
| js/ui/pages.js | Perutean lokal antar halaman |
| tests/vectorEngine.test.js | Rangkaian uji murni mesin vektorisasi (18 kasus, tanpa DOM, dapat dijalankan di peramban) |
| tests/amAdapter.test.js | Rangkaian uji murni adapter XML, validasi, dan integrasi ekspor (21 kasus, tanpa DOM) |
| tests/amImportFixture.test.js | Rangkaian uji regresi impor dan tampilan (9 kasus: fixture ekspor asli, penolakan pola gagal v0.4.0 dan v0.4.1, fixture ekspor asli berpath, regresi geometri lingkaran dan cincin) |
| tests/index.html | Harness peramban untuk menjalankan rangkaian uji |

Alur data: imageImport menghasilkan ImageDescriptor (kanvas ternormalisasi) ke store; silhouette menghitung mask dari kanvas; pratinjau raster dirasterisasi. vectorEngine mengubah mask menjadi VectorPathData (SVG) yang ditampilkan sebagai pratinjau vektor beserta statistiknya; perubahan gambar, mode, ambang, penyederhanaan, dan warna memicu penghitungan ulang dari state terkini (lihat 7.3). Saat tombol ekspor ditekan, exportManager menghitung ulang mask dan vektor dari state terkini, lalu amAdapter membangun XML scene statis (satu bentuk imported) dan xmlValidation memverifikasinya sebelum unduhan (lihat bagian 10). Tahap yang masih belum tersedia: penerapan AnimationClipData preset menjadi keyframe XML (AN-1). Setiap tahap memancarkan pesan status yang jujur.

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

Belum diimplementasikan (ditandai eksplisit di UI): penerapan keyframe preset ke properti Alight Motion (AN-1) dan bukti kompatibilitas impor nyata (TS-1).

## 5. Backlog

| ID | Butir | Catatan teknis |
|----|-------|----------------|
| VE-1 | Mesin vektorisasi mask ke path SVG | Selesai (v0.2.0): marching squares pada crack boundary + RDP per kontur tertutup; uji 18/18 lulus (lihat 7) |
| VE-2 | Penyederhanaan path bertingkat | Selesai (v0.2.0): toleransi rendah 0.3 px, sedang 1.5 px, tinggi 3.5 px; override tolerancePx didukung; terhubung ke kontrol state |
| AM-1 | Adapter XML Alight Motion | Selesai (v0.4.0): bentuk imported statis dari kontur vektor; lihat bagian 10. Tanpa klaim kompatibilitas sebelum TS-1 |
| AM-2 | Penyelarasan struktur XML dengan pola ekspor asli (prolog, precompose, retime/retimeAdaptFPS, mediaFillMode) | Selesai (v0.4.1): didasarkan pada tiga ekspor asli Alight Motion; lihat bagian 11. Impor nyata belum terbukti (TS-1) |
| AM-3 | Outline shape pada tag path sesuai parser asli (perbaikan impor berhasil namun kanvas kosong) | Selesai (v0.4.2): didasarkan pada dekompilasi parser (ShapeElementTypeImpl) dan ekspor asli Proyek Baru 19.xml; lihat bagian 12. Tampilan shape pada perangkat nyata belum terbukti (TS-1) |
| AN-1 | Penerapan keyframe preset ke properti AM (scale, rotation, opacity) | Bergantung TS-1: semantik keyframe pada bentuk imported harus diverifikasi lewat uji impor nyata sebelum diimplementasikan |
| XV-1 | Validasi XML (well-formedness, atribut wajib, referensi ID) | Selesai (v0.4.0): dijalankan sebelum unduhan; lihat bagian 10 |
| XV-2 | Pengetatan validator + fixture regresi kegagalan impor | Selesai (v0.4.1): validator menolak dokumen tanpa prolog/pola ekspor asli; lihat bagian 11 |
| XV-3 | Pengetatan validator outline (tag path) + regresi geometri path nonkosong | Selesai (v0.4.2): validator menolak shape tanpa outline path; 9 kasus fixture termasuk geometri; lihat bagian 12 |
| EX-1 | Unduh .xml + proses unduhan multi-berkas bila diperlukan | Selesai (v0.4.0): unduhan satu .xml lokal; multi-berkas tidak diperlukan untuk keluaran vektor murni; lihat bagian 10 |
| TS-1 | Uji impor nyata di Alight Motion (Android) | v0.4.0 terbukti gagal diimpor di lapangan; v0.4.1 terimpor namun kanvas kosong; v0.4.2 wajib diuji ulang dan diverifikasi secara visual (shape terlihat, bentuk/posisi/skala/warna masuk akal) sebelum klaim kompatibilitas apa pun |
| DS-1 | Redesign visual "Imperfect by Design" | Selesai (v0.3.0): lihat bagian 8 |
| NB-1 | Perbaikan bug tombol "Buka Studio" (no-op) dan reset gulir saat pindah halaman | Selesai (v0.4.0): lihat bagian 9 |
| GT-1 | Aktifkan GitHub Pages / deployment statis | Konfigurasi manual di pengaturan repositori |
| TS-2 | Uji otomatis ringan (parsing modul, unit silhouette) | Terlayani sebagian (v0.4.2): 48 uji murni (18 VE + 21 AM/XV/EX + 9 fixture regresi) berjalan via tests/index.html di peramban tanpa Node; unit silhouette terpisah dan uji runtime peramban belum tercakup |

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
- `behavior` berharga `auto` ketika `matchMedia('(prefers-reduced-motion: reduce)').matches`, selainnya `smooth` (menghormati preferensi aksesibilitas).
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
3. Keluaran sengaja statis: satu `<shape>` tanpa `<kf>` keyframe. Penerapan preset animasi (AN-1) tidak diarang; semantik keyframe pada bentuk imported akan diverifikasi lewat uji impor nyata terlebih dahulu.
4. Validator ditulis sebagai parser kecil murni (tanpa DOMParser) agar identik di peramban dan di harness uji tanpa Node, dan validasi dijalankan sebelum unduhan (XV-1).
5. `exportName` dipakai sebagai judul scene (di-escape XML); nama berkas unduhan tetap disanitasi terpisah.
6. Status validasi lokal disimpan pada closure panel, bukan di store, agar kontrak `state.js` tidak berubah.

### 10.4 Risiko regresi dan mitigasi

1. Risiko: perubahan exportManager/statusStrip merusak uji lama. Mitigasi: dua asersi uji lama diperbarui sesuai perilaku baru (dijelaskan di 10.5), tidak ada uji yang dihapus; 16 uji lainnya tidak berubah.
2. Risiko: unduhan gagal di peramban tertentu. Mitigasi: alur memakai API standar (Blob, createObjectURL, anchor); bagian ini tidak dapat diuji di sandbox dan wajib diverifikasi manual di peramban (10.6).
3. Risiko: XML ditolap aplikasi Alight Motion. Mitigasi: seluruh teks antarmuka dan dokumentasi menyatakan kompatibilitas belum teruji; tidak ada klaim sebelum TS-1.
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
