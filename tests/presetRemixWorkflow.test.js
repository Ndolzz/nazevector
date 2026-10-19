// tests/presetRemixWorkflow.test.js - Alur Instant Preset Remixer (IPR-3).
// Menguji orkestrasi murni js/modules/presetRemixWorkflow.js: validasi
// berkas masukan, analisis slot, normalisasi URI pengganti, perakitan
// penggantian per slot, pemanggilan replaceAssets (IPR-2) beserta penolakan
// eksplisitnya, penamaan unduhan, dan perhitungan delapan keadaan
// antarmuka. Panel DOM (presetRemixerPanel.js) tidak diuji di sini karena
// membutuhkan peramban (lihat docs/SDD.md bagian 19).
// Fixture PB1/PB19 disalin APA ADANYA dari tests/presetRemixer.test.js
// (ekspor asli AM 5.0.273, identik dengan tests/presetParser.test.js).
// Kejujuran: 11 uji di bawah lulus di sandbox tanpa peramban pada 2026-10-18;
// jalankan ulang tests/index.html di peramban untuk verifikasi runtime.

import { parseAlightMotionProject } from '../js/modules/presetParser.js';
import {
  validatePresetFileInput,
  analyzePresetText,
  normalizeReplacementUri,
  buildReplacement,
  remixPreset,
  buildRemixDownloadName,
  computeRemixerUiState,
  PRESET_MAX_BYTES,
} from '../js/modules/presetRemixWorkflow.js';

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
const SYNTHETIC_NO_SLOT_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?>\n<scene title=\"Tanpa Aset\" width=\"1080\" height=\"1350\" exportWidth=\"1080\" exportHeight=\"1350\" precompose=\"dynamicResolution\" bgcolor=\"#ff000000\" totalTime=\"100\" fps=\"30\" modifiedTime=\"1\" amver=\"1028425\" ffver=\"106\" retime=\"freeze\" retimeAdaptFPS=\"false\">\n  <shape id=\"1\" startTime=\"0\" endTime=\"100\" fillType=\"color\" mediaFillMode=\"fill\">\n    <fillColor value=\"#ff3bb05c\" />\n    <path d=\"M 0 0L 10 0L 10 10L 0 10Z\" />\n  </shape>\n</scene>";
const PB19_SLOT1 = 'content://media/external/images/media/1000891919';
const PB19_SLOT2 = 'am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png';
const PB19_SLOT3 = 'content://media/external/images/media/1000899918';
const PB19_TO1 = 'content://media/external/images/media/100042';
const PB1_SLOT = 'content://media/external/images/media/1000943531';
const PB1_TO = 'content://media/external/images/media/100044';

export function runPresetRemixWorkflowTests() {
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

  test('IPR3-1: validasi berkas masukan - ekstensi .xml, MIME XML, penolakan eksplisit, dan batas 15 MB', () => {
    assertEquals(PRESET_MAX_BYTES, 15 * 1024 * 1024, 'batas ukuran 15 MB');
    assert(validatePresetFileInput({ name: 'p.xml', size: 1000, type: '' }).ok === true, 'ekstensi .xml dengan tipe kosong (umum di Android) diterima');
    assert(validatePresetFileInput({ name: 'p', size: 1000, type: 'text/xml' }).ok === true, 'MIME XML diterima tanpa ekstensi');
    const png = validatePresetFileInput({ name: 'p.png', size: 1000, type: 'image/png' });
    assert(png.ok === false && png.error.includes('Format tidak didukung'), 'PNG ditolak: ' + png.error);
    const emptyFile = validatePresetFileInput({ name: 'p.xml', size: 0, type: 'text/xml' });
    assert(emptyFile.ok === false && emptyFile.error.includes('kosong'), 'berkas kosong ditolak: ' + emptyFile.error);
    const tooBig = validatePresetFileInput({ name: 'p.xml', size: PRESET_MAX_BYTES + 1, type: 'text/xml' });
    assert(tooBig.ok === false && tooBig.error.includes('15 MB'), 'berkas terlalu besar ditolak: ' + tooBig.error);
    const badSize = validatePresetFileInput({ name: 'p.xml', size: 'abc', type: 'text/xml' });
    assert(badSize.ok === false, 'ukuran tidak numerik ditolak');
    assert(validatePresetFileInput(null).ok === false, 'masukan null ditolak');
  });

  test('IPR3-2: analisis PB19 - ringkasan proyek dan tiga slot aset dengan info lengkap', () => {
    const a = analyzePresetText(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(a.ok === true, 'ok: ' + a.error);
    assertEquals(a.summary.title, 'Proyek Baru 19', 'judul scene');
    assertEquals(a.summary.width, 1080, 'lebar');
    assertEquals(a.summary.height, 1350, 'tinggi');
    assertEquals(a.summary.fps, 60, 'fps');
    assertEquals(a.summary.totalTime, 7148, 'totalTime');
    assertEquals(a.summary.layerCount, 5, 'jumlah layer');
    assertEquals(a.summary.mediaCount, 3, 'jumlah media');
    assertEquals(a.summary.keyframeCount, 14, 'jumlah keyframe');
    assertEquals(a.slots.length, 3, 'jumlah slot');
    assertEquals(a.slots[0].uri, PB19_SLOT1, 'uri slot1');
    assertEquals(a.slots[0].kind, 'image', 'jenis slot1');
    assert(a.slots[0].declared === true, 'slot1 terdeklarasi');
    assertEquals(a.slots[0].filename, 'mascot-wink-cutout.png', 'filename slot1');
    assertEquals(a.slots[0].layerCount, 1, 'slot1 dipakai 1 layer');
    assertEquals(a.slots[0].declarationCount, 1, 'slot1 satu deklarasi');
    assertEquals(a.slots[2].uri, PB19_SLOT3, 'uri slot3');
    assertEquals(a.slots[2].layerCount, 3, 'slot3 dipakai 3 layer');
    assert(a.slots[2].filename === null, 'slot3 tanpa filename');
    assert(Array.isArray(a.unsupported), 'daftar unsupported tersedia');
  });

  test('IPR3-3: analisis menolak XML rusak dan berkas tanpa <scene> dengan pesan eksplisit', () => {
    const broken = analyzePresetText('<scene><shape id="1"></scene>');
    assert(broken.ok === false, 'XML rusak ditolak');
    assert(broken.error.length > 0, 'pesan galat tersedia');
    const noScene = analyzePresetText('<other></other>');
    assert(noScene.ok === false, 'tanpa scene ditolak');
    assert(noScene.error.includes('scene'), 'pesan menyebut scene: ' + noScene.error);
  });

  test('IPR3-4: proyek valid tanpa media menghasilkan analisis sukses dengan nol slot', () => {
    const a = analyzePresetText(SYNTHETIC_NO_SLOT_FIXTURE);
    assert(a.ok === true, 'ok: ' + a.error);
    assertEquals(a.slots.length, 0, 'nol slot');
    assertEquals(a.summary.layerCount, 1, 'satu layer');
    assertEquals(a.summary.mediaCount, 0, 'nol media');
    assertEquals(a.summary.keyframeCount, 0, 'nol keyframe');
  });

  test('IPR3-5: normalisasi URI pengganti - pemangkasan, penolakan kosong/terlarang/kepanjangan', () => {
    const trimmed = normalizeReplacementUri('  ' + PB19_TO1 + '  ');
    assert(trimmed.ok === true && trimmed.uri === PB19_TO1, 'URI dipangkas');
    assert(normalizeReplacementUri('').ok === false, 'kosong ditolak');
    assert(normalizeReplacementUri('   ').ok === false, 'spasi saja ditolak');
    for (const bad of ['a"b', 'a<b', 'a&b']) {
      const r = normalizeReplacementUri(bad);
      assert(r.ok === false && r.error.includes('terlarang'), 'karakter terlarang ditolak: ' + bad);
    }
    assert(normalizeReplacementUri('u'.repeat(2049)).ok === false, 'URI lebih dari 2048 karakter ditolak');
    assert(normalizeReplacementUri('u'.repeat(2048)).ok === true, 'URI tepat 2048 karakter diterima');
    assert(normalizeReplacementUri(null).ok === false, 'masukan bukan teks ditolak');
  });

  test('IPR3-6: perakitan penggantian - metadata opsional dari berkas, hanya bidang yang valid', () => {
    const full = buildReplacement(PB19_SLOT1, PB19_TO1, { name: 'maskot-baru.png', size: 1234, width: 800, height: 999 });
    assert(full.ok === true, 'ok: ' + full.error);
    assertEquals(full.replacement.fromUri, PB19_SLOT1, 'fromUri');
    assertEquals(full.replacement.toUri, PB19_TO1, 'toUri');
    assertEquals(full.replacement.filename, 'maskot-baru.png', 'filename dari berkas');
    assertEquals(full.replacement.size, 1234, 'size dari berkas');
    assertEquals(full.replacement.width, 800, 'width dari berkas');
    assertEquals(full.replacement.height, 999, 'height dari berkas');
    const bare = buildReplacement(PB19_SLOT1, PB19_TO1, null);
    assert(bare.ok === true, 'tanpa berkas tetap valid');
    assertEquals(JSON.stringify(Object.keys(bare.replacement).sort()), JSON.stringify(['fromUri', 'toUri']), 'tanpa berkas hanya fromUri/toUri');
    const partial = buildReplacement(PB19_SLOT1, PB19_TO1, { name: 'x.png' });
    assertEquals(JSON.stringify(Object.keys(partial.replacement).sort()), JSON.stringify(['filename', 'fromUri', 'toUri']), 'berkas sebagian hanya metadata valid');
    const invalid = buildReplacement(PB19_SLOT1, 'a"b', null);
    assert(invalid.ok === false && invalid.replacement === null, 'URI tidak valid ditolak tanpa penggantian');
  });

  test('IPR3-7: alur remix PB19 satu slot - berhasil, slot lain utuh, lulus validasi', () => {
    const a = analyzePresetText(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(a.ok === true, 'analisis ok');
    const built = buildReplacement(PB19_SLOT1, PB19_TO1, null);
    assert(built.ok === true, 'perakitan ok');
    const r = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [built.replacement]);
    assert(r.ok === true, 'remix ok: ' + r.error);
    assert(r.xml.includes(PB19_TO1), 'xml memuat uri baru');
    assertEquals(JSON.stringify(r.untouchedSlots), JSON.stringify([PB19_SLOT2, PB19_SLOT3]), 'slot lain utuh');
    assert(r.validation && r.validation.valid === true, 'validasi lulus');
    const p = parseAlightMotionProject(r.xml);
    assert(p.ok === true, 'parse ulang ok');
    assertEquals(p.assetSlots.length, 3, 'jumlah slot tetap 3');
    assertEquals(p.assetSlots[0].uri, PB19_TO1, 'slot1 kini uri baru');
    const pb1 = remixPreset(REAL_AM_EXPORT_FIXTURE, [{ fromUri: PB1_SLOT, toUri: PB1_TO }]);
    assert(pb1.ok === true, 'remix PB1 ok: ' + pb1.error);
    assertEquals(pb1.untouchedSlots.length, 0, 'PB1 tidak menyisakan slot lain');
    assert(pb1.validation.valid === true, 'PB1 lulus validasi');
  });

  test('IPR3-8: alur penuh dengan metadata berkas - filename/size/width/height diperbarui, title asli terjaga', () => {
    const built = buildReplacement(PB19_SLOT1, PB19_TO1, { name: 'maskot-baru.png', size: 1234.6, width: 800, height: 999.4 });
    assert(built.ok === true, 'perakitan ok');
    const r = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [built.replacement]);
    assert(r.ok === true, 'remix ok: ' + r.error);
    const p = parseAlightMotionProject(r.xml);
    assertEquals(p.media[0].uri, PB19_TO1, 'uri diganti');
    assertEquals(p.media[0].filename, 'maskot-baru.png', 'filename metadata');
    assertEquals(p.media[0].size, 1235, 'size dibulatkan');
    assertEquals(p.media[0].width, 800, 'width metadata');
    assertEquals(p.media[0].height, 999, 'height dibulatkan');
    assertEquals(p.media[0].title, 'mascot-wink-cutout.png', 'title tidak disentuh alur ini');
  });

  test('IPR3-9: penolakan remix diteruskan dengan pesan eksplisit - fromUri tak dikenal, duplikat, tabrakan', () => {
    const unknown = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: 'content://tidak/ada.png', toUri: PB19_TO1 }]);
    assert(unknown.ok === false && unknown.error.includes('tidak dikenal'), 'fromUri tak dikenal: ' + unknown.error);
    const dup = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [
      { fromUri: PB19_SLOT1, toUri: PB19_TO1 },
      { fromUri: PB19_SLOT3, toUri: PB19_TO1 },
    ]);
    assert(dup.ok === false && dup.error.includes('toUri duplikat'), 'toUri duplikat: ' + dup.error);
    const clash = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_SLOT3 }]);
    assert(clash.ok === false && clash.error.includes('bertabrakan'), 'toUri bertabrakan: ' + clash.error);
  });

  test('IPR3-10: keadaan antarmuka - delapan keadaan terhitung murni dengan prioritas benar', () => {
    assertEquals(computeRemixerUiState({}), 'empty', 'keadaan kosong');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml' }), 'fileSelected', 'berkas dipilih');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', parsing: true }), 'parsing', 'mengurai');
    const analysis = { ok: true, slots: [] };
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', analysis }), 'analysis', 'analisis selesai');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', analysis, replacementCount: 1 }), 'replacementSelected', 'penggantian dipilih');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', analysis, replacementCount: 1, result: { ok: true } }), 'ready', 'siap unduh');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', analysis, result: { ok: false, validation: { valid: false } } }), 'validationFailed', 'validasi gagal');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', error: 'gagal' }), 'processingError', 'galat pemrosesan');
    assertEquals(computeRemixerUiState({ fileName: 'a.xml', error: 'gagal', parsing: true }), 'parsing', 'mengurai menang atas galat');
    assertEquals(computeRemixerUiState(null), 'empty', 'model null jatuh ke kosong');
  });

  test('IPR3-11: nama unduhan diturunkan dari berkas sumber dan disanitasi', () => {
    assertEquals(buildRemixDownloadName('Proyek Baru 19.xml'), 'proyek-baru-19-remix', 'nama diturunkan');
    assertEquals(buildRemixDownloadName(''), 'preset-remix', 'nama kosong jatuh ke bawaan');
    assertEquals(buildRemixDownloadName('a/b:c*d?.xml'), 'a-b-c-d-remix', 'karakter terlarang disanitasi');
    const long = buildRemixDownloadName('x'.repeat(80) + '.xml');
    assert(long.length <= 66 && long.endsWith('-remix'), 'panjang dibatasi: ' + long.length);
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
