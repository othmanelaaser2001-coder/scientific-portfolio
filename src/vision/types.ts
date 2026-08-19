/** Shared types for the vision pipeline. */

/** Single-channel 8-bit image. */
export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/** A detected keypoint in image coordinates. */
export interface Keypoint {
  x: number;
  y: number;
  /** Corner strength (Shi-Tomasi). */
  score: number;
  /** Dominant orientation in radians, from the intensity centroid. */
  angle: number;
}

/**
 * A 2x3 affine matrix in row-major order mapping a point (x, y) as:
 *   x' = a * x + b * y + tx
 *   y' = c * x + d * y + ty
 */
export interface Mat23 {
  a: number;
  b: number;
  tx: number;
  c: number;
  d: number;
  ty: number;
}

export interface Match {
  /** Index into the query keypoint array. */
  queryIdx: number;
  /** Index into the train keypoint array. */
  trainIdx: number;
  /** Hamming distance between the two descriptors. */
  distance: number;
}

/** Result of aligning a moving frame onto a reference frame. */
export interface Alignment {
  /** Maps moving-frame coordinates into the reference frame. */
  transform: Mat23;
  /** Correspondences that agreed with `transform`. */
  inliers: number;
  /** Total correspondences that survived the ratio test. */
  matches: number;
  /** Keypoints found in the moving frame. */
  keypointsA: number;
  /** Keypoints found in the reference frame. */
  keypointsB: number;
  /** 0..1 heuristic combining inlier count, inlier ratio and residual error. */
  confidence: number;
  /** Mean reprojection error of the inliers, in reference-frame pixels. */
  residual: number;
  /** Rotation encoded by `transform`, in radians. */
  rotation: number;
  /** Uniform scale encoded by `transform`. */
  scale: number;
  /** Shear magnitude; ~0 for a pure similarity transform. */
  shear: number;
}

export const IDENTITY: Mat23 = { a: 1, b: 0, tx: 0, c: 0, d: 1, ty: 0 };
