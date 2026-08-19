import type { Mat23 } from './types';
import { matApply } from './mat';

type Point = { x: number; y: number };

function clipPolygon(poly: Point[], inside: (p: Point) => boolean, intersect: (a: Point, b: Point) => Point): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

function polygonArea(poly: Point[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Warps the rectangle [0,w]x[0,h] by `m` and returns its four corners. */
function warpedCorners(m: Mat23, w: number, h: number): Point[] {
  return [
    matApply(m, 0, 0),
    matApply(m, w, 0),
    matApply(m, w, h),
    matApply(m, 0, h),
  ];
}

/**
 * Fraction of a frame that still lies inside the reference frame after warping.
 * 1 means the frames coincide, 0 means they no longer share any area.
 */
export function overlapRatio(m: Mat23, w: number, h: number): number {
  let poly = warpedCorners(m, w, h);
  const edges: Array<[(p: Point) => boolean, (a: Point, b: Point) => Point]> = [
    [(p) => p.x >= 0, (a, b) => ({ x: 0, y: a.y + ((b.y - a.y) * (0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= w, (a, b) => ({ x: w, y: a.y + ((b.y - a.y) * (w - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= 0, (a, b) => ({ x: a.x + ((b.x - a.x) * (0 - a.y)) / (b.y - a.y), y: 0 })],
    [(p) => p.y <= h, (a, b) => ({ x: a.x + ((b.x - a.x) * (h - a.y)) / (b.y - a.y), y: h })],
  ];
  for (const [inside, intersect] of edges) {
    poly = clipPolygon(poly, inside, intersect);
    if (poly.length === 0) return 0;
  }
  return Math.min(1, polygonArea(poly) / (w * h));
}
