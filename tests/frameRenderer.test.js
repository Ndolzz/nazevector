// Uji komposit bingkai 1280x720 (RV-1).
// Dijalankan melalui harness tests/index.html (butuh server HTTP lokal).

import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  totalFrames,
  createFrameBuffer,
  sampleTrack,
  computeLayerState,
  layerDestBounds,
  compositeFrame,
  renderFrame,
} from '../server/src/render/frameRenderer.js';

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assert gagal');
}

function runCase(name, fn) {
  try {
    fn();
    return { name, ok: true, error: null };
  } catch (error) {
    return { name, ok: false, error: error && error.message ? error.message : String(error) };
  }
}

function summarize(cases) {
  return {
    total: cases.length,
    passed: cases.filter((entry) => entry.ok).length,
    failed: cases.filter((entry) => !entry.ok).length,
    failures: cases.filter((entry) => !entry.ok).map((entry) => ({ name: entry.name, error: entry.error })),
  };
}

function solidImage(width, height, rgba) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = rgba[0];
    pixels[i + 1] = rgba[1];
    pixels[i + 2] = rgba[2];
    pixels[i + 3] = rgba[3];
  }
  return { width, height, pixels };
}

function whiteFrame() {
  const frame = createFrameBuffer();
  for (let i = 0; i < frame.length; i += 4) {
    frame[i] = 255;
    frame[i + 1] = 255;
    frame[i + 2] = 255;
    frame[i + 3] = 255;
  }
  return frame;
}

function pixelAt(frame, x, y) {
  const o = (y * FRAME_WIDTH + x) * 4;
  return [frame[o], frame[o + 1], frame[o + 2], frame[o + 3]];
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function runFrameRendererTests() {
  const cases = [];

  cases.push(runCase('totalFrames menghitung jumlah bingkai', () => {
    assert(totalFrames({ durationMs: 1000, canvas: { fps: 30 } }) === 30, '1000 ms seharusnya 30 bingkai');
    assert(totalFrames({ durationMs: 200, canvas: { fps: 30 } }) === 6, '200 ms seharusnya 6 bingkai');
    assert(totalFrames({ durationMs: 15000, canvas: { fps: 30 } }) === 450, '15000 ms seharusnya 450 bingkai');
  }));

  cases.push(runCase('createFrameBuffer mengalokasikan buffer RGBA 1280x720', () => {
    const frame = createFrameBuffer();
    assert(frame.length === FRAME_WIDTH * FRAME_HEIGHT * 4, 'ukuran buffer salah');
    assert(frame[0] === 0 && frame[frame.length - 1] === 0, 'buffer baru seharusnya nol');
  }));

  cases.push(runCase('sampleTrack menginterpolasi linear antar keyframe', () => {
    const track = [{ t: 0, value: 0 }, { t: 100, value: 100 }];
    assert(sampleTrack(track, 50) === 50, 't=50 seharusnya 50');
    assert(sampleTrack(track, 25) === 25, 't=25 seharusnya 25');
    assert(sampleTrack(track, 75) === 75, 't=75 seharusnya 75');
  }));

  cases.push(runCase('sampleTrack mengunci di luar rentang keyframe', () => {
    const track = [{ t: 10, value: 5 }, { t: 100, value: 50 }];
    assert(sampleTrack(track, -10) === 5, 't sebelum awal seharusnya nilai awal');
    assert(sampleTrack(track, 200) === 50, 't setelah akhir seharusnya nilai akhir');
  }));

  cases.push(runCase('sampleTrack keyframe tunggal mengembalikan nilai tetap', () => {
    assert(sampleTrack([{ t: 0, value: 7 }], 123) === 7, 'keyframe tunggal seharusnya konstan');
  }));

  cases.push(runCase('computeLayerState memberi nilai bawaan tanpa tracks', () => {
    const state = computeLayerState({}, 500);
    assert(state.x === 0 && state.y === 0 && state.scale === 1 && state.rotation === 0 && state.opacity === 1, 'nilai bawaan salah');
  }));

  cases.push(runCase('computeLayerState membaca tracks pada waktu t', () => {
    const layer = { tracks: { x: [{ t: 0, value: 10 }, { t: 100, value: 20 }], opacity: [{ t: 0, value: 0.25 }] } };
    const state = computeLayerState(layer, 50);
    assert(state.x === 15, 'x seharusnya 15');
    assert(state.opacity === 0.25, 'opacity seharusnya 0.25');
  }));

  cases.push(runCase('layerDestBounds konvensi pusat piksel tanpa rotasi', () => {
    const bounds = layerDestBounds({ width: 2, height: 2 }, { x: 640, y: 360, scale: 1, rotation: 0, opacity: 1 });
    assert(bounds.x0 === 639 && bounds.x1 === 640, 'batas x salah: ' + JSON.stringify(bounds));
    assert(bounds.y0 === 359 && bounds.y1 === 360, 'batas y salah: ' + JSON.stringify(bounds));
  }));

  cases.push(runCase('layerDestBounds membesar sebanding skala', () => {
    const bounds = layerDestBounds({ width: 2, height: 2 }, { x: 640, y: 360, scale: 2, rotation: 0, opacity: 1 });
    assert(bounds.x0 === 638 && bounds.x1 === 641, 'batas x skala 2 salah: ' + JSON.stringify(bounds));
    assert(bounds.y0 === 358 && bounds.y1 === 361, 'batas y skala 2 salah: ' + JSON.stringify(bounds));
  }));

  cases.push(runCase('layerDestBounds memperhitungkan rotasi 90 derajat', () => {
    const bounds = layerDestBounds({ width: 4, height: 2 }, { x: 640, y: 360, scale: 1, rotation: 90, opacity: 1 });
    assert(bounds.x0 === 639 && bounds.x1 === 640, 'lebar seharusnya menyusut (2 kolom): ' + JSON.stringify(bounds));
    assert(bounds.y0 === 358 && bounds.y1 === 361, 'tinggi seharusnya membentang (4 baris): ' + JSON.stringify(bounds));
  }));

  cases.push(runCase('compositeFrame menempel gambar solid buram', () => {
    const frame = whiteFrame();
    compositeFrame(frame, solidImage(2, 2, [255, 0, 0, 255]), { x: 640, y: 360, scale: 1, rotation: 0, opacity: 1 });
    assert(arraysEqual(pixelAt(frame, 639, 359), [255, 0, 0, 255]), 'piksel 639,359 salah');
    assert(arraysEqual(pixelAt(frame, 640, 360), [255, 0, 0, 255]), 'piksel 640,360 salah');
    assert(arraysEqual(pixelAt(frame, 100, 100), [255, 255, 255, 255]), 'piksel jauh tidak boleh berubah');
  }));

  cases.push(runCase('compositeFrame menerapkan opacity 0.5 di atas latar putih', () => {
    const frame = whiteFrame();
    compositeFrame(frame, solidImage(2, 2, [255, 0, 0, 255]), { x: 640, y: 360, scale: 1, rotation: 0, opacity: 0.5 });
    const px = pixelAt(frame, 640, 360);
    assert(px[0] === 255, 'merah tetap 255');
    assert(px[1] === 128 && px[2] === 128, 'hijau/biru seharusnya 128 (127.5 dibulatkan), diperoleh ' + px[1]);
    assert(px[3] === 255, 'alfa tetap 255');
  }));

  cases.push(runCase('compositeFrame alfa sumber parsial di atas latar putih', () => {
    const frame = whiteFrame();
    compositeFrame(frame, solidImage(2, 2, [0, 0, 0, 128]), { x: 640, y: 360, scale: 1, rotation: 0, opacity: 1 });
    const px = pixelAt(frame, 640, 360);
    assert(px[0] === 127 && px[1] === 127 && px[2] === 127, 'hitam alfa 128 di atas putih seharusnya 127, diperoleh ' + px[0]);
    assert(px[3] === 255, 'alfa keluaran seharusnya 255');
  }));

  cases.push(runCase('compositeFrame memutar 90 derajat dengan pemetaan invers', () => {
    const frame = whiteFrame();
    compositeFrame(frame, solidImage(4, 2, [255, 0, 0, 255]), { x: 640, y: 360, scale: 1, rotation: 90, opacity: 1 });
    const red = [[639, 360], [640, 360], [640, 358], [640, 361]];
    for (const pair of red) {
      assert(arraysEqual(pixelAt(frame, pair[0], pair[1]), [255, 0, 0, 255]), 'piksel ' + pair[0] + ',' + pair[1] + ' seharusnya merah');
    }
    const white = [[642, 360], [638, 360], [640, 356], [640, 363]];
    for (const pair of white) {
      assert(arraysEqual(pixelAt(frame, pair[0], pair[1]), [255, 255, 255, 255]), 'piksel ' + pair[0] + ',' + pair[1] + ' seharusnya putih');
    }
  }));

  cases.push(runCase('renderFrame mengisi latar putih buram', () => {
    const frame = createFrameBuffer();
    renderFrame(frame, { durationMs: 1000, canvas: { fps: 30 }, layers: [] }, [], 0);
    assert(arraysEqual(pixelAt(frame, 0, 0), [255, 255, 255, 255]), 'piksel 0,0 seharusnya putih');
    assert(arraysEqual(pixelAt(frame, 1279, 719), [255, 255, 255, 255]), 'piksel sudut seharusnya putih');
  }));

  cases.push(runCase('renderFrame menganimasikan posisi antar bingkai', () => {
    const project = {
      durationMs: 1000,
      canvas: { width: 1280, height: 720, fps: 30 },
      layers: [
        {
          type: 'image',
          asset: {},
          tracks: {
            x: [{ t: 0, value: 0 }, { t: 1000, value: 100 }],
            y: [{ t: 0, value: 360 }],
          },
        },
      ],
    };
    const images = [solidImage(2, 2, [0, 0, 255, 255])];
    const frame0 = createFrameBuffer();
    renderFrame(frame0, project, images, 0);
    assert(arraysEqual(pixelAt(frame0, 0, 360), [0, 0, 255, 255]), 'bingkai 0 seharusnya biru di x=0');
    assert(arraysEqual(pixelAt(frame0, 1279, 360), [255, 255, 255, 255]), 'bingkai 0 kanan seharusnya putih');
    const frame29 = createFrameBuffer();
    renderFrame(frame29, project, images, 29);
    assert(arraysEqual(pixelAt(frame29, 96, 360), [0, 0, 255, 255]), 'bingkai 29 seharusnya biru sekitar x=96');
    assert(arraysEqual(pixelAt(frame29, 0, 360), [255, 255, 255, 255]), 'bingkai 29 kiri seharusnya putih');
  }));

  return summarize(cases);
}
