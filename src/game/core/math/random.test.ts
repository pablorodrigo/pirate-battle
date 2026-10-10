import { describe, expect, it } from 'vitest'
import { SeededRandom } from './random.ts'

describe('SeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = new SeededRandom(42)
    const second = new SeededRandom(42)
    const sequence = Array.from({ length: 5 }, () => first.next())

    expect(Array.from({ length: 5 }, () => second.next())).toEqual(sequence)
  })

  it('produces different sequences for different seeds', () => {
    expect(new SeededRandom(1).next()).not.toBe(new SeededRandom(2).next())
  })

  it('stays within [0, 1) and within the requested range', () => {
    const random = new SeededRandom(7)
    for (let i = 0; i < 1000; i += 1) {
      const value = random.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      const ranged = random.range(-3, 5)
      expect(ranged).toBeGreaterThanOrEqual(-3)
      expect(ranged).toBeLessThan(5)
    }
  })
})
