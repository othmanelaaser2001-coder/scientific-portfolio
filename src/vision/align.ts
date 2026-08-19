import { describeKeypoints } from './brief';
import { blur3, downsample, meanLuma, sharpness } from './gray';
import { detectKeypoints } from './fast';
import { matRotationOf, matScaleOf, matShearOf } from './mat';
import { matchDescriptors } from './match';
import { ransacTransform } from './ransac';
import type { PointPair } from './estimate';
import type { Alignment, GrayImage, Keypoint } from './types';

/** Everything needed to align a frame against another, computed once per frame. */
export interface FrameFeatures {
  width: number;
  height: number;
  keypoints: Keypoint[];
  descriptors: Uint32Array;
  sharpness: number;
  luma: number;
  /** Heavily downsampled copy used by the correlation fallback. */
  thumb: GrayImage;
}

export function extractFeatures(gray: GrayImage, maxKeypoints = 400): FrameFeatures {
  const smooth = blur3(gray);
  const keypoints = detectKeypoints(smooth, { maxKeypoints });
  return {
    width: gray.width,
    height: gray.height,
    keypoints,
    descriptors: describeKeypoints(smooth, keypoints),
    sharpness: sharpness(gray),
    luma: meanLuma(gray),
    thumb: downsample(smooth, Math.max(1, Math.round(gray.width / 72))),
  };
}

/**
 * Sum-of-absolute-differences translation search on thumbnails. Used only when
 * feature matching fails, which happens on very uniform materials such as plain
 * leather. Returns a translation in full working-resolution pixels.
 */
function correlateTranslation(
  moving: FrameFeatures,
  reference: FrameFeatures,
): { dx: number; dy: number; score: number } | null {
  const a = moving.thumb;
  const b = reference.thumb;
  if (a.width !== b.width || a.height !== b.height || a.width < 16) return null;
  const maxDx = Math.floor(a.width * 0.7);
  const maxDy = Math.floor(a.height * 0.35);
  let bestScore = Infinity;
  let bestDx = 0;
  let bestDy = 0;
  let secondBest = Infinity;

  // Coarse pass over the whole search window on a sparse pixel grid, then a
  // fine pass around the winner. Keeps this within the live frame budget.
  const evaluate = (dx: number, dy: number, sample: number): number => {
    const x0 = Math.max(0, -dx);
    const x1 = Math.min(a.width, a.width - dx);
    const y0 = Math.max(0, -dy);
    const y1 = Math.min(a.height, a.height - dy);
    if ((x1 - x0) * (y1 - y0) < a.width * a.height * 0.25) return Infinity;
    let sum = 0;
    let count = 0;
    for (let y = y0; y < y1; y += sample) {
      const ra = y * a.width;
      const rb = (y + dy) * b.width + dx;
      for (let x = x0; x < x1; x += sample) {
        const d = a.data[ra + x] - b.data[rb + x];
        sum += d < 0 ? -d : d;
        count++;
      }
    }
    return count ? sum / count : Infinity;
  };

  for (let dy = -maxDy; dy <= maxDy; dy += 2) {
    for (let dx = -maxDx; dx <= maxDx; dx += 2) {
      const score = evaluate(dx, dy, 2);
      if (score < bestScore) {
        secondBest = bestScore;
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      } else if (score < secondBest) {
        secondBest = score;
      }
    }
  }
  for (let dy = bestDy - 2; dy <= bestDy + 2; dy++) {
    for (let dx = bestDx - 2; dx <= bestDx + 2; dx++) {
      const score = evaluate(dx, dy, 1);
      if (score < bestScore) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  if (!Number.isFinite(bestScore)) return null;
  const factor = moving.width / a.width;
  // Distinctiveness of the minimum tells us how much to trust this estimate.
  const distinctiveness = secondBest === Infinity ? 0 : Math.min(1, (secondBest - bestScore) / Math.max(1, bestScore));
  return { dx: bestDx * factor, dy: bestDy * factor, score: distinctiveness };
}

export interface AlignOptions {
  threshold?: number;
  allowAffine?: boolean;
  /** Enable the SAD fallback when feature matching does not converge. */
  allowFallback?: boolean;
}

/**
 * Aligns `moving` onto `reference`. The returned transform maps moving-frame
 * coordinates into the reference frame.
 */
export function alignFrames(
  moving: FrameFeatures,
  reference: FrameFeatures,
  options: AlignOptions = {},
): Alignment | null {
  const matches = matchDescriptors(moving.descriptors, reference.descriptors);
  const pairs: PointPair[] = matches.map((m) => ({
    px: moving.keypoints[m.queryIdx].x,
    py: moving.keypoints[m.queryIdx].y,
    qx: reference.keypoints[m.trainIdx].x,
    qy: reference.keypoints[m.trainIdx].y,
  }));

  const result =
    pairs.length >= 6
      ? ransacTransform(pairs, {
          threshold: options.threshold ?? 2.5,
          allowAffine: options.allowAffine,
        })
      : null;

  if (result && result.inliers.length >= 6) {
    const inlierRatio = result.inliers.length / Math.max(1, pairs.length);
    const countScore = Math.min(1, result.inliers.length / 40);
    const errorScore = Math.max(0, 1 - result.residual / 4);
    const confidence = Math.max(0, Math.min(1, 0.45 * countScore + 0.35 * inlierRatio + 0.2 * errorScore));
    return {
      transform: result.transform,
      inliers: result.inliers.length,
      matches: pairs.length,
      keypointsA: moving.keypoints.length,
      keypointsB: reference.keypoints.length,
      confidence,
      residual: result.residual,
      rotation: matRotationOf(result.transform),
      scale: matScaleOf(result.transform),
      shear: matShearOf(result.transform),
    };
  }

  if (options.allowFallback === false) return null;
  const fallback = correlateTranslation(moving, reference);
  if (!fallback || fallback.score < 0.08) return null;
  return {
    transform: { a: 1, b: 0, tx: fallback.dx, c: 0, d: 1, ty: fallback.dy },
    inliers: 0,
    matches: pairs.length,
    keypointsA: moving.keypoints.length,
    keypointsB: reference.keypoints.length,
    // Deliberately capped: a correlation-only match is never treated as solid.
    confidence: Math.min(0.32, fallback.score),
    residual: Number.NaN,
    rotation: 0,
    scale: 1,
    shear: 0,
  };
}
