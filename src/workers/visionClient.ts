import type { AlignReport, Slot, VisionRequest, VisionResponse } from './protocol';

/**
 * Promise-based wrapper around the vision worker. Requests are matched by id so
 * the live loop and the refinement pass can share one worker safely.
 */
export class VisionClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (report: AlignReport) => void; reject: (error: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<VisionResponse>) => {
      const message = event.data;
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.type === 'ok') entry.resolve(message.report);
      else if (message.type === 'error') entry.reject(new Error(message.message));
      else entry.resolve(null as unknown as AlignReport);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Vision worker failed');
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
    };
  }

  private send(request: VisionRequest, transfer: Transferable[] = []): Promise<AlignReport> {
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      this.worker.postMessage(request, transfer);
    });
  }

  /** Aligns `pixels` against the slot's current reference frame. */
  align(
    slot: Slot,
    pixels: ImageData,
    options: { commit: boolean; precise?: boolean },
  ): Promise<AlignReport> {
    const buffer = pixels.data.buffer as ArrayBuffer;
    return this.send(
      {
        id: this.nextId++,
        type: 'align',
        slot,
        commit: options.commit,
        precise: options.precise,
        frame: { width: pixels.width, height: pixels.height, data: buffer },
      },
      [buffer],
    );
  }

  reset(slot: Slot): Promise<void> {
    return this.send({ id: this.nextId++, type: 'reset', slot }).then(() => undefined);
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
