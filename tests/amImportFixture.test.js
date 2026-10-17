// tests/amImportFixture.test.js — Regresi kegagalan impor dan tampilan XML
// (AM-2 + AM-3, XV-2 + XV-3, v0.4.2).
// Bukti lapangan:
// - v0.4.0: berkas DITOLAK saat impor ("Gagal mengunggah. Formatnya tidak benar
//   atau file rusak.") — fixture rekonstruksi v0.4.0 (tanpa prolog, tanpa
//   precompose/retime/retimeAdaptFPS, tanpa mediaFillMode).
// - v0.4.1: berkas BERHASIL diimpor namun kanvas tampak KOSONG — fixture
//   rekonstruksi v0.4.1: outline pada <parameter><contour d/> TIDAK dibaca
//   parser asli Alight Motion 5.0.273 (ShapeElementTypeImpl.unserializeElement
//   hanya membaca outline shape imported dari tag path — dekompilasi
//   boiniArun2006/am-xml); tag tak dikenal diabaikan sehingga shape tanpa
//   outline meski impor berhasil.
// Pembanding ekspor asli yang TERBUKTI menampilkan shape: preset/Proyek Baru
// 19.xml (andikachan/alight-web-editor, AM 5.0.273.1028425) memuat outline
// pada <path d="M ... Z"/> langsung di bawah <shape> setelah fillColor
// (fixture di bawah, garis baris dinormalisasi ke \r\n aslinya).
// Geometri (tahap wajib 5): gambar uji lingkaran dan cincin menjamin path
// nonkosong, jumlah subpath sama dengan kontur vektorisasi, rentang koordinat
// terpusat, pengulangan titik awal sebelum Z, bbox identik dengan kontur
// tergeser, dan lubang berada di dalam kontur luar — bukan sekadar "XML valid".
// Kejujuran: validasi struktur otomatis BUKAN bukti keberhasilan impor nyata;
// TS-1 tetap terbuka hingga keluaran v0.4.2 terbukti MENAMPILKAN shape pada
// perangkat nyata (impor berhasil saja tidak cukup).

import { buildAlightMotionXml } from '../js/modules/amAdapter.js';
import { validateAlightMotionXml } from '../js/modules/xmlValidation.js';
import { requestXmlExport } from '../js/modules/exportManager.js';
import { computeSilhouetteMask } from '../js/modules/silhouette.js';
import { vectorizeSilhouette } from '../js/modules/vectorEngine.js';

const REAL_AM_EXPORT_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?><!--\nCreated by Alight Motion (http://alightmotion.com)\nExported: 2026-10-03 08:34 AM\n5.0.273.1028425 (1028425)\n2d5c0f8 (20 Mei 2026 04.16.19)\n-->\n<scene title=\"Proyek Baru 1\" width=\"1080\" height=\"1350\" exportWidth=\"1080\" exportHeight=\"1350\" precompose=\"dynamicResolution\" bgcolor=\"#ffd8d8d8\" totalTime=\"2032\" fps=\"30\" modifiedTime=\"1790991248751\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\" retime=\"freeze\" retimeAdaptFPS=\"false\">\n  <media uri=\"content://media/external/images/media/1000943531\" filename=\"IMG-20261002-WA0040.jpg\" title=\"IMG-20261002-WA0040.jpg\" type=\"image/jpeg\" size=\"77267\" orientation=\"0\" infoUpdated=\"1790991214653\" width=\"720\" height=\"1280\" />\n  <shape id=\"205153572\" label=\"IMG-20261002-WA0040.jpg\" startTime=\"0\" endTime=\"2032\" fillType=\"media\" fillImage=\"content://media/external/images/media/1000943531\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"540.000000,675.000000,0.000000\" />\n      <scale value=\"1.472593,1.472593\" />\n    </transform>\n    <property name=\"size\" type=\"vec2\" value=\"379.500000,675.000000\" />\n  </shape>\n  <shape id=\"205153573\" label=\"Persegi panjang 1\" startTime=\"0\" endTime=\"932\" fillType=\"color\" blending=\"mask\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n  <shape id=\"205153574\" label=\"Persegi panjang 1\" startTime=\"900\" endTime=\"2032\" fillType=\"color\" blending=\"exclude\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n</scene>";

// Rekonstruksi keluaran v0.4.0 untuk kanvas uji 20x20 (lingkaran siluet, mode
// gelap, ambang 50, modifiedTime dipatok): ditolak saat impor oleh Alight
// Motion 5.0.273 (Android).
const V040_FAILED_EXPORT_FIXTURE = "<scene title=\"siluet-uji\" width=\"20\" height=\"20\" exportWidth=\"20\" exportHeight=\"20\" bgcolor=\"#00000000\" totalTime=\"5000\" fps=\"30\" modifiedTime=\"1792174909769\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\"><shape id=\"1\" label=\"Shape 1\" startTime=\"0\" endTime=\"5000\" fillType=\"color\"><transform><location value=\"10.000000,10.000000,0.000000\"/></transform><fillColor value=\"#FF3B82F6\"/><parameter><contour d=\"M-8,0 L-6,6 L0,9 L6,7 L9,1 L7,-5 L1,-8 L-5,-6 Z\"/></parameter></shape></scene>";

// Rekonstruksi keluaran v0.4.1 untuk vektor data yang sama: prolog dan pola
// atribut AM-2 sudah benar (berkas diterima impor), namun outline masih pada
// <parameter><contour d/> sehingga shape kosong di kanvas (bukti lapangan
// pengguna). Validator XV-3 kini menolak struktur ini.
const V041_INVISIBLE_EXPORT_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?><scene title=\"siluet-uji\" width=\"20\" height=\"20\" exportWidth=\"20\" exportHeight=\"20\" precompose=\"dynamicResolution\" bgcolor=\"#00000000\" totalTime=\"5000\" fps=\"30\" modifiedTime=\"1792174909769\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\" retime=\"freeze\" retimeAdaptFPS=\"false\"><shape id=\"1\" label=\"Shape 1\" startTime=\"0\" endTime=\"5000\" fillType=\"color\" mediaFillMode=\"fill\"><transform><location value=\"10.000000,10.000000,0.000000\"/></transform><fillColor value=\"#FF3B82F6\"/><parameter><contour d=\"M-8,0 L-6,6 L0,9 L6,7 L9,1 L7,-5 L1,-8 L-5,-6 Z\"/></parameter></shape></scene>";

// Kutipan utuh ekspor asli yang memuat bentuk imported dengan outline nyata
// pada tag <path d="M ... Z"/> (Proyek Baru 19.xml, AM 5.0.273.1028425,
// andikachan/alight-web-editor): shape 1787713685975 tanpa template s memuat
// <path d="M -360.0 -640.0L 360.0 -640.0L 360.0 640.0L -360.0 640.0L -360.0 -640.0Z" />
// persis pola serializer asli (CubicBSplineKt.toSVGPath). Garis baris asli
// \r\n dipulihkan lewat replace agar fixture identik dengan berkas sumber.
const REAL_AM_IMPORTED_PATH_FIXTURE = `<?xml version='1.0' encoding='UTF-8' ?><!--
Created by Alight Motion (http://alightmotion.com)
Exported: 2026-09-30 02:55 AM
5.0.273.1028425 (1028425)
2d5c0f8 (20 Mei 2026 04.16.19)
-->
<scene title="Proyek Baru 19" width="1080" height="1350" exportWidth="1080" exportHeight="1350" precompose="dynamicResolution" bgcolor="#ff00b140" totalTime="7148" fps="60" modifiedTime="1790711706386" amver="1028425" ffver="106" am="com.alightcreative.motion/5.0.273.1028425" amplatform="android" retime="freeze" retimeAdaptFPS="false">
  <media uri="content://media/external/images/media/1000891919" filename="mascot-wink-cutout.png" title="mascot-wink-cutout.png" type="image/png" size="1019645" orientation="0" infoUpdated="1790711701374" width="782" height="941" />
  <media uri="am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png" filename="Profil Copy 3 Copy 3 [3C65A93].png" title="Profil Copy 3 Copy 3 [3C65A93].png" type="image/png" size="3601000" sig="4DA4437668755B26FE88E3FB73A9D712C287E1EA" orientation="0" infoUpdated="1790711701374" width="2160" height="3840" />
  <media uri="content://media/external/images/media/1000899918" type="image/png" duration="0" orientation="0" infoUpdated="1790711701374" width="0" height="0" />
  <shape id="1787713685974" label="mascot-wink-cutout.png" startTime="0" endTime="2015" fillType="media" fillImage="content://media/external/images/media/1000891919" mediaFillMode="fill" s=".rect">
    <transform>
      <location>
        <kf t="0.003970" v="540.000000,675.000000,0.000000" />
        <kf t="0.186104" v="588.500000,715.500000,0.000000" />
        <kf t="0.260546" v="633.000000,525.000000,0.000000" />
      </location>
    </transform>
    <effect id="com.alightcreative.effects.fade" locallyApplied="true">
      <property name="inTime" type="float" value="0.600000" />
      <property name="outTime" type="float" value="0.300000" />
    </effect>
    <property name="size" type="vec2" value="540.000000,649.500000" />
  </shape>
  <shape id="1787713685975" startTime="2016" endTime="7148" fillType="media" fillImage="am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png" mediaFillMode="fill">
    <transform>
      <location>
        <kf t="0.706742" v="540.210266,960.149780,0.000000" />
        <kf t="0.999026" v="540.210266,960.149780,0.000000" />
        <kf t="0.862627" v="540.210266,1396.574097,0.000000" e="cubicBezier 0.9 -0.91 1.0 1.0" />
        <kf t="0.950507" v="570.840637,812.174683,0.000000" />
      </location>
      <scale>
        <kf t="0.270850" v="1.500000,1.500000" e="cubicBezier 0.42 0.0 0.0 1.0" />
        <kf t="0.501754" v="2.478515,2.478515" e="cubicBezier 0.7184972 0.0 0.44273883 1.0" />
        <kf t="0.706742" v="1.500000,1.500000" e="cubicBezier 0.31319663 0.0 0.08122213 1.0" />
        <kf t="0.000585" v="2.579479,2.579479" />
        <kf t="0.862627" v="2.208864,2.208864" e="cubicBezier 0.89643914 -0.91275054 1.0 1.0" />
        <kf t="0.999026" v="2.207012,2.207012" e="cubicBezier 1.0 0.0 1.0 1.0" />
        <kf t="0.960055" v="1.649235,1.649235" e="cubicBezier 0.0 0.0 0.22396892 1.0" />
      </scale>
    </transform>
    <path d="M -360.0 -640.0L 360.0 -640.0L 360.0 640.0L -360.0 640.0L -360.0 -640.0Z" />
  </shape>
  <shape id="1787713685979" label="Bentuk 1" startTime="850" endTime="1365" fillType="media" fillImage="content://media/external/images/media/1000899918" mediaFillMode="fit">
    <transform>
      <location value="540.000000,675.000000,0.000000" />
    </transform>
    <fillColor value="#ffecb455" />
    <path-stroke direction="centered" end-size="1.500000">
      <size value="6.500000" />
    </path-stroke>
    <path d="M -359.73874 256.04205L -162.86777 -82.89453L 185.36041 78.60547L 143.92258 221.64441L -529.2438 -334.3945L -34.49997 352.5L -359.73874 256.04205" />
  </shape>
  <shape id="1787713685980" label="Bentuk 1" startTime="1350" endTime="1899" fillType="media" fillImage="content://media/external/images/media/1000899918" mediaFillMode="fill">
    <transform>
      <location value="540.000000,675.000000,0.000000" />
    </transform>
    <fillColor value="#ffecb455" />
    <border direction="inside" id="1">
      <size value="13.000000" />
    </border>
    <path-stroke direction="centered" cap="square" end-size="1.500000">
      <size value="3.500000" />
    </path-stroke>
    <shadow direction="outside">
      <size value="9.000000" />
    </shadow>
    <path d="M -359.73874 256.04205L -162.86777 -82.89453L 185.36041 78.60547L 143.92258 221.64441L 66.00003 246.0L -34.49997 352.5L -359.73874 256.04205" />
  </shape>
  <shape id="1787713685981" label="Bentuk 1" startTime="1883" endTime="2865" fillType="media" fillImage="content://media/external/images/media/1000899918" mediaFillMode="stretch">
    <transform>
      <location value="540.000000,675.000000,0.000000" />
    </transform>
    <fillColor value="#ffecb455" />
    <path d="M -359.73874 256.04205L -162.86777 -82.89453L 185.36041 78.60547L 143.92258 221.64441L 66.00003 246.0L -34.49997 352.5L -359.73874 256.04205" />
  </shape>
</scene>`.replace(/\n/g, '\r\n');

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

// Ambil nilai atribut d dari tag <path> pertama pada dokumen keluaran adapter.
function extractOutlineD(xml) {
  const match = xml.match(/<path d="([^"]*)"/);
  if (!match) throw new Error('Tag <path> dengan atribut d tidak ditemukan pada keluaran.');
  return match[1];
}

// Parse path d format serializer asli: "M x y" + "L x y"* + "L x0 y0" + "Z",
// antar kontur digabung tanpa separator (token "ZM").
function parseOutline(d) {
  return d
    .split('M')
    .filter((segment) => segment.trim().length > 0)
    .map((segment) => {
      const trimmed = segment.trim();
      const closed = trimmed.endsWith('Z');
      const body = trimmed.replace(/Z$/, '');
      const pairs = body
        .split('L')
        .map((pair) => pair.trim().split(/\s+/).map(Number));
      return { closed, pairs };
    });
}

function bboxOf(pairs) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pairs) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
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
          points: [[0, 0], [20, 0], [20, 20], [0, 20]],
          d: 'M0 0 L20 0 L20 20 L0 20 Z',
          vertexCount: 4,
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
    assert(result.valid === false, 'keluaran v0.4.0 harus tidak valid bagi validator');
    const all = result.issues.join(' ');
    assertIncludes(all, 'prolog', 'isu prolog');
    assertIncludes(all, 'precompose', 'isu precompose');
    assertIncludes(all, 'retime', 'isu retime');
    assertIncludes(all, 'mediaFillMode', 'isu mediaFillMode');
  });

  test('Fixture ekspor asli Alight Motion (Proyek Baru 1) lulus validasi struktural kita', () => {
    const result = validateAlightMotionXml(REAL_AM_EXPORT_FIXTURE);
    assert(result.valid === true, 'ekspor asli harus lulus validasi kita: ' + JSON.stringify(result.issues));
    assert(Array.isArray(result.issues) && result.issues.length === 0, 'tanpa isu');
  });

  test('Regresi AM-3/XV-3: keluaran v0.4.1 yang terimpor namun kosong kini ditolak validator', () => {
    const result = validateAlightMotionXml(V041_INVISIBLE_EXPORT_FIXTURE);
    assert(result.valid === false, 'keluaran v0.4.1 harus tidak valid bagi validator v0.4.2');
    assert(result.issues.length === 1, 'satu-satunya isu adalah outline, ditemukan: ' + JSON.stringify(result.issues));
    assertIncludes(result.issues[0], 'path', 'isu menyebut tag path');
    assertIncludes(result.issues[0], 'parameter/contour', 'isu menyebut struktur parameter/contour yang tidak dibaca parser asli');
  });

  test('Fixture ekspor asli dengan shape path (Proyek Baru 19) lulus validasi kita', () => {
    const result = validateAlightMotionXml(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(result.valid === true, 'ekspor asli berpath harus lulus validasi kita: ' + JSON.stringify(result.issues));
    assertIncludes(REAL_AM_IMPORTED_PATH_FIXTURE, '<path d="M -360.0 -640.0L 360.0 -640.0L 360.0 640.0L -360.0 640.0L -360.0 -640.0Z" />', 'outline pada tag path sesuai serializer asli');
  });

  test('Keluaran adapter mengikuti pola struktural ekspor asli (outline pada tag path)', () => {
    const xml = buildAlightMotionXml(makeVectorData(), OPTIONS);
    assert(xml.startsWith("<?xml version='1.0' encoding='UTF-8' ?>"), 'prolog XML ada');
    const attrs = sceneAttrs(xml);
    assert(attrs.precompose === 'dynamicResolution', 'precompose dinamis: ' + attrs.precompose);
    assert(attrs.retime === 'freeze', 'retime freeze: ' + attrs.retime);
    assert(attrs.retimeAdaptFPS === 'false', 'retimeAdaptFPS false: ' + attrs.retimeAdaptFPS);
    assertIncludes(xml, 'mediaFillMode="fill"', 'mediaFillMode pada shape');
    assertIncludes(xml, '<path d="', 'outline pada tag path (AM-3)');
    assert(!xml.includes('<parameter>'), 'tidak ada tag parameter');
    assert(!xml.includes('<contour'), 'tidak ada tag contour');
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

  test('requestXmlExport menghasilkan keluaran berpola ekspor asli dengan outline path', () => {
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
    assertIncludes(result.xml, '<path d="', 'outline pada tag path (AM-3)');
    assert(!result.xml.includes('<parameter>'), 'tidak ada tag parameter');
    assert(!result.xml.includes('<contour'), 'tidak ada tag contour');
    assert(result.validation && result.validation.valid === true, 'validasi lokal lulus');
  });

  test('Geometri wajib: lingkaran uji menghasilkan satu shape dengan path nonkosong dan geometri masuk akal', () => {
    const canvas = makeFakeCanvas(20, 20, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      return dx * dx + dy * dy <= 64 ? [20, 20, 30, 255] : [240, 240, 240, 255];
    });
    const vector = { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' };
    const mask = computeSilhouetteMask(canvas, vector.mode, vector.threshold);
    const vectorData = vectorizeSilhouette(mask, vector);
    assert(vectorData.empty === false, 'siluet terdeteksi');
    assert(vectorData.pathCount >= 1, 'ada minimal satu kontur');
    assert(vectorData.subpaths[0].points.length >= 4, 'kontur memiliki setidaknya 4 titik');
    const result = requestXmlExport({ image: { name: 'uji.png', canvas }, vector, exportName: 'geometri-lingkaran' });
    assert(result.ok === true, 'ekspor berhasil: ' + (result.message || ''));
    assert((result.xml.match(/<shape /g) || []).length === 1, 'tepat satu objek shape dibuat');
    assert((result.xml.match(/<path /g) || []).length === 1, 'satu tag path per shape');
    const d = extractOutlineD(result.xml);
    assert(d.trim().length > 0, 'path d tidak kosong dan tidak terpotong');
    const subs = parseOutline(d);
    assert(subs.length === vectorData.pathCount, 'jumlah subpath == jumlah kontur vektorisasi');
    assert(subs.length >= 1, 'setidaknya satu subpath');
    const halfW = vectorData.width / 2;
    const halfH = vectorData.height / 2;
    subs.forEach((sub, index) => {
      const points = vectorData.subpaths[index].points;
      assert(sub.closed === true, 'setiap subpath ditutup Z');
      assert(sub.pairs.length === points.length + 1, 'jumlah pasangan == jumlah titik + pengulangan titik awal');
      for (const [x, y] of sub.pairs) {
        assert(
          Number.isFinite(x) && Number.isFinite(y) && x >= -halfW && x <= halfW && y >= -halfH && y <= halfH,
          'semua koordinat dalam rentang [-w/2, w/2] x [-h/2, h/2]'
        );
      }
      for (let k = 0; k < points.length; k += 1) {
        assert(
          sub.pairs[k][0] === points[k][0] - halfW && sub.pairs[k][1] === points[k][1] - halfH,
          'pasangan koordinat sesuai kontur digeser ke pusat'
        );
      }
      const last = sub.pairs[points.length];
      assert(last[0] === points[0][0] - halfW && last[1] === points[0][1] - halfH, 'pasangan terakhir mengulang titik awal');
    });
    const contourBbox = bboxOf(vectorData.subpaths[0].points);
    const dBbox = bboxOf(subs[0].pairs);
    assert(
      dBbox.minX === contourBbox.minX - halfW && dBbox.maxX === contourBbox.maxX - halfW &&
        dBbox.minY === contourBbox.minY - halfH && dBbox.maxY === contourBbox.maxY - halfH,
      'bbox path identik dengan bbox kontur yang digeser'
    );
    assert(vectorData.subpaths[0].area >= 150, 'luas kontur masuk akal untuk lingkaran radius 8: ' + vectorData.subpaths[0].area);
  });

  test('Geometri wajib: cincin menghasilkan dua subpath tertutup dengan lubang di dalam kontur luar', () => {
    const canvas = makeFakeCanvas(21, 21, (x, y) => {
      const dx = x - 10;
      const dy = y - 10;
      const r2 = dx * dx + dy * dy;
      return r2 >= 36 && r2 <= 100 ? [20, 20, 30, 255] : [240, 240, 240, 255];
    });
    const vector = { mode: 'gelap', threshold: 50, simplification: 'sedang', color: '#3B82F6' };
    const mask = computeSilhouetteMask(canvas, vector.mode, vector.threshold);
    const vectorData = vectorizeSilhouette(mask, vector);
    assert(vectorData.empty === false, 'siluet terdeteksi');
    assert(vectorData.pathCount === 2, 'dua kontur: luar dan lubang, ditemukan ' + vectorData.pathCount);
    assert(vectorData.componentCount === 1, 'satu komponen siluet');
    const result = requestXmlExport({ image: { name: 'uji.png', canvas }, vector, exportName: 'geometri-cincin' });
    assert(result.ok === true, 'ekspor berhasil: ' + (result.message || ''));
    const d = extractOutlineD(result.xml);
    assert(d.trim().length > 0, 'path d tidak kosong');
    const subs = parseOutline(d);
    assert(subs.length === 2, 'dua subpath pada satu tag path, ditemukan ' + subs.length);
    for (const sub of subs) {
      assert(sub.closed === true, 'setiap subpath (kontur dan lubang) ditutup Z');
    }
    const outerIndex = vectorData.subpaths.findIndex((s) => s.role === 'outer');
    const holeIndex = vectorData.subpaths.findIndex((s) => s.role === 'hole');
    assert(outerIndex !== -1 && holeIndex !== -1, 'ada kontur luar dan kontur lubang');
    const outerBbox = bboxOf(subs[outerIndex].pairs);
    const holeBbox = bboxOf(subs[holeIndex].pairs);
    assert(
      holeBbox.minX > outerBbox.minX && holeBbox.maxX < outerBbox.maxX &&
        holeBbox.minY > outerBbox.minY && holeBbox.maxY < outerBbox.maxY,
      'bbox lubang berada di dalam bbox kontur luar'
    );
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
