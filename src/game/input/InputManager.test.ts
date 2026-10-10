import { describe, expect, it } from 'vitest'
import { InputManager } from './InputManager.ts'

describe('InputManager', () => {
  it('combines simultaneous movement and attacks', () => {
    const input = new InputManager()
    input.press('thrust', 'key:KeyW')
    input.press('turnRight', 'key:KeyD')
    input.press('fireLeft', 'pointer:1')

    expect(input.snapshot()).toEqual({
      thrust: true,
      turn: 1,
      fireFront: false,
      fireLeft: true,
      fireRight: false,
    })
  })

  it('cancels opposite turns', () => {
    const input = new InputManager()
    input.press('turnLeft', 'key:KeyA')
    input.press('turnRight', 'key:KeyD')
    expect(input.snapshot().turn).toBe(0)
  })

  it('keeps an action held by another source when one source releases it', () => {
    const input = new InputManager()
    input.press('thrust', 'pointer:1')
    input.press('thrust', 'key:KeyW')
    input.release('thrust', 'key:KeyW')
    expect(input.snapshot().thrust).toBe(true)

    input.releaseSource('pointer:1')
    expect(input.snapshot().thrust).toBe(false)
  })

  it('releases everything on clear', () => {
    const input = new InputManager()
    input.press('fireFront', 'key:Space')
    input.clear()
    expect(input.snapshot().fireFront).toBe(false)
  })
})
