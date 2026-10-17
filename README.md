# Naze Vector

Naze Vector adalah alat berbasis peramban untuk mengubah gambar menjadi siluet vektor animasi dengan target ekspor XML untuk Alight Motion. Seluruh pemrosesan berjalan lokal di peramban; tidak ada akun, backend, atau API berbayar.

Status: v0.4.3 — pratinjau siluet dan vektorisasi dioptimalkan berdasarkan pengukuran (backlog PF-1 selesai: tabel tepi terlacak bit-packed pada mesin kontur, mask pratinjau dihitung pada resolusi kerja maks 700 piksel, debounce penghitungan 150 ms; geometri kontur dan jalur ekspor resolusi penuh tidak berubah) di atas perbaikan ekspor v0.4.2 (AM-3, XV-3: outline shape pada tag path sesuai parser asli), penyelarasan struktur ekspor v0.4.1 (AM-2, XV-2), ekspor XML lokal v0.4.0 (AM-1, XV-1, EX-1), perbaikan navigasi NB-1, redesign visual "Imperfect by Design" (DS-1), dan mesin vektorisasi SVG (VE-1, VE-2). Keluaran XML berupa bentuk statis tanpa keyframe. Catatan faktual: ekspor v0.4.0 ditolak Alight Motion saat diimpor ("Gagal mengunggah. Formatnya tidak benar atau file rusak."); ekspor v0.4.1 berhasil diimpor namun kanvas tampak kosong karena outline pada tag parameter/contour tidak dibaca parser asli; v0.4.2 memindahkan outline ke tag path berdasarkan dekompilasi parser dan ekspor asli yang terbukti menampilkan shape, namun impor nyata yang menampilkan shape belum diuji ulang (backlog TS-1) sehingga tidak ada klaim kompatibilitas.

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
- Ekspor XML Alight Motion (AM-1): tombol ekspor menghitung ulang mask dan vektor dari pengaturan terkini pada resolusi penuh, membangun dokumen `<scene>` berisi satu bentuk statis dari kontur siluet (termasuk lubang internal), memvalidasinya secara lokal (XV-1: well-formedness, atribut wajib, ID unik, rentang waktu, format warna), lalu mengunduhnya sebagai `.xml` (EX-1). Semua berjalan lokal di peramban; nol dependensi.

Belum diimplementasikan (ditandai jelas di antarmuka):
- Penerapan preset animasi menjadi keyframe XML (backlog AN-1) — menunggu verifikasi semantik keyframe melalui uji impor nyata.
- Uji impor ulang nyata di aplikasi Alight Motion pada perangkat Android (backlog TS-1). Ekspor v0.4.0 terbukti gagal diimpor; ekspor v0.4.1 terbukti terimpor namun kanvas kosong; struktur v0.4.2 telah diselaraskan dengan parser asli (outline pada tag path), namun sampai uji ulang membuktikan shape benar-benar terlihat di kanvas, proyek ini tidak mengklaim kompatibilitas impor apa pun. Lihat `docs/SDD.md` untuk backlog.
- Pengukuran waktu pratinjau pada perangkat Android nyata (PF-1 dibuktikan dengan penghitungan operasi dan kesetaraan keluaran; lihat `docs/SDD.md` bagian 13).

## Menjalankan secara lokal

Situs ini statis tanpa langkah build. Karena menggunakan ES Modules, jalankan melalui server HTTP lokal (membuka `index.html` langsung via `file://` dapat diblokir kebijakan modul pada beberapa peramban):

```bash
# contoh dengan Python
python3 -m http.server 8080
```

Lalu buka http://localhost:8080.

## Menjalankan pengujian

Rangkaian uji vektorisasi, ekspor XML, regresi impor, dan pembantu pratinjau (53 kasus: 18 VE-1 + 21 AM-1/XV-1/EX-1 + 9 regresi AM-2/AM-3/XV-2/XV-3 termasuk geometri path nonkosong + 5 pembantu pratinjau P1, tanpa Node.js) dapat dijalankan di peramban:

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
tests/                Rangkaian uji vektorisasi, adapter/ekspor XML, regresi
                      impor XML, pembantu pratinjau, harness peramban
docs/SDD.md           Hasil audit, spesifikasi, kriteria penerimaan, backlog
```

## Kompatibilitas

Alight Creative tidak memublikasikan spesifikasi resmi format XML. Adapter dibangun dari dokumentasi komunitas hasil rekayasa balik (alight-motion-docs) dan, sejak v0.4.1, dari pembanding langsung tiga ekspor asli Alight Motion; sejak v0.4.2, dari dekompilasi parser asli (ShapeElementTypeImpl: outline shape imported hanya dibaca dari tag path) dan ekspor asli yang terbukti menampilkan shape (Proyek Baru 19.xml memuat `<path d="M ... Z"/>` langsung di bawah `<shape>`). Bukti lapangan: ekspor v0.4.0 ditolak Alight Motion Android dengan pesan "Gagal mengunggah. Formatnya tidak benar atau file rusak."; ekspor v0.4.1 berhasil diimpor namun kanvas kosong — tag parameter/contour diabaikan parser sehingga shape tanpa outline. Perbaikan AM-3 memindahkan outline ke tag path dan validator XV-3 menolak shape tanpa outline path sebelum unduhan; regresi geometri memastikan path nonkosong dengan koordinat terpusat, pengulangan titik awal, dan lubang di dalam kontur luar. Keluaran tetap bentuk statis (bukan klaim vektor animasi final). Validasi struktural otomatis terpisah dari hasil impor nyata: klaim kompatibilitas hanya akan diberikan setelah berkas XML hasil v0.4.2 terbukti menampilkan shape di kanvas pada uji impor nyata di Alight Motion (backlog TS-1).
