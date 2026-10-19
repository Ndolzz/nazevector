// Deteksi tipe MIME gambar dari magic byte dan pemetaan ekstensi.
// Modul murni.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWithBytes(bytes, signature) {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

// Mendeteksi MIME dari magic byte. Butuh minimal 12 byte; kurang dari itu
// dianggap tidak dikenali.
export function sniffImageMime(bytes) {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 12) return null;
  if (startsWithBytes(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWithBytes(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

export function extensionForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return null;
}

// Memeriksa Content-Type unduhan: case-insensitive, parameter diabaikan.
export function isAllowedImageContentType(value) {
  if (typeof value !== 'string') return false;
  const mime = value.trim().toLowerCase().split(';')[0].trim();
  return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp';
}
