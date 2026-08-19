import type { PairStats } from './plan';

export type QualityGrade = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface QualityReport {
  grade: QualityGrade;
  score: number;
  metrics: {
    meanInliers: number;
    minInliers: number;
    meanConfidence: number;
    minOverlap: number;
    maxRotationDeg: number;
    maxShear: number;
    lumaSpread: number;
    meanSharpness: number;
    weakPairs: number;
  };
  issues: string[];
  advice: string[];
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

/**
 * Grades a finished scan from the evidence collected while stitching. The score
 * is intentionally conservative: anything that could have degraded geometry
 * pulls it down, so users are warned instead of trusting a bad mosaic.
 */
export function gradeScan(pairs: PairStats[], sharpnessRatios: number[], frameCount: number): QualityReport {
  if (!pairs.length) {
    return {
      grade: frameCount > 0 ? 'Fair' : 'Poor',
      score: frameCount > 0 ? 55 : 0,
      metrics: {
        meanInliers: 0,
        minInliers: 0,
        meanConfidence: 0,
        minOverlap: 1,
        maxRotationDeg: 0,
        maxShear: 0,
        lumaSpread: 0,
        meanSharpness: sharpnessRatios.length ? sharpnessRatios.reduce((a, b) => a + b, 0) / sharpnessRatios.length : 1,
        weakPairs: 0,
      },
      issues: frameCount > 0 ? ['Only one frame was captured, so nothing had to be aligned.'] : ['No frames were captured.'],
      advice: [],
    };
  }

  const inliers = pairs.map((p) => p.inliers);
  const confidences = pairs.map((p) => p.confidence);
  const overlaps = pairs.map((p) => p.overlap);
  const meanInliers = inliers.reduce((a, b) => a + b, 0) / inliers.length;
  const minInliers = percentile(inliers, 0.05);
  const meanConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const minOverlap = percentile(overlaps, 0.05);
  const maxRotationDeg = Math.max(...pairs.map((p) => Math.abs((p.rotation * 180) / Math.PI)));
  const maxShear = Math.max(...pairs.map((p) => p.shear));
  const lumas = pairs.map((p) => p.gain);
  const lumaSpread = Math.max(...lumas) / Math.max(0.001, Math.min(...lumas)) - 1;
  const meanSharpness = sharpnessRatios.length
    ? sharpnessRatios.reduce((a, b) => a + b, 0) / sharpnessRatios.length
    : 1;
  const weakPairs = pairs.filter((p) => p.confidence < 0.45 || p.inliers < 15).length;

  // Sub-scores, each 0..1.
  const matchScore = Math.min(1, meanInliers / 45) * 0.6 + Math.min(1, minInliers / 18) * 0.4;
  const confidenceScore = Math.min(1, meanConfidence / 0.75);
  const overlapScore = Math.min(1, Math.max(0, (minOverlap - 0.2) / 0.35));
  const geometryScore = Math.max(0, 1 - maxRotationDeg / 22) * 0.6 + Math.max(0, 1 - maxShear / 0.05) * 0.4;
  const lightingScore = Math.max(0, 1 - lumaSpread / 0.5);
  const sharpnessScore = Math.min(1, meanSharpness / 0.8);

  const score = Math.round(
    100 *
      (0.3 * matchScore +
        0.16 * confidenceScore +
        0.24 * overlapScore +
        0.12 * geometryScore +
        0.08 * lightingScore +
        0.1 * sharpnessScore),
  );

  const grade: QualityGrade = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';

  const issues: string[] = [];
  const advice: string[] = [];
  if (minOverlap < 0.35) {
    issues.push('Some sections had insufficient overlap between frames.');
    advice.push('Scan again while moving more slowly, so each view still shows most of the previous one.');
  }
  if (minInliers < 15) {
    issues.push('Parts of the object had very little visible texture to match on.');
    advice.push('Add side lighting, or include a textured edge of the object inside the guide.');
  }
  if (meanSharpness < 0.6) {
    issues.push('Several frames were softer than the sharpest ones in the scan.');
    advice.push('Move more slowly and keep the phone at a constant distance so autofocus can keep up.');
  }
  if (maxRotationDeg > 12) {
    issues.push(`The phone rotated up to ${maxRotationDeg.toFixed(0)}° during the scan.`);
    advice.push('Keep the phone square to the object and slide it along, rather than pivoting it.');
  }
  if (lumaSpread > 0.35) {
    issues.push('Lighting changed noticeably along the object.');
    advice.push('Scan away from strong shadows or reflections for a more even result.');
  }
  if (weakPairs > 0) {
    issues.push(`${weakPairs} of ${pairs.length} frame joins were low confidence.`);
  }
  if (!issues.length) issues.push('No problems detected.');

  return {
    grade,
    score,
    metrics: {
      meanInliers,
      minInliers,
      meanConfidence,
      minOverlap,
      maxRotationDeg,
      maxShear,
      lumaSpread,
      meanSharpness,
      weakPairs,
    },
    issues,
    advice,
  };
}
