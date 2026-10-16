// js/ui/animationPanel.js — Kontrol preset animasi, durasi, intensitas, dan pemutaran.

import { qs, qsa } from '../dom.js';

export function initAnimationPanel(store) {
  const tiles = qsa('.preset-tile');
  const durationInput = qs('#animation-duration');
  const durationValue = qs('#animation-duration-value');
  const intensityInput = qs('#animation-intensity');
  const intensityValue = qs('#animation-intensity-value');
  const btnPlay = qs('#btn-play');
  const btnPause = qs('#btn-pause');
  const btnRestart = qs('#btn-restart');

  tiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      update({ preset: tile.dataset.preset });
    });
  });
  durationInput.addEventListener('input', () => {
    durationValue.textContent =
      Number(durationInput.value).toLocaleString('id-ID') + ' detik';
    update({ duration: Number(durationInput.value) });
  });
  intensityInput.addEventListener('input', () => {
    intensityValue.textContent = intensityInput.value + '%';
    update({ intensity: Number(intensityInput.value) });
  });

  btnPlay.addEventListener('click', () => store.set({ playback: 'playing' }));
  btnPause.addEventListener('click', () => store.set({ playback: 'paused' }));
  btnRestart.addEventListener('click', () => {
    store.set({
      playback: 'playing',
      playbackEpoch: store.get().playbackEpoch + 1,
    });
  });

  store.subscribe(render);
  render(store.get());

  function render(state) {
    const hasImage = !!state.image;
    btnPlay.disabled = !hasImage;
    btnPause.disabled = !hasImage;
    btnRestart.disabled = !hasImage;
    tiles.forEach((tile) => {
      tile.classList.toggle('active', tile.dataset.preset === state.animation.preset);
    });
  }

  function update(patch) {
    const { animation } = store.get();
    store.set({ animation: { ...animation, ...patch } });
  }
}
