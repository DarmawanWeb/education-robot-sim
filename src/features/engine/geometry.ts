import type { Box, LinePath, Mover, Vec } from './types';

export function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPath(p: Vec, path: LinePath): number {
  const { points } = path;
  let best = Infinity;
  const count = path.closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) {
    const a = points[index] as Vec;
    const b = points[(index + 1) % points.length] as Vec;
    best = Math.min(best, distanceToSegment(p, a, b));
  }
  return best;
}

export function circleHitsBox(center: Vec, radius: number, box: Box): boolean {
  const nearestX = Math.max(box.x, Math.min(center.x, box.x + box.w));
  const nearestY = Math.max(box.y, Math.min(center.y, box.y + box.h));
  return Math.hypot(center.x - nearestX, center.y - nearestY) < radius;
}

export function pointInBox(p: Vec, box: Box): boolean {
  return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
}

/** Distance along a ray to an axis-aligned box (slab method), or Infinity. */
export function rayToBox(origin: Vec, angle: number, box: Box): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let tMin = -Infinity;
  let tMax = Infinity;
  const axes: ReadonlyArray<readonly [number, number, number, number]> = [
    [origin.x, dx, box.x, box.x + box.w],
    [origin.y, dy, box.y, box.y + box.h],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return Infinity;
    } else {
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    }
  }
  if (tMax < Math.max(tMin, 0)) return Infinity;
  return tMin >= 0 ? tMin : 0;
}

/** Distance along a ray to the arena walls (the inside of a rectangle). */
export function rayToWalls(origin: Vec, angle: number, width: number, height: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx > 1e-12 ? (width - origin.x) / dx : dx < -1e-12 ? -origin.x / dx : Infinity;
  const ty = dy > 1e-12 ? (height - origin.y) / dy : dy < -1e-12 ? -origin.y / dy : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/** Points along an arc, angles in radians, clockwise on screen when end > start. */
export function arc(center: Vec, radius: number, start: number, end: number, steps: number): Vec[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = start + ((end - start) * index) / steps;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
}

/** Where a mover is at `time`, moving in straight lines between its keys. */
export function moverBox(mover: Mover, time: number): Box {
  const { keys } = mover;
  const first = keys[0];
  if (!first) return { x: 0, y: 0, w: 0, h: 0 };
  let at = { x: first.x, y: first.y };
  for (let index = 1; index < keys.length; index += 1) {
    const from = keys[index - 1] as Mover['keys'][number];
    const to = keys[index] as Mover['keys'][number];
    if (time >= to.t) {
      at = { x: to.x, y: to.y };
      continue;
    }
    if (time > from.t) {
      const progress = (time - from.t) / (to.t - from.t);
      at = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
    }
    break;
  }
  return { ...at, w: mover.w, h: mover.h };
}

/** Closed rounded-rectangle track. */
export function roundedTrack(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  width: number,
): LinePath {
  const q = Math.PI / 2;
  const points = [
    ...arc({ x: x + w - r, y: y + r }, r, -q, 0, 6),
    ...arc({ x: x + w - r, y: y + h - r }, r, 0, q, 6),
    ...arc({ x: x + r, y: y + h - r }, r, q, 2 * q, 6),
    ...arc({ x: x + r, y: y + r }, r, 2 * q, 3 * q, 6),
  ];
  return { points, closed: true, width };
}
