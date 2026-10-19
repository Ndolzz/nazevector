// Uji guard SSRF untuk sourceUrl gambar (RV-1..RV-3).
// Dijalankan melalui harness tests/index.html (butuh server HTTP lokal).

import {
  checkSourceUrl,
  hostMatchesAllowlist,
  isBlockedIp,
  checkResolvedAddresses,
  validateRedirect,
} from '../server/src/security/urlGuard.js';

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

export function runUrlGuardTests() {
  const allowlist = ['cdn.example.org', '*.images.example.org', '151.101.1.6'];
  const cases = [];

  cases.push(runCase('RV1: URL https pada host allowlist eksak diterima', () => {
    const res = checkSourceUrl('https://cdn.example.org/a.png', { allowlist });
    assert(res.ok === true, 'seharusnya diterima, alasan: ' + (res && res.reason));
    assert(res.hostname === 'cdn.example.org', 'hostname salah');
  }));

  cases.push(runCase('RV1: URL http ditolak', () => {
    assert(checkSourceUrl('http://cdn.example.org/a.png', { allowlist }).ok === false, 'http seharusnya ditolak');
  }));

  cases.push(runCase('RV1: URL dengan userinfo ditolak', () => {
    assert(checkSourceUrl('https://user:pass@cdn.example.org/a.png', { allowlist }).ok === false, 'userinfo seharusnya ditolak');
  }));

  cases.push(runCase('RV1: port selain 443 ditolak', () => {
    assert(checkSourceUrl('https://cdn.example.org:8443/a.png', { allowlist }).ok === false, 'port 8443 seharusnya ditolak');
  }));

  cases.push(runCase('RV1: host di luar allowlist ditolak', () => {
    assert(checkSourceUrl('https://evil.example.com/a.png', { allowlist }).ok === false, 'host asing seharusnya ditolak');
  }));

  cases.push(runCase('RV2: wildcard mencakup semua tingkat subdomain', () => {
    const res = checkSourceUrl('https://b.a.images.example.org/x.png', { allowlist });
    assert(res.ok === true, 'subdomain bertingkat seharusnya diterima, alasan: ' + (res && res.reason));
    assert(checkSourceUrl('https://images.example.org/x.png', { allowlist }).ok === false, 'wildcard tidak mencocokkan domain dasar');
  }));

  cases.push(runCase('RV1: allowlist kosong menolak semua host', () => {
    assert(checkSourceUrl('https://cdn.example.org/a.png', { allowlist: [] }).ok === false, 'allowlist kosong seharusnya menolak');
  }));

  cases.push(runCase('RV1: IP literal IPv4 ditolak meski ada di allowlist', () => {
    assert(checkSourceUrl('https://151.101.1.6/x.png', { allowlist }).ok === false, 'IP literal seharusnya ditolak');
  }));

  cases.push(runCase('RV1: IP literal IPv6 ditolak', () => {
    assert(checkSourceUrl('https://[2606:2800:220:1:248:1893:25c8:1946]/x.png', { allowlist }).ok === false, 'IPv6 literal seharusnya ditolak');
  }));

  cases.push(runCase('RV1: hostname numerik ditolak', () => {
    assert(checkSourceUrl('https://2130706433/x.png', { allowlist }).ok === false, 'hostname numerik seharusnya ditolak');
  }));

  cases.push(runCase('RV2: hostMatchesAllowlist peka huruf dan titik akhir', () => {
    assert(hostMatchesAllowlist('CDN.example.org.', ['cdn.EXAMPLE.org']) === true, 'pencocokan seharusnya case-insensitive');
    assert(hostMatchesAllowlist('xcdn.example.org', ['cdn.example.org']) === false, 'kecocokan parsial seharusnya gagal');
  }));

  cases.push(runCase('RV3: isBlockedIp memblokir IPv4 privat dan khusus', () => {
    const blocked = ['10.0.0.1', '127.0.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '172.31.255.255', '0.0.0.0', '198.18.0.5', '203.0.113.9', '224.0.0.1', '255.255.255.255'];
    for (const ip of blocked) assert(isBlockedIp(ip) === true, ip + ' seharusnya terblokir');
  }));

  cases.push(runCase('RV3: isBlockedIp mengizinkan IPv4 publik', () => {
    for (const ip of ['8.8.8.8', '151.101.1.6', '1.1.1.1']) assert(isBlockedIp(ip) === false, ip + ' seharusnya diizinkan');
  }));

  cases.push(runCase('RV3: isBlockedIp memblokir IPv6 khusus dan v4-terpetakan', () => {
    const blocked = ['::', '::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '64:ff9b::192.0.2.1', '2001:db8::1', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1'];
    for (const ip of blocked) assert(isBlockedIp(ip) === true, ip + ' seharusnya terblokir');
  }));

  cases.push(runCase('RV3: isBlockedIp mengizinkan IPv6 publik dan menolak string tak parseable', () => {
    assert(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946') === false, 'IPv6 publik seharusnya diizinkan');
    assert(isBlockedIp('bukan-ip') === true, 'string tak parseable seharusnya dianggap terblokir (fail closed)');
  }));

  cases.push(runCase('RV3: checkResolvedAddresses memvalidasi seluruh hasil DNS', () => {
    assert(checkResolvedAddresses(['8.8.8.8', '127.0.0.1']).ok === false, 'daftar berisi IP terblokir seharusnya ditolak');
    assert(checkResolvedAddresses(['151.101.1.6']).ok === true, 'daftar publik seharusnya diterima');
    assert(checkResolvedAddresses([]).ok === false, 'daftar kosong seharusnya ditolak');
  }));

  cases.push(runCase('RV3: validateRedirect menolak target berbahaya dan menerima https allowlist', () => {
    const current = 'https://cdn.example.org/a.png';
    assert(validateRedirect(current, 'http://evil.com/x.png', { allowlist }).ok === false, 'redirect ke http seharusnya ditolak');
    assert(validateRedirect(current, 'https://cdn.example.org:8443/x.png', { allowlist }).ok === false, 'redirect ke port lain seharusnya ditolak');
    assert(validateRedirect(current, 'https://img.images.example.org/b.png', { allowlist }).ok === true, 'redirect ke host wildcard seharusnya diterima');
    const rel = validateRedirect(current, '/b.png', { allowlist });
    assert(rel.ok === true, 'redirect relatif ke host sama seharusnya diterima');
    assert(rel.hostname === 'cdn.example.org', 'hostname redirect relatif salah');
    assert(validateRedirect(current, '', { allowlist }).ok === false, 'Location kosong seharusnya ditolak');
  }));

  return summarize(cases);
}
