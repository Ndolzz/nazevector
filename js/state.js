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
  page: 'studio',
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
  exportMessage: null,
};
