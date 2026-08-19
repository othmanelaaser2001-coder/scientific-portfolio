import type { Match } from './types';
import { DESCRIPTOR_WORDS } from './brief';

function popcount(v: number): number {
  v = v - ((v >> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  return (((v + (v >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

function hamming(a: Uint32Array, ai: number, b: Uint32Array, bi: number): number {
  let d = 0;
  for (let w = 0; w < DESCRIPTOR_WORDS; w++) d += popcount(a[ai + w] ^ b[bi + w]);
  return d;
}

export interface MatchOptions {
  /** Lowe ratio test threshold. */
  ratio?: number;
  /** Reject matches whose Hamming distance exceeds this. */
  maxDistance?: number;
  /** Require the match to be mutually best in both directions. */
  crossCheck?: boolean;
}

/**
 * Brute-force Hamming matching with Lowe's ratio test and optional cross-check.
 * `query` and `train` are packed descriptor arrays.
 */
export function matchDescriptors(
  query: Uint32Array,
  train: Uint32Array,
  options: MatchOptions = {},
): Match[] {
  const ratio = options.ratio ?? 0.82;
  const maxDistance = options.maxDistance ?? 72;
  const crossCheck = options.crossCheck ?? true;
  const nq = query.length / DESCRIPTOR_WORDS;
  const nt = train.length / DESCRIPTOR_WORDS;
  if (nq === 0 || nt === 0) return [];

  const bestForTrain = new Int32Array(nt).fill(-1);
  const bestForTrainDist = new Int32Array(nt).fill(0x7fffffff);
  const forward = new Int32Array(nq).fill(-1);
  const forwardDist = new Int32Array(nq).fill(0x7fffffff);

  for (let q = 0; q < nq; q++) {
    const qi = q * DESCRIPTOR_WORDS;
    let best = 0x7fffffff;
    let second = 0x7fffffff;
    let bestIdx = -1;
    for (let t = 0; t < nt; t++) {
      const d = hamming(query, qi, train, t * DESCRIPTOR_WORDS);
      if (d < best) {
        second = best;
        best = d;
        bestIdx = t;
      } else if (d < second) {
        second = d;
      }
      if (d < bestForTrainDist[t]) {
        bestForTrainDist[t] = d;
        bestForTrain[t] = q;
      }
    }
    if (bestIdx < 0 || best > maxDistance) continue;
    if (second < 0x7fffffff && best > ratio * second) continue;
    forward[q] = bestIdx;
    forwardDist[q] = best;
  }

  const matches: Match[] = [];
  for (let q = 0; q < nq; q++) {
    const t = forward[q];
    if (t < 0) continue;
    if (crossCheck && bestForTrain[t] !== q) continue;
    matches.push({ queryIdx: q, trainIdx: t, distance: forwardDist[q] });
  }
  return matches;
}
