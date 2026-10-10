import { describe, expect, it } from 'vitest'
import shipAtlasXml from '../../../assets/spritesheet/ships_miscellaneous_sheet.xml?raw'
import { parseSparrowAtlas } from './sparrowAtlas.ts'

describe('parseSparrowAtlas', () => {
  it('reads frames keyed by sprite name', () => {
    const frames = parseSparrowAtlas(`
      <TextureAtlas imagePath="sheet.png">
        <SubTexture name="cannon_ball.png" x="120" y="29" width="10" height="10"/>
        <SubTexture name="ship_5.png" x="68" y="77" width="66" height="113"/>
      </TextureAtlas>`)

    expect(frames.get('cannon_ball')).toEqual({ x: 120, y: 29, width: 10, height: 10 })
    expect(frames.get('ship_5')).toEqual({ x: 68, y: 77, width: 66, height: 113 })
  })

  it('skips malformed entries', () => {
    const frames = parseSparrowAtlas('<SubTexture name="broken.png" x="a" y="0" width="1" height="1"/>')
    expect(frames.size).toBe(0)
  })

  it('finds every sprite the game uses in the provided ship sheet', () => {
    const frames = parseSparrowAtlas(shipAtlasXml)
    for (let index = 1; index <= 24; index += 1) {
      expect(frames.has(`ship_${index}`)).toBe(true)
    }
    for (const name of ['cannon_ball', 'explosion_1', 'explosion_2', 'explosion_3', 'fire_1', 'fire_2']) {
      expect(frames.has(name)).toBe(true)
    }
  })
})
