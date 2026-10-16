// js/modules/animation.js — Preset animasi dan mesin pratinjau lokal (berfungsi).
// Catatan: preset ini untuk pratinjau di peramban. Penerapan preset ke keyframe
// Alight Motion adalah bagian adapter XML (backlog AM-1, AN-1) dan belum tersedia.

export const ANIMATION_PRESETS = [
  {
    id: 'reveal',
    name: 'Silhouette Reveal',
    keyframes: 'nv-reveal',
    direction: 'normal',
  },
  {
    id: 'pulse',
    name: 'Scale Pulse',
    keyframes: 'nv-pulse',
    direction: 'normal',
  },
  {
    id: 'rotation',
    name: 'Rotation Motion',
    keyframes: 'nv-rotation',
    direction: 'alternate',
  },
];

export function getPresetById(id) {
  return ANIMATION_PRESETS.find((preset) => preset.id === id) || ANIMATION_PRESETS[0];
}

export function applyAnimationToElement(element, preset, durationSec, intensityPercent, playState) {
  if (playState === 'idle') {
    element.style.animation = 'none';
    return;
  }
  const intensity = intensityPercent / 100;
  element.style.setProperty('--nv-i', (0.04 + intensity * 0.18).toFixed(3));
  element.style.setProperty('--nv-deg', (8 + intensity * 72).toFixed(1) + 'deg');
  element.style.animationDuration = durationSec + 's';
  element.style.animationTimingFunction = 'ease-in-out';
  element.style.animationIterationCount = 'infinite';
  element.style.animationDirection = preset.direction;
  element.style.animationPlayState = playState === 'playing' ? 'running' : 'paused';
  element.style.animationName = 'none';
  void element.offsetWidth; // paksa reflow agar animasi dimulai ulang.
  element.style.animationName = preset.keyframes;
}
