// tests/vectorEngine.test.js — Uji mesin vektorisasi VE-1 dan regresi pipeline.
// Modul murni tanpa dependensi: dapat dijalankan lewat tests/index.html di
// peramban, atau oleh host ES Module apa pun (Node, runner sandbox).
// Bagian yang membutuhkan DOM peramban (previewPanel, rendering nyata) tidak
// diuji di sini dan dilaporkan sebagai keterbatasan di docs/SDD.md.

import { vectorizeSilhouette, buildSvgDocument, SIMPLIFICATION_LEVELS } from '../js/modules/vectorEngine.js';
import { requestXmlExport } from '../js/modules/exportManager.js';
import { FEATURE_STATUS } from '../js/ui/statusStrip.js';

export function runVectorEngineTests() {
  const failures = [];
  let total = 0;

  function test(name, fn) {
    total += 1;
    try {
      fn();
    } catch (error) {
      failures.push({ name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Asersi gagal.');
  }

  function assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error((message || 'Nilai tidak sama.') + ' Diharapkan: ' + expected + '; diperoleh: ' + actual + '.');
    }
  }

  function assertThrows(fn, messagePart) {
    try {
      fn();
    } catch (error) {
      if (messagePart && !(error instanceof Error && error.message.includes(messagePart))) {
        throw new Error('Pesan kesalahan tidak sesuai: ' + (error && error.message));
      }
      return;
    }
    throw new Error('Fungsi seharusnya melempar kesalahan.');
  }

  /* ---------- Pembantu mask ---------- */

  function makeMask(width, height, predicate) {
    const mask = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (predicate(x, y)) mask[y * width + x] = 255;
      }
    }
    return { mask, width, height };
  }

  function pointSet(points) {
    return points.map((p) => p[0] + ',' + p[1]).sort().join(';');
  }

  function countInsidePixels(maskData) {
    let count = 0;
    for (let i = 0; i < maskData.mask.length; i += 1) {
      if (maskData.mask[i] > 0) count += 1;
    }
    return count;
  }

  /* ---------- Kasus: bentuk dasar ---------- */

  test('Persegi penuh menghasilkan satu kontur luar dengan 4 titik dan luas tepat', () => {
    const mask = makeMask(12, 12, (x, y) => x >= 3 && x < 8 && y >= 4 && y < 9);
    const result = vectorizeSilhouette(mask, { simplification: 'sedang', color: '#3B82F6' });
    assert(result.ok, 'result.ok harus true');
    assert(!result.empty, 'hasil tidak boleh kosong');
    assertEquals(result.componentCount, 1, 'jumlah komponen');
    assertEquals(result.pathCount, 1, 'jumlah subpath');
    assertEquals(result.subpaths[0].role, 'outer', 'peran kontur');
    assertEquals(result.subpaths[0].vertexCount, 4, 'jumlah titik persegi');
    assertEquals(
      pointSet(result.subpaths[0].points),
      pointSet([[3, 4], [3, 9], [8, 9], [8, 4]]),
      'sudut persegi'
    );
    assertEquals(result.subpaths[0].area, 25, 'luas persegi 5x5');
  });

  test('Lingkaran menghasilkan satu kontur luar tertutup dengan batas konsisten', () => {
    const radius = 8;
    const mask = makeMask(21, 21, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      return dx * dx + dy * dy <= radius * radius;
    });
    const result = vectorizeSilhouette(mask, { simplification: 'sedang' });
    assertEquals(result.componentCount, 1, 'satu komponen');
    assertEquals(result.pathCount, 1, 'satu subpath');
    assertEquals(result.subpaths[0].role, 'outer', 'peran kontur');
    assert(result.subpaths[0].vertexCount >= 8, 'lingkaran butuh minimal 8 titik');
    assert(result.subpaths[0].area >= 150 && result.subpaths[0].area <= 260, 'luas lingkaran masuk akal: ' + result.subpaths[0].area);
    for (const [x, y] of result.subpaths[0].points) {
      assert(x >= 1 && x <= 20 && y >= 1 && y <= 20, 'koordinat dalam batas');
    }
    assert(result.subpaths[0].d.endsWith(' Z'), 'path tertutup dengan Z');
  });

  test('Cincin menghasilkan kontur luar dan lubang internal dengan orientasi berlawanan', () => {
    const mask = makeMask(21, 21, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      const d2 = dx * dx + dy * dy;
      return d2 <= 64 && d2 > 16; // cincin: lubang radius 4 di dalam radius 8
    });
    const result = vectorizeSilhouette(mask, { simplification: 'sedang' });
    assertEquals(result.componentCount, 1, 'satu komponen cincin');
    assertEquals(result.pathCount, 2, 'kontur luar plus lubang');
    const outer = result.subpaths.find((s) => s.role === 'outer');
    const hole = result.subpaths.find((s) => s.role === 'hole');
    assert(outer, 'ada kontur luar');
    assert(hole, 'ada lubang');
    assert(hole.area > 30 && hole.area < 70, 'luas lubang masuk akal: ' + hole.area);
    assert(result.svg.includes('fill-rule="evenodd"'), 'SVG memakai evenodd untuk lubang');
  });

  /* ---------- Kasus: multi komponen ---------- */

  test('Dua komponen terpisah menghasilkan dua kontur luar', () => {
    const mask = makeMask(20, 10, (x, y) => {
      const inA = x >= 1 && x < 5 && y >= 1 && y < 5;
      const inB = x >= 12 && x < 18 && y >= 4 && y < 9;
      return inA || inB;
    });
    const result = vectorizeSilhouette(mask, { simplification: 'sedang' });
    assertEquals(result.componentCount, 2, 'dua komponen');
    assertEquals(result.pathCount, 2, 'dua subpath');
    assertEquals(result.subpaths.filter((s) => s.role === 'outer').length, 2, 'dua kontur luar');
    assertEquals(result.subpaths[0].area, 16, 'luas komponen A');
    assertEquals(result.subpaths[1].area, 30, 'luas komponen B');
  });

  test('Pulau di dalam lubang tetap terdeteksi sebagai komponen terpisah', () => {
    const mask = makeMask(15, 15, (x, y) => {
      const dx = x - 7;
      const dy = y - 7;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 49 && d2 > 9) return true; // cincin luar, lubang radius 3
      return d2 <= 1; // pulau radius 1 di tengah lubang
    });
    const result = vectorizeSilhouette(mask, { simplification: 'sedang' });
    assertEquals(result.componentCount, 2, 'cincin plus pulau');
    assertEquals(result.pathCount, 3, 'luar, lubang, luar pulau');
    assertEquals(result.subpaths.filter((s) => s.role === 'outer').length, 2, 'dua kontur luar');
    assertEquals(result.subpaths.filter((s) => s.role === 'hole').length, 1, 'satu lubang');
  });

  test('Piksel yang bersentangan diagonal terpisah menjadi dua komponen', () => {
    const mask = makeMask(12, 12, (x, y) => (x === 5 && y === 5) || (x === 6 && y === 6));
    const result = vectorizeSilhouette(mask, { simplification: 'sedang' });
    assertEquals(result.componentCount, 2, 'diagonal bukan satu komponen 4-connectivity');
    assertEquals(result.pathCount, 2, 'dua subpath');
    for (const subpath of result.subpaths) {
      assertEquals(subpath.area, 1, 'luas satu piksel');
      assertEquals(subpath.vertexCount, 4, 'empat sudut');
    }
  });

  /* ---------- Kasus: mask kosong dan input tidak valid ---------- */

  test('Mask kosong menghasilkan empty tanpa svg dan tanpa kesalahan', () => {
    const mask = makeMask(10, 10, () => false);
    const result = vectorizeSilhouette(mask, {});
    assert(result.ok, 'ok');
    assert(result.empty, 'empty');
    assertEquals(result.pathCount, 0, 'pathCount 0');
    assertEquals(result.svg, null, 'tidak ada svg');
    assertEquals(result.subpaths.length, 0, 'tanpa subpath');
  });

  test('Input tidak valid melempar kesalahan yang jelas', () => {
    assertThrows(() => vectorizeSilhouette(null, {}), 'Data mask siluet tidak valid.');
    assertThrows(
      () => vectorizeSilhouette({ mask: new Uint8ClampedArray(4), width: 3, height: 2 }, {}),
      'Panjang mask tidak sesuai'
    );
    assertThrows(
      () => vectorizeSilhouette({ mask: new Uint8ClampedArray(9), width: 3, height: 2 }, {}),
      'Panjang mask tidak sesuai'
    );
    assertThrows(
      () => vectorizeSilhouette({ mask: new Uint8ClampedArray(0), width: 0, height: 5 }, {}),
      'Dimensi mask tidak valid'
    );
    assertThrows(
      () => vectorizeSilhouette({ mask: new Uint8ClampedArray(5), width: 2.5, height: 2 }, {}),
      'Dimensi mask tidak valid'
    );
  });

  /* ---------- Kasus: penyederhanaan ---------- */

  test('Tingkat penyederhanaan mengurangi titik secara monoton', () => {
    const mask = makeMask(41, 41, (x, y) => {
      const dx = x - 20;
      const dy = y - 20;
      return dx * dx + dy * dy <= 324; // lingkaran radius 18
    });
    const rendah = vectorizeSilhouette(mask, { simplification: 'rendah' });
    const sedang = vectorizeSilhouette(mask, { simplification: 'sedang' });
    const tinggi = vectorizeSilhouette(mask, { simplification: 'tinggi' });
    assert(
      rendah.vertexCount >= sedang.vertexCount && sedang.vertexCount >= tinggi.vertexCount,
      'jumlah titik harus tak meningkat: ' + rendah.vertexCount + '/' + sedang.vertexCount + '/' + tinggi.vertexCount
    );
    assert(tinggi.vertexCount < rendah.vertexCount, 'tinggi harus benar-benar lebih sederhana');
    assertEquals(rendah.tolerancePx, SIMPLIFICATION_LEVELS.rendah.tolerancePx, 'toleransi rendah');
    assertEquals(sedang.tolerancePx, SIMPLIFICATION_LEVELS.sedang.tolerancePx, 'toleransi sedang');
    assertEquals(tinggi.tolerancePx, SIMPLIFICATION_LEVELS.tinggi.tolerancePx, 'toleransi tinggi');
  });

  test('Override tolerancePx dan nilai simplification tak dikenal ditangani', () => {
    const mask = makeMask(41, 41, (x, y) => {
      const dx = x - 20;
      const dy = y - 20;
      return dx * dx + dy * dy <= 324;
    });
    const longgar = vectorizeSilhouette(mask, { tolerancePx: 12 });
    const defaultLevel = vectorizeSilhouette(mask, { simplification: 'tidak-ada' });
    assertEquals(longgar.tolerancePx, 12, 'override tolerancePx');
    assertEquals(defaultLevel.tolerancePx, SIMPLIFICATION_LEVELS.sedang.tolerancePx, 'fallback ke sedang');
    assert(longgar.vertexCount <= defaultLevel.vertexCount, 'toleransi besar menyederhanakan lebih');
  });

  /* ---------- Kasus: validitas SVG dan batas koordinat ---------- */

  test('SVG berformat valid, tertutup, dan berkoordinat bulat dalam batas', () => {
    let seed = 123456789;
    const random = () => {
      seed = (1103515245 * seed + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const mask = makeMask(60, 40, (x, y) => random() < ((x * 7 + y * 3) % 13) / 26);
    const result = vectorizeSilhouette(mask, { simplification: 'rendah', color: '#22C55E' });
    assert(!result.empty, 'pola acak deterministik menghasilkan siluet');
    assert(result.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), 'deklarasi svg');
    assert(result.svg.includes('viewBox="0 0 60 40"'), 'viewBox sesuai dimensi');
    assert(result.svg.includes('width="60" height="40"'), 'ukuran eksplisit');
    assert(result.svg.includes('fill="#22C55E"'), 'warna tersanitasi');
    assert(result.svg.endsWith('</svg>'), 'tag svg ditutup');
    const dMatch = result.svg.match(/ d="([^"]+)"/);
    assert(dMatch, 'atribut d ada');
    assert(
      /^M\d+ \d+(?: L\d+ \d+)* Z(?: M\d+ \d+(?: L\d+ \d+)* Z)*$/.test(dMatch[1]),
      'format d hanya M/L/Z dengan koordinat bulat'
    );
    for (const subpath of result.subpaths) {
      for (const [x, y] of subpath.points) {
        assert(Number.isInteger(x) && Number.isInteger(y), 'koordinat bulat');
        assert(x >= 0 && x <= 60, 'x dalam batas: ' + x);
        assert(y >= 0 && y <= 40, 'y dalam batas: ' + y);
      }
    }
  });

  test('Warna tidak valid dan buildSvgDocument untuk data kosong ditangani aman', () => {
    const mask = makeMask(8, 8, (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6);
    const result = vectorizeSilhouette(mask, { color: 'javascript:alert(1)' });
    assert(result.svg.includes('fill="#3B82F6"'), 'warna berbahaya diganti default');
    const rebuilt = buildSvgDocument(result, '#abcdef');
    assert(rebuilt.includes('fill="#ABCDEF"'), 'warna valid dinormalisasi');
    assertEquals(buildSvgDocument(null, '#000000'), '', 'data null menghasilkan string kosong');
    const empty = vectorizeSilhouette(makeMask(4, 4, () => false), {});
    assertEquals(buildSvgDocument(empty, '#000000'), '', 'mask kosong menghasilkan string kosong');
  });

  test('Hasil deterministik: input sama menghasilkan keluaran identik', () => {
    const mask = makeMask(21, 21, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      return dx * dx + dy * dy <= 64;
    });
    const a = vectorizeSilhouette(mask, { simplification: 'sedang' });
    const b = vectorizeSilhouette(mask, { simplification: 'sedang' });
    assertEquals(a.svg, b.svg, 'svg identik');
    assertEquals(a.vertexCount, b.vertexCount, 'jumlah titik identik');
  });

  /* ---------- Kasus: konsistensi geometri ---------- */

  test('Setiap piksel dalam mask berada di dalam genap kontur; luar mask di luar', () => {
    const mask = makeMask(20, 20, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      const d2 = dx * dx + dy * dy;
      return (d2 <= 64 && d2 > 16) || d2 <= 1; // cincin plus pulau
    });
    const result = vectorizeSilhouette(mask, { simplification: 'rendah' });
    const crossings = (px, py) => {
      let count = 0;
      for (const subpath of result.subpaths) {
        const pts = subpath.points;
        for (let i = 0; i < pts.length; i += 1) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[(i + 1) % pts.length];
          if (y1 === y2) continue;
          if (py >= Math.min(y1, y2) && py < Math.max(y1, y2)) {
            const intersectX = x1 + ((py - y1) * (x2 - x1)) / (y2 - y1);
          if (px < intersectX) count += 1;
          }
        }
      }
      return count;
    };
    // Paritas lintasan kontur (evenodd): ganjil = terisi, genap = lubang.
    assertEquals(crossings(10, 10), 3, 'pusat pulau dilintasi tiga kontur (ganjil = terisi)');
    assertEquals(crossings(13, 10), 2, 'titik di lubang dilintasi dua kontur (genap = tidak terisi)');
    assertEquals(crossings(10, 5), 1, 'titik pada badan cincin dilintasi satu kontur (terisi)');
    assertEquals(crossings(1, 1), 0, 'titik luar objek tidak dilintasi');
  });

  test('Luas kontur luar konsisten dengan jumlah piksel untuk persegi besar', () => {
    const mask = makeMask(50, 50, (x, y) => x >= 5 && x < 45 && y >= 5 && y < 45);
    const result = vectorizeSilhouette(mask, { simplification: 'tinggi' });
    assertEquals(result.subpaths[0].vertexCount, 4, 'persegi tetap 4 titik');
    assertEquals(result.subpaths[0].area, 1600, 'luas 40x40');
    assertEquals(countInsidePixels(mask), 1600, 'jumlah piksel mask');
  });

  /* ---------- Kasus: integrasi pipeline dan regresi ---------- */

  function makeFakeCanvas(width, height, pixel) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const [r, g, b, a] = pixel(x, y);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    return {
      width,
      height,
      getContext: () => ({
        getImageData: () => ({ data, width, height }),
      }),
    };
  }

  test('requestXmlExport menghasilkan XML statis yang lulus validasi lokal (AM-1 + XV-1)', () => {
    const canvas = makeFakeCanvas(20, 20, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      const inside = dx * dx + dy * dy <= 64;
      return inside ? [20, 20, 30, 255] : [240, 240, 240, 255]; // siluet gelap
    });
    const state = {
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
      exportName: 'siluet-uji',
    };
    const result = requestXmlExport(state);
    assert(result.ok, 'ekspor kini harus berhasil: ' + (result.message || ''));
    assert(typeof result.xml === 'string' && result.xml.length > 0, 'XML dihasilkan');
    assert(result.xml.includes('<scene '), 'akar scene ada');
    assert(result.xml.includes('<shape id="1"'), 'satu bentuk dengan id 1');
    assert(result.xml.includes('title="siluet-uji"'), 'nama ekspor dipakai sebagai judul scene');
    assert(result.xml.includes('<path d="'), 'outline ada pada tag path bentuk (AM-3)');
    assert(!result.xml.includes('<kf '), 'XML statis: tidak ada keyframe (AN-1 belum dikerjakan)');
    assert(result.validation && result.validation.valid === true, 'validasi lokal lulus');
  });

  test('requestXmlExport menolak state tanpa gambar dan mask kosong dengan pesan jelas', () => {
    const noImage = requestXmlExport({ image: null, vector: {} });
    assert(!noImage.ok && noImage.message.includes('Unggah gambar'), 'pesan tanpa gambar');
    const whiteCanvas = makeFakeCanvas(10, 10, () => [250, 250, 250, 255]);
    const emptySilhouette = requestXmlExport({
      image: { name: 'kosong.png', canvas: whiteCanvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
    });
    assert(!emptySilhouette.ok, 'siluet kosong tidak boleh diekspor');
    assert(emptySilhouette.message.includes('Tidak ada siluet'), 'pesan siluet kosong: ' + emptySilhouette.message);
    const nullState = requestXmlExport(null);
    assert(!nullState.ok, 'state null ditolak');
  });

  test('statusStrip menandai fitur tersedia dengan catatan batas yang jujur', () => {
    const vector = FEATURE_STATUS.find((f) => f.label === 'Mesin Vektorisasi (SVG)');
    assert(vector && vector.available === true, 'vektorisasi tersedia');
    const adapter = FEATURE_STATUS.find((f) => f.label === 'Adapter XML Alight Motion');
    assert(adapter && adapter.available === true, 'adapter XML kini tersedia (lokal)');
    assert(
      adapter.note && adapter.note.includes('keyframe'),
      'catatan adapter menyatakan batas statis: ' + (adapter && adapter.note)
    );
    const ekspor = FEATURE_STATUS.find((f) => f.label === 'Ekspor XML');
    assert(ekspor && ekspor.available === true, 'ekspor XML kini tersedia (lokal)');
    assert(
      ekspor.note && ekspor.note.includes('belum terbukti'),
      'catatan ekspor menyatakan impor nyata belum terbukti: ' + (ekspor && ekspor.note)
    );
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
