import type { Rect } from '../stitch/render';
import type { Calibration, LabelledMeasurement, Point } from '../measure/measurements';
import { formatLength } from '../measure/measurements';
import { dimensionStyle, drawDimension } from './annotations';
import { rotationMatrix } from './geometry';
import { matApply } from '../vision/mat';

export type ExportFormat = 'png' | 'jpeg';

export interface ExportOptions {
  mosaic: HTMLCanvasElement;
  angle: number;
  crop: Rect;
  measurements: LabelledMeasurement[];
  calibration: Calibration | null;
  includeAnnotations: boolean;
  format: ExportFormat;
  quality?: number;
}

export interface ExportedImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Renders exactly what the user sees — the straightened, cropped mosaic, with
 * annotations optionally burned in — at full mosaic resolution.
 */
export async function renderExport(options: ExportOptions): Promise<ExportedImage> {
  const width = Math.max(1, Math.round(options.crop.width));
  const height = Math.max(1, Math.round(options.crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: options.format === 'png' });
  if (!ctx) throw new Error('Canvas 2D is unavailable on this device');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (options.format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  const rotate = rotationMatrix(options.mosaic.width, options.mosaic.height, options.angle);
  ctx.save();
  ctx.translate(-options.crop.x, -options.crop.y);
  ctx.transform(rotate.a, rotate.c, rotate.b, rotate.d, rotate.tx, rotate.ty);
  ctx.drawImage(options.mosaic, 0, 0);
  ctx.restore();

  if (options.includeAnnotations && (options.measurements.length || options.calibration)) {
    const scale = Math.min(6, Math.max(1, Math.max(width, height) / 1400));
    const project = (point: Point): Point => {
      const rotated = matApply(rotate, point.x, point.y);
      return { x: rotated.x - options.crop.x, y: rotated.y - options.crop.y };
    };
    if (options.calibration) {
      drawDimension(
        ctx,
        project(options.calibration.a),
        project(options.calibration.b),
        `${formatLength(options.calibration.referenceCm, 'cm')} · reference`,
        dimensionStyle(scale, '#0a8f65'),
      );
    }
    for (const measurement of options.measurements) {
      drawDimension(ctx, project(measurement.a), project(measurement.b), measurement.label, dimensionStyle(scale));
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(
      resolve,
      options.format === 'png' ? 'image/png' : 'image/jpeg',
      options.format === 'jpeg' ? (options.quality ?? 0.94) : undefined,
    ),
  );
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('The image could not be encoded — it may be too large for this device.');
  return { blob, width, height };
}

export function fileNameFor(name: string, format: ExportFormat): string {
  const safe = name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'scan';
  return `${safe}.${format === 'png' ? 'png' : 'jpg'}`;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canShareFiles(blob: Blob, filename: string): boolean {
  const file = new File([blob], filename, { type: blob.type });
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export async function shareBlob(blob: Blob, filename: string, title: string): Promise<boolean> {
  if (!navigator.share) return false;
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return true;
    return false;
  }
}
