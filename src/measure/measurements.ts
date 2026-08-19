import type { QualityGrade } from '../stitch/quality';

export interface Point {
  x: number;
  y: number;
}

export interface Measurement {
  id: string;
  /** Endpoints in mosaic-image pixel coordinates, so they survive crop edits. */
  a: Point;
  b: Point;
  /** Optional name, e.g. "Hole diameter". The value is always appended. */
  title: string;
}

/** A measurement with its value resolved for the current unit and calibration. */
export type LabelledMeasurement = Measurement & { label: string };

export interface Calibration {
  pixelsPerCm: number;
  referenceCm: number;
  a: Point;
  b: Point;
}

export type Unit = 'mm' | 'cm';

export function pixelDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function toCm(pixels: number, calibration: Calibration): number {
  return pixels / calibration.pixelsPerCm;
}

export function formatLength(cm: number, unit: Unit): string {
  if (unit === 'mm') {
    const mm = cm * 10;
    return `${mm.toFixed(mm < 100 ? 1 : 0)} mm`;
  }
  return `${cm.toFixed(cm < 10 ? 2 : 1)} cm`;
}

const GRADE_UNCERTAINTY: Record<QualityGrade, number> = {
  Excellent: 0.01,
  Good: 0.02,
  Fair: 0.045,
  Poor: 0.09,
};

export interface AccuracyEstimate {
  /** Relative uncertainty, e.g. 0.02 for ±2%. */
  relative: number;
  text: string;
  detail: string;
}

/**
 * Honest error budget for a measurement: stitching quality, the resolution the
 * mosaic was rendered at, and how precisely the calibration reference itself
 * could be clicked. These are estimates, not calibrated instrument accuracy.
 */
export function estimateAccuracy(
  grade: QualityGrade,
  calibration: Calibration | null,
  outputScale: number,
): AccuracyEstimate {
  const stitching = GRADE_UNCERTAINTY[grade];
  const resolution = Math.max(0, (1 - Math.min(1, outputScale)) * 0.01);
  // Two endpoint clicks, each good to roughly 3 mosaic pixels.
  const referencePixels = calibration ? pixelDistance(calibration.a, calibration.b) : 0;
  const clicking = referencePixels > 0 ? Math.min(0.08, (3 * Math.SQRT2) / referencePixels) : 0.02;
  const relative = Math.sqrt(stitching ** 2 + resolution ** 2 + clicking ** 2);
  return {
    relative,
    text: `±${(relative * 100).toFixed(relative < 0.1 ? 1 : 0)}%`,
    detail:
      `Estimated from scan quality (${grade}), render scale ` +
      `(${Math.round(outputScale * 100)}%) and how precisely the reference points were placed. ` +
      `These are estimates, not laboratory-grade measurements.`,
  };
}

export function newId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
