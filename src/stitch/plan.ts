import { matApply, matIdentity, matInvert, matMul, matRotationOf, matScaleOf, matShearOf } from '../vision/mat';
import type { Mat23 } from '../vision/types';
import { chooseOutputSize } from './canvasLimits';

export interface PairStats {
  index: number;
  inliers: number;
  matches: number;
  confidence: number;
  residual: number;
  overlap: number;
  rotation: number;
  scale: number;
  shear: number;
  /** Exposure gain applied to this frame relative to the sequence average. */
  gain: number;
  source: 'refined' | 'live' | 'assumed';
}

export interface PairTransform {
  index: number;
  /** Full-resolution transform mapping frame `index` into frame `index - 1`. */
  transform: Mat23;
  stats: Omit<PairStats, 'gain'>;
  /** Mean luma of the shared region, measured in each of the two frames. */
  luma: { moving: number; reference: number };
}

export interface FeatherSpec {
  axis: 'x' | 'y';
  /** -1 feathers the low edge (left/top), +1 the high edge (right/bottom). */
  side: -1 | 1;
  width: number;
}

export interface StitchPlan {
  /** Per-frame transform from source pixels into output-canvas pixels. */
  transforms: Mat23[];
  outputWidth: number;
  outputHeight: number;
  /** Resolution of the output relative to the source frames. */
  outputScale: number;
  gains: number[];
  feather: (FeatherSpec | null)[];
  pairStats: PairStats[];
  direction: 'horizontal' | 'vertical';
  /** Rotation applied to straighten the object, in radians. */
  straightenBy: number;
  scaleDriftRemoved: number;
  limitedByCanvas: boolean;
}

export interface PlanOptions {
  frameWidth: number;
  frameHeight: number;
  direction: 'horizontal' | 'vertical';
  /** Cancel systematic zoom drift so the object keeps constant proportions. */
  normaliseScaleDrift?: boolean;
  /** Rotate the mosaic so the object runs along an axis. */
  straighten?: boolean;
  /** Upper bound on output pixels, on top of the browser's own canvas limits. */
  maxOutputPixels?: number;
}

/** Principal direction of a set of points, as an angle in radians. */
function principalAngle(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

function exposureGains(pairs: PairTransform[], frameCount: number): number[] {
  const gains = new Array<number>(frameCount).fill(1);
  for (let i = 1; i < frameCount; i++) {
    const pair = pairs.find((p) => p.index === i);
    const moving = pair?.luma.moving ?? 0;
    const reference = pair?.luma.reference ?? 0;
    const relative = moving > 4 && reference > 4 ? reference / moving : 1;
    // Clamp each step so a single bad measurement cannot run away.
    gains[i] = gains[i - 1] * Math.min(1.12, Math.max(0.89, relative));
  }
  // Remove the average so the mosaic keeps the overall brightness it was shot at.
  let logSum = 0;
  for (const gain of gains) logSum += Math.log(gain);
  const mean = Math.exp(logSum / gains.length);
  return gains.map((gain) => Math.min(1.45, Math.max(0.7, gain / mean)));
}

function featherFor(transform: Mat23, width: number, height: number): FeatherSpec {
  const inverse = matInvert(transform);
  const centre = { x: width / 2, y: height / 2 };
  const previous = matApply(inverse, centre.x, centre.y);
  const vx = previous.x - centre.x;
  const vy = previous.y - centre.y;
  if (Math.abs(vx) >= Math.abs(vy)) {
    const overlapWidth = Math.max(0, width - Math.abs(vx));
    return {
      axis: 'x',
      side: vx < 0 ? -1 : 1,
      width: Math.min(width * 0.4, Math.max(16, overlapWidth * 0.5)),
    };
  }
  const overlapHeight = Math.max(0, height - Math.abs(vy));
  return {
    axis: 'y',
    side: vy < 0 ? -1 : 1,
    width: Math.min(height * 0.4, Math.max(16, overlapHeight * 0.5)),
  };
}

/**
 * Turns pairwise transforms into a complete rendering plan: global placement,
 * straightening, exposure gains, blend ramps and a safe output size.
 *
 * Scale is only ever adjusted globally, never per frame and never per axis, so
 * the mosaic cannot stretch the object to make frames agree.
 */
export function buildPlan(pairs: PairTransform[], frameCount: number, options: PlanOptions): StitchPlan {
  const { frameWidth, frameHeight } = options;
  const byIndex = new Map(pairs.map((pair) => [pair.index, pair]));

  // 1. Cancel systematic scale drift across the whole chain.
  let driftCorrection = 1;
  if (options.normaliseScaleDrift !== false && pairs.length >= 3) {
    let logSum = 0;
    for (const pair of pairs) logSum += Math.log(Math.max(0.5, matScaleOf(pair.transform)));
    driftCorrection = Math.exp(logSum / pairs.length);
    // Only correct a genuine trend; leave real distance changes alone.
    driftCorrection = Math.min(1.01, Math.max(0.99, driftCorrection));
  }

  // 2. Chain into global transforms.
  const globals: Mat23[] = [matIdentity()];
  for (let i = 1; i < frameCount; i++) {
    const pair = byIndex.get(i);
    let step = pair ? pair.transform : { a: 1, b: 0, tx: frameWidth * 0.38, c: 0, d: 1, ty: 0 };
    if (driftCorrection !== 1) {
      const k = 1 / driftCorrection;
      step = { a: step.a * k, b: step.b * k, tx: step.tx, c: step.c * k, d: step.d * k, ty: step.ty };
    }
    globals.push(matMul(globals[i - 1], step));
  }

  // 3. Straighten: rotate so the path of frame centres runs along one axis.
  const centres = globals.map((m) => matApply(m, frameWidth / 2, frameHeight / 2));
  let straightenBy = 0;
  if (options.straighten !== false && frameCount >= 3) {
    const angle = principalAngle(centres);
    straightenBy = options.direction === 'horizontal' ? -angle : -(angle - Math.PI / 2);
    // Never rotate more than a moderate tilt; a large angle means the path was
    // not straight and rotating would only make the result confusing.
    while (straightenBy > Math.PI / 2) straightenBy -= Math.PI;
    while (straightenBy < -Math.PI / 2) straightenBy += Math.PI;
    if (Math.abs(straightenBy) > (35 * Math.PI) / 180) straightenBy = 0;
  }
  const cos = Math.cos(straightenBy);
  const sin = Math.sin(straightenBy);
  const rotation: Mat23 = { a: cos, b: -sin, tx: 0, c: sin, d: cos, ty: 0 };
  const rotated = globals.map((m) => matMul(rotation, m));

  // 4. Union bounding box of every warped frame.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of rotated) {
    for (const [x, y] of [
      [0, 0],
      [frameWidth, 0],
      [frameWidth, frameHeight],
      [0, frameHeight],
    ]) {
      const p = matApply(m, x, y);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  // 5. Fit inside what this browser can actually allocate, at full resolution
  //    whenever that fits.
  const output = chooseOutputSize(spanX, spanY, options.maxOutputPixels);
  const outputScale = output.scale;
  const limitedByCanvas = outputScale < 1;

  const place: Mat23 = {
    a: outputScale,
    b: 0,
    tx: -minX * outputScale,
    c: 0,
    d: outputScale,
    ty: -minY * outputScale,
  };
  const transforms = rotated.map((m) => matMul(place, m));

  // 6. Exposure and blending.
  const gains = exposureGains(pairs, frameCount);
  const feather: (FeatherSpec | null)[] = [];
  const pairStats: PairStats[] = [];
  for (let i = 0; i < frameCount; i++) {
    const pair = byIndex.get(i);
    feather.push(i === 0 || !pair ? null : featherFor(pair.transform, frameWidth, frameHeight));
    if (pair) {
      pairStats.push({
        ...pair.stats,
        rotation: matRotationOf(pair.transform),
        scale: matScaleOf(pair.transform),
        shear: matShearOf(pair.transform),
        gain: gains[i],
      });
    }
  }

  return {
    transforms,
    outputWidth: output.width,
    outputHeight: output.height,
    outputScale,
    gains,
    feather,
    pairStats,
    direction: options.direction,
    straightenBy,
    scaleDriftRemoved: driftCorrection,
    limitedByCanvas,
  };
}
