// tests/presetParser.test.js - Parser teks XML proyek/preset Alight Motion (IPR-1).
// Fondasi Instant Preset Remixer: memetakan scene, media, layer, keyframe,
// slot aset, dan struktur yang belum didukung. Parser TIDAK menilai validitas
// impor (tugas xmlValidation dan uji lapangan TS-1) dan TIDAK mengubah berkas.
// Fixture: dua ekspor asli AM 5.0.273 yang sama dengan
// tests/amImportFixture.test.js, disalin APA ADANYA tanpa perubahan data.
// Kejujuran: 18 uji di bawah lulus di sandbox tanpa peramban pada 2026-10-18;
// jalankan ulang tests/index.html di peramban untuk verifikasi runtime.

import { parseAlightMotionProject } from '../js/modules/presetParser.js';

const REAL_AM_EXPORT_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?><!--\nCreated by Alight Motion (http://alightmotion.com)\nExported: 2026-10-03 08:34 AM\n5.0.273.1028425 (1028425)\n2d5c0f8 (20 Mei 2026 04.16.19)\n-->\n<scene title=\"Proyek Baru 1\" width=\"1080\" height=\"1350\" exportWidth=\"1080\" exportHeight=\"1350\" precompose=\"dynamicResolution\" bgcolor=\"#ffd8d8d8\" totalTime=\"2032\" fps=\"30\" modifiedTime=\"1790991248751\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\" retime=\"freeze\" retimeAdaptFPS=\"false\">\n  <media uri=\"content://media/external/images/media/1000943531\" filename=\"IMG-20261002-WA0040.jpg\" title=\"IMG-20261002-WA0040.jpg\" type=\"image/jpeg\" size=\"77267\" orientation=\"0\" infoUpdated=\"1790991214653\" width=\"720\" height=\"1280\" />\n  <shape id=\"205153572\" label=\"IMG-20261002-WA0040.jpg\" startTime=\"0\" endTime=\"2032\" fillType=\"media\" fillImage=\"content://media/external/images/media/1000943531\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"540.000000,675.000000,0.000000\" />\n      <scale value=\"1.472593,1.472593\" />\n    </transform>\n    <property name=\"size\" type=\"vec2\" value=\"379.500000,675.000000\" />\n  </shape>\n  <shape id=\"205153573\" label=\"Persegi panjang 1\" startTime=\"0\" endTime=\"932\" fillType=\"color\" blending=\"mask\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n  <shape id=\"205153574\" label=\"Persegi panjang 1\" startTime=\"900\" endTime=\"2032\" fillType=\"color\" blending=\"exclude\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n</scene>";

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

export function runPresetParserTests() {
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

  test('PB1: parsing berhasil, atribut scene terbaca', () => {
    const r = parseAlightMotionProject(REAL_AM_EXPORT_FIXTURE);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.scene.width === 1080 && r.scene.height === 1350, 'dimensi scene');
    assert(r.scene.fps === 30 && r.scene.totalTime === 2032, 'fps/totalTime');
  });

  test('PB1: satu media, tiga layer, satu slot aset', () => {
    const r = parseAlightMotionProject(REAL_AM_EXPORT_FIXTURE);
    assert(r.media.length === 1, 'media: ' + r.media.length);
    assert(r.layers.length === 3, 'layers: ' + r.layers.length);
    assert(r.assetSlots.length === 1, 'slots: ' + r.assetSlots.length);
    const s = r.assetSlots[0];
    assert(s.uri === 'content://media/external/images/media/1000943531', 'uri slot');
    assert(s.declared === true && s.kind === 'image', 'declared/kind');
    assert(JSON.stringify(s.layers) === '["205153572"]', 'layer pemakai: ' + JSON.stringify(s.layers));
  });

  test('PB1: tanpa keyframe; transform statis terbaca', () => {
    const r = parseAlightMotionProject(REAL_AM_EXPORT_FIXTURE);
    assert(r.keyframeSummary.keyframeCount === 0, 'kf 0');
    assert(r.layers[1].staticTransform.location === '532.500000,641.999939,0.000000', 'transform statis: ' + r.layers[1].staticTransform.location);
  });

  test('PB1: blending mask dan exclude dilaporkan eksplisit', () => {
    const r = parseAlightMotionProject(REAL_AM_EXPORT_FIXTURE);
    const kinds = r.unsupported.map((u) => u.kind);
    assert(kinds.filter((k) => k === 'blending').length === 2, 'dua blending: ' + JSON.stringify(kinds));
    assert(r.unsupported.every((u) => u.note && u.note.length > 0), 'setiap temuan memuat penjelasan');
  });

  test('PB1: urutan layer mengikuti urutan dokumen', () => {
    const r = parseAlightMotionProject(REAL_AM_EXPORT_FIXTURE);
    assert(r.layers.map((l) => l.id).join(',') === '205153572,205153573,205153574', 'urutan: ' + r.layers.map((l) => l.id).join(','));
    assert(r.layers[1].startTime === 0 && r.layers[1].endTime === 932, 'durasi layer');
  });

  test('PB19: parsing berhasil dengan CRLF dan komentar prolog', () => {
    const r = parseAlightMotionProject(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.scene.fps === 60 && r.scene.totalTime === 7148, 'fps 60');
  });

  test('PB19: tiga media, lima layer, tiga slot aset dengan pemetaan layer benar', () => {
    const r = parseAlightMotionProject(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(r.media.length === 3, 'media: ' + r.media.length);
    assert(r.layers.length === 5, 'layers: ' + r.layers.length);
    assert(r.assetSlots.length === 3, 'slots: ' + r.assetSlots.length);
    const slot3 = r.assetSlots[2];
    assert(slot3.uri === 'content://media/external/images/media/1000899918', 'slot ketiga');
    assert(JSON.stringify(slot3.layers) === '["1787713685979","1787713685980","1787713685981"]', 'tiga layer pemakai: ' + JSON.stringify(slot3.layers));
    assert(r.assetSlots[1].uri.startsWith('am:'), 'aset sig am: dikenali');
  });

  test('PB19: keyframe terbaca dengan t, v, dan e (cubicBezier) utuh', () => {
    const r = parseAlightMotionProject(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(r.keyframeSummary.layersWithKeyframes === 2, 'layer berkf: ' + r.keyframeSummary.layersWithKeyframes);
    assert(r.keyframeSummary.keyframeCount === 14, 'kf total: ' + r.keyframeSummary.keyframeCount);
    const withE = r.layers.flatMap((l) => l.keyframes).filter((k) => k.e !== null);
    assert(withE.length > 0 && withE.every((k) => k.e.includes('cubicBezier')), 'easing terbaca');
    const loc = r.layers[0].keyframes;
    assert(loc.length === 3 && loc.every((k) => k.property === 'location'), 'location 3 kf');
  });

  test('PB19: efek fade, path-stroke, border, shadow dilaporkan eksplisit', () => {
    const r = parseAlightMotionProject(REAL_AM_IMPORTED_PATH_FIXTURE);
    const kinds = r.unsupported.map((u) => u.kind);
    assert(kinds.filter((k) => k === 'effect').length === 1, 'satu efek: ' + JSON.stringify(kinds));
    assert(kinds.filter((k) => k === 'pathStroke').length === 2, 'dua path-stroke');
    assert(kinds.filter((k) => k === 'border').length === 1, 'satu border');
    assert(kinds.filter((k) => k === 'shadow').length === 1, 'satu shadow');
    assert(r.layers[0].effects[0].id === 'com.alightcreative.effects.fade', 'id efek');
    assert(r.layers[0].effects[0].properties.length === 2, 'properti efek terbaca');
  });

  test('PB19: pathD terbaca pada empat layer outline', () => {
    const r = parseAlightMotionProject(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(r.layers.filter((l) => l.pathD !== null).length === 4, 'pathD: ' + r.layers.filter((l) => l.pathD !== null).length);
    assert(r.layers[1].pathD.startsWith('M -360.0 -640.0'), 'pathD shape 975');
  });

  test('Error: tag tidak tertutup dilaporkan dengan nama tag', () => {
    const r = parseAlightMotionProject('<scene><shape id="1"></scene>');
    assert(r.ok === false, 'harus gagal');
    assert(r.error.includes('shape'), 'penyebab: ' + r.error);
  });

  test('Error: root bukan scene ditolak', () => {
    const r = parseAlightMotionProject('<svg></svg>');
    assert(r.ok === false && r.error.includes('scene'), 'pesan: ' + r.error);
  });

  test('Error: masukan kosong atau null ditolak', () => {
    assert(parseAlightMotionProject('').ok === false, 'kosong gagal');
    assert(parseAlightMotionProject(null).ok === false, 'null gagal');
  });

  test('Keluaran v0.4.0 (tanpa prolog) tetap dapat diparse sebagai teks (parser bukan validator)', () => {
    const r = parseAlightMotionProject('<scene title="siluet-uji" width="20" height="20"><shape id="1" label="Shape 1"><transform><location value="10.000000,10.000000,0.000000"/></transform></shape></scene>');
    assert(r.ok === true && r.layers.length === 1, 'terbaca');
  });

  test('fillImage tanpa deklarasi media: slot declared false + temuan undeclaredAsset', () => {
    const r = parseAlightMotionProject('<scene title="t" width="10" height="10" fps="30" totalTime="100"><shape id="1" fillType="media" fillImage="content://x/y.png"><transform/></shape></scene>');
    assert(r.ok === true, 'ok');
    assert(r.assetSlots.length === 1 && r.assetSlots[0].declared === false, 'slot tidak dideklarasikan');
    assert(r.unsupported.some((u) => u.kind === 'undeclaredAsset'), 'temuan undeclaredAsset');
  });

  test('Atribut scene wajib yang hilang dilaporkan (parser tetap berhasil membaca)', () => {
    const r = parseAlightMotionProject('<scene><shape id="1"/></scene>');
    assert(r.ok === true, 'parse ok');
    assert(r.unsupported.filter((u) => u.kind === 'missingSceneAttr').length >= 4, 'atribut wajib hilang dilaporkan');
  });

  test('Grup dan layer teks dilaporkan eksplisit, shape dalam grup tetap dipetakan datar', () => {
    const r = parseAlightMotionProject('<scene title="t" width="10" height="10" fps="30" totalTime="100"><group id="g"><shape id="2" fillType="color"/></group><text id="3"/></scene>');
    assert(r.ok === true, 'ok');
    assert(r.layers.length === 1 && r.layers[0].id === '2' && r.layers[0].groups.length === 1, 'shape dalam grup dipetakan: ' + JSON.stringify(r.layers.map((l) => l.id)));
    const kinds = r.unsupported.map((u) => u.kind);
    assert(kinds.includes('group') && kinds.includes('textLayer'), 'grup dan teks dilaporkan: ' + JSON.stringify(kinds));
  });

  test('Atribut nilai dengan tanda ">" atau "/" di dalam kutip tidak merusak parsing', () => {
    const r = parseAlightMotionProject('<scene title="t" width="10" height="10" fps="30" totalTime="100"><shape id="1" label="a>b/c" fillType="color"><path d="M 0 0L 1>2 3Z"/></shape></scene>');
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.layers[0].label === 'a>b/c', 'label utuh');
    assert(r.layers[0].pathD === 'M 0 0L 1>2 3Z', 'pathD utuh');
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
