import { matApply, matIdentity, matInvert, matMul } from '../vision/mat';
import type { Mat23 } from '../vision/types';
import type { Point } from '../measure/measurements';
import type { Rect } from '../stitch/render';

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Rotation about the centre of the mosaic. Straightening is expressed here
 * rather than baked into the pixels, so measurements stay anchored to the
 * original mosaic coordinates no matter how the user turns the image.
 */
export function rotationMatrix(width: number, height: number, angle: number): Mat23 {
  if (!angle) return matIdentity();
  const cx = width / 2;
  const cy = height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    a: cos,
    b: -sin,
    tx: cx - (cos * cx - sin * cy),
    c: sin,
    d: cos,
    ty: cy - (sin * cx + cos * cy),
  };
}

/** Bounding box of the whole mosaic once rotated. */
export function rotatedBounds(width: number, height: number, angle: number): Rect {
  const m = rotationMatrix(width, height, angle);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]) {
    const p = matApply(m, x, y);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Full image-pixels to screen-pixels transform. */
export function viewMatrix(
  mosaicWidth: number,
  mosaicHeight: number,
  angle: number,
  crop: Rect,
  view: ViewState,
  viewportWidth: number,
  viewportHeight: number,
): Mat23 {
  const rotate = rotationMatrix(mosaicWidth, mosaicHeight, angle);
  const cropCentreX = crop.x + crop.width / 2;
  const cropCentreY = crop.y + crop.height / 2;
  const place: Mat23 = {
    a: view.zoom,
    b: 0,
    tx: viewportWidth / 2 + view.panX - cropCentreX * view.zoom,
    c: 0,
    d: view.zoom,
    ty: viewportHeight / 2 + view.panY - cropCentreY * view.zoom,
  };
  return matMul(place, rotate);
}

export function screenToImage(matrix: Mat23, x: number, y: number): Point {
  return matApply(matInvert(matrix), x, y);
}

export function fitZoom(crop: Rect, viewportWidth: number, viewportHeight: number): number {
  if (crop.width <= 0 || crop.height <= 0) return 1;
  return Math.min(viewportWidth / crop.width, viewportHeight / crop.height) * 0.92;
}

export function clampRect(rect: Rect, bounds: Rect, minSize = 32): Rect {
  const width = Math.max(minSize, Math.min(rect.width, bounds.width));
  const height = Math.max(minSize, Math.min(rect.height, bounds.height));
  return {
    x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - width),
    y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - height),
    width,
    height,
  };
}

/** Maps a rect from unrotated image space into rotated space. */
export function rectToRotated(rect: Rect, mosaicWidth: number, mosaicHeight: number, angle: number): Rect {
  const m = rotationMatrix(mosaicWidth, mosaicHeight, angle);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ]) {
    const p = matApply(m, x, y);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
