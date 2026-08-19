import type { GrayImage, Keypoint } from './types';

/** Offsets of the 16 pixels on the Bresenham circle of radius 3. */
const CIRCLE: Array<[number, number]> = [
  [0, -3], [1, -3], [2, -2], [3, -1], [3, 0], [3, 1], [2, 2], [1, 3],
  [0, 3], [-1, 3], [-2, 2], [-3, 1], [-3, 0], [-3, -1], [-2, -2], [-1, -3],
];

const PATCH_RADIUS = 15;

function circleOffsets(width: number): Int32Array {
  const offsets = new Int32Array(16);
  for (let i = 0; i < 16; i++) offsets[i] = CIRCLE[i][1] * width + CIRCLE[i][0];
  return offsets;
}

/** Shi-Tomasi corner response over a 5x5 window; used to rank FAST candidates. */
function shiTomasi(img: GrayImage, x: number, y: number): number {
  const { data, width } = img;
  let ixx = 0;
  let iyy = 0;
  let ixy = 0;
  for (let dy = -2; dy <= 2; dy++) {
    const row = (y + dy) * width + x;
    for (let dx = -2; dx <= 2; dx++) {
      const i = row + dx;
      const gx = (data[i + 1] - data[i - 1]) * 0.5;
      const gy = (data[i + width] - data[i - width]) * 0.5;
      ixx += gx * gx;
      iyy += gy * gy;
      ixy += gx * gy;
    }
  }
  const trace = ixx + iyy;
  const det = ixx * iyy - ixy * ixy;
  return 0.5 * (trace - Math.sqrt(Math.max(0, trace * trace - 4 * det)));
}

/** Intensity-centroid orientation, as used by ORB. */
function orientation(img: GrayImage, x: number, y: number): number {
  const { data, width, height } = img;
  let m01 = 0;
  let m10 = 0;
  const r = PATCH_RADIUS;
  const y0 = Math.max(1, y - r);
  const y1 = Math.min(height - 2, y + r);
  const x0 = Math.max(1, x - r);
  const x1 = Math.min(width - 2, x + r);
  for (let py = y0; py <= y1; py++) {
    const row = py * width;
    const dy = py - y;
    for (let px = x0; px <= x1; px++) {
      const v = data[row + px];
      m10 += (px - x) * v;
      m01 += dy * v;
    }
  }
  return Math.atan2(m01, m10);
}

export interface DetectOptions {
  /** FAST intensity threshold. */
  threshold?: number;
  /** Maximum number of keypoints returned. */
  maxKeypoints?: number;
  /** Cell size, in pixels, for spatial bucketing of keypoints. */
  cellSize?: number;
}

/**
 * FAST-9 corner detection with adaptive thresholding, Shi-Tomasi ranking and
 * grid-based distribution so that features cover the whole frame instead of
 * clustering in one textured corner.
 */
export function detectKeypoints(img: GrayImage, options: DetectOptions = {}): Keypoint[] {
  const maxKeypoints = options.maxKeypoints ?? 400;
  const cellSize = options.cellSize ?? 32;
  const border = PATCH_RADIUS + 4;
  const { data, width, height } = img;
  if (width < border * 2 + 2 || height < border * 2 + 2) return [];

  const offsets = circleOffsets(width);
  const cols = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const perCell = Math.max(2, Math.ceil((maxKeypoints * 1.6) / (cols * rows)));

  let threshold = options.threshold ?? 18;
  let candidates: Keypoint[] = [];

  // Two attempts: if a low-contrast frame yields too few corners, relax once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const buckets: Keypoint[][] = Array.from({ length: cols * rows }, () => []);
    let found = 0;
    for (let y = border; y < height - border; y++) {
      const row = y * width;
      for (let x = border; x < width - border; x++) {
        const i = row + x;
        const p = data[i];
        const hi = p + threshold;
        const lo = p - threshold;
        // Fast reject using the four compass points: at least three must agree.
        let brighter = 0;
        let darker = 0;
        for (let k = 0; k < 16; k += 4) {
          const v = data[i + offsets[k]];
          if (v > hi) brighter++;
          else if (v < lo) darker++;
        }
        if (brighter < 3 && darker < 3) continue;

        // Full contiguity test over the 16-pixel circle (arc length >= 9).
        let runBright = 0;
        let runDark = 0;
        let bestBright = 0;
        let bestDark = 0;
        for (let k = 0; k < 25; k++) {
          const v = data[i + offsets[k % 16]];
          if (v > hi) {
            runBright++;
            runDark = 0;
            if (runBright > bestBright) bestBright = runBright;
          } else if (v < lo) {
            runDark++;
            runBright = 0;
            if (runDark > bestDark) bestDark = runDark;
          } else {
            runBright = 0;
            runDark = 0;
          }
        }
        if (bestBright < 9 && bestDark < 9) continue;

        const score = shiTomasi(img, x, y);
        if (score < 1) continue;
        const cell = Math.min(rows - 1, (y / cellSize) | 0) * cols + Math.min(cols - 1, (x / cellSize) | 0);
        const bucket = buckets[cell];
        if (bucket.length < perCell) {
          bucket.push({ x, y, score, angle: 0 });
          found++;
        } else {
          let worst = 0;
          for (let b = 1; b < bucket.length; b++) if (bucket[b].score < bucket[worst].score) worst = b;
          if (bucket[worst].score < score) bucket[worst] = { x, y, score, angle: 0 };
        }
      }
    }
    candidates = buckets.flat();
    if (found >= maxKeypoints * 0.4 || attempt === 1) break;
    threshold = Math.max(6, Math.round(threshold * 0.55));
  }

  // Local non-maximum suppression over a 3-pixel radius.
  candidates.sort((p, q) => q.score - p.score);
  const kept: Keypoint[] = [];
  const claimed = new Set<number>();
  const stride = Math.ceil(width / 4);
  for (const kp of candidates) {
    const key = ((kp.y >> 2) * stride + (kp.x >> 2)) | 0;
    if (claimed.has(key)) continue;
    claimed.add(key);
    kp.angle = orientation(img, kp.x, kp.y);
    kept.push(kp);
    if (kept.length >= maxKeypoints) break;
  }
  return kept;
}
