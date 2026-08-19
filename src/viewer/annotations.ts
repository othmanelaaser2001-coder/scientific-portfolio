import type { Point } from '../measure/measurements';

export interface DimensionStyle {
  color: string;
  lineWidth: number;
  arrowSize: number;
  tickSize: number;
  fontSize: number;
  plate: string;
  plateBorder: string;
  textColor: string;
}

export function dimensionStyle(scale: number, color = '#d8322b'): DimensionStyle {
  return {
    color,
    lineWidth: Math.max(1, 1.6 * scale),
    arrowSize: Math.max(6, 9 * scale),
    tickSize: Math.max(7, 11 * scale),
    fontSize: Math.max(11, 13 * scale),
    plate: 'rgba(255,255,255,0.94)',
    plateBorder: 'rgba(12,16,21,0.16)',
    textColor: '#0c1015',
  };
}

/** `roundRect` only landed in Safari 16.4, so fall back to arcs when missing. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function arrowHead(ctx: CanvasRenderingContext2D, at: Point, angle: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.lineTo(at.x + Math.cos(angle - 0.38) * size, at.y + Math.sin(angle - 0.38) * size);
  ctx.lineTo(at.x + Math.cos(angle + 0.38) * size, at.y + Math.sin(angle + 0.38) * size);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws a dimension line in the style of a technical drawing: extension ticks
 * at both ends, arrowheads pointing outwards, and the value on a small plate in
 * the middle, always readable right way up.
 */
export function drawDimension(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  text: string,
  style: DimensionStyle,
): void {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) return;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);

  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineWidth = style.lineWidth;

  // Extension ticks perpendicular to the measurement.
  for (const p of [a, b]) {
    ctx.beginPath();
    ctx.moveTo(p.x - nx * style.tickSize, p.y - ny * style.tickSize);
    ctx.lineTo(p.x + nx * style.tickSize, p.y + ny * style.tickSize);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  if (length > style.arrowSize * 3) {
    arrowHead(ctx, a, angle + Math.PI, style.arrowSize);
    arrowHead(ctx, b, angle, style.arrowSize);
  }

  // Label plate, rotated with the line but never upside-down.
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let labelAngle = angle;
  if (labelAngle > Math.PI / 2 || labelAngle < -Math.PI / 2) labelAngle += Math.PI;
  ctx.translate(mid.x, mid.y);
  ctx.rotate(labelAngle);
  ctx.font = `600 ${style.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const padX = style.fontSize * 0.55;
  const padY = style.fontSize * 0.36;
  const width = ctx.measureText(text).width + padX * 2;
  const height = style.fontSize + padY * 2;
  const radius = Math.min(height / 2, style.fontSize * 0.5);
  roundedRect(ctx, -width / 2, -height / 2, width, height, radius);
  ctx.fillStyle = style.plate;
  ctx.fill();
  ctx.lineWidth = Math.max(0.75, style.lineWidth * 0.6);
  ctx.strokeStyle = style.plateBorder;
  ctx.stroke();
  ctx.fillStyle = style.textColor;
  ctx.fillText(text, 0, height * 0.02);
  ctx.restore();
}

/** Small draggable handle drawn at a measurement endpoint. */
export function drawHandle(ctx: CanvasRenderingContext2D, p: Point, radius: number, active: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#1f5eff' : 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? '#ffffff' : '#1f5eff';
  ctx.stroke();
  ctx.restore();
}

/** Crosshair shown while the user is placing a point. */
export function drawCrosshair(ctx: CanvasRenderingContext2D, p: Point, size: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(31,94,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - size, p.y);
  ctx.lineTo(p.x + size, p.y);
  ctx.moveTo(p.x, p.y - size);
  ctx.lineTo(p.x, p.y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
