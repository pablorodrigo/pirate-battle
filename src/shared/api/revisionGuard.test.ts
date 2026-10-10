import { describe, expect, it } from 'vitest'
import { RevisionGuard, StaleResponseError } from './revisionGuard.ts'

function reads(...revisions: number[]): { read: () => Promise<{ revision: number }>; calls: () => number } {
  let index = 0
  return {
    read: async () => ({ revision: revisions[Math.min(index++, revisions.length - 1)] ?? 0 }),
    calls: () => index,
  }
}

describe('RevisionGuard', () => {
  it('accepts answers at least as recent as what was seen', async () => {
    const guard = new RevisionGuard()
    guard.note(3)
    const { read, calls } = reads(3)
    await expect(guard.fresh(read)).resolves.toEqual({ revision: 3 })
    expect(calls()).toBe(1)
  })

  it('discards a late, older answer and reads again', async () => {
    const guard = new RevisionGuard()
    guard.note(5)
    const { read, calls } = reads(4, 6)
    await expect(guard.fresh(read)).resolves.toEqual({ revision: 6 })
    expect(calls()).toBe(2)
  })

  it('gives up after a bounded number of stale answers', async () => {
    const guard = new RevisionGuard()
    guard.note(9)
    const { read, calls } = reads(1)
    await expect(guard.fresh(read, 3)).rejects.toBeInstanceOf(StaleResponseError)
    expect(calls()).toBe(3)
  })

  it('remembers the newest revision it accepts', async () => {
    const guard = new RevisionGuard()
    await guard.fresh(reads(7).read)
    const { read, calls } = reads(6, 7)
    await expect(guard.fresh(read)).resolves.toEqual({ revision: 7 })
    expect(calls()).toBe(2)
  })
})
