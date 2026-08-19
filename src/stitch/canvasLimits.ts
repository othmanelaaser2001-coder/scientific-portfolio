/**
 * Browsers cap both the maximum canvas dimension and the total canvas area, and
 * the caps differ a lot between iOS Safari and desktop Chrome. Exceeding them
 * yields a blank canvas rather than an exception, so the stitcher probes before
 * committing to an output size.
 *
 * The probes are deliberately cheap: the dimension probe allocates a sliver
 * eight pixels tall, and the area probe only ever allocates a canvas the size of
 * the mosaic that is actually about to be rendered, backing off if that fails.
 */

let cachedMaxDimension: number | null = null;

const DIMENSION_CANDIDATES = [32767, 16384, 8192, 4096, 2048];

function probe(width: number, height: number): boolean {
  const canvas = document.createElement('canvas');
  try {
    canvas.width = width;
    canvas.height = height;
    if (canvas.width !== width || canvas.height !== height) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // A canvas that exceeded an internal limit silently refuses to paint.
    ctx.fillStyle = '#ff8000';
    ctx.fillRect(width - 1, height - 1, 1, 1);
    const pixel = ctx.getImageData(width - 1, height - 1, 1, 1).data;
    return pixel[0] > 200 && pixel[3] > 200;
  } catch {
    return false;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function maxCanvasDimension(): number {
  if (cachedMaxDimension !== null) return cachedMaxDimension;
  cachedMaxDimension = 2048;
  for (const candidate of DIMENSION_CANDIDATES) {
    if (probe(candidate, 8)) {
      cachedMaxDimension = candidate;
      break;
    }
  }
  return cachedMaxDimension;
}

/**
 * Rough ceiling from the device's reported memory. Safari does not implement
 * `deviceMemory`, so iPhones fall back to a figure that a modern handset can
 * hold comfortably (72 megapixels is still roughly 36000 x 2000).
 */
function memoryCeiling(): number {
  const gigabytes = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (!gigabytes) return 72_000_000;
  // 4 bytes per pixel, and the canvas must not be more than a sixteenth of RAM.
  return Math.max(24_000_000, Math.min(150_000_000, (gigabytes * 1024 * 1024 * 1024) / 4 / 16));
}

export interface OutputSize {
  scale: number;
  width: number;
  height: number;
}

/**
 * Largest renderable output for a mosaic spanning `spanX` x `spanY` source
 * pixels, at most `hardCap` pixels in total.
 */
export function chooseOutputSize(spanX: number, spanY: number, hardCap = 150_000_000): OutputSize {
  const maxDimension = maxCanvasDimension();
  const areaCap = Math.min(hardCap, memoryCeiling());
  let scale = Math.min(
    1,
    maxDimension / Math.max(spanX, spanY),
    Math.sqrt(areaCap / Math.max(1, spanX * spanY)),
  );

  for (let attempt = 0; attempt < 8; attempt++) {
    const width = Math.max(1, Math.round(spanX * scale));
    const height = Math.max(1, Math.round(spanY * scale));
    if (probe(width, height)) return { scale, width, height };
    scale *= 0.72;
    if (scale < 0.04) break;
  }
  const scaleFallback = Math.max(0.04, scale);
  return {
    scale: scaleFallback,
    width: Math.max(1, Math.round(spanX * scaleFallback)),
    height: Math.max(1, Math.round(spanY * scaleFallback)),
  };
}
