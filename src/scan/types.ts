import type { Mat23 } from '../vision/types';

export type Guidance =
  | 'position'
  | 'start-moving'
  | 'good'
  | 'slow-down'
  | 'hold-steady'
  | 'move-back'
  | 'low-overlap'
  | 'lost'
  | 'budget'
  | 'complete';

export const GUIDANCE_TEXT: Record<Guidance, string> = {
  position: 'Position the start of the object in the guide',
  'start-moving': 'Move slowly along the object',
  good: 'Good',
  'slow-down': 'Move slowly',
  'hold-steady': 'Hold steady',
  'move-back': 'Move back slightly',
  'low-overlap': 'Not enough overlap',
  lost: 'Move back slightly',
  budget: 'Frame limit reached — finish the scan',
  complete: 'Scan complete',
};

export interface KeyframeRecord {
  index: number;
  /** Maps this frame's working-resolution coordinates into the previous frame. */
  toPrev: Mat23 | null;
  confidence: number;
  inliers: number;
  matches: number;
  sharpness: number;
  luma: number;
  /** Mean luma of the shared region, in this frame and in the previous one. */
  overlapLuma: number;
  prevOverlapLuma: number;
  overlapWithPrev: number;
  fullWidth: number;
  fullHeight: number;
  workWidth: number;
  workHeight: number;
  capturedAt: number;
}

export interface ScanCapture {
  scanId: string;
  keyframes: KeyframeRecord[];
  direction: 'horizontal' | 'vertical';
  cameraLabel: string;
  fullWidth: number;
  fullHeight: number;
  workWidth: number;
  workHeight: number;
  rejectedFrames: number;
  startedAt: number;
  endedAt: number;
}

export interface LiveState {
  phase: 'idle' | 'starting' | 'ready' | 'scanning' | 'finishing' | 'error';
  guidance: Guidance;
  frames: number;
  rejected: number;
  overlap: number;
  sharpness: number;
  sharpnessRatio: number;
  speed: number;
  confidence: number;
  matches: number;
  inliers: number;
  keypoints: number;
  coverage: number;
  advance: number;
  direction: 'horizontal' | 'vertical' | null;
  workerMs: number;
  probeHz: number;
  error: string | null;
  errorHint: string | null;
  cameraLabel: string;
  captureWidth: number;
  captureHeight: number;
  torchOn: boolean;
  torchSupported: boolean;
}
