import type { FeatherSpec, StitchPlan } from './plan';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderInput {
  plan: StitchPlan;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  /** Loads the full-resolution frame for an index. */
  loadFrame: (index: number) => Promise<Blob | undefined>;
  onProgress?: (fraction: number, label: string) => void;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function ctxOf(canvas: HTMLCanvasElement, alpha: boolean): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha });
  if (!ctx) throw new Error('Canvas 2D is unavailable on this device');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** Applies an exact linear gain to the canvas contents. */
function applyGain(ctx: CanvasRenderingContext2D, width: number, height: number, gain: number): void {
  if (Math.abs(gain - 1) < 0.004) return;
  ctx.save();
  if (gain < 1) {
    // multiply by a constant grey: result = src * gain
    const level = Math.round(Math.max(0, gain) * 255);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${level},${level},${level})`;
    ctx.fillRect(0, 0, width, height);
  } else {
    // additive re-draw: result = src + (gain - 1) * src = gain * src
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, gain - 1);
    ctx.drawImage(ctx.canvas, 0, 0);
  }
  ctx.restore();
}

/** Ramps the frame's alpha to zero on the edge that overlaps earlier frames. */
function applyFeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  feather: FeatherSpec,
): void {
  const span = Math.max(1, Math.min(feather.width, feather.axis === 'x' ? width : height));
  const gradient =
    feather.axis === 'x'
      ? feather.side < 0
        ? ctx.createLinearGradient(0, 0, span, 0)
        : ctx.createLinearGradient(width, 0, width - span, 0)
      : feather.side < 0
        ? ctx.createLinearGradient(0, 0, 0, span)
        : ctx.createLinearGradient(0, height, 0, height - span);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Renders the mosaic one frame at a time. Only one full-resolution frame is
 * decoded at any moment, which keeps peak memory close to
 * (output canvas + one frame) even for a hundred-frame scan.
 */
export async function renderMosaic(input: RenderInput): Promise<HTMLCanvasElement> {
  const { plan, frameWidth, frameHeight, frameCount } = input;
  const output = makeCanvas(plan.outputWidth, plan.outputHeight);
  const outputCtx = ctxOf(output, true);
  const scratch = makeCanvas(frameWidth, frameHeight);
  const scratchCtx = ctxOf(scratch, true);

  for (let i = 0; i < frameCount; i++) {
    input.onProgress?.(i / frameCount, `Blending frame ${i + 1} of ${frameCount}`);
    const blob = await input.loadFrame(i);
    if (!blob) continue;
    const bitmap = await createImageBitmap(blob);
    try {
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, frameWidth, frameHeight);
      scratchCtx.globalCompositeOperation = 'source-over';
      scratchCtx.globalAlpha = 1;
      scratchCtx.drawImage(bitmap, 0, 0, frameWidth, frameHeight);
      applyGain(scratchCtx, frameWidth, frameHeight, plan.gains[i] ?? 1);
      const feather = plan.feather[i];
      if (feather) applyFeather(scratchCtx, frameWidth, frameHeight, feather);

      const m = plan.transforms[i];
      outputCtx.save();
      outputCtx.setTransform(m.a, m.c, m.b, m.d, m.tx, m.ty);
      outputCtx.drawImage(scratch, 0, 0);
      outputCtx.restore();
    } finally {
      bitmap.close();
    }
    await yieldToUi();
  }

  scratch.width = 0;
  scratch.height = 0;
  input.onProgress?.(1, 'Finishing');
  return output;
}

export interface CropAnalysis {
  /** Region actually covered by camera pixels. */
  coverage: Rect;
  /** Tighter region around the object itself. */
  content: Rect;
  contentConfident: boolean;
}

/**
 * Works out where the mosaic actually has pixels, and where the object sits
 * inside it, from a small downscaled copy so that even a 100-megapixel result
 * can be analysed without reading it back at full size.
 */
export function analyseCrop(canvas: HTMLCanvasElement, direction: 'horizontal' | 'vertical'): CropAnalysis {
  const long = Math.max(canvas.width, canvas.height);
  const scale = Math.min(1, 1000 / long);
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  const small = makeCanvas(width, height);
  const ctx = ctxOf(small, true);
  ctx.drawImage(canvas, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const full: Rect = { x: 0, y: 0, width: canvas.width, height: canvas.height };

  // Coverage: any pixel the camera actually painted.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { coverage: full, content: full, contentConfident: false };

  const toFull = (rect: Rect): Rect => {
    const x = Math.max(0, Math.floor(rect.x / scale));
    const y = Math.max(0, Math.floor(rect.y / scale));
    return {
      x,
      y,
      width: Math.min(canvas.width - x, Math.ceil(rect.width / scale)),
      height: Math.min(canvas.height - y, Math.ceil(rect.height / scale)),
    };
  };

  const coverageSmall: Rect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const coverage = toFull(coverageSmall);

  // Background estimate: median-ish colour of the covered border ring.
  const samples: number[][] = [];
  const ring = Math.max(1, Math.round(Math.min(coverageSmall.width, coverageSmall.height) * 0.03));
  for (let y = coverageSmall.y; y < coverageSmall.y + coverageSmall.height; y++) {
    for (let x = coverageSmall.x; x < coverageSmall.x + coverageSmall.width; x++) {
      const onEdge =
        x < coverageSmall.x + ring ||
        x >= coverageSmall.x + coverageSmall.width - ring ||
        y < coverageSmall.y + ring ||
        y >= coverageSmall.y + coverageSmall.height - ring;
      if (!onEdge) continue;
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 24) continue;
      samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
    }
  }
  if (samples.length < 24) return { coverage, content: coverage, contentConfident: false };
  const median = (channel: number) => {
    const values = samples.map((s) => s[channel]).sort((a, b) => a - b);
    return values[values.length >> 1];
  };
  const bg = [median(0), median(1), median(2)];

  // Profile of "not background" pixels along each axis.
  const colProfile = new Float32Array(width);
  const rowProfile = new Float32Array(height);
  const threshold = 42;
  for (let y = coverageSmall.y; y < coverageSmall.y + coverageSmall.height; y++) {
    for (let x = coverageSmall.x; x < coverageSmall.x + coverageSmall.width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 24) continue;
      const distance =
        Math.abs(pixels[i] - bg[0]) + Math.abs(pixels[i + 1] - bg[1]) + Math.abs(pixels[i + 2] - bg[2]);
      if (distance > threshold) {
        colProfile[x] += 1;
        rowProfile[y] += 1;
      }
    }
  }

  const band = (profile: Float32Array, from: number, to: number): [number, number] | null => {
    let peak = 0;
    for (let i = from; i < to; i++) peak = Math.max(peak, profile[i]);
    if (peak < 3) return null;
    const cut = peak * 0.18;
    let start = -1;
    let end = -1;
    for (let i = from; i < to; i++) {
      if (profile[i] >= cut) {
        if (start < 0) start = i;
        end = i;
      }
    }
    return start < 0 ? null : [start, end];
  };

  const cols = band(colProfile, coverageSmall.x, coverageSmall.x + coverageSmall.width);
  const rows = band(rowProfile, coverageSmall.y, coverageSmall.y + coverageSmall.height);
  if (!cols || !rows) return { coverage, content: coverage, contentConfident: false };

  const margin = Math.max(2, Math.round(Math.min(coverageSmall.width, coverageSmall.height) * 0.02));
  const contentSmall: Rect = {
    x: Math.max(coverageSmall.x, cols[0] - margin),
    y: Math.max(coverageSmall.y, rows[0] - margin),
    width: 0,
    height: 0,
  };
  contentSmall.width = Math.min(coverageSmall.x + coverageSmall.width, cols[1] + margin) - contentSmall.x + 1;
  contentSmall.height = Math.min(coverageSmall.y + coverageSmall.height, rows[1] + margin) - contentSmall.y + 1;

  const areaRatio =
    (contentSmall.width * contentSmall.height) / (coverageSmall.width * coverageSmall.height);
  // Along the scan axis the object should span nearly the whole mosaic; a much
  // shorter band means the detection latched onto something else.
  const alongRatio =
    direction === 'horizontal'
      ? contentSmall.width / coverageSmall.width
      : contentSmall.height / coverageSmall.height;
  const contentConfident = areaRatio > 0.03 && areaRatio < 0.95 && alongRatio > 0.6;

  return {
    coverage,
    content: contentConfident ? toFull(contentSmall) : coverage,
    contentConfident,
  };
}
