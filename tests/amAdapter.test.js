// tests/amAdapter.test.js — Uji adapter XML Alight Motion (AM-1 + AM-3), validasi
// XML (XV-1 + XV-3), dan integrasi ekspor (EX-1). Modul murni tanpa dependensi
// DOM: dapat dijalankan lewat tests/index.html di peramban atau oleh host ES
// Module apa pun. Bagan kanvas palsu (fake canvas) meniru antarmuka getImageData
// yang dibaca silhouette.js; bagian unduhan berkas (Blob/anchor) memerlukan
// peramban dan tidak diuji di sini (dilaporkan sebagai keterbatasan di
// docs/SDD.md bagian 12).

import { buildAlightMotionXml } from '../js/modules/amAdapter.js';
import { validateAlightMotionXml } from '../js/modules/xmlValidation.js';
import { requestXmlExport } from '../js/modules/exportManager.js';

export function runAmAdapterTests() {
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

  function assertIncludes(haystack, needle, message) {
    if (!String(haystack).includes(needle)) {
      throw new Error((message || 'Fragmen tidak ditemukan.') + ' Dicarikan: "' + needle + '"');
    }
  }

  function assertThrows(fn, messagePart, label) {
    try {
      fn();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (messagePart && !text.includes(messagePart)) {
        throw new Error(label + ' melempar, namun pesan tidak memuat "' + messagePart + '": ' + text);
      }
      return;
    }
    throw new Error(label + ' harus melempar Error.');
  }

  // Data vektor minimal menyerupai keluaran vectorizeSilhouette: kontur berupa
  // cincin titik TANPA duplikat titik penutup (traceLoop membuang titik terakhir
  // yang sama dengan titik awal; pengulangan titik awal ditambahkan adapter).
  function makeVectorData(overrides = {}) {
    return {
      ok: true,
      empty: false,
      svg: '<svg></svg>',
      width: 100,
      height: 80,
      pathCount: 1,
      componentCount: 1,
      vertexCount: 4,
      tolerancePx: 1.5,
      subpaths: [
        {
          role: 'outer',
          points: [
            [0, 0],
            [100, 0],
            [100, 80],
            [0, 80],
          ],
          d: 'M0 0 L100 0 L100 80 L0 80 Z',
          vertexCount: 4,
          area: 8000,
        },
      ],
      ...overrides,
    };
  }

  function makeRingVectorData() {
    return makeVectorData({
      width: 50,
      height: 50,
      pathCount: 2,
      componentCount: 1,
      vertexCount: 8,
      subpaths: [
        {
          role: 'outer',
          points: [
            [0, 0],
            [50, 0],
            [50, 50],
            [0, 50],
          ],
          d: 'M0 0 L50 0 L50 50 L0 50 Z',
          vertexCount: 4,
          area: 2500,
        },
        {
          role: 'hole',
          points: [
            [10, 10],
            [40, 10],
            [40, 40],
            [10, 40],
          ],
          d: 'M10 10 L40 10 L40 40 L10 40 Z',
          vertexCount: 4,
          area: 900,
        },
      ],
    });
  }

  // AM-4: dua komponen terpisah pada satu kanvas. Komponen A (dengan lubang)
  // berada di [0..30]x[0..20], komponen B di [60..90]x[40..60]; pivot bbox A
  // = (15,10), pivot bbox B = (75,50).
  function makeTwoComponentVectorData() {
    return makeVectorData({
      pathCount: 3,
      componentCount: 2,
      vertexCount: 12,
      subpaths: [
        {
          role: 'outer',
          points: [
            [0, 0],
            [30, 0],
            [30, 20],
            [0, 20],
          ],
          d: 'M0 0 L30 0 L30 20 L0 20 Z',
          vertexCount: 4,
          area: 600,
        },
        {
          role: 'hole',
          points: [
            [10, 10],
            [20, 10],
            [20, 15],
            [10, 15],
          ],
          d: 'M10 10 L20 10 L20 15 L10 15 Z',
          vertexCount: 4,
          area: 50,
        },
        {
          role: 'outer',
          points: [
            [60, 40],
            [90, 40],
            [90, 60],
            [60, 60],
          ],
          d: 'M60 40 L90 40 L90 60 L60 60 Z',
          vertexCount: 4,
          area: 600,
        },
      ],
    });
  }

  // AM-4: cincin dengan pulau di dalam lubangnya. Kontur luar [0..40]² dan
  // pulau [17..23]² sama-sama role 'outer'; lubang [10..30]² role 'hole'.
  // Kedua pivot bbox = (20,20).
  function makeIslandVectorData() {
    return makeVectorData({
      width: 40,
      height: 40,
      pathCount: 3,
      componentCount: 2,
      vertexCount: 12,
      subpaths: [
        {
          role: 'outer',
          points: [
            [0, 0],
            [40, 0],
            [40, 40],
            [0, 40],
          ],
          d: 'M0 0 L40 0 L40 40 L0 40 Z',
          vertexCount: 4,
          area: 1600,
        },
        {
          role: 'hole',
          points: [
            [10, 10],
            [30, 10],
            [30, 30],
            [10, 30],
          ],
          d: 'M10 10 L30 10 L30 30 L10 30 Z',
          vertexCount: 4,
          area: 400,
        },
        {
          role: 'outer',
          points: [
            [17, 17],
            [23, 17],
            [23, 23],
            [17, 23],
          ],
          d: 'M17 17 L23 17 L23 23 L17 23 Z',
          vertexCount: 4,
          area: 36,
        },
      ],
    });
  }

  // Ambil segmen XML per elemen shape (untuk membuktikan lubang berada pada
  // layer komponen yang benar, bukan pada layer lain).
  function splitByShape(xml) {
    return xml.split('<shape ').slice(1).map((segment) => '<shape ' + segment.split('</shape>')[0]);
  }

  const OPTIONS = { title: 'Uji', totalTime: 2500, fps: '30', modifiedTime: 1700000000000, color: '#3B82F6' };

  /* ---------- AM-1: pembangkit XML ---------- */

  test('AM-1/AM-2: struktur scene lengkap dengan prolog dan atribut wajib', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assert(xml.startsWith("<?xml version='1.0' encoding='UTF-8' ?>"), 'prolog XML ada');
    assertIncludes(xml, '<scene ', 'akar scene');
    for (const attr of [
      'precompose="dynamicResolution"',
      'retime="freeze"',
      'retimeAdaptFPS="false"',
    ]) {
      assertIncludes(xml, attr, 'atribut pola ekspor asli (AM-2)');
    }
    for (const attr of [
      'title="Uji"',
      'width="100"',
      'height="80"',
      'exportWidth="100"',
      'exportHeight="80"',
      'bgcolor="#00000000"',
      'totalTime="2500"',
      'fps="30"',
      'modifiedTime="1700000000000"',
      'amver="1028425"',
      'ffver="106"',
      'amplatform="android"',
    ]) {
      assertIncludes(xml, attr, 'atribut scene');
    }
  });

  test('AM-1/AM-3: satu shape imported dengan transform, fillColor, dan outline path', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assertIncludes(xml, '<shape id="1" label="Shape 1" startTime="0" endTime="2500" fillType="color" mediaFillMode="fill">', 'atribut shape (mediaFillMode, AM-2)');
    assert(!xml.includes(' s="'), 'bentuk imported tidak memakai template s');
    assertIncludes(xml, '<location value="50.000000,40.000000,0.000000"/>', 'location di pusat kanvas');
    assertIncludes(xml, '<fillColor value="#FF3B82F6"/>', 'warna #AARRGGBB');
    assertIncludes(xml, '<path d="', 'outline pada tag path (AM-3, pola parser asli)');
    assert(!xml.includes('<parameter>'), 'outline tidak lagi memakai tag parameter');
    assert(!xml.includes('<contour'), 'outline tidak lagi memakai tag contour');
  });

  test('AM-1/AM-3: outline digeser agar terpusat pada location dengan pola serializer asli', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assertIncludes(xml, 'M -50 -40L 50 -40L 50 40L -50 40L -50 -40Z', 'outline digeser (-w/2, -h/2), titik awal diulang sebelum Z');
  });

  test('AM-1/AM-3: multi-subpath (cincin) diserialisasi dalam satu tag path', () => {
    const xml = buildAlightMotionXml(makeRingVectorData(), OPTIONS);
    assertIncludes(xml, 'M -25 -25L 25 -25L 25 25L -25 25L -25 -25Z', 'outline luar');
    assertIncludes(xml, 'M -15 -15L 15 -15L 15 15L -15 15L -15 -15Z', 'outline lubang');
    assertIncludes(xml, 'ZM -15 -15', 'token ZM antar kontur (joinToString separator kosong)');
    assert((xml.match(/<path /g) || []).length === 1, 'kedua subpath berada dalam satu tag path gabungan');
  });

  test('AM-1: warna divalidasi dan dinormalisasi huruf besar', () => {
    const xmlLower = buildAlightMotionXml(makeVectorData(), { ...OPTIONS, color: '#ff7a29' });
    assertIncludes(xmlLower, '<fillColor value="#FFFF7A29"/>', 'warna lowercase dinormalisasi');
    assertThrows(
      () => buildAlightMotionXml(makeVectorData(), { ...OPTIONS, color: '#GG0000' }),
      'Warna siluet tidak valid',
      'warna tidak valid'
    );
  });

  test('AM-1: id elemen unik dan naik dari 1', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    const ids = [...xml.matchAll(/\sid="(\d+)"/g)].map((m) => m[1]);
    assert(ids.length >= 1, 'ada minimal satu id');
    assert(new Set(ids).size === ids.length, 'id unik: ' + ids.join(','));
    assert(ids[0] === '1', 'id pertama 1');
  });

  test('AM-1: deterministik untuk input dan opsi identik', () => {
    const a = buildAlightMotionXml(makeVectorData(), OPTIONS);
    const b = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assert(a === b, 'XML identik untuk input identik');
    const c = buildAlightMotionXml(makeRingVectorData(), OPTIONS);
    assert(a !== c, 'XML berbeda untuk kontur berbeda');
  });

  test('AM-1: judul di-escape terhadap karakter XML', () => {
    const xml = buildAlightMotionXml(makeVectorData(), { ...OPTIONS, title: 'A<b & "c">' });
    assertIncludes(xml, 'title="A&lt;b &amp; &quot;c&quot;&gt;"', 'judul di-escape');
  });

  test('AM-1: input tidak valid ditolak dengan pesan Indonesia', () => {
    assertThrows(() => buildAlightMotionXml(null, OPTIONS), 'Data vektor tidak valid', 'input null');
    assertThrows(
      () => buildAlightMotionXml({ width: 100, height: 80, subpaths: [] }, OPTIONS),
      'tidak ada kontur',
      'subpaths kosong'
    );
    assertThrows(
      () => buildAlightMotionXml({ width: 0, height: 80, subpaths: [{}] }, OPTIONS),
      'dimensi',
      'dimensi nol'
    );
    assertThrows(
      () => buildAlightMotionXml({ width: 100.5, height: 80, subpaths: [{}] }, OPTIONS),
      'dimensi',
      'dimensi pecahan'
    );
    assertThrows(
      () =>
        buildAlightMotionXml(
          { width: 10, height: 10, subpaths: [{ role: 'outer', points: [[0, 0], [1, 0]] }] },
          OPTIONS
        ),
      'tidak lengkap',
      'kontur kurang dari 4 titik'
    );
    assertThrows(
      () => buildAlightMotionXml(makeVectorData(), { ...OPTIONS, totalTime: 0 }),
      'totalTime',
      'totalTime nol'
    );
    assertThrows(
      () => buildAlightMotionXml(makeVectorData(), { ...OPTIONS, fps: 'nol' }),
      'fps',
      'fps bukan angka'
    );
  });

  /* ---------- XV-1: validasi XML ---------- */

  test('XV-1: XML hasil adapter lulus validasi', () => {
    const result = validateAlightMotionXml(buildAlightMotionXml(makeVectorData(), OPTIONS));
    assert(result.valid === true, 'valid: ' + JSON.stringify(result.issues));
    assert(Array.isArray(result.issues) && result.issues.length === 0, 'tanpa isu');
  });

  test('XV-1: XML rusak ditolak (tag tidak ditutup)', () => {
    const result = validateAlightMotionXml('<scene><shape></scene>');
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'tidak ditutup', 'pesan tag terbuka');
  });

  test('XV-1: tag tidak cocok ditolak', () => {
    const result = validateAlightMotionXml('<scene></other>');
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'tidak cocok', 'pesan tag tidak cocok');
  });

  test('XV-1: akar bukan scene ditolak', () => {
    const result = validateAlightMotionXml('<svg width="10"></svg>');
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'scene', 'pesan akar scene');
  });

  test('XV-1: atribut wajib scene hilang dilaporkan', () => {
    const result = validateAlightMotionXml('<scene title="x"></scene>');
    assert(result.valid === false, 'tidak valid');
    const all = result.issues.join(' ');
    assertIncludes(all, 'width', 'atribut width hilang');
    assertIncludes(all, 'totalTime', 'atribut totalTime hilang');
  });

  test('XV-1: id duplikat ditolak', () => {
    const result = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FF000000" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><path d="M 0 0L 1 0Z"/></shape>' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><path d="M 0 0L 1 0Z"/></shape>' +
        '</scene>'
    );
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'duplikat', 'pesan id duplikat');
  });

  test('XV-1: endTime melebihi totalTime ditolak', () => {
    const result = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FF000000" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="200" fillType="color"><path d="M 0 0L 1 0Z"/></shape>' +
        '</scene>'
    );
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'totalTime', 'pesan endTime melebihi totalTime');
  });

  test('XV-1/XV-3: fillColor dan bgcolor harus #AARRGGBB; outline path tidak boleh kosong', () => {
    const badColor = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FFF" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><fillColor value="#3B82F6"/><path d="M 0 0L 1 0Z"/></shape>' +
        '</scene>'
    );
    assert(badColor.valid === false, 'tidak valid');
    const all = badColor.issues.join(' ');
    assertIncludes(all, 'bgcolor', 'bgcolor harus 8 heksadesimal');
    assertIncludes(all, 'fillColor', 'fillColor harus 8 heksadesimal');

    const emptyPath = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FF000000" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><path d=""/></shape>' +
        '</scene>'
    );
    assert(emptyPath.valid === false, 'outline path kosong tidak valid');
    assertIncludes(emptyPath.issues.join(' '), 'path', 'pesan outline path kosong (XV-3)');
  });

  test('XV-1: input bukan string ditolak', () => {
    const result = validateAlightMotionXml(null);
    assert(result.valid === false, 'null ditolak');
    const number = validateAlightMotionXml(42);
    assert(number.valid === false, 'angka ditolak');
    const empty = validateAlightMotionXml('   ');
    assert(empty.valid === false, 'string kosong ditolak');
  });

  /* ---------- EX-1: integrasi exportManager ---------- */

  function makeFakeCanvas(width, height, pixelAt) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a] = pixelAt(x, y);
        const i = (y * width + x) * 4;
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

  test('EX-1: requestXmlExport menghasilkan XML valid dari kanvas siluet', () => {
    const canvas = makeFakeCanvas(20, 20, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      return dx * dx + dy * dy <= 64 ? [20, 20, 30, 255] : [240, 240, 240, 255];
    });
    const state = {
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
      exportName: 'siluet-cincin-uji',
    };
    const result = requestXmlExport(state);
    assert(result.ok === true, 'ekspor berhasil: ' + (result.message || ''));
    assert(result.validation && result.validation.valid === true, 'validasi lokal lulus');
    assertIncludes(result.xml, '<scene ', 'scene dihasilkan');
    assertIncludes(result.xml, 'title="siluet-cincin-uji"', 'judul dari exportName');
  });

  test('EX-1: state tanpa gambar, mask kosong, dan state null gagal jujur', () => {
    const noImage = requestXmlExport({ image: null, vector: {} });
    assert(noImage.ok === false && noImage.message.includes('Unggah gambar'), 'pesan tanpa gambar');
    const whiteCanvas = makeFakeCanvas(10, 10, () => [250, 250, 250, 255]);
    const emptySilhouette = requestXmlExport({
      image: { name: 'kosong.png', canvas: whiteCanvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
    });
    assert(emptySilhouette.ok === false, 'siluet kosong tidak boleh diekspor');
    assertIncludes(emptySilhouette.message, 'Tidak ada siluet', 'pesan siluet kosong');
    const nullState = requestXmlExport(null);
    assert(nullState.ok === false, 'state null ditolak');
  });

  test('EX-1: warna state.vector diteruskan ke fillColor XML', () => {
    const canvas = makeFakeCanvas(20, 20, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      return dx * dx + dy * dy <= 64 ? [20, 20, 30, 255] : [240, 240, 240, 255];
    });
    const result = requestXmlExport({
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#8C6CFF' },
      exportName: 'uji-warna',
    });
    assert(result.ok === true, 'ekspor berhasil');
    assertIncludes(result.xml, '<fillColor value="#FF8C6CFF"/>', 'warna state diteruskan');
  });

  /* ---------- AM-4 (v0.4.4): pemisah layer per komponen ---------- */

  test('AM-4: siluet satu komponen tetap menghasilkan tepat satu shape (regresi)', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assert((xml.match(/<shape /g) || []).length === 1, 'tepat satu shape untuk satu komponen');
    assert((xml.match(/<path /g) || []).length === 1, 'satu tag path per shape');
    assertIncludes(xml, '<shape id="1" label="Shape 1"', 'id dan label layer pertama tetap 1');
    assertIncludes(xml, '<location value="50.000000,40.000000,0.000000"/>', 'pivot = pusat bbox kontur luar');
    assertIncludes(xml, 'M -50 -40L 50 -40L 50 40L -50 40L -50 -40Z', 'outline digeser ke pivot bbox');
    assert(validateAlightMotionXml(xml).valid === true, 'XML satu komponen lulus validator');
  });

  test('AM-4: dua komponen dipisah menjadi dua shape (layer) dengan pivot masing-masing', () => {
    const xml = buildAlightMotionXml(makeTwoComponentVectorData(), OPTIONS);
    assert((xml.match(/<shape /g) || []).length === 2, 'dua komponen menghasilkan dua shape');
    assert((xml.match(/<path /g) || []).length === 2, 'satu tag path per shape (dua total)');
    const ids = [...xml.matchAll(/\slabel="Shape (\d+)"/g)].map((m) => m[1]);
    assert(ids.join(',') === '1,2', 'label layer Shape 1 lalu Shape 2 sesuai urutan pindai: ' + ids.join(','));
    assert(new Set(ids).size === ids.length, 'id/label unik per layer');
    assertIncludes(xml, '<location value="15.000000,10.000000,0.000000"/>', 'pivot layer A = pusat bbox A (15,10)');
    assertIncludes(xml, '<location value="75.000000,50.000000,0.000000"/>', 'pivot layer B = pusat bbox B (75,50)');
    const shapes = splitByShape(xml);
    assert(shapes.length === 2, 'dua segmen shape terpisah');
    assertIncludes(shapes[0], 'M -15 -10L 15 -10L 15 10L -15 10L -15 -10Z', 'outline luar A digeser ke pivot A');
    assertIncludes(shapes[0], 'ZM -5 0L 5 0L 5 5L -5 5L -5 0Z', 'lubang A bergabung pada layer A (token ZM)');
    assert(!shapes[1].includes('ZM'), 'layer B tidak memuat token ZM (tanpa lubang)');
    assertIncludes(shapes[1], 'M -15 -10L 15 -10L 15 10L -15 10L -15 -10Z', 'outline B digeser ke pivot B');
    assert(validateAlightMotionXml(xml).valid === true, 'XML dua komponen lulus validator');
  });

  test('AM-4: pulau di dalam lubang menjadi layer tersendiri, lubang tetap di layer cincin', () => {
    const xml = buildAlightMotionXml(makeIslandVectorData(), OPTIONS);
    assert((xml.match(/<shape /g) || []).length === 2, 'cincin dan pulau menghasilkan dua shape');
    const shapes = splitByShape(xml);
    assert(shapes.length === 2, 'dua segmen shape terpisah');
    assertIncludes(shapes[0], '<location value="20.000000,20.000000,0.000000"/>', 'pivot cincin = pusat bbox luar');
    assertIncludes(
      shapes[0],
      'M -20 -20L 20 -20L 20 20L -20 20L -20 -20ZM -10 -10L 10 -10L 10 10L -10 10L -10 -10Z',
      'cincin: kontur luar dan lubang bergabung pada satu layer (token ZM)'
    );
    assert(!shapes[0].includes('M -3 -3'), 'pulau tidak ikut layer cincin');
    assertIncludes(shapes[1], 'M -3 -3L 3 -3L 3 3L -3 3L -3 -3Z', 'pulau menjadi outline layer tersendiri');
    assertIncludes(shapes[1], '<location value="20.000000,20.000000,0.000000"/>', 'pivot pulau = pusat bbox pulau');
    assert((xml.match(/ZM/g) || []).length === 1, 'token ZM hanya muncul pada layer cincin');
    assert(validateAlightMotionXml(xml).valid === true, 'XML cincin+pulau lulus validator');
  });

  /* ---------- AM-5 (v0.5.0): mode garis centerline dan warna per komponen ---------- */

  test('AM-5: componentColors mode isi menulis fillColor berbeda per layer komponen', () => {
    const xml = buildAlightMotionXml(makeTwoComponentVectorData(), {
      ...OPTIONS,
      componentColors: ['#E61923', '#2846E1'],
    });
    const shapes = splitByShape(xml);
    assert(shapes.length === 2, 'dua layer komponen');
    assertIncludes(shapes[0], '<fillColor value="#FFE61923"/>', 'fillColor layer A = warna komponen A');
    assertIncludes(shapes[1], '<fillColor value="#FF2846E1"/>', 'fillColor layer B = warna komponen B');
    assert(!xml.includes('#FF3B82F6'), 'warna global tidak dipakai bila componentColors tersedia');
    assert(validateAlightMotionXml(xml).valid === true, 'XML warna per komponen lulus validator');
  });

  test('AM-5: mode garis menulis satu shape per centerline dengan path-stroke tanpa Z', () => {
    const centerlineData = {
      ok: true,
      empty: false,
      width: 100,
      height: 80,
      lines: [
        { points: [[10, 10], [10, 60]], closed: false, width: 2.5, componentIndex: 0 },
        { points: [[50, 40], [90, 40], [90, 70]], closed: false, width: 1.5, componentIndex: 1 },
      ],
    };
    const xml = buildAlightMotionXml(makeTwoComponentVectorData(), {
      ...OPTIONS,
      representation: 'garis',
      centerlineData,
    });
    assert((xml.match(/<shape /g) || []).length === 2, 'satu layer per garis');
    assert((xml.match(/<path /g) || []).length === 2, 'satu tag path per garis');
    assert(!xml.includes('Z'), 'path garis tanpa penutup Z');
    assertIncludes(
      xml,
      '<path-stroke direction="centered" end-size="1.500000"><size value="2.500000"/></path-stroke>',
      'path-stroke garis pertama memuat tebal pita'
    );
    assertIncludes(
      xml,
      '<path-stroke direction="centered" end-size="1.500000"><size value="1.500000"/></path-stroke>',
      'path-stroke garis kedua memuat tebal pita'
    );
    assertIncludes(xml, '<location value="10.000000,35.000000,0.000000"/>', 'pivot garis pertama = pusat bbox garis');
    assertIncludes(xml, '<location value="70.000000,55.000000,0.000000"/>', 'pivot garis kedua = pusat bbox garis');
    assertIncludes(xml, 'M 0 -25L 0 25L 0 -25', 'path garis pertama digeser ke pivot dan mengulang titik awal');
    assertIncludes(xml, 'M -20 -15L 20 -15L 20 15L -20 -15', 'path garis kedua digeser ke pivot dan mengulang titik awal');
    assertIncludes(xml, '<fillColor value="#FF3B82F6"/>', 'mode garis tanpa componentColors memakai warna global');
    assert(validateAlightMotionXml(xml).valid === true, 'XML mode garis lulus validator');
  });

  test('AM-5: mode garis tanpa centerlineData gagal jujur', () => {
    assertThrows(
      () => buildAlightMotionXml(makeVectorData(), { ...OPTIONS, representation: 'garis' }),
      'Data garis',
      'mode garis tanpa data centerline'
    );
  });

  test('AM-5: componentColors dengan panjang tidak sesuai jumlah komponen ditolak', () => {
    assertThrows(
      () => buildAlightMotionXml(makeTwoComponentVectorData(), { ...OPTIONS, componentColors: ['#E61923'] }),
      'componentColors',
      'componentColors lebih pendek dari jumlah komponen'
    );
    assertThrows(
      () => buildAlightMotionXml(makeVectorData(), { ...OPTIONS, componentColors: ['#E61923', '#2846E1'] }),
      'componentColors',
      'componentColors lebih panjang dari jumlah komponen'
    );
  });

  /* ---------- EX (v0.5.0): mode warna asli dan mode garis pada pipeline ---------- */

  test('EX: warna asli (CV-1) mensampling warna dominan piksel sumber per komponen', () => {
    const canvas = makeFakeCanvas(40, 20, (x, y) => {
      const da = (x - 10) * (x - 10) + (y - 10) * (y - 10);
      const db = (x - 30) * (x - 30) + (y - 10) * (y - 10);
      if (da <= 16) return [230, 25, 35, 255];
      if (db <= 16) return [40, 70, 225, 255];
      return [240, 240, 240, 255];
    });
    const result = requestXmlExport({
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
      exportColorMode: 'asli',
      exportName: 'warna-asli',
    });
    assert(result.ok === true, 'ekspor warna asli berhasil: ' + (result.message || ''));
    const shapes = splitByShape(result.xml);
    assert(shapes.length === 2, 'dua komponen menghasilkan dua layer');
    assertIncludes(shapes[0], '<fillColor value="#FFE61923"/>', 'warna disk merah tersampling per komponen');
    assertIncludes(shapes[1], '<fillColor value="#FF2846E1"/>', 'warna disk biru tersampling per komponen');
    assert(!result.xml.includes('#FF3B82F6'), 'warna global tidak dipakai pada mode warna asli');
    assert(validateAlightMotionXml(result.xml).valid === true, 'XML warna asli lulus validator');
  });

  test('EX: mode garis (VE-3) mengekspor pita sebagai satu layer centerline dengan warna asli', () => {
    const canvas = makeFakeCanvas(20, 30, (x, y) => {
      const strip = x >= 3 && x <= 5 && y >= 3 && y <= 26;
      return strip ? [20, 30, 30, 255] : [240, 240, 240, 255];
    });
    const result = requestXmlExport({
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
      exportRepresentation: 'garis',
      exportColorMode: 'asli',
      exportName: 'garis-pita',
    });
    assert(result.ok === true, 'ekspor mode garis berhasil: ' + (result.message || ''));
    assert((result.xml.match(/<shape /g) || []).length === 1, 'satu pita menghasilkan satu layer garis');
    assertIncludes(
      result.xml,
      '<path-stroke direction="centered" end-size="1.500000"><size value="3.600000"/></path-stroke>',
      'path-stroke memuat tebal pita (perkiraan area/panjang skeleton = 3.6)'
    );
    assertIncludes(result.xml, '<fillColor value="#FF141E1E"/>', 'warna asli pita tersampling pada layer garis');
    assert(!result.xml.includes('Z'), 'path garis tanpa penutup Z');
    assert(validateAlightMotionXml(result.xml).valid === true, 'XML mode garis lulus validator');
  });

  test('EX: mode garis pada bercak padat tanpa goresan layak gagal jujur', () => {
    const canvas = makeFakeCanvas(20, 20, (x, y) => {
      const block = x >= 8 && x <= 11 && y >= 8 && y <= 11;
      return block ? [20, 20, 30, 255] : [240, 240, 240, 255];
    });
    const result = requestXmlExport({
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
      exportRepresentation: 'garis',
      exportName: 'bercak',
    });
    assert(result.ok === false, 'ekspor mode garis pada bercak tanpa goresan layak harus gagal');
    assertIncludes(result.message, 'Tidak ada garis', 'pesan gagal menyebut ketiadaan garis');
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
