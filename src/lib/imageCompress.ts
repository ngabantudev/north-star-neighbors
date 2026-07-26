'use client';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

export interface CompressedImage {
  blob: Blob;
  canvas: HTMLCanvasElement;
  previewUrl: string;
}

async function encodeFromSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<CompressedImage> {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(source, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression failed'))), 'image/jpeg', JPEG_QUALITY);
  });

  return { blob, canvas, previewUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY) };
}

/**
 * Resizes and re-encodes an image via canvas. This is also how EXIF/GPS/device
 * metadata gets stripped — a canvas pixel buffer carries no metadata, so
 * re-exporting through it drops whatever the original file embedded.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const result = await encodeFromSource(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return result;
}

/**
 * Grabs the current frame of a live camera stream. Never touches a file the
 * OS may have sourced from the photo gallery — the pixels come straight off
 * the live `<video>` element.
 */
export async function captureVideoFrame(video: HTMLVideoElement): Promise<CompressedImage> {
  return encodeFromSource(video, video.videoWidth, video.videoHeight);
}
