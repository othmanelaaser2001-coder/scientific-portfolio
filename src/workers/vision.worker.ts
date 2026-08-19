import { alignFrames, extractFeatures, type FrameFeatures } from '../vision/align';
import { toGray } from '../vision/gray';
import { overlapRatio } from '../vision/overlap';
import type { GrayImage, Mat23 } from '../vision/types';
import type { AlignReport, Slot, VisionRequest, VisionResponse } from './protocol';

// `self` is typed as Window because the app's tsconfig loads the DOM lib; this
// narrow view is all the worker needs.
const ctx = self as unknown as {
  postMessage(message: VisionResponse): void;
  onmessage: ((event: { data: VisionRequest }) => void) | null;
};

interface SlotState {
  features: FrameFeatures | null;
  gray: GrayImage | null;
}

const slots: Record<Slot, SlotState> = {
  live: { features: null, gray: null },
  refine: { features: null, gray: null },
};

/**
 * Mean luminance of both frames restricted to the region they share, sampled on
 * a coarse grid. Feeding the stitcher matched pairs of means is what lets it
 * cancel exposure drift between frames.
 */
function overlapLuma(
  moving: GrayImage,
  reference: GrayImage,
  transform: Mat23,
): { moving: number; reference: number } {
  const step = Math.max(2, Math.round(moving.width / 64));
  let sumMoving = 0;
  let sumReference = 0;
  let count = 0;
  for (let y = 0; y < moving.height; y += step) {
    for (let x = 0; x < moving.width; x += step) {
      const rx = transform.a * x + transform.b * y + transform.tx;
      const ry = transform.c * x + transform.d * y + transform.ty;
      if (rx < 0 || ry < 0 || rx >= reference.width - 1 || ry >= reference.height - 1) continue;
      sumMoving += moving.data[y * moving.width + x];
      sumReference += reference.data[(ry | 0) * reference.width + (rx | 0)];
      count++;
    }
  }
  if (!count) return { moving: 0, reference: 0 };
  return { moving: sumMoving / count, reference: sumReference / count };
}

function handleAlign(request: Extract<VisionRequest, { type: 'align' }>): AlignReport {
  const started = performance.now();
  const { width, height, data } = request.frame;
  const gray = toGray(new Uint8Array(data), width, height);
  const features = extractFeatures(gray, request.precise ? 600 : 380);
  const slot = slots[request.slot];
  const reference = slot.features;
  const referenceGray = slot.gray;

  let report: AlignReport = {
    alignment: null,
    overlap: 0,
    stats: { sharpness: features.sharpness, luma: features.luma, keypoints: features.keypoints.length },
    overlapLumaMoving: features.luma,
    overlapLumaReference: features.luma,
    isFirst: !reference,
    ms: 0,
  };

  if (reference && referenceGray) {
    const alignment = alignFrames(features, reference, {
      threshold: request.precise ? 2 : 2.75,
      allowAffine: true,
      allowFallback: !request.precise,
    });
    if (alignment) {
      // Fraction of the incoming frame that still lands on the reference.
      const overlap = overlapRatio(alignment.transform, width, height);
      const luma = overlapLuma(gray, referenceGray, alignment.transform);
      report = {
        ...report,
        alignment,
        overlap,
        overlapLumaMoving: luma.moving || features.luma,
        overlapLumaReference: luma.reference || reference.luma,
      };
    }
  }

  if (request.commit) {
    slot.features = features;
    slot.gray = gray;
  }
  report.ms = performance.now() - started;
  return report;
}

ctx.onmessage = (event) => {
  const request = event.data;
  try {
    if (request.type === 'reset') {
      slots[request.slot] = { features: null, gray: null };
      ctx.postMessage({ id: request.id, type: 'reset-ok' });
      return;
    }
    ctx.postMessage({ id: request.id, type: 'ok', report: handleAlign(request) });
  } catch (error) {
    ctx.postMessage({ id: request.id, type: 'error', message: String(error) });
  }
};
