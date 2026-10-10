const STEP_TOLERANCE = 1e-6

export type FixedStepLoopOptions = {
  readonly stepsPerSecond: number
  /** Longest frame time accepted; anything above is dropped, not simulated. */
  readonly maxFrameMs: number
  readonly maxStepsPerFrame: number
}

/**
 * Turns variable frame times into a whole number of fixed simulation steps.
 * The time left over is carried to the next frame and exposed as `alpha`,
 * so rendering can interpolate between the last two simulated poses.
 *
 * A long frame (a stall, a debugger break) is clamped instead of replayed:
 * the match slows down for that moment rather than jumping ahead.
 */
export class FixedStepLoop {
  readonly stepMs: number
  private readonly maxFrameMs: number
  private readonly maxStepsPerFrame: number
  private accumulatorMs = 0

  constructor(options: FixedStepLoopOptions) {
    this.stepMs = 1000 / options.stepsPerSecond
    this.maxFrameMs = options.maxFrameMs
    this.maxStepsPerFrame = options.maxStepsPerFrame
  }

  /** Returns how many steps to simulate for a frame that took `elapsedMs`. */
  advance(elapsedMs: number): number {
    this.accumulatorMs += Math.min(Math.max(elapsedMs, 0), this.maxFrameMs)
    // 1000 / 60 is not exact in floating point; the tolerance keeps a whole
    // step from being counted as 0.999… of a step.
    const due = Math.floor(this.accumulatorMs / this.stepMs + STEP_TOLERANCE)
    if (due > this.maxStepsPerFrame) {
      this.accumulatorMs = 0
      return this.maxStepsPerFrame
    }
    this.accumulatorMs = Math.max(0, this.accumulatorMs - due * this.stepMs)
    return due
  }

  /** Fraction of a step not simulated yet, in [0, 1). */
  get alpha(): number {
    return this.accumulatorMs / this.stepMs
  }

  /** Forgets pending time, so a pause never turns into a burst of steps. */
  reset(): void {
    this.accumulatorMs = 0
  }
}
