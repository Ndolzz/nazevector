# SDD — Naze Vector Website MVP

Dokumen: Spesifikasi dan Desain (SDD) untuk Naze Vector.
Repositori: Ndolzz/nazevector. Diperbarui: 2026-10-16.

## 1. Ringkasan

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dan mengekspornya sebagai XML untuk Alight Motion. Tahap pertama (MVP) berfokus pada desain website, navigasi, unggah gambar, pratinjau, kontrol antarmuka, dan status aplikasi yang benar-benar berfungsi. Pembaruan v0.2.0 menambahkan mesin vektorisasi yang berfungsi (backlog VE-1 dan VE-2): mask siluet diubah menjadi path SVG tertutup dengan kontur luar, lubang internal, beberapa komponen terpisah, dan penyederhanaan bertingkat. Pembaruan v0.3.0 (backlog DS-1) merombak identitas visual situs ke arah "Imperfect by Design" tanpa mengubah perilaku pipeline (lihat bagian 8). Adapter XML, validasi XML, dan ekspor tetap ditandai secara eksplisit sebagai belum diimplementasikan.

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
| RF-06 | Kontrol penyederhanaan path memengaruhi jumlah titik kontur hasil vektorisasi | Diimplementasikan (VE-2) |
| RF-07 | Preset animasi Silhouette Reveal, Scale Pulse, Rotation Motion dengan durasi dan intensitas, kontrol putar, jeda, ulangi | Diimplementasikan (pratinjau lokal) |
| RF-08 | Panel ekspor: nama berkas, format target, status validasi, informasi kompatibilitas, pesan kesalahan yang jelas | Diimplementasikan (panel); ekspor ditandai belum tersedia |
| RF-09 | Mesin vektorisasi (path SVG) | Diimplementasikan (VE-1; uji 18/18 lulus, lihat bagian 7) |
| RF-10 | Adapter XML Alight Motion | Belum diimplementasikan (AM-1) |
| RF-11 | Validasi XML | Belum diimplementasikan (XV-1) |
| RF-12 | Ekspor XML | Belum diimplementasikan (EX-1) |

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
| tests/vectorEngine.test.js | Rangkaian uji murni mesin vektorisasi (18 kasus, tanpa DOM, dapat dijalankan di peramban) |
| tests/index.html | Harness peramban untuk menjalankan rangkaian uji |

Alur data: imageImport menghasilkan ImageDescriptor (kanvas ternormalisasi) ke store; silhouette menghitung mask dari kanvas; pratinjau raster dirasterisasi. vectorEngine mengubah mask menjadi VectorPathData (SVG) yang ditampilkan sebagai pratinjau vektor beserta statistiknya; perubahan gambar, mode, ambang, penyederhanaan, dan warna memicu penghitungan ulang dari state terkini (lihat 7.3). Tahap berikutnya belum tersedia: animation menghasilkan AnimationClipData, amAdapter membuat XML, xmlValidation memverifikasi, dan exportManager mengunduh. Setiap tahap memancarkan pesan status yang jujur.

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

Diimplementasikan: desain, navigasi, unggah, pratinjau (asli + siluet raster + hasil vektor SVG), kontrol UI, state aplikasi, pratinjau animasi lokal, mesin vektorisasi dengan penyederhanaan bertingkat (VE-1, VE-2).

Belum diimplementasikan (ditandai eksplisit di UI): adapter XML Alight Motion, validasi XML, unduhan ekspor.

## 5. Backlog

| ID | Butir | Catatan teknis |
|----|-------|----------------|
| VE-1 | Mesin vektorisasi mask ke path SVG | Selesai (v0.2.0): marching squares pada crack boundary + RDP per kontur tertutup; uji 18/18 lulus (lihat 7) |
| VE-2 | Penyederhanaan path bertingkat | Selesai (v0.2.0): toleransi rendah 0.3 px, sedang 1.5 px, tinggi 3.5 px; override tolerancePx didukung; terhubung ke kontrol state |
| AM-1 | Adapter XML Alight Motion | Basis: alight-motion-docs komunitas; butuh verifikasi uji impor nyata sebelum klaim kompatibel |
| AN-1 | Penerapan keyframe preset ke properti AM (scale, rotation, opacity) | Bergantung AM-1 |
| XV-1 | Validasi XML (well-formedness, atribut wajib, referensi ID) | Jalankan sebelum unduhan |
| EX-1 | Unduh .xml + proses unduhan multi-berkas bila diperlukan | Bergantung AM-1 dan XV-1 |
| TS-1 | Uji impor nyata di Alight Motion (Android) | Bukti keberhasilan wajib sebelum klaim kompatibilitas apa pun |
| DS-1 | Redesign visual "Imperfect by Design" | Selesai (v0.3.0): lihat bagian 8 |
| GT-1 | Aktifkan GitHub Pages / deployment statis | Konfigurasi manual di pengaturan repositori |
| TS-2 | Uji otomatis ringan (parsing modul, unit silhouette) | Terlayani sebagian (v0.2.0): 18 uji murni mesin vektorisasi berjalan via tests/index.html di peramban tanpa Node; unit silhouette dan uji runtime peramban belum tercakup |

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
