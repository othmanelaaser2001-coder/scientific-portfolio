import type { GrayImage, Keypoint } from './types';

export const DESCRIPTOR_BITS = 256;
export const DESCRIPTOR_WORDS = DESCRIPTOR_BITS / 32;
const PATCH_RADIUS = 15;

/** Deterministic PRNG so the sampling pattern is identical in every context. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * BRIEF sampling pattern: 256 point pairs drawn from an isotropic Gaussian
 * inside the 31x31 patch, generated once with a fixed seed.
 */
function buildPattern(): Int8Array {
  const rand = mulberry32(0x5eed1234);
  const pattern = new Int8Array(DESCRIPTOR_BITS * 4);
  const sigma = PATCH_RADIUS / 2.6;
  const gauss = () => {
    const u = Math.max(1e-9, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
  };
  const clamp = (v: number) => Math.max(-PATCH_RADIUS, Math.min(PATCH_RADIUS, Math.round(v)));
  for (let i = 0; i < DESCRIPTOR_BITS; i++) {
    pattern[i * 4 + 0] = clamp(gauss());
    pattern[i * 4 + 1] = clamp(gauss());
    pattern[i * 4 + 2] = clamp(gauss());
    pattern[i * 4 + 3] = clamp(gauss());
  }
  return pattern;
}

const PATTERN = buildPattern();

/** Pre-rotated copies of the pattern, quantised to 30 angle steps (12 degrees). */
const ANGLE_STEPS = 30;
const ROTATED: Int8Array[] = (() => {
  const table: Int8Array[] = [];
  for (let step = 0; step < ANGLE_STEPS; step++) {
    const theta = (step / ANGLE_STEPS) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rotated = new Int8Array(PATTERN.length);
    for (let i = 0; i < DESCRIPTOR_BITS; i++) {
      const ax = PATTERN[i * 4 + 0];
      const ay = PATTERN[i * 4 + 1];
      const bx = PATTERN[i * 4 + 2];
      const by = PATTERN[i * 4 + 3];
      rotated[i * 4 + 0] = Math.round(cos * ax - sin * ay);
      rotated[i * 4 + 1] = Math.round(sin * ax + cos * ay);
      rotated[i * 4 + 2] = Math.round(cos * bx - sin * by);
      rotated[i * 4 + 3] = Math.round(sin * bx + cos * by);
    }
    table.push(rotated);
  }
  return table;
})();

/**
 * Computes rotation-aware BRIEF descriptors (the "rBRIEF" half of ORB).
 * Returns one Uint32Array of DESCRIPTOR_WORDS per keypoint, packed contiguously.
 */
export function describeKeypoints(img: GrayImage, keypoints: Keypoint[]): Uint32Array {
  const { data, width, height } = img;
  const out = new Uint32Array(keypoints.length * DESCRIPTOR_WORDS);
  const maxX = width - 1;
  const maxY = height - 1;
  for (let k = 0; k < keypoints.length; k++) {
    const kp = keypoints[k];
    let step = Math.round((kp.angle / (Math.PI * 2)) * ANGLE_STEPS) % ANGLE_STEPS;
    if (step < 0) step += ANGLE_STEPS;
    const pattern = ROTATED[step];
    const base = k * DESCRIPTOR_WORDS;
    for (let bit = 0; bit < DESCRIPTOR_BITS; bit++) {
      const ax = Math.min(maxX, Math.max(0, kp.x + pattern[bit * 4 + 0]));
      const ay = Math.min(maxY, Math.max(0, kp.y + pattern[bit * 4 + 1]));
      const bx = Math.min(maxX, Math.max(0, kp.x + pattern[bit * 4 + 2]));
      const by = Math.min(maxY, Math.max(0, kp.y + pattern[bit * 4 + 3]));
      if (data[ay * width + ax] < data[by * width + bx]) {
        out[base + (bit >> 5)] |= 1 << (bit & 31);
      }
    }
  }
  return out;
}
