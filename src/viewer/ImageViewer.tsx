import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { matApply } from '../vision/mat';
import type { Rect } from '../stitch/render';
import type { Calibration, LabelledMeasurement, Point, Unit } from '../measure/measurements';
import { formatLength, pixelDistance, toCm } from '../measure/measurements';
import { dimensionStyle, drawCrosshair, drawDimension, drawHandle } from './annotations';
import { clampRect, fitZoom, rotatedBounds, screenToImage, viewMatrix, type ViewState } from './geometry';

export type ViewerMode = 'view' | 'measure' | 'calibrate' | 'crop';

export interface ViewerHandle {
  fit: () => void;
}

interface Props {
  mosaic: HTMLCanvasElement;
  angle: number;
  crop: Rect;
  mode: ViewerMode;
  measurements: LabelledMeasurement[];
  calibration: Calibration | null;
  pending: Point[];
  unit: Unit;
  selectedId: string | null;
  onCropChange: (rect: Rect) => void;
  onPlacePoint: (point: Point) => void;
  onMoveEndpoint: (id: string, endpoint: 'a' | 'b', point: Point) => void;
  onSelect: (id: string | null) => void;
  handleRef?: RefObject<ViewerHandle | null>;
}

type Drag =
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | { kind: 'crop'; corner: number; start: Rect }
  | { kind: 'endpoint'; id: string; endpoint: 'a' | 'b' }
  | null;

const HANDLE_RADIUS = 11;
const TAP_SLOP = 9;

export default function ImageViewer({
  mosaic,
  angle,
  crop,
  mode,
  measurements,
  calibration,
  pending,
  unit,
  selectedId,
  onCropChange,
  onPlacePoint,
  onMoveEndpoint,
  onSelect,
  handleRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const [size, setSize] = useState({ width: 1, height: 1, dpr: 1 });
  const dragRef = useRef<Drag>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const downRef = useRef<{ x: number; y: number; time: number; moved: boolean } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const cropRef = useRef(crop);
  cropRef.current = crop;

  const bounds = rotatedBounds(mosaic.width, mosaic.height, angle);

  /**
   * A downscaled copy of the mosaic. Repainting a 100-megapixel canvas on every
   * pan frame is far too slow on a phone, so the preview is used until the user
   * zooms in past its resolution.
   */
  const preview = useMemo(() => {
    const longest = Math.max(mosaic.width, mosaic.height);
    const scale = Math.min(1, 2600 / longest);
    if (scale >= 1) return { canvas: mosaic, scale: 1 };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(mosaic.width * scale));
    canvas.height = Math.max(1, Math.round(mosaic.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { canvas: mosaic, scale: 1 };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mosaic, 0, 0, canvas.width, canvas.height);
    return { canvas, scale: canvas.width / mosaic.width };
  }, [mosaic]);

  /* --- sizing --------------------------------------------------------- */
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        dpr: Math.min(3, window.devicePixelRatio || 1),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    setView({ zoom: fitZoom(cropRef.current, size.width, size.height), panX: 0, panY: 0 });
  }, [size.width, size.height]);

  useImperativeHandle(
    handleRef,
    () => ({ fit }),
    [fit],
  );

  const clampZoom = (zoom: number) => {
    const base = fitZoom(cropRef.current, size.width, size.height);
    return Math.min(Math.max(zoom, base * 0.35), Math.max(base * 40, 16));
  };
  const clampZoomRef = useRef(clampZoom);
  clampZoomRef.current = clampZoom;

  // Re-fit whenever the frame the user is looking at changes shape.
  useEffect(() => {
    setView({ zoom: fitZoom(crop, size.width, size.height), panX: 0, panY: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, angle, mosaic]);

  // Wheel zoom for desktop review. React attaches wheel handlers passively, so
  // this one is registered directly to be able to cancel the page scroll.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((current) => ({
        ...current,
        zoom: clampZoomRef.current(current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)),
      }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  /* --- rendering ------------------------------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.round(size.width * size.dpr);
    const height = Math.round(size.height * size.dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.scale(size.dpr, size.dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const matrix = viewMatrix(mosaic.width, mosaic.height, angle, crop, view, size.width, size.height);
    const toScreen = (p: Point) => matApply(matrix, p.x, p.y);

    ctx.save();
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.transform(matrix.a, matrix.c, matrix.b, matrix.d, matrix.tx, matrix.ty);
    const usePreview = preview.scale < 1 && view.zoom <= preview.scale * 1.05;
    if (usePreview) {
      ctx.scale(1 / preview.scale, 1 / preview.scale);
      ctx.drawImage(preview.canvas, 0, 0);
    } else {
      ctx.drawImage(mosaic, 0, 0);
    }
    ctx.restore();

    // Everything below is drawn in screen space.
    const cropCorners = cropQuad(crop, matrix, mosaic, angle);

    if (mode === 'crop') {
      ctx.save();
      ctx.fillStyle = 'rgba(12,16,21,0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, size.width, size.height);
      ctx.moveTo(cropCorners[0].x, cropCorners[0].y);
      for (let i = cropCorners.length - 1; i > 0; i--) ctx.lineTo(cropCorners[i].x, cropCorners[i].y);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cropCorners[0].x, cropCorners[0].y);
      for (let i = 1; i < cropCorners.length; i++) ctx.lineTo(cropCorners[i].x, cropCorners[i].y);
      ctx.closePath();
      ctx.stroke();
      for (const corner of cropCorners) drawHandle(ctx, corner, HANDLE_RADIUS, false);
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(12,16,21,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cropCorners[0].x, cropCorners[0].y);
      for (let i = 1; i < cropCorners.length; i++) ctx.lineTo(cropCorners[i].x, cropCorners[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    const style = dimensionStyle(1);
    for (const measurement of measurements) {
      const a = toScreen(measurement.a);
      const b = toScreen(measurement.b);
      const active = measurement.id === selectedId;
      drawDimension(ctx, a, b, measurement.label, {
        ...style,
        color: active ? '#1f5eff' : style.color,
        lineWidth: active ? style.lineWidth * 1.4 : style.lineWidth,
      });
      if ((mode === 'measure' || mode === 'calibrate') && active) {
        drawHandle(ctx, a, HANDLE_RADIUS, true);
        drawHandle(ctx, b, HANDLE_RADIUS, true);
      }
    }

    if (calibration && (mode === 'calibrate' || mode === 'measure')) {
      const a = toScreen(calibration.a);
      const b = toScreen(calibration.b);
      drawDimension(ctx, a, b, `${formatLength(calibration.referenceCm, 'cm')} · reference`, {
        ...dimensionStyle(1, '#0a8f65'),
      });
    }

    if (pending.length) {
      const first = toScreen(pending[0]);
      drawCrosshair(ctx, first, 16);
      if (pending.length > 1) {
        const second = toScreen(pending[1]);
        const label = calibration
          ? formatLength(toCm(pixelDistance(pending[0], pending[1]), calibration), unit)
          : `${Math.round(pixelDistance(pending[0], pending[1]))} px`;
        drawDimension(ctx, first, second, label, dimensionStyle(1, '#1f5eff'));
      }
    }
  }, [mosaic, preview, angle, crop, view, size, mode, measurements, calibration, pending, unit, selectedId]);

  /* --- interaction ----------------------------------------------------- */
  const matrixNow = () =>
    viewMatrix(mosaic.width, mosaic.height, angle, cropRef.current, viewRef.current, size.width, size.height);

  const localPoint = (event: React.PointerEvent): Point => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const local = localPoint(event);
    pointersRef.current.set(event.pointerId, local);
    downRef.current = { x: local.x, y: local.y, time: Date.now(), moved: false };

    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.hypot(p2.x - p1.x, p2.y - p1.y), zoom: viewRef.current.zoom };
      dragRef.current = null;
      return;
    }

    const matrix = matrixNow();
    if (mode === 'crop') {
      const corners = cropQuad(cropRef.current, matrix, mosaic, angle);
      for (let i = 0; i < corners.length; i++) {
        if (Math.hypot(corners[i].x - local.x, corners[i].y - local.y) <= HANDLE_RADIUS * 2) {
          dragRef.current = { kind: 'crop', corner: i, start: { ...cropRef.current } };
          return;
        }
      }
    }
    if (mode === 'measure' || mode === 'calibrate') {
      for (const measurement of measurements) {
        for (const endpoint of ['a', 'b'] as const) {
          const screen = matApply(matrix, measurement[endpoint].x, measurement[endpoint].y);
          if (Math.hypot(screen.x - local.x, screen.y - local.y) <= HANDLE_RADIUS * 2) {
            onSelect(measurement.id);
            dragRef.current = { kind: 'endpoint', id: measurement.id, endpoint };
            return;
          }
        }
      }
    }
    dragRef.current = {
      kind: 'pan',
      startX: local.x,
      startY: local.y,
      panX: viewRef.current.panX,
      panY: viewRef.current.panY,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const local = localPoint(event);
    pointersRef.current.set(event.pointerId, local);
    const down = downRef.current;
    if (down && Math.hypot(local.x - down.x, local.y - down.y) > TAP_SLOP) down.moved = true;

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const ratio = distance / Math.max(1, pinchRef.current.distance);
      setView((current) => ({ ...current, zoom: clampZoom(pinchRef.current!.zoom * ratio) }));
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'pan') {
      setView((current) => ({
        ...current,
        panX: drag.panX + (local.x - drag.startX),
        panY: drag.panY + (local.y - drag.startY),
      }));
      return;
    }
    const matrix = matrixNow();
    const imagePoint = screenToImage(matrix, local.x, local.y);
    if (drag.kind === 'endpoint') {
      onMoveEndpoint(drag.id, drag.endpoint, imagePoint);
      return;
    }
    if (drag.kind === 'crop') {
      const rotated = toRotated(imagePoint, mosaic, angle);
      const start = drag.start;
      const x0 = drag.corner === 0 || drag.corner === 3 ? rotated.x : start.x;
      const y0 = drag.corner === 0 || drag.corner === 1 ? rotated.y : start.y;
      const x1 = drag.corner === 1 || drag.corner === 2 ? rotated.x : start.x + start.width;
      const y1 = drag.corner === 2 || drag.corner === 3 ? rotated.y : start.y + start.height;
      onCropChange(
        clampRect(
          { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) },
          bounds,
        ),
      );
    }
  };

  const endPointer = (event: React.PointerEvent) => {
    const local = localPoint(event);
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const down = downRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    downRef.current = null;
    if (!down || down.moved || Date.now() - down.time > 600) return;
    if (drag && drag.kind !== 'pan') return;
    if (mode === 'measure' || mode === 'calibrate') {
      onPlacePoint(screenToImage(matrixNow(), local.x, local.y));
    } else if (mode === 'view') {
      onSelect(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/** Screen-space quad of the crop rectangle (which lives in rotated space). */
function cropQuad(
  crop: Rect,
  matrix: import('../vision/types').Mat23,
  mosaic: HTMLCanvasElement,
  angle: number,
): Point[] {
  const corners: Point[] = [
    { x: crop.x, y: crop.y },
    { x: crop.x + crop.width, y: crop.y },
    { x: crop.x + crop.width, y: crop.y + crop.height },
    { x: crop.x, y: crop.y + crop.height },
  ];
  return corners.map((corner) => {
    const image = fromRotated(corner, mosaic, angle);
    return matApply(matrix, image.x, image.y);
  });
}

function toRotated(point: Point, mosaic: HTMLCanvasElement, angle: number): Point {
  const cx = mosaic.width / 2;
  const cy = mosaic.height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - cx;
  const dy = point.y - cy;
  return { x: cx + cos * dx - sin * dy, y: cy + sin * dx + cos * dy };
}

function fromRotated(point: Point, mosaic: HTMLCanvasElement, angle: number): Point {
  return toRotated(point, mosaic, -angle);
}
