/**
 * Synthetic validation of the alignment core: build a textured "material"
 * image, cut two overlapping windows with a known similarity transform between
 * them, and check that the estimator recovers it.
 */
import { extractFeatures, alignFrames } from '../src/vision/align';
import { overlapRatio } from '../src/vision/overlap';
import type { GrayImage } from '../src/vision/types';

function makeTexture(w: number, h: number): GrayImage {
  const data = new Uint8Array(w * h);
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Smooth base + speckle + a few strong blobs, similar to grained leather.
      let v = 128 + 40 * Math.sin(x / 23) * Math.cos(y / 17) + 25 * Math.sin((x + y) / 9);
      v += (rand() - 0.5) * 30;
      data[y * w + x] = Math.max(0, Math.min(255, v));
    }
  }
  for (let i = 0; i < 400; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r = 3 + rand() * 6;
    const tone = rand() > 0.5 ? 235 : 20;
    for (let y = Math.max(0, cy - r) | 0; y < Math.min(h, cy + r); y++) {
      for (let x = Math.max(0, cx - r) | 0; x < Math.min(w, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) data[y * w + x] = tone;
      }
    }
  }
  return { data, width: w, height: h };
}

/** Samples a window from `src` under a similarity transform (bilinear). */
function sampleWindow(
  src: GrayImage,
  w: number,
  h: number,
  originX: number,
  originY: number,
  theta: number,
  scale: number,
): GrayImage {
  const out = new Uint8Array(w * h);
  const cos = Math.cos(theta) * scale;
  const sin = Math.sin(theta) * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x - w / 2;
      const cy = y - h / 2;
      const sx = originX + cos * cx - sin * cy;
      const sy = originY + sin * cx + cos * cy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= src.width || y0 + 1 >= src.height) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      const i = y0 * src.width + x0;
      out[y * w + x] =
        src.data[i] * (1 - fx) * (1 - fy) +
        src.data[i + 1] * fx * (1 - fy) +
        src.data[i + src.width] * (1 - fx) * fy +
        src.data[i + src.width + 1] * fx * fy;
    }
  }
  return { data: out, width: w, height: h };
}

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const texture = makeTexture(1400, 500);
const FW = 320;
const FH = 240;

// Case 1: pure horizontal translation, the dominant left-to-right scan case.
{
  const shift = 120;
  const a = sampleWindow(texture, FW, FH, 400, 250, 0, 1);
  const b = sampleWindow(texture, FW, FH, 400 + shift, 250, 0, 1);
  const t0 = performance.now();
  const fa = extractFeatures(a);
  const fb = extractFeatures(b);
  const align = alignFrames(fb, fa); // maps frame b into frame a
  const ms = performance.now() - t0;
  const dx = align ? align.transform.tx : NaN;
  check(
    'horizontal translation',
    !!align && Math.abs(dx - shift) < 2 && align.inliers > 20,
    `expected dx=${shift}, got ${dx?.toFixed(2)} (inliers ${align?.inliers}, conf ${align?.confidence.toFixed(2)}, ${ms.toFixed(0)}ms for 3 stages)`,
  );
  const ov = align ? overlapRatio(align.transform, FW, FH) : 0;
  check('overlap estimate', Math.abs(ov - (FW - shift) / FW) < 0.05, `overlap=${ov.toFixed(3)}`);
}

// Case 2: translation with a small rotation and scale change (hand shake).
{
  const a = sampleWindow(texture, FW, FH, 500, 250, 0, 1);
  const b = sampleWindow(texture, FW, FH, 500 + 100, 250 + 8, 0.06, 1.02);
  const fa = extractFeatures(a);
  const fb = extractFeatures(b);
  const align = alignFrames(fb, fa);
  const rotDeg = align ? (align.rotation * 180) / Math.PI : NaN;
  check(
    'rotation recovery',
    !!align && Math.abs(rotDeg - (0.06 * 180) / Math.PI) < 1.2,
    `expected ~3.44deg, got ${rotDeg?.toFixed(2)}deg, scale ${align?.scale.toFixed(3)} (expected ~1.02)`,
  );
  check('scale recovery', !!align && Math.abs(align.scale - 1.02) < 0.02, `scale=${align?.scale.toFixed(4)}`);
}

// Case 3: vertical translation, the top-to-bottom scan case.
{
  const tall = makeTexture(500, 1400);
  const a = sampleWindow(tall, FH, FW, 250, 400, 0, 1);
  const b = sampleWindow(tall, FH, FW, 250, 400 + 130, 0, 1);
  const align = alignFrames(extractFeatures(b), extractFeatures(a));
  check(
    'vertical translation',
    !!align && Math.abs(align.transform.ty - 130) < 2,
    `expected dy=130, got ${align?.transform.ty.toFixed(2)}`,
  );
}

// Case 4: no shared content must not produce a confident transform.
{
  const a = sampleWindow(texture, FW, FH, 200, 250, 0, 1);
  const b = sampleWindow(texture, FW, FH, 1150, 250, 0, 1);
  const align = alignFrames(extractFeatures(b), extractFeatures(a));
  check(
    'rejects unrelated frames',
    !align || align.confidence < 0.35,
    `confidence=${align ? align.confidence.toFixed(2) : 'null'}`,
  );
}

// Case 5: timing budget for the live loop.
{
  const a = sampleWindow(texture, FW, FH, 400, 250, 0, 1);
  const b = sampleWindow(texture, FW, FH, 520, 250, 0, 1);
  const fa = extractFeatures(a);
  const t0 = performance.now();
  const iterations = 20;
  for (let i = 0; i < iterations; i++) alignFrames(extractFeatures(b), fa);
  const per = (performance.now() - t0) / iterations;
  check('live loop budget', per < 60, `${per.toFixed(1)}ms per detect+describe+match+ransac at ${FW}x${FH}`);
}

console.log(failures === 0 ? '\nAll vision checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
