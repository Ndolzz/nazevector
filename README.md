# Naze Vector

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dengan target ekspor XML untuk Alight Motion. Seluruh pemrosesan berjalan lokal di peramban; tidak ada akun, backend, atau API berbayar.

Status: v0.4.0 — ekspor XML lokal (backlog AM-1, XV-1, EX-1 selesai) di atas perbaikan navigasi NB-1, redesign visual "Imperfect by Design" (DS-1), dan mesin vektorisasi SVG (VE-1, VE-2). Keluaran XML berupa bentuk statis tanpa keyframe; kompatibilitas impor di aplikasi Alight Motion belum diuji (backlog TS-1).

## Identitas visual (v0.3.0)

Situs menggunakan sistem desain "Imperfect by Design": latar krem bergaris grid tipis, tipografi hitam editorial tebal, outline hitam tegas pada kartu dan tombol, bayangan solid pendek, serta aksen konsisten kuning, oranye, ungu, dan hijau sebagai penanda fungsi (bukan dekorasi acak). Tidak ada dependensi CSS/JS eksternal; seluruh identitas diimplementasikan di `styles/main.css`. Redesign ini hanya menyentuh presentasi — perilaku pipeline, kontrak modul, dan hasil SVG tidak berubah.

## Status fitur

Berfungsi:
- Navigasi Studio, Preset, Tentang (satu halaman, perutean lokal).
- Unggah gambar via pemilih berkas dan drag-and-drop (PNG, JPG, WebP; maks 15 MB).
- Pratinjau gambar asli dengan metadata; tombol ganti dan hapus gambar.
- Pratinjau siluet raster dengan mode gelap/terang, warna, dan ambang segmentasi.
- Mesin vektorisasi: mask siluet menjadi path SVG tertutup dengan kontur luar, lubang internal, beberapa komponen terpisah (termasuk pulau di dalam lubang), dan penyederhanaan bertingkat (rendah/sedang/tinggi). Koordinat proporsional terhadap dimensi mask; seluruhnya lokal, nol dependensi.
- Pratinjau hasil vektor (SVG) beserta statistik komponen/kontur/titik; perubahan gambar, ambang, mode, warna, dan penyederhanaan langsung memperbarui hasil.
- Pratinjau animasi lokal: Silhouette Reveal, Scale Pulse, Rotation Motion, dengan durasi, intensitas, putar, jeda, ulangi; animasi juga diterapkan pada hasil vektor.
- Ekspor XML Alight Motion (AM-1): tombol ekspor menghitung ulang mask dan vektor dari pengaturan terkini, membangun dokumen `<scene>` berisi satu bentuk statis dari kontur siluet (termasuk lubang internal), memvalidasinya secara lokal (XV-1: well-formedness, atribut wajib, ID unik, rentang waktu, format warna), lalu mengunduhnya sebagai `.xml` (EX-1). Semua berjalan lokal di peramban; nol dependensi.

Belum diimplementasikan (ditandai jelas di antarmuka):
- Penerapan preset animasi menjadi keyframe XML (backlog AN-1) — menunggu verifikasi semantik keyframe melalui uji impor nyata.
- Uji impor nyata di aplikasi Alight Motion pada perangkat Android (backlog TS-1). Tanpa bukti tersebut, proyek ini tidak mengklaim kompatibilitas impor apa pun. Lihat `docs/SDD.md` untuk backlog.

## Menjalankan secara lokal

Situs ini statis tanpa langkah build. Karena menggunakan ES Modules, jalankan melalui server HTTP lokal (membuka `index.html` langsung via `file://` dapat diblokir kebijakan modul pada beberapa peramban):

```bash
# contoh dengan Python
python3 -m http.server 8080
```

Lalu buka http://localhost:8080.

## Menjalankan pengujian

Rangkaian uji vektorisasi dan ekspor XML (39 kasus: 18 VE-1 + 21 AM-1/XV-1/EX-1, tanpa Node.js) dapat dijalankan di peramban:

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
                      animation, amAdapter (XML statis), xmlValidation,
                      exportManager (ekspor lokal)
js/ui/                Komponen UI: pages, uploadZone, previewPanel,
                      vectorPanel, animationPanel, exportPanel, statusStrip
tests/                Rangkaian uji vektorisasi, adapter/ekspor XML, harness peramban
docs/SDD.md           Hasil audit, spesifikasi, kriteria penerimaan, backlog
```

## Kompatibilitas

Alight Creative tidak memublikasikan spesifikasi resmi format XML. Adapter AM-1 dibangun dari dokumentasi komunitas hasil rekayasa balik (alight-motion-docs) dan menghasilkan XML yang lulus validasi lokal, namun hal itu bukan klaim vektor animasi final (keluaran masih bentuk statis) maupun klaim kompatibilitas impor. Klaim kompatibilitas hanya akan diberikan setelah berkas XML yang dihasilkan lulus uji impor nyata di Alight Motion.
