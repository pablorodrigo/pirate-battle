import { describe, expect, it } from 'vitest'
import { FixedStepLoop } from './FixedStepLoop.ts'

function createLoop() {
  return new FixedStepLoop({ stepsPerSecond: 60, maxFrameMs: 250, maxStepsPerFrame: 15 })
}

function stepsForOneSecond(frameMs: number): number {
  const loop = createLoop()
  let steps = 0
  for (let elapsed = 0; elapsed < 1000 - 1e-6; elapsed += frameMs) {
    steps += loop.advance(frameMs)
  }
  return steps
}

describe('FixedStepLoop', () => {
  it('simulates the same number of steps per second at any frame rate', () => {
    expect(stepsForOneSecond(1000 / 30)).toBe(60)
    expect(stepsForOneSecond(1000 / 60)).toBe(60)
    expect(stepsForOneSecond(1000 / 144)).toBeGreaterThanOrEqual(59)
    expect(stepsForOneSecond(1000 / 144)).toBeLessThanOrEqual(60)
  })

  it('carries leftover time as an interpolation factor', () => {
    const loop = createLoop()
    expect(loop.advance(25)).toBe(1)
    expect(loop.alpha).toBeCloseTo(0.5)
  })

  it('clamps long frames instead of replaying them', () => {
    const loop = createLoop()
    expect(loop.advance(5000)).toBe(15)
    expect(loop.advance(0)).toBe(0)
  })

  it('drops pending time on reset', () => {
    const loop = createLoop()
    loop.advance(10)
    loop.reset()
    expect(loop.alpha).toBe(0)
    expect(loop.advance(10)).toBe(0)
  })
})
