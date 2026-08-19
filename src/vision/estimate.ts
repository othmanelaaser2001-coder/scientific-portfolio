import type { Mat23 } from './types';

export interface PointPair {
  /** Point in the moving image. */
  px: number;
  py: number;
  /** Corresponding point in the reference image. */
  qx: number;
  qy: number;
}

/**
 * Closed-form similarity (rotation + uniform scale + translation) from two
 * correspondences. Returns null when the two source points are too close for a
 * stable estimate.
 */
export function similarityFromPair(m1: PointPair, m2: PointPair): Mat23 | null {
  const dpx = m2.px - m1.px;
  const dpy = m2.py - m1.py;
  const denom = dpx * dpx + dpy * dpy;
  if (denom < 36) return null;
  const dqx = m2.qx - m1.qx;
  const dqy = m2.qy - m1.qy;
  // Complex division (dq / dp) gives the rotation-and-scale factor directly.
  const a = (dqx * dpx + dqy * dpy) / denom;
  const c = (dqy * dpx - dqx * dpy) / denom;
  return {
    a,
    b: -c,
    tx: m1.qx - (a * m1.px - c * m1.py),
    c,
    d: a,
    ty: m1.qy - (c * m1.px + a * m1.py),
  };
}

/** Least-squares similarity fit (Umeyama) over an arbitrary number of pairs. */
export function similarityFromPairs(pairs: PointPair[], indices?: Int32Array | number[]): Mat23 | null {
  const list = indices ?? pairs.map((_, i) => i);
  const n = list.length;
  if (n < 2) return null;
  let pxm = 0;
  let pym = 0;
  let qxm = 0;
  let qym = 0;
  for (const i of list) {
    pxm += pairs[i].px;
    pym += pairs[i].py;
    qxm += pairs[i].qx;
    qym += pairs[i].qy;
  }
  pxm /= n;
  pym /= n;
  qxm /= n;
  qym /= n;
  let num_r = 0;
  let num_i = 0;
  let den = 0;
  for (const i of list) {
    const px = pairs[i].px - pxm;
    const py = pairs[i].py - pym;
    const qx = pairs[i].qx - qxm;
    const qy = pairs[i].qy - qym;
    num_r += qx * px + qy * py;
    num_i += qy * px - qx * py;
    den += px * px + py * py;
  }
  if (den < 1e-6) return null;
  const a = num_r / den;
  const c = num_i / den;
  return {
    a,
    b: -c,
    tx: qxm - (a * pxm - c * pym),
    c,
    d: a,
    ty: qym - (c * pxm + a * pym),
  };
}

/** Least-squares full affine fit (6 parameters) over the given pairs. */
export function affineFromPairs(pairs: PointPair[], indices?: Int32Array | number[]): Mat23 | null {
  const list = indices ?? pairs.map((_, i) => i);
  if (list.length < 3) return null;
  // Normal equations for [x y 1] * params = target, shared by both output axes.
  let sxx = 0;
  let sxy = 0;
  let sx = 0;
  let syy = 0;
  let sy = 0;
  let s1 = 0;
  let bx0 = 0;
  let bx1 = 0;
  let bx2 = 0;
  let by0 = 0;
  let by1 = 0;
  let by2 = 0;
  for (const i of list) {
    const { px, py, qx, qy } = pairs[i];
    sxx += px * px;
    sxy += px * py;
    sx += px;
    syy += py * py;
    sy += py;
    s1 += 1;
    bx0 += px * qx;
    bx1 += py * qx;
    bx2 += qx;
    by0 += px * qy;
    by1 += py * qy;
    by2 += qy;
  }
  const m = [sxx, sxy, sx, sxy, syy, sy, sx, sy, s1];
  const det =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (Math.abs(det) < 1e-8) return null;
  const inv = [
    (m[4] * m[8] - m[5] * m[7]) / det,
    (m[2] * m[7] - m[1] * m[8]) / det,
    (m[1] * m[5] - m[2] * m[4]) / det,
    (m[5] * m[6] - m[3] * m[8]) / det,
    (m[0] * m[8] - m[2] * m[6]) / det,
    (m[2] * m[3] - m[0] * m[5]) / det,
    (m[3] * m[7] - m[4] * m[6]) / det,
    (m[1] * m[6] - m[0] * m[7]) / det,
    (m[0] * m[4] - m[1] * m[3]) / det,
  ];
  return {
    a: inv[0] * bx0 + inv[1] * bx1 + inv[2] * bx2,
    b: inv[3] * bx0 + inv[4] * bx1 + inv[5] * bx2,
    tx: inv[6] * bx0 + inv[7] * bx1 + inv[8] * bx2,
    c: inv[0] * by0 + inv[1] * by1 + inv[2] * by2,
    d: inv[3] * by0 + inv[4] * by1 + inv[5] * by2,
    ty: inv[6] * by0 + inv[7] * by1 + inv[8] * by2,
  };
}

export function residualOf(m: Mat23, pairs: PointPair[], indices: Int32Array | number[]): number {
  let sum = 0;
  let n = 0;
  for (const i of indices) {
    const { px, py, qx, qy } = pairs[i];
    const dx = m.a * px + m.b * py + m.tx - qx;
    const dy = m.c * px + m.d * py + m.ty - qy;
    sum += Math.hypot(dx, dy);
    n++;
  }
  return n ? sum / n : Infinity;
}
