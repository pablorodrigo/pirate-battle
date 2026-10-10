import { Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js'
import { destroyBakedTexture, type GameTextures, type TilePlacement } from '../assets/gameTextures.ts'
import type { ArenaDefinition } from '../config/ArenaDefinition.ts'
import type { Rect } from '../core/math/geometry.ts'

const TILE = 64
const WATER_TILE = 73
/** Sand island tiles laid out as a 3×3 block: corners, edges and center. */
const SAND = {
  topLeft: 1,
  top: 2,
  topRight: 3,
  left: 17,
  center: 18,
  right: 19,
  bottomLeft: 33,
  bottom: 34,
  bottomRight: 35,
} as const
/** A palm or plant and a rock for each island, cycling through the arena. */
const DECORATIONS = [
  [70, 49],
  [72, 66],
  [71, 50],
  [70, 67],
  [72, 51],
] as const
const SHALLOW_WATER = { color: 0x9be3ff, alpha: 0.32, margin: 18, radius: 30 } as const
/** Logical units per simulation step the water texture drifts by. */
const WATER_DRIFT = { x: 0.12, y: 0.05 } as const

/**
 * Static scenery: tiled water, shallow-water halos and islands built from the
 * sand tiles. Islands and water are baked into their own textures, which
 * this terrain owns and destroys. Visual only: island colliders come from
 * the arena definition and never from these sprites.
 */
export class Terrain {
  readonly root = new Container()
  private readonly water: TilingSprite
  private readonly bakedTextures: Texture[] = []

  constructor(arena: ArenaDefinition, textures: GameTextures) {
    const waterTexture = this.bake(textures, TILE, TILE, [{ tile: WATER_TILE, x: 0, y: 0 }])
    this.water = new TilingSprite({ texture: waterTexture, width: arena.width, height: arena.height })
    this.root.addChild(this.water)

    for (const island of arena.islands) {
      this.root.addChild(shallowWater(island))
    }
    arena.islands.forEach((island, index) => {
      const decoration = DECORATIONS[index % DECORATIONS.length] ?? DECORATIONS[0]
      const texture = this.bake(textures, island.width, island.height, islandPlacements(island, decoration))
      this.root.addChild(new Sprite({ texture, x: island.x, y: island.y }))
    })
  }

  update(now: number): void {
    this.water.tilePosition.set(now * WATER_DRIFT.x, now * WATER_DRIFT.y)
  }

  /** Sprites first, then the baked textures they display. */
  destroy(): void {
    this.root.destroy({ children: true, context: true })
    for (const texture of this.bakedTextures) {
      destroyBakedTexture(texture)
    }
    this.bakedTextures.length = 0
  }

  private bake(textures: GameTextures, width: number, height: number, placements: readonly TilePlacement[]): Texture {
    const texture = textures.bakeTiles(width, height, placements)
    this.bakedTextures.push(texture)
    return texture
  }
}

function shallowWater(island: Rect): Graphics {
  const { margin, radius, color, alpha } = SHALLOW_WATER
  const halo = new Graphics()
    .roundRect(island.x - margin, island.y - margin, island.width + margin * 2, island.height + margin * 2, radius)
    .fill(color)
  halo.alpha = alpha
  return halo
}

/** Sand tiles over the island rectangle, then two decorations kept inside its edges. */
function islandPlacements(island: Rect, decoration: readonly [number, number]): TilePlacement[] {
  const columns = Math.max(2, Math.round(island.width / TILE))
  const rows = Math.max(2, Math.round(island.height / TILE))
  const placements: TilePlacement[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      placements.push({ tile: sandTile(column, row, columns, rows), x: column * TILE, y: row * TILE })
    }
  }
  const [plant, rock] = decoration
  const middleY = island.height / 2
  placements.push({ tile: plant, x: island.width * 0.32 - TILE / 2, y: middleY - TILE / 2 })
  placements.push({ tile: rock, x: island.width * 0.7 - 26, y: middleY - 20, size: 52 })
  return placements
}

function sandTile(column: number, row: number, columns: number, rows: number): number {
  const horizontal = column === 0 ? 'left' : column === columns - 1 ? 'right' : 'middle'
  const vertical = row === 0 ? 'top' : row === rows - 1 ? 'bottom' : 'middle'
  if (vertical === 'top') {
    return horizontal === 'left' ? SAND.topLeft : horizontal === 'right' ? SAND.topRight : SAND.top
  }
  if (vertical === 'bottom') {
    return horizontal === 'left' ? SAND.bottomLeft : horizontal === 'right' ? SAND.bottomRight : SAND.bottom
  }
  return horizontal === 'left' ? SAND.left : horizontal === 'right' ? SAND.right : SAND.center
}
