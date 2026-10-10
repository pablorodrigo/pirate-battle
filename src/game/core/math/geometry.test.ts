import { describe, expect, it } from 'vitest'
import {
  angleDifference,
  circlesTimeOfImpact,
  normalizeAngle,
  resolveCircleRect,
  segmentRectEntry,
  type Rect,
} from './geometry.ts'

const island: Rect = { x: 100, y: 100, width: 100, height: 50 }

describe('normalizeAngle and angleDifference', () => {
  it('wraps angles into (-π, π]', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI)
    expect(normalizeAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2)
    expect(normalizeAngle(0)).toBe(0)
  })

  it('returns the shortest signed rotation', () => {
    expect(angleDifference(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(angleDifference(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2)
  })
})

describe('resolveCircleRect', () => {
  it('ignores circles that do not overlap or only touch the edge', () => {
    expect(resolveCircleRect(50, 125, 20, island)).toBeNull()
    expect(resolveCircleRect(80, 125, 20, island)).toBeNull()
  })

  it('pushes an overlapping circle out along the edge normal, keeping the tangential position', () => {
    expect(resolveCircleRect(90, 120, 20, island)).toEqual({ x: 80, y: 120 })
    expect(resolveCircleRect(150, 160, 20, island)).toEqual({ x: 150, y: 170 })
  })

  it('pushes a circle overlapping a corner away from that corner', () => {
    const corrected = resolveCircleRect(95, 95, 10, island)
    expect(corrected).not.toBeNull()
    const distance = Math.hypot((corrected?.x ?? 0) - 100, (corrected?.y ?? 0) - 100)
    expect(distance).toBeCloseTo(10)
  })

  it('moves a center that ended inside the rectangle through the nearest edge', () => {
    expect(resolveCircleRect(105, 125, 20, island)).toEqual({ x: 80, y: 125 })
    expect(resolveCircleRect(150, 145, 20, island)).toEqual({ x: 150, y: 170 })
  })
})

describe('segmentRectEntry', () => {
  it('returns the entry fraction of a crossing segment', () => {
    expect(segmentRectEntry(0, 125, 200, 125, island)).toBeCloseTo(0.5)
  })

  it('detects a segment that passes through the rectangle between its endpoints', () => {
    expect(segmentRectEntry(90, 90, 210, 160, island)).not.toBeNull()
  })

  it('returns 0 when the segment starts inside and null when it misses', () => {
    expect(segmentRectEntry(150, 125, 400, 125, island)).toBe(0)
    expect(segmentRectEntry(0, 0, 400, 0, island)).toBeNull()
    expect(segmentRectEntry(0, 125, 90, 125, island)).toBeNull()
  })
})

describe('circlesTimeOfImpact', () => {
  it('finds when a projectile reaches a static circle', () => {
    expect(circlesTimeOfImpact(-30, 0, 40, 0, 10)).toBeCloseTo(0.5)
  })

  it('returns 0 for circles that already overlap', () => {
    expect(circlesTimeOfImpact(5, 0, 1, 0, 10)).toBe(0)
  })

  it('returns null when the circles move apart, miss, or meet after the step', () => {
    expect(circlesTimeOfImpact(-30, 0, -10, 0, 10)).toBeNull()
    expect(circlesTimeOfImpact(-30, 20, 60, 0, 10)).toBeNull()
    expect(circlesTimeOfImpact(-100, 0, 40, 0, 10)).toBeNull()
  })
})
