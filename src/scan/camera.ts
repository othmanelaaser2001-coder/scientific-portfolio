/** Rear-camera access with a preference for the highest practical resolution. */

export interface CameraHandle {
  stream: MediaStream;
  track: MediaStreamTrack;
  width: number;
  height: number;
  label: string;
  torchSupported: boolean;
}

/** Resolutions to try, best first. The browser picks the closest it can serve. */
const RESOLUTION_LADDER: Array<{ width: number; height: number }> = [
  { width: 3840, height: 2160 },
  { width: 2560, height: 1440 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

export class CameraError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.name = 'CameraError';
    this.hint = hint;
  }
}

function describeError(error: unknown): CameraError {
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new CameraError(
      'Camera access was blocked',
      'Allow camera access for this site in your browser settings, then try again.',
    );
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new CameraError('No usable camera found', 'This device does not expose a rear camera to the browser.');
  }
  if (name === 'NotReadableError') {
    return new CameraError('The camera is busy', 'Close other apps or tabs that are using the camera, then try again.');
  }
  if (!window.isSecureContext) {
    return new CameraError('Camera needs a secure connection', 'Open this app over HTTPS or on localhost.');
  }
  return new CameraError('Could not start the camera', String((error as Error)?.message ?? error));
}

export async function startCamera(): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('Camera capture is not supported', 'This browser does not implement getUserMedia.');
  }

  let lastError: unknown;
  for (const resolution of RESOLUTION_LADDER) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: resolution.width },
          height: { ideal: resolution.height },
          frameRate: { ideal: 30 },
        },
      });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
      await tuneForScanning(track);
      return {
        stream,
        track,
        width: settings.width ?? resolution.width,
        height: settings.height ?? resolution.height,
        label: track.label || 'Rear camera',
        torchSupported: 'torch' in capabilities,
      };
    } catch (error) {
      lastError = error;
      const name = (error as { name?: string })?.name;
      // A permission or hardware failure will not be fixed by a lower request.
      if (name === 'NotAllowedError' || name === 'NotFoundError' || name === 'SecurityError') break;
    }
  }
  throw describeError(lastError);
}

/** Best-effort continuous autofocus/exposure; ignored where unsupported. */
async function tuneForScanning(track: MediaStreamTrack): Promise<void> {
  if (typeof track.getCapabilities !== 'function') return;
  const capabilities = track.getCapabilities() as Record<string, unknown>;
  const advanced: Record<string, unknown>[] = [];
  const wants = (key: string, value: string) => {
    const modes = capabilities[key];
    if (Array.isArray(modes) && modes.includes(value)) advanced.push({ [key]: value });
  };
  wants('focusMode', 'continuous');
  wants('exposureMode', 'continuous');
  wants('whiteBalanceMode', 'continuous');
  if (!advanced.length) return;
  try {
    await track.applyConstraints({ advanced } as MediaTrackConstraints);
  } catch {
    // Constraint tuning is optional; scanning still works without it.
  }
}

export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] } as unknown as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}

export function stopCamera(handle: CameraHandle | null): void {
  handle?.stream.getTracks().forEach((track) => track.stop());
}
