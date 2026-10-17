# Naze Vector

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dengan target ekspor XML untuk Alight Motion. Seluruh pemrosesan berjalan lokal di peramban; tidak ada akun, backend, atau API berbayar.

Status: v0.5.0 — mode garis centerline dan warna asli per komponen pada ekspor XML (VE-3 + CV-1 + AM-5: representasi "garis" mengekstraksi satu kurva tunggal di tengah setiap goresan line art — skeletonisasi Zhang-Suen lalu perunututan rantai — dan menuliskannya sebagai layer shape dengan `path-stroke`, tebal diperkirakan dari luas dibagi panjang skeleton; representasi "isi" tetap tersedia; mode warna "asli" mensampling warna dominan piksel sumber per komponen dan menuliskannya sebagai fillColor layer tersebut). Pembaruan ini dibangun di atas v0.4.4 (backlog AM-4 selesai: setiap komponen siluet ditulis sebagai elemen `<shape>` — satu layer Alight Motion — tersendiri dengan pivot pada pusat bounding box komponennya), v0.4.3 (backlog PF-1: pratinjau dioptimalkan berdasarkan pengukuran — tabel tepi bit-packed, mask pratinjau resolusi kerja maks 700 piksel, debounce 150 ms), perbaikan ekspor v0.4.2 (AM-3, XV-3: outline shape pada tag path sesuai parser asli), penyelarasan struktur ekspor v0.4.1 (AM-2, XV-2), ekspor XML lokal v0.4.0 (AM-1, XV-1, EX-1), perbaikan navigasi NB-1, redesign visual "Imperfect by Design" (DS-1), dan mesin vektorisasi SVG (VE-1, VE-2). Keluaran XML berupa bentuk statis tanpa keyframe. Bukti lapangan 2026-10-17 (TS-1 untuk bentuk statis mode isi): ekspor v0.4.2/v0.4.3 terbukti diimpor dan menampilkan shape dengan titik sunting di Alight Motion 5.0.273 (Android), namun seluruh komponen bergabung pada satu layer — kekurangan yang diperbaiki AM-4. Catatan faktual riwayat: ekspor v0.4.0 ditolak saat impor ("Gagal mengunggah. Formatnya tidak benar atau file rusak."); ekspor v0.4.1 berhasil diimpor namun kanvas tampak kosong karena outline pada tag parameter/contour tidak dibaca parser asli. Keluaran multi-layer v0.4.4 serta mode garis (VE-3) dan warna asli (CV-1) v0.5.0 belum diuji di perangkat nyata sehingga tidak ada klaim kompatibilitas untuk kasus tersebut.

## Identitas visual (v0.3.0)

Situs menggunakan sistem desain "Imperfect by Design": latar krem bergaris grid tipis, tipografi hitam editorial tebal, outline hitam tegas pada kartu dan tombol, bayangan solid pendek, serta aksen konsisten kuning, oranye, ungu, dan hijau sebagai penanda fungsi (bukan dekorasi acak). Tidak ada dependensi CSS/JS eksternal; seluruh identitas diimplementasikan di `styles/main.css`. Redesign ini hanya menyentuh presentasi — perilaku pipeline, kontrak modul, dan hasil SVG tidak berubah.

## Status fitur

Berfungsi:
- Navigasi Studio, Preset, Tentang (satu halaman, perutean lokal).
- Unggah gambar via pemilih berkas dan drag-and-drop (PNG, JPG, WebP; maks 15 MB).
- Pratinjau gambar asli dengan metadata; tombol ganti dan hapus gambar.
- Pratinjau siluet raster dengan mode gelap/terang, warna, dan ambang segmentasi. Sejak v0.4.3 mask pratinjau dihitung pada resolusi kerja maks 700 piksel (rasio aspek terjaga, gambar kecil tidak diperbesar) dengan debounce 150 ms — ukuran tampilan tidak berubah; ekspor tetap memakai resolusi penuh.
- Mesin vektorisasi: mask siluet menjadi path SVG tertutup dengan kontur luar, lubang internal, beberapa komponen terpisah (termasuk pulau di dalam lubang), dan penyederhanaan bertingkat (rendah/sedang/tinggi). Sejak v0.4.3 tabel tepi terlacak memakai Uint8Array berbit per arah (tanpa Set) dengan keluaran geometri identik. Koordinat proporsional terhadap dimensi mask; seluruhnya lokal, nol dependensi.
- Pratinjau hasil vektor (SVG) beserta statistik komponen/kontur/titik; perubahan gambar, ambang, mode, warna, dan penyederhanaan langsung memperbarui hasil.
- Pratinjau animasi lokal: Silhouette Reveal, Scale Pulse, Rotation Motion, dengan durasi, intensitas, putar, jeda, ulangi; animasi juga diterapkan pada hasil vektor.
- Ekspor XML Alight Motion (AM-1 + AM-4 + AM-5): tombol ekspor membaca piksel sumber sekali, menghitung ulang mask dan vektor dari pengaturan terkini pada resolusi penuh, lalu membangun dokumen `<scene>` sesuai mode terpilih. Representasi "isi": satu shape (layer) tersendiri per komponen siluet — pemisah layer — dengan lubang internal bergabung pada layer komponennya dan pivot setiap layer pada pusat bounding box komponen (tiap bagian dapat diputar/diskalakan pada pusatnya sendiri). Representasi "garis" (VE-3): satu layer shape per goresan centerline — skeletonisasi Zhang-Suen per region, perunututan rantai dengan penekanan diagonal semu pada sudut siku agar loop tertutup dikenali, penyederhanaan RDP, dan `path-stroke` berisi tebal perkiraan pita. Mode warna "pilihan" memakai satu warna global; mode warna "asli" (CV-1) mensampling warna dominan piksel sumber per komponen (keranjang kuantisasi 16 tingkat per kanal, rata-rata tepat keranjang terbanyak; tepat untuk desain warna datar, perkiraan untuk gradien/foto) dan menuliskannya sebagai fillColor per layer. Hasil divalidasi secara lokal (XV-1: well-formedness, atribut wajib, ID unik, rentang waktu, format warna), lalu diunduh sebagai `.xml` (EX-1). Semua berjalan lokal di peramban; nol dependensi.

Belum diimplementasikan (ditandai jelas di antarmuka):
- Penerapan preset animasi menjadi keyframe XML (backlog AN-1) — menunggu verifikasi semantik keyframe melalui uji impor nyata.
- Verifikasi lanjutan di aplikasi Alight Motion pada perangkat Android (sisa TS-1): impor dan tampilan shape statis mode isi terbukti di lapangan (tangkapan layar pengguna, AM 5.0.273 Android); keluaran multi-layer v0.4.4 (satu layer per komponen) serta mode garis (VE-3) dan warna asli (CV-1) v0.5.0 menunggu uji lapangan lanjutan. Lihat `docs/SDD.md` untuk backlog.
- Pengukuran waktu pratinjau pada perangkat Android nyata (PF-1 dibuktikan dengan penghitungan operasi dan kesetaraan keluaran; lihat `docs/SDD.md` bagian 13).

## Menjalankan secara lokal

Situs ini statis tanpa langkah build. Karena menggunakan ES Modules, jalankan melalui server HTTP lokal (membuka `index.html` langsung via `file://` dapat diblokir kebijakan modul pada beberapa peramban):

```bash
# contoh dengan Python
python3 -m http.server 8080
```

Lalu buka http://localhost:8080.

## Menjalankan pengujian

Rangkaian uji vektorisasi, ekspor XML, regresi impor, pembantu pratinjau, pemisah layer, dan ekstraksi garis centerline (73 kasus: 18 VE-1 + 24 AM-1/XV-1/EX-1 termasuk pemisah layer AM-4 + 11 regresi AM-2/AM-3/XV-2/XV-3 termasuk geometri path nonkosong dan multi-layer + 5 pembantu pratinjau P1 + 7 mode garis AM-5/EX + 8 ekstraksi centerline VE-3, tanpa Node.js) dapat dijalankan di peramban:

```bash
python3 -m http.server 8080
```

Lalu buka http://localhost:8080/tests/.

Untuk publikasi, aktifkan GitHub Pages pada pengaturan repositori (branch `main`, root) atau gunakan hosting statis lain.

## Struktur

```
index.html            Struktur halaman
styles/main.css       Sistem desain dan animasi
js/main.js            Orkestrasi
js/state.js           Store status aplikasi
js/modules/           Pipeline: imageImport, silhouette, vectorEngine,
                      centerline (garis VE-3), colorSampling (warna CV-1),
                      animation, amAdapter (XML statis), xmlValidation,
                      exportManager (ekspor lokal)
js/ui/                Komponen UI: pages, uploadZone, previewPanel,
                      vectorPanel, animationPanel, exportPanel, statusStrip
tests/                Rangkaian uji vektorisasi, adapter/ekspor XML, regresi
                      impor XML, pembantu pratinjau, harness peramban
docs/SDD.md           Hasil audit, spesifikasi, kriteria penerimaan, backlog
```

## Kompatibilitas

Alight Creative tidak memublikasikan spesifikasi resmi format XML. Adapter dibangun dari dokumentasi komunitas hasil rekayasa balik (alight-motion-docs) dan, sejak v0.4.1, dari pembanding langsung tiga ekspor asli Alight Motion; sejak v0.4.2, dari dekompilasi parser asli (ShapeElementTypeImpl: outline shape imported hanya dibaca dari tag path) dan ekspor asli yang terbukti menampilkan shape (Proyek Baru 19.xml memuat `<path d="M ... Z"/>` langsung di bawah `<shape>`); sejak v0.5.0, pola path stroke pada ekspor asli yang sama dipakai untuk mode garis (`<path-stroke direction="centered" end-size="1.500000"><size value="..."/></path-stroke>` dan path tanpa penutup Z dengan pengulangan titik awal). Bukti lapangan: ekspor v0.4.0 ditolak Alight Motion Android dengan pesan "Gagal mengunggah. Formatnya tidak benar atau file rusak."; ekspor v0.4.1 berhasil diimpor namun kanvas kosong — tag parameter/contour diabaikan parser sehingga shape tanpa outline. Perbaikan AM-3 memindahkan outline ke tag path dan validator XV-3 menolak shape tanpa outline path sebelum unduhan; regresi geometri memastikan path nonkosong dengan koordinat terpusat, pengulangan titik awal, dan lubang di dalam kontur luar. Bukti lapangan 2026-10-17: ekspor v0.4.2/v0.4.3 terbukti diimpor dan menampilkan shape dengan titik sunting di Alight Motion 5.0.273 (Android) — namun seluruh komponen bergabung pada satu layer, sehingga v0.4.4 (AM-4) menulis satu shape per komponen dengan pivot per bounding box. Keluaran multi-layer AM-4 serta mode garis (VE-3) dan warna asli (CV-1) v0.5.0 belum diuji di perangkat nyata: klaim kompatibilitas hanya akan diberikan setelah uji lapangan membuktikannya (termasuk semantik warna path-stroke pada perangkat nyata). Keluaran tetap bentuk statis (bukan klaim vektor animasi final).
