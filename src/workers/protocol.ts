import type { Alignment } from '../vision/types';

/** Raw grayscale-convertible frame handed to the vision worker. */
export interface FramePayload {
  width: number;
  height: number;
  /** RGBA pixel buffer, transferred (not copied) to the worker. */
  data: ArrayBuffer;
}

/** Independent reference slots so the live loop and the refine pass coexist. */
export type Slot = 'live' | 'refine';

export type VisionRequest =
  | { id: number; type: 'reset'; slot: Slot }
  | {
      id: number;
      type: 'align';
      slot: Slot;
      frame: FramePayload;
      /** Make this frame the new reference for the slot. */
      commit: boolean;
      /** Higher quality settings for the post-scan refinement pass. */
      precise?: boolean;
    };

export interface FrameStats {
  sharpness: number;
  luma: number;
  keypoints: number;
}

export interface AlignReport {
  alignment: Alignment | null;
  /** Overlap of the incoming frame with the reference, 0..1. */
  overlap: number;
  stats: FrameStats;
  /** Mean luma inside the shared region, for exposure compensation. */
  overlapLumaMoving: number;
  overlapLumaReference: number;
  /** True when the slot had no reference yet (this frame became the first). */
  isFirst: boolean;
  /** Worker-side processing time in milliseconds. */
  ms: number;
}

export type VisionResponse =
  | { id: number; type: 'ok'; report: AlignReport }
  | { id: number; type: 'reset-ok' }
  | { id: number; type: 'error'; message: string };
