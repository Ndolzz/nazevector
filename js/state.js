// js/state.js — Store status aplikasi (pub/sub sederhana, tanpa dependensi).

export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  function set(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    get: () => state,
    set,
    subscribe(listener) {
      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    },
  };
}

export const initialState = {
  page: 'beranda',
  image: null,
  importError: null,
  isProcessing: false,
  vector: {
    mode: 'gelap',
    color: '#3B82F6',
    threshold: 50,
    simplification: 'sedang',
  },
  animation: {
    preset: 'reveal',
    duration: 2.5,
    intensity: 55,
  },
  playback: 'idle', // 'idle' | 'playing' | 'paused'
  playbackEpoch: 0,
  exportName: 'naze-vector-siluet',
  // AM-5/AM-6: mode representasi ekspor — 'isi' (outline terisi per komponen,
  // AM-4), 'garis' (centerline per goresan, VE-3), atau 'kontur' (satu layer
  // per kontur: kontur luar maupun lubang, AM-6).
  exportRepresentation: 'isi',
  // CV-1/CV-2: mode warna ekspor — 'pilihan' (satu warna global) atau
  // 'asli' (sampling warna dominan piksel sumber per komponen CV-1,
  // atau per kontur pada mode kontur CV-2).
  exportColorMode: 'pilihan',
  exportMessage: null,
};
