// Photo compression for attachments (Task 11).
//
// Owner decision (plan, 2026-07-14): photos are stored at <=1200px long edge,
// JPEG quality ~0.82 — big enough to read a cookbook page, small enough that
// IndexedDB backups stay portable.
//
// UNRUN BY UNIT TESTS: this module is browser-API-bound (createImageBitmap,
// canvas, toBlob have no Node/fake equivalents worth trusting) — it is
// verified manually / by E2E when the photo flow lands, not by Vitest.

/** Downscale to `maxEdge` on the long side (never upscale) and re-encode JPEG. */
export async function compressImage(file: Blob, maxEdge = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // OffscreenCanvas (Chrome/Android — the priority target) with an
    // HTMLCanvasElement fallback for engines that lack it.
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('compressImage: 2d context unavailable');
      ctx.drawImage(bitmap, 0, 0, width, height);
      return await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('compressImage: 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('compressImage: canvas.toBlob returned null'))),
        'image/jpeg',
        quality,
      );
    });
  } finally {
    bitmap.close(); // release decoded pixels promptly — these are multi-MB camera shots
  }
}
