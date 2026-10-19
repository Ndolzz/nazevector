// js/ui/statusStrip.js — Strip status fitur (jujur: tersedia vs belum diimplementasikan).

export const FEATURE_STATUS = [
  { label: 'Impor & Pratinjau Gambar', available: true },
  { label: 'Pratinjau Siluet Raster', available: true },
  { label: 'Mesin Vektorisasi (SVG)', available: true },
  { label: 'Pratinjau Animasi Lokal', available: true },
  { label: 'Adapter XML Alight Motion', available: true, note: 'statis, satu layer per komponen, per goresan, atau per kontur, tanpa keyframe; mode garis dan mode kontur menunggu uji lapangan' },
  { label: 'Ekspor XML', available: true, note: 'mode isi terbukti tampil di perangkat nyata (TS-1); mode garis (VE-3), mode kontur (AM-6), dan warna asli (CV-1/CV-2) menunggu uji lapangan; keyframe menyusul (AN-1)' },
  { label: 'Instant Preset Remixer', available: true, note: 'impor proyek, deteksi slot aset, penggantian aset terpilih, unduhan XML lokal; penerimaan uri pengganti oleh Alight Motion menunggu uji lapangan' },
];

export function renderFeatureStatusStrip(container) {
  if (!container) return;
  container.textContent = '';
  for (const feature of FEATURE_STATUS) {
    const chip = document.createElement('span');
    chip.className = feature.available ? 'chip chip-ok' : 'chip chip-pending';
    const dot = document.createElement('i');
    dot.className = 'chip-dot';
    chip.appendChild(dot);
    let text =
      feature.label + (feature.available ? ' — tersedia' : ' — belum diimplementasikan');
    if (feature.note) {
      text += ' (' + feature.note + ')';
    }
    chip.appendChild(document.createTextNode(text));
    container.appendChild(chip);
  }
}
