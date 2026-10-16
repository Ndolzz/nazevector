// tests/amImportFixture.test.js — Regresi kegagalan impor XML (AM-2 + XV-2, v0.4.1).
// Bukti: ekspor v0.4.0 ditolak Alight Motion 5.0.273 (Android) dengan pesan
// "Gagal mengunggah. Formatnya tidak benar atau file rusak."
// Pembanding: tiga ekspor asli Alight Motion (5.0.260-5.0.273, Android) — dokumen
// diawali prolog <?xml?>, scene memuat precompose/retime/retimeAdaptFPS, dan
// setiap elemen memuat mediaFillMode. Fixture 1: kutipan ekspor asli
// (andikachan/alight-web-editor, preset/Proyek Baru 1.xml, AM 5.0.273.1028425).
// Fixture 2: rekonstruksi keluaran adapter v0.4.0 yang ditolak (tanpa prolog,
// tanpa precompose/retime/retimeAdaptFPS, tanpa mediaFillMode).
// Kejujuran: validasi struktur otomatis BUKAN bukti keberhasilan impor nyata;
// TS-1 tetap terbuka hingga keluaran v0.4.1 diuji ulang di perangkat nyata.

import { buildAlightMotionXml } from '../js/modules/amAdapter.js';
import { validateAlightMotionXml } from '../js/modules/xmlValidation.js';
import { requestXmlExport } from '../js/modules/exportManager.js';

const REAL_AM_EXPORT_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?><!--\nCreated by Alight Motion (http://alightmotion.com)\nExported: 2026-10-03 08:34 AM\n5.0.273.1028425 (1028425)\n2d5c0f8 (20 Mei 2026 04.16.19)\n-->\n<scene title=\"Proyek Baru 1\" width=\"1080\" height=\"1350\" exportWidth=\"1080\" exportHeight=\"1350\" precompose=\"dynamicResolution\" bgcolor=\"#ffd8d8d8\" totalTime=\"2032\" fps=\"30\" modifiedTime=\"1790991248751\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\" retime=\"freeze\" retimeAdaptFPS=\"false\">\n  <media uri=\"content://media/external/images/media/1000943531\" filename=\"IMG-20261002-WA0040.jpg\" title=\"IMG-20261002-WA0040.jpg\" type=\"image/jpeg\" size=\"77267\" orientation=\"0\" infoUpdated=\"1790991214653\" width=\"720\" height=\"1280\" />\n  <shape id=\"205153572\" label=\"IMG-20261002-WA0040.jpg\" startTime=\"0\" endTime=\"2032\" fillType=\"media\" fillImage=\"content://media/external/images/media/1000943531\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"540.000000,675.000000,0.000000\" />\n      <scale value=\"1.472593,1.472593\" />\n    </transform>\n    <property name=\"size\" type=\"vec2\" value=\"379.500000,675.000000\" />\n  </shape>\n  <shape id=\"205153573\" label=\"Persegi panjang 1\" startTime=\"0\" endTime=\"932\" fillType=\"color\" blending=\"mask\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n  <shape id=\"205153574\" label=\"Persegi panjang 1\" startTime=\"900\" endTime=\"2032\" fillType=\"color\" blending=\"exclude\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n</scene>";

const V040_FAILED_EXPORT_FIXTURE = "<scene title=\"siluet-uji\" width=\"20\" height=\"20\" exportWidth=\"20\" exportHeight=\"20\" bgcolor=\"#00000000\" totalTime=\"5000\" fps=\"30\" modifiedTime=\"1792174909769\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\"><shape id=\"1\" label=\"Shape 1\" startTime=\"0\" endTime=\"5000\" fillType=\"color\"><transform><location value=\"10.000000,10.000000,0.000000\"/></transform><fillColor value=\"#FF3B82F6\"/><parameter><contour d=\"M-8,0 L-6,6 L0,9 L6,7 L9,1 L7,-5 L1,-8 L-5,-6 Z\"/></parameter></shape></scene>";

function sceneAttrs(xml) {
  const match = xml.match(/<scene\s+([^>]*?)>/);
  const attrs = {};
  const pattern = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = pattern.exec(match[1])) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

export function runAmImportFixtureTests() {
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

  function makeVectorData() {
    return {
      ok: true,
      empty: false,
      svg: '<svg></svg>',
      width: 20,
      height: 20,
      pathCount: 1,
      componentCount: 1,
      vertexCount: 4,
      tolerancePx: 1.5,
      subpaths: [
        {
          role: 'outer',
          points: [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]],
          d: 'M0 0 L20 0 L20 20 L0 20 L0 0 Z',
          vertexCount: 5,
          area: 400,
        },
      ],
    };
  }

  function makeFakeCanvas(width, height, pixelAt) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const px = pixelAt(x, y);
        const i = (y * width + x) * 4;
        data[i] = px[0]; data[i + 1] = px[1]; data[i + 2] = px[2]; data[i + 3] = px[3];
      }
    }
    return { width, height, getContext: () => ({ getImageData: () => ({ data, width, height }) }) };
  }

  const OPTIONS = { title: 'Uji Regresi', totalTime: 2500, fps: '30', modifiedTime: 1700000000000, color: '#3B82F6' };

  test('Regresi AM-2/XV-2: keluaran v0.4.0 yang gagal diimpor kini ditolak validator', () => {
    const result = validateAlightMotionXml(V040_FAILED_EXPORT_FIXTURE);
    assert(result.valid === false, 'keluaran v0.4.0 harus tidak valid bagi validator v0.4.1');
    const all = result.issues.join(' ');
    assertIncludes(all, 'prolog', 'isu prolog');
    assertIncludes(all, 'precompose', 'isu precompose');
    assertIncludes(all, 'retime', 'isu retime');
    assertIncludes(all, 'mediaFillMode', 'isu mediaFillMode');
  });

  test('Fixture ekspor asli Alight Motion lulus validasi struktural kita', () => {
    const result = validateAlightMotionXml(REAL_AM_EXPORT_FIXTURE);
    assert(result.valid === true, 'ekspor asli harus lulus validasi kita: ' + JSON.stringify(result.issues));
    assert(Array.isArray(result.issues) && result.issues.length === 0, 'tanpa isu');
  });

  test('Keluaran adapter mengikuti pola struktural ekspor asli', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assert(xml.startsWith("<?xml version='1.0' encoding='UTF-8' ?>"), 'prolog XML ada');
    const attrs = sceneAttrs(xml);
    assert(attrs.precompose === 'dynamicResolution', 'precompose dinamis: ' + attrs.precompose);
    assert(attrs.retime === 'freeze', 'retime freeze: ' + attrs.retime);
    assert(attrs.retimeAdaptFPS === 'false', 'retimeAdaptFPS false: ' + attrs.retimeAdaptFPS);
    assertIncludes(xml, 'mediaFillMode="fill"', 'mediaFillMode pada shape');
    const validation = validateAlightMotionXml(xml);
    assert(validation.valid === true, 'keluaran baru lulus validator: ' + JSON.stringify(validation.issues));
  });

  test('Atribut scene konstan bernilai sama dengan ekspor asli', () => {
    const ours = sceneAttrs(buildAlightMotionXml(makeVectorData(), OPTIONS));
    const real = sceneAttrs(REAL_AM_EXPORT_FIXTURE);
    for (const attr of ['amver', 'ffver', 'am', 'amplatform', 'fps', 'precompose', 'retime', 'retimeAdaptFPS']) {
      assert(ours[attr] === real[attr], 'atribut ' + attr + ' sama dengan ekspor asli: "' + ours[attr] + '" vs "' + real[attr] + '"');
    }
  });

  test('requestXmlExport menghasilkan keluaran berpola ekspor asli', () => {
    const canvas = makeFakeCanvas(20, 20, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      return dx * dx + dy * dy <= 64 ? [20, 20, 30, 255] : [240, 240, 240, 255];
    });
    const state = {
      image: { name: 'uji.png', canvas },
      vector: { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' },
      exportName: 'regresi-impor',
    };
    const result = requestXmlExport(state);
    assert(result.ok === true, 'ekspor berhasil: ' + (result.message || ''));
    assert(result.xml.startsWith("<?xml version='1.0' encoding='UTF-8' ?>"), 'prolog XML ada');
    assertIncludes(result.xml, 'precompose="dynamicResolution"', 'precompose');
    assertIncludes(result.xml, 'retime="freeze" retimeAdaptFPS="false"', 'retime dan retimeAdaptFPS');
    assertIncludes(result.xml, 'mediaFillMode="fill"', 'mediaFillMode');
    assert(result.validation && result.validation.valid === true, 'validasi lokal lulus');
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
