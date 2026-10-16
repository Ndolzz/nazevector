// tests/amAdapter.test.js — Uji adapter XML Alight Motion (AM-1), validasi XML (XV-1),
// dan integrasi ekspor (EX-1). Modul murni tanpa dependensi DOM: dapat dijalankan
// lewat tests/index.html di peramban atau oleh host ES Module apa pun.
// Bagan kanvas palsu (fake canvas) meniru antarmuka getImageData yang dibaca
// silhouette.js; bagian unduhan berkas (Blob/anchor) memerlukan peramban dan
// tidak diuji di sini (dilaporkan sebagai keterbatasan di docs/SDD.md).

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

  // Data vektor minimal menyerupai keluaran vectorizeSilhouette.
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
            [0, 0],
          ],
          d: 'M0 0 L100 0 L100 80 L0 80 L0 0 Z',
          vertexCount: 5,
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
            [0, 0],
          ],
          d: 'M0 0 L50 0 L50 50 L0 50 Z',
          vertexCount: 5,
          area: 2500,
        },
        {
          role: 'hole',
          points: [
            [10, 10],
            [40, 10],
            [40, 40],
            [10, 40],
            [10, 10],
          ],
          d: 'M10 10 L40 10 L40 40 L10 40 Z',
          vertexCount: 5,
          area: 900,
        },
      ],
    });
  }

  const OPTIONS = { title: 'Uji', totalTime: 2500, fps: '30', modifiedTime: 1700000000000, color: '#3B82F6' };

  /* ---------- AM-1: pembangkit XML ---------- */

  test('AM-1: struktur scene lengkap dengan atribut wajib', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assertIncludes(xml, '<scene ', 'akar scene');
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

  test('AM-1: satu shape imported dengan transform, fillColor, dan kontur', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assertIncludes(xml, '<shape id="1" label="Shape 1" startTime="0" endTime="2500" fillType="color">', 'atribut shape');
    assert(!xml.includes(' s="'), 'bentuk imported tidak memakai template s');
    assertIncludes(xml, '<location value="50.000000,40.000000,0.000000"/>', 'location di pusat kanvas');
    assertIncludes(xml, '<fillColor value="#FF3B82F6"/>', 'warna #AARRGGBB');
    assertIncludes(xml, '<parameter>', 'blok parameter');
    assertIncludes(xml, '<contour d="', 'kontur');
  });

  test('AM-1: kontur digeser agar terpusat pada location', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assertIncludes(xml, 'M-50,-40 L50,-40 L50,40 L-50,40 L-50,-40 Z', 'kontur digeser (-w/2, -h/2)');
  });

  test('AM-1: multi-subpath (cincin) diserialisasi lengkap', () => {
    const xml = buildAlightMotionXml(makeRingVectorData(), OPTIONS);
    assertIncludes(xml, 'M-25,-25 L25,-25 L25,25 L-25,25 L-25,-25 Z', 'kontur luar');
    assertIncludes(xml, 'M-15,-15 L15,-15 L15,15 L-15,15 L-15,-15 Z', 'kontur lubang');
    assert((xml.match(/<contour /g) || []).length === 1, 'kedua subpath berada dalam satu kontur gabungan');
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
        '<shape id="1" startTime="0" endTime="100" fillType="color"><parameter><contour d="M0,0 L1,0 Z"/></parameter></shape>' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><parameter><contour d="M0,0 L1,0 Z"/></parameter></shape>' +
        '</scene>'
    );
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'duplikat', 'pesan id duplikat');
  });

  test('XV-1: endTime melebihi totalTime ditolak', () => {
    const result = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FF000000" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="200" fillType="color"><parameter><contour d="M0,0 L1,0 Z"/></parameter></shape>' +
        '</scene>'
    );
    assert(result.valid === false, 'tidak valid');
    assertIncludes(result.issues.join(' '), 'totalTime', 'pesan endTime melebihi totalTime');
  });

  test('XV-1: fillColor dan bgcolor harus #AARRGGBB; kontur tidak boleh kosong', () => {
    const badColor = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FFF" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><fillColor value="#3B82F6"/><parameter><contour d="M0,0 L1,0 Z"/></parameter></shape>' +
        '</scene>'
    );
    assert(badColor.valid === false, 'tidak valid');
    const all = badColor.issues.join(' ');
    assertIncludes(all, 'bgcolor', 'bgcolor harus 8 heksadesimal');
    assertIncludes(all, 'fillColor', 'fillColor harus 8 heksadesimal');

    const emptyContour = validateAlightMotionXml(
      '<scene title="t" width="10" height="10" exportWidth="10" exportHeight="10" bgcolor="#FF000000" totalTime="100" fps="30" modifiedTime="1" amver="1" ffver="106">' +
        '<shape id="1" startTime="0" endTime="100" fillType="color"><parameter><contour d=""/></parameter></shape>' +
        '</scene>'
    );
    assert(emptyContour.valid === false, 'kontur kosong tidak valid');
    assertIncludes(emptyContour.issues.join(' '), 'kontur', 'pesan kontur kosong');
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

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
