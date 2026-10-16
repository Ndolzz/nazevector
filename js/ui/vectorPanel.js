// js/ui/vectorPanel.js — Kontrol pengaturan vektor.

import { qs, qsa } from '../dom.js';

export function initVectorPanel(store) {
  const modeInputs = qsa('input[name="vector-mode"]');
  const colorInput = qs('#vector-color');
  const colorValue = qs('#vector-color-hex-label');
  const thresholdInput = qs('#vector-threshold');
  const thresholdValue = qs('#vector-threshold-value');
  const simplificationSelect = qs('#vector-simplification');

  modeInputs.forEach((input) => {
    input.addEventListener('change', () => update({ mode: input.value }));
  });
  colorInput.addEventListener('input', () => {
    colorValue.textContent = colorInput.value;
    update({ color: colorInput.value });
  });
  thresholdInput.addEventListener('input', () => {
    thresholdValue.textContent = thresholdInput.value + '%';
    update({ threshold: Number(thresholdInput.value) });
  });
  simplificationSelect.addEventListener('change', () => {
    update({ simplification: simplificationSelect.value });
  });

  function update(patch) {
    const { vector } = store.get();
    store.set({ vector: { ...vector, ...patch } });
  }
}
