import { getFrame } from '../storage/frameStore';
import { VisionClient } from '../workers/visionClient';
import type { ScanCapture } from '../scan/types';
import { buildPlan, type StitchPlan } from './plan';
import { refinePairs } from './refine';
import { analyseCrop, renderMosaic, type Rect } from './render';
import { gradeScan, type QualityReport } from './quality';

export type { Rect } from './render';
export type { QualityReport, QualityGrade } from './quality';

export interface StitchDebugInfo {
  frames: number;
  rejected: number;
  refinedPairs: number;
  fallbackPairs: number;
  refineSize: number;
  refineMs: number;
  renderMs: number;
  totalMs: number;
  outputScale: number;
  limitedByCanvas: boolean;
  straightenDeg: number;
  scaleDriftRemoved: number;
  memoryMb: number | null;
  sourceFrameSize: string;
}

export interface StitchResult {
  canvas: HTMLCanvasElement;
  /** Region shown to the user; starts at the auto-detected object bounds. */
  crop: Rect;
  coverage: Rect;
  contentCrop: Rect;
  contentConfident: boolean;
  plan: StitchPlan;
  quality: QualityReport;
  debug: StitchDebugInfo;
  warnings: string[];
}

export interface StitchProgress {
  fraction: number;
  label: string;
}

function memoryMb(): number | null {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? Math.round(memory.usedJSHeapSize / 1048576) : null;
}

/**
 * Full stitching pipeline: refine the pairwise geometry, plan the mosaic,
 * render it progressively, then measure how good the result actually is.
 */
export async function stitchScan(
  capture: ScanCapture,
  onProgress?: (progress: StitchProgress) => void,
): Promise<StitchResult> {
  if (!capture.keyframes.length) throw new Error('There are no frames to stitch.');
  const startedAt = performance.now();
  const vision = new VisionClient();
  const report = (fraction: number, label: string) => onProgress?.({ fraction, label });

  try {
    const refineStart = performance.now();
    const refined = await refinePairs(capture, vision, 560, (fraction, label) =>
      report(fraction * 0.35, label),
    );
    const refineMs = performance.now() - refineStart;

    report(0.36, 'Planning the mosaic');
    const plan = buildPlan(refined.pairs, capture.keyframes.length, {
      frameWidth: capture.fullWidth,
      frameHeight: capture.fullHeight,
      direction: capture.direction,
    });

    const renderStart = performance.now();
    const canvas = await renderMosaic({
      plan,
      frameWidth: capture.fullWidth,
      frameHeight: capture.fullHeight,
      frameCount: capture.keyframes.length,
      loadFrame: async (index) => (await getFrame(capture.scanId, index))?.blob,
      onProgress: (fraction, label) => report(0.36 + fraction * 0.58, label),
    });
    const renderMs = performance.now() - renderStart;

    report(0.95, 'Trimming the background');
    const crop = analyseCrop(canvas, capture.direction);
    const quality = gradeScan(plan.pairStats, refined.sharpnessRatios, capture.keyframes.length);

    const warnings: string[] = [];
    if (refined.fallbackPairs > 0) {
      warnings.push(
        `${refined.fallbackPairs} frame join${refined.fallbackPairs === 1 ? '' : 's'} could not be re-measured at high precision; the live estimate was used instead.`,
      );
    }
    const assumed = plan.pairStats.filter((pair) => pair.source === 'assumed').length;
    if (assumed > 0) {
      warnings.push(
        `${assumed} join${assumed === 1 ? ' was' : 's were'} not matched at all. That part of the image may not line up — rescan that section.`,
      );
    }
    if (plan.limitedByCanvas) {
      warnings.push(
        `The mosaic was scaled to ${(plan.outputScale * 100).toFixed(0)}% of camera resolution to fit this device's maximum canvas size.`,
      );
    }
    if (quality.grade === 'Poor') warnings.push('Overall stitching confidence is low. Consider scanning again.');

    report(1, 'Done');
    return {
      canvas,
      crop: crop.content,
      coverage: crop.coverage,
      contentCrop: crop.content,
      contentConfident: crop.contentConfident,
      plan,
      quality,
      warnings,
      debug: {
        frames: capture.keyframes.length,
        rejected: capture.rejectedFrames,
        refinedPairs: refined.refinedPairs,
        fallbackPairs: refined.fallbackPairs,
        refineSize: refined.refineSize,
        refineMs: Math.round(refineMs),
        renderMs: Math.round(renderMs),
        totalMs: Math.round(performance.now() - startedAt),
        outputScale: plan.outputScale,
        limitedByCanvas: plan.limitedByCanvas,
        straightenDeg: (plan.straightenBy * 180) / Math.PI,
        scaleDriftRemoved: plan.scaleDriftRemoved,
        memoryMb: memoryMb(),
        sourceFrameSize: `${capture.fullWidth}x${capture.fullHeight}`,
      },
    };
  } finally {
    vision.dispose();
  }
}
