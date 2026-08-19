import type { Mat23 } from './types';
import { IDENTITY } from './types';

export function matIdentity(): Mat23 {
  return { ...IDENTITY };
}

/** Returns the matrix equivalent to applying `second` after `first`. */
export function matMul(second: Mat23, first: Mat23): Mat23 {
  return {
    a: second.a * first.a + second.b * first.c,
    b: second.a * first.b + second.b * first.d,
    tx: second.a * first.tx + second.b * first.ty + second.tx,
    c: second.c * first.a + second.d * first.c,
    d: second.c * first.b + second.d * first.d,
    ty: second.c * first.tx + second.d * first.ty + second.ty,
  };
}

export function matInvert(m: Mat23): Mat23 {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return matIdentity();
  const ia = m.d / det;
  const ib = -m.b / det;
  const ic = -m.c / det;
  const id = m.a / det;
  return {
    a: ia,
    b: ib,
    tx: -(ia * m.tx + ib * m.ty),
    c: ic,
    d: id,
    ty: -(ic * m.tx + id * m.ty),
  };
}

export function matApply(m: Mat23, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.b * y + m.tx, y: m.c * x + m.d * y + m.ty };
}

/**
 * Rescales a transform that was estimated between two images at `fromScale`
 * so that it applies to the same images at `toScale`.
 */
export function matRescale(m: Mat23, factor: number): Mat23 {
  return { ...m, tx: m.tx * factor, ty: m.ty * factor };
}

export function matRotationOf(m: Mat23): number {
  return Math.atan2(m.c, m.a);
}

export function matScaleOf(m: Mat23): number {
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}

/**
 * Deviation from a pure similarity transform: 0 for rotation + uniform scale,
 * growing as the matrix introduces shear or non-uniform scaling.
 */
export function matShearOf(m: Mat23): number {
  const col1 = Math.hypot(m.a, m.c);
  const col2 = Math.hypot(m.b, m.d);
  if (col1 < 1e-9 || col2 < 1e-9) return 1;
  const orthogonality = Math.abs((m.a * m.b + m.c * m.d) / (col1 * col2));
  const anisotropy = Math.abs(col1 - col2) / Math.max(col1, col2);
  return orthogonality + anisotropy;
}
