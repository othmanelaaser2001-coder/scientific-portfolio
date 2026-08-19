import type { Mat23 } from './types';
import { matShearOf } from './mat';
import {
  affineFromPairs,
  residualOf,
  similarityFromPair,
  similarityFromPairs,
  type PointPair,
} from './estimate';

export interface RansacOptions {
  /** Inlier distance threshold in pixels. */
  threshold?: number;
  /** Maximum RANSAC iterations. */
  maxIterations?: number;
  /**
   * Allow a full affine refinement when it clearly fits better and stays close
   * to a similarity. Keeps small perspective/tilt changes without stretching.
   */
  allowAffine?: boolean;
  /** Maximum tolerated shear/anisotropy for the affine refinement. */
  maxShear?: number;
  /** Scale must stay inside [1 - scaleTolerance, 1 + scaleTolerance]. */
  scaleTolerance?: number;
  /** Deterministic seed for reproducible results. */
  seed?: number;
}

export interface RansacResult {
  transform: Mat23;
  inliers: Int32Array;
  residual: number;
  model: 'similarity' | 'affine';
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 0xffffff) / 0xffffff;
  };
}

function collectInliers(m: Mat23, pairs: PointPair[], threshold: number): Int32Array {
  const t2 = threshold * threshold;
  const out: number[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const { px, py, qx, qy } = pairs[i];
    const dx = m.a * px + m.b * py + m.tx - qx;
    const dy = m.c * px + m.d * py + m.ty - qy;
    if (dx * dx + dy * dy <= t2) out.push(i);
  }
  return Int32Array.from(out);
}

/**
 * Robustly estimates the transform between two frames.
 *
 * The default model is a similarity transform: rotation, uniform scale and
 * translation only. That is deliberate — a similarity cannot stretch the object
 * to force frames to agree, so the physical proportions survive stitching.
 */
export function ransacTransform(pairs: PointPair[], options: RansacOptions = {}): RansacResult | null {
  const threshold = options.threshold ?? 2.5;
  const maxIterations = options.maxIterations ?? 500;
  const scaleTolerance = options.scaleTolerance ?? 0.12;
  const maxShear = options.maxShear ?? 0.045;
  if (pairs.length < 3) return null;

  const random = rng(options.seed ?? 0x1234567);
  let best: Mat23 | null = null;
  let bestInliers: Int32Array = new Int32Array(0);
  let iterations = maxIterations;

  for (let iter = 0; iter < iterations; iter++) {
    const i = (random() * pairs.length) | 0;
    let j = (random() * pairs.length) | 0;
    if (i === j) j = (j + 1) % pairs.length;
    const candidate = similarityFromPair(pairs[i], pairs[j]);
    if (!candidate) continue;
    const scale = Math.hypot(candidate.a, candidate.c);
    if (Math.abs(scale - 1) > scaleTolerance) continue;
    const inliers = collectInliers(candidate, pairs, threshold);
    if (inliers.length > bestInliers.length) {
      best = candidate;
      bestInliers = inliers;
      // Adaptive stopping: enough iterations for 99% confidence.
      const ratio = inliers.length / pairs.length;
      if (ratio > 0.2) {
        const needed = Math.log(0.01) / Math.log(1 - Math.min(0.999, ratio * ratio));
        iterations = Math.min(maxIterations, Math.max(24, Math.ceil(needed)));
      }
    }
  }

  if (!best || bestInliers.length < 3) return null;

  // Iterative reweighting: refit on inliers, then recollect.
  for (let round = 0; round < 3; round++) {
    const refined = similarityFromPairs(pairs, bestInliers);
    if (!refined) break;
    const inliers = collectInliers(refined, pairs, threshold);
    if (inliers.length < 3) break;
    best = refined;
    bestInliers = inliers;
  }

  let model: RansacResult['model'] = 'similarity';
  let residual = residualOf(best, pairs, bestInliers);

  if (options.allowAffine !== false && bestInliers.length >= 12) {
    const affine = affineFromPairs(pairs, bestInliers);
    if (affine) {
      const shear = matShearOf(affine);
      const scale = Math.sqrt(Math.abs(affine.a * affine.d - affine.b * affine.c));
      const affineResidual = residualOf(affine, pairs, bestInliers);
      const affineInliers = collectInliers(affine, pairs, threshold);
      // Only accept the extra freedom if it is small and genuinely fits better.
      if (
        shear <= maxShear &&
        Math.abs(scale - 1) <= scaleTolerance &&
        affineResidual < residual * 0.9 &&
        affineInliers.length >= bestInliers.length
      ) {
        best = affine;
        bestInliers = affineInliers;
        residual = affineResidual;
        model = 'affine';
      }
    }
  }

  return { transform: best, inliers: bestInliers, residual, model };
}
