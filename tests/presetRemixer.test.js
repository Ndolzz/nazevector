// tests/presetRemixer.test.js - Penggantian aset individual (IPR-2).
// Membuktikan lewat API publik: penggantian uri aset terpilih pada deklarasi
// <media> dan fillImage layer, metadata hanya pada atribut yang sudah ada,
// aset lain terjaga byte demi byte (round-trip), keyframe/durasi/urutan
// layer utuh (JSON compare), penolakan eksplisit untuk kasus tidak aman,
// dan hasil lulus validator struktur. Validitas struktur BUKAN bukti
// keberhasilan impor di Alight Motion (uji lapangan tetap wajib).
// Fixture PB1/PB19 disalin APA ADANYA dari tests/presetParser.test.js
// (ekspor asli AM 5.0.273, identik dengan tests/amImportFixture.test.js).
// Kejujuran: 17 uji di bawah lulus di sandbox tanpa peramban pada 2026-10-18;
// jalankan ulang tests/index.html di peramban untuk verifikasi runtime.

import { parseAlightMotionProject } from '../js/modules/presetParser.js';
import { replaceAssets } from '../js/modules/presetRemixer.js';

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

const SYNTHETIC_DUP_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?>\n<scene title=\"Duplikat IPR2\" width=\"1080\" height=\"1350\" exportWidth=\"1080\" exportHeight=\"1350\" precompose=\"dynamicResolution\" bgcolor=\"#ff000000\" totalTime=\"100\" fps=\"30\" modifiedTime=\"1\" amver=\"1028425\" ffver=\"106\" retime=\"freeze\" retimeAdaptFPS=\"false\">\n  <media uri=\"content://dup/asset.png\" filename=\"a.png\" title=\"a.png\" type=\"image/png\" size=\"10\" width=\"4\" height=\"4\" />\n  <media uri=\"content://dup/asset.png\" filename=\"a.png\" title=\"a.png\" type=\"image/png\" size=\"10\" width=\"4\" height=\"4\" />\n  <shape id=\"1\" startTime=\"0\" endTime=\"100\" fillType=\"media\" fillImage=\"content://dup/asset.png\" mediaFillMode=\"fill\">\n    <path d=\"M 0 0L 10 0L 10 10L 0 10Z\" />\n  </shape>\n</scene>";
const SYNTHETIC_UNDECLARED_FIXTURE = "<scene title=\"t\" width=\"10\" height=\"10\" fps=\"30\" totalTime=\"100\"><shape id=\"1\" fillType=\"media\" fillImage=\"content://x/y.png\"><transform/></shape></scene>";

export function runPresetRemixerTests() {
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

  function stripSource(obj) {
    const copy = Object.assign({}, obj);
    delete copy._source;
    return copy;
  }

  const PB19_SLOT1 = 'content://media/external/images/media/1000891919';
  const PB19_SLOT2 = 'am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png';
  const PB19_SLOT3 = 'content://media/external/images/media/1000899918';
  const PB19_TO1 = 'content://media/external/images/media/100042';
  const PB19_TO3 = 'content://media/external/images/media/100043';
  const PB1_SLOT = 'content://media/external/images/media/1000943531';
  const PB1_TO = 'content://media/external/images/media/100044';

  test('IPR2-1: PB19 slot tunggal diganti - uri media dan fillImage layer diperbarui, slot lain terdeteksi utuh', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_TO1 }]);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.validation && r.validation.valid === true, 'valid: ' + JSON.stringify(r.validation && r.validation.issues));
    assert(JSON.stringify(r.untouchedSlots) === JSON.stringify([PB19_SLOT2, PB19_SLOT3]), 'untouched: ' + JSON.stringify(r.untouchedSlots));
    const p = parseAlightMotionProject(r.xml);
    assert(p.ok === true, 'parse ulang: ' + p.error);
    assert(p.assetSlots.length === 3, 'jumlah slot: ' + p.assetSlots.length);
    assert(p.assetSlots[0].uri === PB19_TO1 && p.assetSlots[0].declared === true, 'slot1 baru');
    assert(p.layers[0].fillImage === PB19_TO1, 'fillImage layer: ' + p.layers[0].fillImage);
    assert(p.media[0].uri === PB19_TO1, 'uri media');
  });

  test('IPR2-2: round-trip byte - mengembalikan uri lama memulihkan berkas identik byte demi byte', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_TO1 }]);
    assert(r.ok === true, 'ok: ' + r.error);
    const restored = r.xml.split(PB19_TO1).join(PB19_SLOT1);
    assert(restored === REAL_AM_IMPORTED_PATH_FIXTURE, 'tidak identik byte demi byte');
  });

  test('IPR2-3: keyframe, durasi, dan urutan layer terjaga (JSON compare) pada penggantian slot tiga-layer', () => {
    const before = parseAlightMotionProject(REAL_AM_IMPORTED_PATH_FIXTURE);
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT3, toUri: PB19_TO3 }]);
    assert(r.ok === true, 'ok: ' + r.error);
    const after = parseAlightMotionProject(r.xml);
    assert(before.layers.length === after.layers.length, 'jumlah layer');
    assert(JSON.stringify(before.layers.map((l) => l.id)) === JSON.stringify(after.layers.map((l) => l.id)), 'urutan layer berubah');
    for (let i = 0; i < before.layers.length; i += 1) {
      const a = stripSource(before.layers[i]);
      const b = stripSource(after.layers[i]);
      if (a.fillImage === PB19_SLOT3) a.fillImage = PB19_TO3;
      assert(JSON.stringify(a) === JSON.stringify(b), 'layer ' + i + ' berubah di luar fillImage');
      assert(before.layers[i].startTime === after.layers[i].startTime && before.layers[i].endTime === after.layers[i].endTime, 'durasi layer ' + i);
    }
    assert(JSON.stringify(before.keyframeSummary) === JSON.stringify(after.keyframeSummary), 'ringkasan keyframe berubah');
    assert(after.keyframeSummary.keyframeCount === 14 && after.keyframeSummary.layersWithKeyframes === 2, '14 keyframe pada 2 layer');
  });

  test('IPR2-4: metadata lengkap menimpa filename/title/size/width/height yang sudah ada; size/height dibulatkan', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_TO1, filename: 'maskot-baru.png', title: 'Maskot Baru', size: 1234.6, width: 800, height: 999.4 }]);
    assert(r.ok === true, 'ok: ' + r.error);
    const p = parseAlightMotionProject(r.xml);
    assert(p.media[0].filename === 'maskot-baru.png', 'filename: ' + p.media[0].filename);
    assert(p.media[0].title === 'Maskot Baru', 'title: ' + p.media[0].title);
    assert(p.media[0].size === 1235, 'size dibulatkan: ' + p.media[0].size);
    assert(p.media[0].width === 800, 'width: ' + p.media[0].width);
    assert(p.media[0].height === 999, 'height dibulatkan: ' + p.media[0].height);
  });

  test('IPR2-5: media tanpa filename (PB19 slot3) - atribut yang tidak ada dilewati dengan warning, uri tetap diganti', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT3, toUri: PB19_TO3, filename: 'baru.png', width: 77 }]);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.warnings.some((w) => w.includes('filename') && w.includes('dilewati')), 'warning filename: ' + JSON.stringify(r.warnings));
    const p = parseAlightMotionProject(r.xml);
    assert(p.media[2].uri === PB19_TO3, 'uri slot3 diganti');
    assert(p.media[2].filename === null, 'filename tetap null');
    assert(p.media[2].width === 77, 'width diganti: ' + p.media[2].width);
  });

  test('IPR2-6: dua deklarasi media dengan uri sama - seluruh deklarasi diperbarui dengan warning eksplisit', () => {
    const r = replaceAssets(SYNTHETIC_DUP_FIXTURE, [{ fromUri: 'content://dup/asset.png', toUri: 'content://dup/baru.png', filename: 'b.png' }]);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.warnings.some((w) => w.includes('dideklarasikan 2 kali')), 'warning duplikat: ' + JSON.stringify(r.warnings));
    const p = parseAlightMotionProject(r.xml);
    assert(p.media.length === 2 && p.media.every((m) => m.uri === 'content://dup/baru.png'), 'kedua deklarasi diperbarui');
    assert(p.media.every((m) => m.filename === 'b.png'), 'filename kedua deklarasi');
    assert(p.assetSlots[0].declarationCount === 2, 'declarationCount: ' + p.assetSlots[0].declarationCount);
  });

  test('IPR2-7: slot tanpa deklarasi <media> ditolak eksplisit tanpa keluaran', () => {
    const r = replaceAssets(SYNTHETIC_UNDECLARED_FIXTURE, [{ fromUri: 'content://x/y.png', toUri: 'content://x/z.png' }]);
    assert(r.ok === false, 'harus ditolak');
    assert(r.error.includes('tidak dideklarasikan'), 'pesan: ' + r.error);
    assert(r.xml === null, 'tidak boleh ada keluaran xml');
  });

  test('IPR2-8: fromUri yang tidak dikenal ditolak', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: 'content://tidak/ada.png', toUri: PB19_TO1 }]);
    assert(r.ok === false, 'harus ditolak');
    assert(r.error.includes('tidak dikenal'), 'pesan: ' + r.error);
  });

  test('IPR2-9: fromUri duplikat pada daftar penggantian ditolak', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_TO1 }, { fromUri: PB19_SLOT1, toUri: PB19_TO3 }]);
    assert(r.ok === false, 'harus ditolak');
    assert(r.error.includes('fromUri duplikat'), 'pesan: ' + r.error);
  });

  test('IPR2-10: toUri yang bertabrakan dengan uri aset yang sudah ada ditolak', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_SLOT3 }]);
    assert(r.ok === false, 'harus ditolak');
    assert(r.error.includes('bertabrakan'), 'pesan: ' + r.error);
  });

  test('IPR2-11: toUri kosong ditolak', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: '' }]);
    assert(r.ok === false, 'harus ditolak');
    assert(r.error.includes('toUri kosong'), 'pesan: ' + r.error);
  });

  test('IPR2-12: karakter terlarang pada toUri atau filename ditolak', () => {
    const r1 = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: 'content://a"b' }]);
    assert(r1.ok === false, 'toUri terlarang harus ditolak');
    assert(r1.error.includes('terlarang'), 'pesan toUri: ' + r1.error);
    const r2 = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_TO1, filename: 'a<b.png' }]);
    assert(r2.ok === false, 'filename terlarang harus ditolak');
    assert(r2.error.includes('filename'), 'pesan filename: ' + r2.error);
  });

  test('IPR2-13: XML masukan rusak ditolak dengan pesan parser', () => {
    const r = replaceAssets('<scene><shape id="1"></scene>', [{ fromUri: 'a', toUri: 'b' }]);
    assert(r.ok === false, 'harus ditolak');
    assert(r.error.includes('tidak dapat dibaca'), 'pesan: ' + r.error);
  });

  test('IPR2-14: hasil penggantian slot am: pada PB19 lulus validator struktur', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT2, toUri: 'am:BARU.png' }]);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.validation.valid === true && r.validation.issues.length === 0, 'valid: ' + JSON.stringify(r.validation.issues));
  });

  test('IPR2-15: PB1 - slot satu-satunya diganti, lulus validator, tidak ada slot tersisa', () => {
    const r = replaceAssets(REAL_AM_EXPORT_FIXTURE, [{ fromUri: PB1_SLOT, toUri: PB1_TO }]);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(r.validation.valid === true, 'valid');
    assert(r.untouchedSlots.length === 0, 'untouched: ' + JSON.stringify(r.untouchedSlots));
    const p = parseAlightMotionProject(r.xml);
    assert(p.assetSlots.length === 1 && p.assetSlots[0].uri === PB1_TO, 'slot PB1 baru');
  });

  test('IPR2-16: dua slot sekaligus diganti, slot ketiga dan metadata aslinya terjaga', () => {
    const r = replaceAssets(REAL_AM_IMPORTED_PATH_FIXTURE, [{ fromUri: PB19_SLOT1, toUri: PB19_TO1 }, { fromUri: PB19_SLOT3, toUri: PB19_TO3 }]);
    assert(r.ok === true, 'ok: ' + r.error);
    assert(JSON.stringify(r.untouchedSlots) === JSON.stringify([PB19_SLOT2]), 'untouched: ' + JSON.stringify(r.untouchedSlots));
    const p = parseAlightMotionProject(r.xml);
    assert(p.assetSlots.map((s) => s.uri).join('|') === [PB19_TO1, PB19_SLOT2, PB19_TO3].join('|'), 'urutan slot: ' + p.assetSlots.map((s) => s.uri).join('|'));
    assert(p.media[1].uri === PB19_SLOT2 && p.media[1].filename === 'Profil Copy 3 Copy 3 [3C65A93].png', 'media slot2 utuh');
  });

  test('IPR2-17: daftar penggantian kosong, null, atau masukan xml kosong ditolak', () => {
    assert(replaceAssets(REAL_AM_EXPORT_FIXTURE, []).ok === false, 'array kosong ditolak');
    assert(replaceAssets(REAL_AM_EXPORT_FIXTURE, null).ok === false, 'null ditolak');
    assert(replaceAssets('', [{ fromUri: 'a', toUri: 'b' }]).ok === false, 'xml kosong ditolak');
  });

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}
