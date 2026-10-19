// js/main.js — Orkestrasi aplikasi Naze Vector.

import { createStore, initialState } from './state.js';
import { qs } from './dom.js';
import { initRouting } from './ui/pages.js';
import { initUploadZone } from './ui/uploadZone.js';
import { initPreviewPanel } from './ui/previewPanel.js';
import { initVectorPanel } from './ui/vectorPanel.js';
import { initAnimationPanel } from './ui/animationPanel.js';
import { initExportPanel } from './ui/exportPanel.js';
import { initPresetRemixerPanel } from './ui/presetRemixerPanel.js';
import { renderFeatureStatusStrip } from './ui/statusStrip.js';

const store = createStore(initialState);

initRouting(store);
initUploadZone(store);
initPreviewPanel(store);
initVectorPanel(store);
initAnimationPanel(store);
initExportPanel(store);
initPresetRemixerPanel();
renderFeatureStatusStrip(qs('#feature-status-strip'));
renderFeatureStatusStrip(qs('#home-status-strip'));
