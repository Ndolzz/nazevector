# Naze Vector

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dengan target ekspor XML untuk Alight Motion. Seluruh pemrosesan berjalan lokal di peramban; tidak ada akun, backend, atau API berbayar.

Status: v0.3.0 — redesign visual "Imperfect by Design" (backlog DS-1 selesai) di atas antarmuka lengkap dan mesin vektorisasi SVG (backlog VE-1 dan VE-2 selesai). Adapter XML dan ekspor masih stub eksplisit.

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

Belum diimplementasikan (ditandai jelas di antarmuka):
- Adapter XML Alight Motion, validasi XML, dan unduhan ekspor. Tombol ekspor menjalankan tahap vektorisasi yang nyata lalu berhenti jujur dengan pesan "belum diimplementasikan"; tidak ada berkas XML palsu yang dihasilkan. Lihat `docs/SDD.md` untuk backlog.

## Menjalankan secara lokal

Situs ini statis tanpa langkah build. Karena menggunakan ES Modules, jalankan melalui server HTTP lokal (membuka `index.html` langsung via `file://` dapat diblokir kebijakan modul pada beberapa peramban):

```bash
# contoh dengan Python
python3 -m http.server 8080
```

Lalu buka http://localhost:8080.

## Menjalankan pengujian

Rangkaian uji mesin vektorisasi (18 kasus, tanpa Node.js) dapat dijalankan di peramban:

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
js/modules/           Pipeline: imageImport, silhouette, vectorEngine (nyata),
                      animation, amAdapter, xmlValidation, exportManager
js/ui/                Komponen UI: pages, uploadZone, previewPanel,
                      vectorPanel, animationPanel, exportPanel, statusStrip
tests/                Rangkaian uji mesin vektorisasi dan harness peramban
docs/SDD.md           Hasil audit, spesifikasi, kriteria penerimaan, backlog
```

## Kompatibilitas

Alight Creative tidak memublikasikan spesifikasi resmi format XML. Hasil VE-1 adalah geometri vektor siap dipakai tahap berikutnya; ini bukan klaim vektor animasi final maupun klaim kompatibilitas impor apa pun. Klaim kompatibilitas hanya akan diberikan setelah berkas XML yang dihasilkan lulus uji impor nyata di Alight Motion.
