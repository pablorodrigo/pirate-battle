/**
 * Deterministic pseudo-random generator (mulberry32). Every random decision of
 * a match goes through one instance, so a seed reproduces the whole match.
 */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }

  /** Returns a float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }
}
