import type { Guidance } from './types';

/**
 * Live guidance decisions, kept pure so they can be reasoned about and tested
 * without a camera.
 *
 * The important property here is stability. The sampler runs at roughly 15 Hz,
 * and on a real phone individual frames drop out constantly — autofocus hunts,
 * a hand tremor smears one exposure, a highlight washes out the texture. Acting
 * on a single dropped frame produces an alarming message several times a second
 * and, worse, usually the wrong one: a blurred frame does not mean the user has
 * moved past the overlap.
 */

/** Sharpness, relative to the sharpest frame seen, below which a frame is soft. */
export const BLUR_RATIO = 0.42;

/** Sweep speed, in frame widths per second, above which capture struggles. */
export const FAST_SPEED = 0.85;

/**
 * Consecutive tracking failures before the user is told to move back. At the
 * sampler's rate this is about a third of a second of genuinely lost tracking.
 */
export const LOST_STREAK_LIMIT = 4;

/** Minimum time a message stays on screen before a different one replaces it. */
export const GUIDANCE_HOLD_MS = 420;

/** These describe the state of the scan itself and must never be held back. */
const IMMEDIATE: ReadonlySet<Guidance> = new Set<Guidance>(['budget', 'complete', 'position']);

export interface GuidanceInput {
  /** False when the frame could not be aligned against the last keyframe. */
  tracking: boolean;
  overlap: number;
  sharpnessRatio: number;
  /** Frame widths per second. */
  speed: number;
  budgetReached: boolean;
  /** How many probes in a row have failed to align. */
  lostStreak: number;
  minOverlap: number;
}

export function decideGuidance(input: GuidanceInput): Guidance {
  if (input.budgetReached) return 'budget';

  if (!input.tracking) {
    // Short dropouts are far more often a soft frame than a lost position, and
    // holding still fixes both. Only sustained failure means the overlap is
    // genuinely gone and the user has to come back to find it.
    return input.lostStreak >= LOST_STREAK_LIMIT ? 'lost' : 'hold-steady';
  }

  if (input.overlap < input.minOverlap * 0.72) return 'move-back';
  if (input.overlap < input.minOverlap) return 'low-overlap';
  if (input.speed > FAST_SPEED) return 'slow-down';
  if (input.sharpnessRatio < BLUR_RATIO) return 'hold-steady';
  return 'good';
}

/**
 * Holds each message on screen for a minimum time, so the pill reads as advice
 * rather than flickering between states faster than anyone can act on.
 */
export class GuidanceSmoother {
  private current: Guidance;
  private since = 0;
  private readonly holdMs: number;

  constructor(initial: Guidance = 'position', holdMs = GUIDANCE_HOLD_MS) {
    this.current = initial;
    this.holdMs = holdMs;
  }

  update(next: Guidance, now: number): Guidance {
    if (next === this.current) return this.current;
    if (!IMMEDIATE.has(next) && now - this.since < this.holdMs) return this.current;
    this.current = next;
    this.since = now;
    return this.current;
  }

  reset(guidance: Guidance, now: number): void {
    this.current = guidance;
    this.since = now;
  }
}
