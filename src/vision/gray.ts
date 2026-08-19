import type { GrayImage } from './types';

/** Converts RGBA pixels to a single luma channel (ITU-R BT.601 weights). */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const n = width * height;
  const out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = (rgba[j] * 77 + rgba[j + 1] * 151 + rgba[j + 2] * 28) >> 8;
  }
  return { data: out, width, height };
}

/** Box-downsamples a gray image by an integer factor. */
export function downsample(img: GrayImage, factor: number): GrayImage {
  if (factor <= 1) return img;
  const width = Math.max(1, Math.floor(img.width / factor));
  const height = Math.max(1, Math.floor(img.height / factor));
  const out = new Uint8Array(width * height);
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      const sy = y * factor;
      const sx = x * factor;
      for (let dy = 0; dy < factor; dy++) {
        const row = (sy + dy) * img.width + sx;
        for (let dx = 0; dx < factor; dx++) sum += img.data[row + dx];
      }
      out[y * width + x] = sum / area;
    }
  }
  return { data: out, width, height };
}

/** 3x3 binomial blur; cheap noise suppression before corner detection. */
export function blur3(img: GrayImage): GrayImage {
  const { data, width, height } = img;
  const tmp = new Uint8Array(width * height);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const l = data[row + (x > 0 ? x - 1 : 0)];
      const c = data[row + x];
      const r = data[row + (x < width - 1 ? x + 1 : width - 1)];
      tmp[row + x] = (l + 2 * c + r) >> 2;
    }
  }
  for (let y = 0; y < height; y++) {
    const up = (y > 0 ? y - 1 : 0) * width;
    const cur = y * width;
    const dn = (y < height - 1 ? y + 1 : height - 1) * width;
    for (let x = 0; x < width; x++) {
      out[cur + x] = (tmp[up + x] + 2 * tmp[cur + x] + tmp[dn + x]) >> 2;
    }
  }
  return { data: out, width, height };
}

/**
 * Focus measure: variance of the Laplacian, normalised by local contrast so that
 * flat, evenly lit surfaces are not automatically reported as blurry.
 */
export function sharpness(img: GrayImage): number {
  const { data, width, height } = img;
  if (width < 5 || height < 5) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let mean = 0;
  let meanSq = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    const up = row - width;
    const dn = row + width;
    for (let x = 1; x < width - 1; x++) {
      const lap = 4 * data[row + x] - data[row + x - 1] - data[row + x + 1] - data[up + x] - data[dn + x];
      sum += lap;
      sumSq += lap * lap;
      mean += data[row + x];
      meanSq += data[row + x] * data[row + x];
      count++;
    }
  }
  const lapVar = sumSq / count - (sum / count) ** 2;
  const pixVar = meanSq / count - (mean / count) ** 2;
  // Normalising by texture energy keeps the measure comparable across surfaces.
  return lapVar / Math.max(24, Math.sqrt(pixVar) * 6);
}

/** Mean luminance over the whole image. */
export function meanLuma(img: GrayImage): number {
  let sum = 0;
  for (let i = 0; i < img.data.length; i++) sum += img.data[i];
  return sum / img.data.length;
}
