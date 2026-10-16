// js/ui/statusStrip.js — Strip status fitur (jujur: tersedia vs belum diimplementasikan).

export const FEATURE_STATUS = [
  { label: 'Impor & Pratinjau Gambar', available: true },
  { label: 'Pratinjau Siluet Raster', available: true },
  { label: 'Pratinjau Animasi Lokal', available: true },
  { label: 'Mesin Vektorisasi (SVG)', available: false },
  { label: 'Adapter XML Alight Motion', available: false },
  { label: 'Ekspor XML', available: false },
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
    chip.appendChild(
      document.createTextNode(
        feature.label + (feature.available ? ' — tersedia' : ' — belum diimplementasikan')
      )
    );
    container.appendChild(chip);
  }
}
