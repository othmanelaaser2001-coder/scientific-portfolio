import { getFrame } from '../storage/frameStore';
import { matRescale } from '../vision/mat';
import type { VisionClient } from '../workers/visionClient';
import type { ScanCapture } from '../scan/types';
import type { PairTransform } from './plan';

export interface RefineResult {
  pairs: PairTransform[];
  sharpnessRatios: number[];
  /** Long-edge size, in pixels, of the images used for the refinement pass. */
  refineSize: number;
  refinedPairs: number;
  fallbackPairs: number;
}

/**
 * Re-aligns consecutive keyframes from the stored full-resolution images.
 *
 * The live loop has to answer within a video frame, so its transforms come from
 * small images and whatever moment the sampler happened to catch. This pass has
 * no such constraint: it works from the exact stored pixels at a higher working
 * resolution, which is what the final geometry is built from. The live estimate
 * stays as a fallback for pairs that fail here.
 */
export async function refinePairs(
  capture: ScanCapture,
  vision: VisionClient,
  refineSize = 560,
  onProgress?: (fraction: number, label: string) => void,
): Promise<RefineResult> {
  const { keyframes, fullWidth, fullHeight, workWidth } = capture;
  const scale = refineSize / Math.max(fullWidth, fullHeight);
  const width = Math.max(64, Math.round(fullWidth * Math.min(1, scale)));
  const height = Math.max(64, Math.round(fullHeight * Math.min(1, scale)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is unavailable on this device');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  await vision.reset('refine');

  const pairs: PairTransform[] = [];
  const sharpness: number[] = [];
  let refinedPairs = 0;
  let fallbackPairs = 0;

  for (let i = 0; i < keyframes.length; i++) {
    onProgress?.(i / keyframes.length, `Re-aligning frame ${i + 1} of ${keyframes.length}`);
    const stored = await getFrame(capture.scanId, i);
    const keyframe = keyframes[i];
    if (!stored) {
      sharpness.push(keyframe.sharpness);
      if (i > 0 && keyframe.toPrev) {
        pairs.push(livePair(capture, i));
        fallbackPairs++;
      }
      continue;
    }

    const bitmap = await createImageBitmap(stored.blob);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, width, height);
    const report = await vision.align('refine', pixels, { commit: true, precise: true });
    sharpness.push(report.stats.sharpness);

    if (i === 0) continue;

    if (report.alignment && report.alignment.inliers >= 8) {
      const toFullRes = fullWidth / width;
      pairs.push({
        index: i,
        transform: matRescale(report.alignment.transform, toFullRes),
        stats: {
          index: i,
          inliers: report.alignment.inliers,
          matches: report.alignment.matches,
          confidence: report.alignment.confidence,
          residual: report.alignment.residual,
          overlap: report.overlap,
          rotation: report.alignment.rotation,
          scale: report.alignment.scale,
          shear: report.alignment.shear,
          source: 'refined',
        },
        luma: { moving: report.overlapLumaMoving, reference: report.overlapLumaReference },
      });
      refinedPairs++;
    } else if (keyframes[i].toPrev) {
      pairs.push(livePair(capture, i));
      fallbackPairs++;
    } else {
      // Nothing tied this frame to the previous one. Assume the nominal
      // advance along the scan axis and flag it, rather than inventing detail.
      const advance = capture.direction === 'horizontal' ? fullWidth * 0.38 : 0;
      const advanceY = capture.direction === 'vertical' ? fullHeight * 0.38 : 0;
      pairs.push({
        index: i,
        transform: { a: 1, b: 0, tx: advance, c: 0, d: 1, ty: advanceY },
        stats: {
          index: i,
          inliers: 0,
          matches: 0,
          confidence: 0,
          residual: Number.NaN,
          overlap: 0.4,
          rotation: 0,
          scale: 1,
          shear: 0,
          source: 'assumed',
        },
        luma: { moving: keyframe.overlapLuma, reference: keyframe.prevOverlapLuma },
      });
      fallbackPairs++;
    }
  }

  canvas.width = 0;
  canvas.height = 0;
  const peak = Math.max(...sharpness, 0.0001);

  return {
    pairs,
    sharpnessRatios: sharpness.map((value) => value / peak),
    refineSize: Math.max(width, height),
    refinedPairs,
    fallbackPairs,
  };

  function livePair(source: ScanCapture, index: number): PairTransform {
    const keyframe = source.keyframes[index];
    const toFullRes = source.fullWidth / workWidth;
    return {
      index,
      transform: matRescale(keyframe.toPrev!, toFullRes),
      stats: {
        index,
        inliers: keyframe.inliers,
        matches: keyframe.matches,
        confidence: keyframe.confidence * 0.8,
        residual: Number.NaN,
        overlap: keyframe.overlapWithPrev,
        rotation: 0,
        scale: 1,
        shear: 0,
        source: 'live',
      },
      luma: { moving: keyframe.overlapLuma, reference: keyframe.prevOverlapLuma },
    };
  }
}
