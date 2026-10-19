// Guard SSRF untuk sourceUrl gambar pada Naze Vector Render Server.
// Modul murni; hanya bergantung pada kelas URL WHATWG bawaan
// (tersedia di peramban dan Node 18+).

export const BLOCKED_IPV4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export const BLOCKED_IPV6_RANGES = [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

export function parseIpv4(ip) {
  if (typeof ip !== 'string') return null;
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

export function parseIpv6(ip) {
  if (typeof ip !== 'string') return null;
  let text = ip;
  const zoneIndex = text.indexOf('%');
  if (zoneIndex !== -1) text = text.slice(0, zoneIndex);
  if (text === '') return null;
  if (text.indexOf('::') !== text.lastIndexOf('::')) return null;
  const doubleIndex = text.indexOf('::');
  const hasDouble = doubleIndex !== -1;
  const head = hasDouble ? text.slice(0, doubleIndex) : text;
  const tail = hasDouble ? text.slice(doubleIndex + 2) : '';
  const parseSide = (part, isLast) => {
    if (part === '') return [];
    const segments = part.split(':');
    const groups = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (i === segments.length - 1 && isLast && segment.indexOf('.') !== -1) {
        const v4 = parseIpv4(segment);
        if (v4 === null) return null;
        groups.push(Number((v4 >> 16n) & 0xffffn));
        groups.push(Number(v4 & 0xffffn));
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(segment)) return null;
      groups.push(parseInt(segment, 16));
    }
    return groups;
  };
  const headGroups = parseSide(head, !hasDouble);
  const tailGroups = hasDouble ? parseSide(tail, true) : [];
  if (headGroups === null || tailGroups === null) return null;
  const total = headGroups.length + tailGroups.length;
  if (hasDouble) {
    if (total > 7) return null;
  } else if (total !== 8) {
    return null;
  }
  const groups = headGroups.slice();
  if (hasDouble) {
    for (let i = total; i < 8; i++) groups.push(0);
  }
  for (const group of tailGroups) groups.push(group);
  let value = 0n;
  for (const group of groups) value = (value << 16n) | BigInt(group & 0xffff);
  return value;
}

function matchesPrefix(value, baseText, bits, totalBits) {
  const base = totalBits === 32 ? parseIpv4(baseText) : parseIpv6(baseText);
  if (base === null) return false;
  const shift = BigInt(totalBits - bits);
  return (value >> shift) === (base >> shift);
}

// Mengembalikan true bila IP berada pada rentang terblokir.
// String yang gagal di-parse dianggap terblokir (fail closed).
export function isBlockedIp(ip) {
  const v4 = parseIpv4(ip);
  if (v4 !== null) {
    for (const range of BLOCKED_IPV4_RANGES) {
      if (matchesPrefix(v4, range[0], range[1], 32)) return true;
    }
    return false;
  }
  const v6 = parseIpv6(ip);
  if (v6 === null) return true;
  for (const range of BLOCKED_IPV6_RANGES) {
    if (matchesPrefix(v6, range[0], range[1], 128)) return true;
  }
  return false;
}

export function isIpOrNumericHost(hostname) {
  if (typeof hostname !== 'string') return true;
  const host = hostname.toLowerCase();
  if (host.indexOf(':') !== -1) return true;
  if (/^[0-9]+$/.test(host)) return true;
  if (parseIpv4(host) !== null) return true;
  return false;
}

// Allowlist: entri eksak ('cdn.example.org') atau wildcard ('*.example.org').
// Wildcard mencakup semua tingkat subdomain (b.a.example.org cocok) tetapi
// tidak mencocokkan domain dasarnya. Pencocokan case-insensitive.
export function hostMatchesAllowlist(hostname, allowlist) {
  if (typeof hostname !== 'string' || !Array.isArray(allowlist)) return false;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  for (const rawEntry of allowlist) {
    if (typeof rawEntry !== 'string') continue;
    const entry = rawEntry.trim().toLowerCase().replace(/\.$/, '');
    if (entry === '') continue;
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1);
      if (host.endsWith(suffix) && host.length > suffix.length) return true;
    } else if (host === entry) {
      return true;
    }
  }
  return false;
}

// Memvalidasi URL sumber gambar: hanya https, tanpa userinfo, port 443/kosong,
// host bukan IP literal/hostname numerik, dan host ada di allowlist.
export function checkSourceUrl(rawUrl, options) {
  const opts = options || {};
  const allowlist = Array.isArray(opts.allowlist) ? opts.allowlist : [];
  let url = null;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return { ok: false, reason: 'URL tidak valid' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'hanya https diperbolehkan' };
  if (url.username !== '' || url.password !== '') return { ok: false, reason: 'URL tidak boleh memuat userinfo' };
  if (url.port !== '' && url.port !== '443') return { ok: false, reason: 'port hanya 443 atau kosong' };
  const hostname = url.hostname;
  if (isIpOrNumericHost(hostname)) return { ok: false, reason: 'host tidak boleh IP literal atau hostname numerik' };
  if (!hostMatchesAllowlist(hostname, allowlist)) return { ok: false, reason: 'host tidak ada di allowlist' };
  return { ok: true, url, hostname, href: url.href };
}

// Memvalidasi ulang header Location untuk redirect: target di-resolve
// terhadap URL saat ini lalu menjalankan pemeriksaan checkSourceUrl penuh.
export function validateRedirect(currentUrl, locationHeader, options) {
  if (typeof locationHeader !== 'string' || locationHeader === '') {
    return { ok: false, reason: 'header Location kosong' };
  }
  let resolved = null;
  try {
    resolved = new URL(locationHeader, currentUrl);
  } catch (e) {
    return { ok: false, reason: 'header Location tidak valid' };
  }
  const check = checkSourceUrl(resolved.href, options);
  if (!check.ok) return { ok: false, reason: 'redirect ditolak: ' + check.reason };
  return { ok: true, url: resolved, hostname: resolved.hostname, href: resolved.href };
}

// Memvalidasi seluruh alamat hasil resolusi DNS sebelum koneksi dibuat.
export function checkResolvedAddresses(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return { ok: false, reason: 'tidak ada alamat hasil resolusi DNS' };
  }
  for (const address of addresses) {
    if (typeof address !== 'string' || isBlockedIp(address)) {
      return { ok: false, reason: 'alamat terblokir: ' + address };
    }
  }
  return { ok: true };
}
