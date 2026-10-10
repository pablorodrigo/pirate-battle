export type Rect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type Point = {
  readonly x: number
  readonly y: number
}

const EPSILON = 1e-9

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

/** Wraps an angle into (-π, π]. */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % (Math.PI * 2)
  if (wrapped > Math.PI) {
    return wrapped - Math.PI * 2
  }
  if (wrapped <= -Math.PI) {
    return wrapped + Math.PI * 2
  }
  return wrapped
}

/** Signed shortest rotation that turns `from` into `to`. */
export function angleDifference(from: number, to: number): number {
  return normalizeAngle(to - from)
}

export function expandRect(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2,
  }
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

/**
 * Pushes a circle out of a rectangle along the shortest direction. Returns the
 * corrected center, or null when they do not overlap. Moving the circle along
 * the push direction only, and never along the edge, is what makes ships slide.
 */
export function resolveCircleRect(x: number, y: number, radius: number, rect: Rect): Point | null {
  const nearestX = clamp(x, rect.x, rect.x + rect.width)
  const nearestY = clamp(y, rect.y, rect.y + rect.height)
  const dx = x - nearestX
  const dy = y - nearestY
  const distanceSq = dx * dx + dy * dy
  if (distanceSq >= radius * radius) {
    return null
  }
  if (distanceSq > EPSILON) {
    const distance = Math.sqrt(distanceSq)
    const push = radius - distance
    return { x: x + (dx / distance) * push, y: y + (dy / distance) * push }
  }

  // The center is inside the rectangle: leave through the nearest edge.
  const toLeft = x - rect.x
  const toRight = rect.x + rect.width - x
  const toTop = y - rect.y
  const toBottom = rect.y + rect.height - y
  const nearest = Math.min(toLeft, toRight, toTop, toBottom)
  if (nearest === toLeft) {
    return { x: rect.x - radius, y }
  }
  if (nearest === toRight) {
    return { x: rect.x + rect.width + radius, y }
  }
  if (nearest === toTop) {
    return { x, y: rect.y - radius }
  }
  return { x, y: rect.y + rect.height + radius }
}

/**
 * Returns the fraction of the segment (0..1) at which it enters the rectangle,
 * 0 when it starts inside, or null when it misses.
 */
export function segmentRectEntry(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rect: Rect,
): number | null {
  let enter = 0
  let exit = 1
  const axes = [
    [x0, x1 - x0, rect.x, rect.x + rect.width],
    [y0, y1 - y0, rect.y, rect.y + rect.height],
  ] as const
  for (const [start, delta, min, max] of axes) {
    if (Math.abs(delta) < EPSILON) {
      if (start < min || start > max) {
        return null
      }
      continue
    }
    const t1 = (min - start) / delta
    const t2 = (max - start) / delta
    enter = Math.max(enter, Math.min(t1, t2))
    exit = Math.min(exit, Math.max(t1, t2))
    if (enter > exit) {
      return null
    }
  }
  return enter
}

/**
 * First time t in [0, 1] at which two moving circles touch, given their
 * relative position (px, py) at t = 0 and relative displacement (dx, dy)
 * over the step. Returns 0 if they already overlap and null if they never
 * touch during the step.
 */
export function circlesTimeOfImpact(
  px: number,
  py: number,
  dx: number,
  dy: number,
  radiusSum: number,
): number | null {
  const c = px * px + py * py - radiusSum * radiusSum
  if (c <= 0) {
    return 0
  }
  const a = dx * dx + dy * dy
  const b = 2 * (px * dx + py * dy)
  if (a < EPSILON || b >= 0) {
    return null
  }
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    return null
  }
  const t = (-b - Math.sqrt(discriminant)) / (2 * a)
  return t <= 1 ? t : null
}
