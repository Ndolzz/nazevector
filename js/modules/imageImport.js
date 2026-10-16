// js/modules/imageImport.js — Impor dan normalisasi gambar (berfungsi, lokal).

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const NORMALIZED_MAX_DIMENSION = 1400;

export function isAcceptedFile(file) {
  return ACCEPTED_TYPES.includes(file.type);
}

export async function importImageFile(file) {
  if (!isAcceptedFile(file)) {
    throw new Error('Format tidak didukung. Gunakan PNG, JPG, atau WebP.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Ukuran file melebihi batas 15 MB.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const bitmap = await loadImageElement(objectUrl);
    const scale = Math.min(
      1,
      NORMALIZED_MAX_DIMENSION / Math.max(bitmap.naturalWidth, bitmap.naturalHeight)
    );
    const width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
    const height = Math.max(1, Math.round(bitmap.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Kanvas 2D tidak tersedia di peramban ini.');
    }
    context.drawImage(bitmap, 0, 0, width, height);
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      originalWidth: bitmap.naturalWidth,
      originalHeight: bitmap.naturalHeight,
      width,
      height,
      canvas,
      url: objectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    if (error instanceof Error && error.message === 'Kanvas 2D tidak tersedia di peramban ini.') {
      throw error;
    }
    throw new Error('Gambar tidak dapat dibaca. File mungkin rusak.');
  }
}

export function releaseImage(image) {
  if (image && image.url) {
    URL.revokeObjectURL(image.url);
  }
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar gagal dimuat.'));
    img.src = url;
  });
}
