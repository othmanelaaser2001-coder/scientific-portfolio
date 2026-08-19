import { setTorch, startCamera, stopCamera, type CameraHandle } from './camera';
import { GUIDANCE_TEXT, type KeyframeRecord, type LiveState, type ScanCapture } from './types';
import { BLUR_RATIO, GuidanceSmoother, LOST_STREAK_LIMIT, decideGuidance } from './guidance';
import { clearScanFrames, clearStaleFrames, estimateStorage, putFrame } from '../storage/frameStore';
import { VisionClient } from '../workers/visionClient';
import { matApply, matIdentity, matInvert, matMul } from '../vision/mat';
import type { Mat23 } from '../vision/types';

export interface ScanSettings {
  /** Capture a new keyframe once overlap with the last one falls to this. */
  targetOverlap: number;
  /** Below this, the pair is too weak to stitch reliably. */
  minOverlap: number;
  /** Long edge, in pixels, of the images used for alignment. */
  workSize: number;
  /** Hard cap on keyframes, to bound memory and stitch time. */
  maxFrames: number;
  /** JPEG quality for the stored full-resolution frames. */
  jpegQuality: number;
  /** Minimum milliseconds between two probes. */
  probeInterval: number;
}

export const DEFAULT_SETTINGS: ScanSettings = {
  targetOverlap: 0.62,
  minOverlap: 0.3,
  workSize: 384,
  maxFrames: 140,
  jpegQuality: 0.92,
  probeInterval: 66,
};

const STRIP_LONG = 2400;
const STRIP_SHORT = 300;

const INITIAL_STATE: LiveState = {
  phase: 'idle',
  guidance: 'position',
  frames: 0,
  rejected: 0,
  drops: 0,
  overlap: 1,
  sharpness: 0,
  sharpnessRatio: 1,
  speed: 0,
  confidence: 0,
  matches: 0,
  inliers: 0,
  keypoints: 0,
  coverage: 0,
  advance: 0,
  direction: null,
  workerMs: 0,
  probeHz: 0,
  error: null,
  errorHint: null,
  cameraLabel: '',
  captureWidth: 0,
  captureHeight: 0,
  torchOn: false,
  torchSupported: false,
};

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement, alpha = false): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha, willReadFrequently: false });
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  return ctx;
}

/**
 * Drives a live scan: samples the camera, decides which frames are worth
 * keeping, stores them at full resolution and produces live guidance.
 */
export class ScanSession {
  readonly settings: ScanSettings;
  /** Set once the capture has been passed to the stitcher, so frames survive teardown. */
  handedOver = false;
  private video: HTMLVideoElement;
  private vision = new VisionClient();
  private camera: CameraHandle | null = null;

  private workCanvas = createCanvas(2, 2);
  private captureCanvas = createCanvas(2, 2);
  private referenceCanvas = createCanvas(2, 2);
  private stripCanvas = createCanvas(STRIP_LONG, STRIP_SHORT);
  private stripScale = 1;
  private stripOrigin = { x: 24, y: STRIP_SHORT / 2 };
  private stripDrawn = false;

  private state: LiveState = { ...INITIAL_STATE };
  private listeners = new Set<(state: LiveState) => void>();

  private scanId = '';
  private keyframes: KeyframeRecord[] = [];
  private cumulative: Mat23[] = [];
  private rejected = 0;
  private startedAt = 0;

  private running = false;
  private busy = false;
  private capturing = false;
  private frameHandle: number | null = null;
  private timerHandle: number | null = null;
  private lastProbeAt = 0;
  private probeTimes: number[] = [];
  private sharpnessPeak = 0;
  private lastAdvance = 0;
  private lastAdvanceAt = 0;
  private lostStreak = 0;
  private drops = 0;
  private guidanceSmoother = new GuidanceSmoother();
  private frameBudget = DEFAULT_SETTINGS.maxFrames;
  private storageFull = false;
  private liveTransform: Mat23 | null = null;
  private pendingBlobs = 0;

  constructor(video: HTMLVideoElement, settings: Partial<ScanSettings> = {}) {
    this.video = video;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  subscribe(listener: (state: LiveState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): LiveState {
    return this.state;
  }

  getStripCanvas(): HTMLCanvasElement {
    return this.stripCanvas;
  }

  /** Keyframes this scan may still take, after the storage check at startup. */
  get maxFrames(): number {
    return this.frameBudget;
  }

  /** Bounding box, in strip-canvas pixels, of everything drawn so far. */
  getStripBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.stripDrawn || !this.keyframes.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const { workWidth, workHeight } = this.keyframes[0];
    for (let i = 0; i < this.keyframes.length; i++) {
      const m = this.stripTransform(this.cumulative[i]);
      for (const [x, y] of [
        [0, 0],
        [workWidth, 0],
        [workWidth, workHeight],
        [0, workHeight],
      ]) {
        const p = matApply(m, x, y);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private patch(changes: Partial<LiveState>): void {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener(this.state);
  }

  async start(): Promise<void> {
    this.patch({ ...INITIAL_STATE, phase: 'starting' });
    try {
      const camera = await startCamera();
      this.camera = camera;
      this.video.srcObject = camera.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      await this.waitForMetadata();

      const width = this.video.videoWidth || camera.width;
      const height = this.video.videoHeight || camera.height;
      this.captureCanvas.width = width;
      this.captureCanvas.height = height;

      const scale = this.settings.workSize / Math.max(width, height);
      const workWidth = Math.max(64, Math.round(width * scale));
      const workHeight = Math.max(64, Math.round(height * scale));
      this.workCanvas.width = workWidth;
      this.workCanvas.height = workHeight;
      this.referenceCanvas.width = workWidth;
      this.referenceCanvas.height = workHeight;

      this.frameBudget = await this.planFrameBudget(width, height);
      this.storageFull = false;
      this.scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await clearStaleFrames(this.scanId);
      await this.vision.reset('live');

      this.keyframes = [];
      this.cumulative = [];
      this.rejected = 0;
      this.drops = 0;
      this.lostStreak = 0;
      this.guidanceSmoother.reset('position', performance.now());
      this.sharpnessPeak = 0;
      this.lastAdvance = 0;
      this.liveTransform = null;
      this.stripScale = 1;
      this.stripDrawn = false;
      this.resetStrip();
      this.startedAt = Date.now();

      this.patch({
        phase: 'ready',
        guidance: 'position',
        cameraLabel: camera.label,
        captureWidth: width,
        captureHeight: height,
        torchSupported: camera.torchSupported,
        torchOn: false,
      });
    } catch (error) {
      const hint = (error as { hint?: string }).hint ?? null;
      this.patch({ phase: 'error', error: (error as Error).message, errorHint: hint });
      throw error;
    }
  }

  /**
   * Frames are held on disk, so the ceiling is whatever the origin's storage
   * quota can take — a safeguard against a very long scan filling the device.
   */
  private async planFrameBudget(width: number, height: number): Promise<number> {
    const configured = this.settings.maxFrames;
    try {
      const estimate = await estimateStorage();
      if (!estimate || !estimate.quota) return configured;
      // A JPEG of a photographic frame at this quality runs about 0.18 bytes
      // per pixel; use half of what is free so other data is not squeezed out.
      const perFrame = Math.max(60_000, width * height * 0.18);
      const affordable = Math.floor(((estimate.quota - estimate.usage) * 0.5) / perFrame);
      return Math.max(8, Math.min(configured, affordable));
    } catch {
      return configured;
    }
  }

  private waitForMetadata(): Promise<void> {
    if (this.video.readyState >= 2 && this.video.videoWidth) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        this.video.removeEventListener('loadedmetadata', done);
        resolve();
      };
      this.video.addEventListener('loadedmetadata', done);
    });
  }

  /** Begins automatic capture. The first probe becomes the first keyframe. */
  beginScanning(): void {
    if (this.state.phase !== 'ready') return;
    this.running = true;
    this.guidanceSmoother.reset('start-moving', performance.now());
    this.patch({ phase: 'scanning', guidance: 'start-moving' });
    this.scheduleProbe();
  }

  private scheduleProbe(): void {
    if (!this.running) return;
    const anyVideo = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    if (typeof anyVideo.requestVideoFrameCallback === 'function') {
      this.frameHandle = anyVideo.requestVideoFrameCallback(() => void this.onFrame());
    } else {
      this.timerHandle = window.setTimeout(() => void this.onFrame(), this.settings.probeInterval);
    }
  }

  private async onFrame(): Promise<void> {
    if (!this.running) return;
    const now = performance.now();
    if (this.busy || now - this.lastProbeAt < this.settings.probeInterval) {
      this.scheduleProbe();
      return;
    }
    this.lastProbeAt = now;
    this.busy = true;
    try {
      await this.probe(now);
    } catch (error) {
      this.patch({ error: (error as Error).message });
    } finally {
      this.busy = false;
      this.scheduleProbe();
    }
  }

  private drawWorkFrameFromVideo(): ImageData {
    const ctx = context2d(this.workCanvas);
    ctx.drawImage(this.video, 0, 0, this.workCanvas.width, this.workCanvas.height);
    return ctx.getImageData(0, 0, this.workCanvas.width, this.workCanvas.height);
  }

  private async probe(now: number): Promise<void> {
    if (!this.video.videoWidth) return;

    this.probeTimes.push(now);
    while (this.probeTimes.length > 12) this.probeTimes.shift();
    const span = this.probeTimes.length > 1 ? now - this.probeTimes[0] : 0;
    const probeHz = span > 0 ? ((this.probeTimes.length - 1) / span) * 1000 : 0;

    if (this.keyframes.length === 0) {
      await this.captureKeyframe();
      this.patch({ probeHz });
      return;
    }

    const report = await this.vision.align('live', this.drawWorkFrameFromVideo(), { commit: false });
    const workWidth = this.workCanvas.width;
    const sharpness = report.stats.sharpness;
    this.sharpnessPeak = Math.max(this.sharpnessPeak * 0.995, sharpness);
    const sharpnessRatio = this.sharpnessPeak > 0 ? sharpness / this.sharpnessPeak : 1;

    if (!report.alignment) {
      this.lostStreak++;
      this.drops++;
      // Keep the last known position for the ghost overlay through a short
      // dropout; only drop it once tracking is genuinely gone, so the overlay
      // does not strobe on every soft frame.
      if (this.lostStreak >= LOST_STREAK_LIMIT) this.liveTransform = null;
      this.patch({
        guidance: this.guidanceSmoother.update(
          decideGuidance({
            tracking: false,
            overlap: 0,
            sharpnessRatio,
            speed: this.state.speed,
            budgetReached: this.keyframes.length >= this.frameBudget || this.storageFull,
            lostStreak: this.lostStreak,
            minOverlap: this.settings.minOverlap,
          }),
          now,
        ),
        confidence: 0,
        matches: 0,
        inliers: 0,
        keypoints: report.stats.keypoints,
        sharpness,
        sharpnessRatio,
        drops: this.drops,
        workerMs: report.ms,
        probeHz,
      });
      return;
    }
    this.lostStreak = 0;

    this.liveTransform = report.alignment.transform;
    const advance = Math.hypot(report.alignment.transform.tx, report.alignment.transform.ty) / workWidth;
    const dt = this.lastAdvanceAt ? (now - this.lastAdvanceAt) / 1000 : 0;
    const speed = dt > 0.001 ? Math.abs(advance - this.lastAdvance) / dt : this.state.speed;
    this.lastAdvance = advance;
    this.lastAdvanceAt = now;

    const overlap = report.overlap;
    const blurry = sharpnessRatio < BLUR_RATIO;
    const budgetReached = this.keyframes.length >= this.frameBudget || this.storageFull;

    const guidance = this.guidanceSmoother.update(
      decideGuidance({
        tracking: true,
        overlap,
        sharpnessRatio,
        speed,
        budgetReached,
        lostStreak: 0,
        minOverlap: this.settings.minOverlap,
      }),
      now,
    );

    this.patch({
      guidance,
      overlap,
      sharpness,
      sharpnessRatio,
      speed,
      confidence: report.alignment.confidence,
      matches: report.alignment.matches,
      inliers: report.alignment.inliers,
      keypoints: report.stats.keypoints,
      workerMs: report.ms,
      probeHz,
      advance: this.totalAdvance(),
      coverage: this.keyframes.length / this.frameBudget,
    });

    const usable = !blurry && report.alignment.confidence > 0.28;
    const shouldCapture = overlap <= this.settings.targetOverlap && overlap >= this.settings.minOverlap * 0.72;
    if (!budgetReached && shouldCapture && usable && !this.capturing) {
      await this.captureKeyframe();
    } else if (shouldCapture && !usable) {
      this.rejected++;
      this.patch({ rejected: this.rejected });
    }
  }

  private totalAdvance(): number {
    if (this.keyframes.length < 2) return 0;
    const { workWidth, workHeight } = this.keyframes[0];
    const first = matApply(this.cumulative[0], workWidth / 2, workHeight / 2);
    const last = matApply(this.cumulative[this.cumulative.length - 1], workWidth / 2, workHeight / 2);
    return Math.hypot(last.x - first.x, last.y - first.y) / workWidth;
  }

  /**
   * Grabs the current video frame at full resolution, derives the alignment
   * image from that same pixel data, and stores the frame.
   */
  private async captureKeyframe(): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;
    try {
      const fullCtx = context2d(this.captureCanvas);
      fullCtx.drawImage(this.video, 0, 0, this.captureCanvas.width, this.captureCanvas.height);

      const workCtx = context2d(this.workCanvas);
      workCtx.drawImage(this.captureCanvas, 0, 0, this.workCanvas.width, this.workCanvas.height);
      const pixels = workCtx.getImageData(0, 0, this.workCanvas.width, this.workCanvas.height);

      const report = await this.vision.align('live', pixels, { commit: true });
      const isFirst = this.keyframes.length === 0;
      if (!isFirst && !report.alignment) {
        // The committed frame could not be tied to the previous one; drop it
        // and let the user recover rather than guessing a transform.
        this.rejected++;
        this.lostStreak++;
        await this.vision.reset('live');
        await this.recommitReference();
        this.patch({
          rejected: this.rejected,
          guidance: this.guidanceSmoother.update(
            this.lostStreak >= LOST_STREAK_LIMIT ? 'lost' : 'hold-steady',
            performance.now(),
          ),
        });
        return;
      }

      const index = this.keyframes.length;
      const record: KeyframeRecord = {
        index,
        toPrev: report.alignment?.transform ?? null,
        confidence: report.alignment?.confidence ?? 1,
        inliers: report.alignment?.inliers ?? 0,
        matches: report.alignment?.matches ?? 0,
        sharpness: report.stats.sharpness,
        luma: report.stats.luma,
        overlapLuma: report.overlapLumaMoving,
        prevOverlapLuma: report.overlapLumaReference,
        overlapWithPrev: isFirst ? 1 : report.overlap,
        fullWidth: this.captureCanvas.width,
        fullHeight: this.captureCanvas.height,
        workWidth: this.workCanvas.width,
        workHeight: this.workCanvas.height,
        capturedAt: Date.now(),
      };
      this.keyframes.push(record);
      this.cumulative.push(
        isFirst || !record.toPrev
          ? matIdentity()
          : matMul(this.cumulative[index - 1], record.toPrev),
      );

      // Keep a copy of the committed frame for the ghost overlay. It is copied
      // from the work canvas, because `pixels` was transferred to the worker
      // and its buffer is detached by now.
      context2d(this.referenceCanvas).drawImage(this.workCanvas, 0, 0);

      this.appendToStrip(index);
      this.persistFrame(index);

      this.patch({
        frames: this.keyframes.length,
        coverage: this.keyframes.length / this.frameBudget,
        advance: this.totalAdvance(),
        direction: this.detectDirection(),
      });
    } finally {
      this.capturing = false;
    }
  }

  /** Re-establishes the worker reference from the last good keyframe image. */
  private async recommitReference(): Promise<void> {
    const ctx = context2d(this.referenceCanvas);
    const pixels = ctx.getImageData(0, 0, this.referenceCanvas.width, this.referenceCanvas.height);
    await this.vision.align('live', pixels, { commit: true });
  }

  private persistFrame(index: number): void {
    this.pendingBlobs++;
    const width = this.captureCanvas.width;
    const height = this.captureCanvas.height;
    this.captureCanvas.toBlob(
      (blob) => {
        this.pendingBlobs--;
        if (!blob) return;
        putFrame({
          key: `${this.scanId}:${index}`,
          scanId: this.scanId,
          index,
          blob,
          width,
          height,
          capturedAt: Date.now(),
        }).catch(() => {
          // Out of quota: stop taking new frames rather than losing the scan.
          this.storageFull = true;
          this.patch({ guidance: 'budget' });
        });
      },
      'image/jpeg',
      this.settings.jpegQuality,
    );
  }

  private detectDirection(): 'horizontal' | 'vertical' | null {
    if (this.keyframes.length < 2) return null;
    const { workWidth, workHeight } = this.keyframes[0];
    const first = matApply(this.cumulative[0], workWidth / 2, workHeight / 2);
    const last = matApply(this.cumulative[this.cumulative.length - 1], workWidth / 2, workHeight / 2);
    return Math.abs(last.x - first.x) >= Math.abs(last.y - first.y) ? 'horizontal' : 'vertical';
  }

  private resetStrip(): void {
    const ctx = context2d(this.stripCanvas, true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.stripCanvas.width, this.stripCanvas.height);
    this.stripOrigin = { x: 24, y: STRIP_SHORT / 2 };
  }

  private stripTransform(cumulative: Mat23): Mat23 {
    const scale = this.stripScale;
    return {
      a: cumulative.a * scale,
      b: cumulative.b * scale,
      tx: cumulative.tx * scale + this.stripOrigin.x,
      c: cumulative.c * scale,
      d: cumulative.d * scale,
      ty: cumulative.ty * scale + this.stripOrigin.y,
    };
  }

  /** Draws the newest keyframe into the running low-resolution preview mosaic. */
  private appendToStrip(index: number): void {
    const record = this.keyframes[index];
    if (index === 0) {
      // Fit one frame into the strip's short edge, centred.
      this.stripScale = (STRIP_SHORT * 0.82) / record.workHeight;
      this.stripOrigin = { x: 24, y: (STRIP_SHORT - record.workHeight * this.stripScale) / 2 };
    }

    for (let guard = 0; guard < 4; guard++) {
      const m = this.stripTransform(this.cumulative[index]);
      const corners = [
        matApply(m, 0, 0),
        matApply(m, record.workWidth, 0),
        matApply(m, record.workWidth, record.workHeight),
        matApply(m, 0, record.workHeight),
      ];
      const overflow = corners.some(
        (p) => p.x < 0 || p.y < 0 || p.x > this.stripCanvas.width || p.y > this.stripCanvas.height,
      );
      if (!overflow) break;
      this.shrinkStrip();
    }

    const ctx = context2d(this.stripCanvas, true);
    const m = this.stripTransform(this.cumulative[index]);
    ctx.save();
    ctx.setTransform(m.a, m.c, m.b, m.d, m.tx, m.ty);
    ctx.drawImage(this.workCanvas, 0, 0);
    ctx.restore();
    this.stripDrawn = true;
  }

  /** Halves the preview scale so a long scan keeps fitting in a fixed canvas. */
  private shrinkStrip(): void {
    const copy = createCanvas(this.stripCanvas.width, this.stripCanvas.height);
    context2d(copy, true).drawImage(this.stripCanvas, 0, 0);
    const ctx = context2d(this.stripCanvas, true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.stripCanvas.width, this.stripCanvas.height);
    ctx.save();
    ctx.setTransform(0.5, 0, 0, 0.5, this.stripOrigin.x * 0.5, this.stripOrigin.y * 0.5);
    ctx.drawImage(copy, 0, 0);
    ctx.restore();
    this.stripScale *= 0.5;
    this.stripOrigin = { x: this.stripOrigin.x * 0.5, y: this.stripOrigin.y * 0.5 };
  }

  /**
   * Paints the running preview into a visible canvas: everything captured so
   * far, plus the live camera view sitting at its current position on the end
   * of the strip. This is the "[ scanned ][ live ]" view during a scan.
   */
  renderStripInto(target: HTMLCanvasElement): void {
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, target.width, target.height);
    const bounds = this.getStripBounds();
    if (!bounds) return;

    const last = this.cumulative[this.cumulative.length - 1];
    const live = this.liveTransform && last ? matMul(last, matInvert(this.liveTransform)) : null;
    const liveStrip = live ? this.stripTransform(live) : null;

    let minX = bounds.x;
    let minY = bounds.y;
    let maxX = bounds.x + bounds.width;
    let maxY = bounds.y + bounds.height;
    if (liveStrip) {
      for (const [x, y] of [
        [0, 0],
        [this.workCanvas.width, 0],
        [this.workCanvas.width, this.workCanvas.height],
        [0, this.workCanvas.height],
      ]) {
        const p = matApply(liveStrip, x, y);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }

    const pad = 6;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((target.width - pad * 2) / spanX, (target.height - pad * 2) / spanY);
    const offsetX = pad + (target.width - pad * 2 - spanX * scale) / 2 - minX * scale;
    const offsetY = pad + (target.height - pad * 2 - spanY * scale) / 2 - minY * scale;

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.drawImage(this.stripCanvas, 0, 0);
    if (liveStrip) {
      ctx.globalAlpha = 0.9;
      ctx.setTransform(
        liveStrip.a * scale,
        liveStrip.c * scale,
        liveStrip.b * scale,
        liveStrip.d * scale,
        liveStrip.tx * scale + offsetX,
        liveStrip.ty * scale + offsetY,
      );
      ctx.drawImage(this.workCanvas, 0, 0);
    }
    ctx.restore();

    if (liveStrip) {
      // Outline the live view so the boundary with captured material is clear.
      ctx.save();
      ctx.setTransform(
        liveStrip.a * scale,
        liveStrip.c * scale,
        liveStrip.b * scale,
        liveStrip.d * scale,
        liveStrip.tx * scale + offsetX,
        liveStrip.ty * scale + offsetY,
      );
      ctx.strokeStyle = 'rgba(34, 211, 154, 0.95)';
      ctx.lineWidth = 2 / scale;
      ctx.strokeRect(0, 0, this.workCanvas.width, this.workCanvas.height);
      ctx.restore();
    }
  }

  /**
   * Draws the last captured frame, ghosted, at the position it currently
   * occupies in the live view, so the user can see how much overlap is left.
   */
  drawGhost(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.liveTransform || !this.keyframes.length) return;
    const inverse = matInvert(this.liveTransform);
    const scale = canvas.width / this.referenceCanvas.width;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.setTransform(inverse.a, inverse.c, inverse.b, inverse.d, inverse.tx * scale, inverse.ty * scale);
    ctx.drawImage(this.referenceCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  async setTorch(on: boolean): Promise<void> {
    if (!this.camera) return;
    const ok = await setTorch(this.camera.track, on);
    if (ok) this.patch({ torchOn: on });
  }

  /** Stops sampling and returns the captured scan for stitching. */
  async finish(): Promise<ScanCapture> {
    this.running = false;
    this.cancelPending();
    this.patch({ phase: 'finishing', guidance: 'complete' });
    // Let the in-flight capture finish and outstanding JPEG encodes land before
    // the frame list is handed over.
    for (let waited = 0; (this.capturing || this.pendingBlobs > 0) && waited < 120; waited++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const first = this.keyframes[0];
    return {
      scanId: this.scanId,
      keyframes: this.keyframes,
      direction: this.detectDirection() ?? 'horizontal',
      cameraLabel: this.state.cameraLabel,
      fullWidth: first?.fullWidth ?? this.captureCanvas.width,
      fullHeight: first?.fullHeight ?? this.captureCanvas.height,
      workWidth: first?.workWidth ?? this.workCanvas.width,
      workHeight: first?.workHeight ?? this.workCanvas.height,
      rejectedFrames: this.rejected,
      startedAt: this.startedAt,
      endedAt: Date.now(),
    };
  }

  private cancelPending(): void {
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.frameHandle !== null) {
      const anyVideo = this.video as HTMLVideoElement & { cancelVideoFrameCallback?: (handle: number) => void };
      anyVideo.cancelVideoFrameCallback?.(this.frameHandle);
      this.frameHandle = null;
    }
  }

  /** Releases the camera but keeps captured frames for stitching. */
  releaseCamera(): void {
    this.running = false;
    this.cancelPending();
    stopCamera(this.camera);
    this.camera = null;
    this.video.srcObject = null;
  }

  /** Full teardown, including deleting the temporary frames. */
  async dispose(discardFrames: boolean): Promise<void> {
    this.releaseCamera();
    if (discardFrames && this.scanId) await clearScanFrames(this.scanId);
    this.vision.dispose();
    this.listeners.clear();
  }

  guidanceText(): string {
    return GUIDANCE_TEXT[this.state.guidance];
  }
}
