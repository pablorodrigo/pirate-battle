import { Container, Sprite, TilingSprite, type Texture } from 'pixi.js'
import { destroyBakedTexture, type GameTextures, type TilePlacement } from '../assets/gameTextures.ts'
import { MAP_TILE, type Coast, type MapLayout, type MapObstacle } from '../core/map/MapLayout.ts'
import { expandRect, type Rect } from '../core/math/geometry.ts'
import { deriveSeed, SeededRandom } from '../core/math/random.ts'

const TILE = MAP_TILE
const WATER_TILE = 73
/** Tile sheet nine-slices: [top, middle, bottom] rows of [left, middle, right] tiles. */
const SAND = [
  [1, 2, 3],
  [17, 18, 19],
  [33, 34, 35],
] as const
const SHALLOWS = [
  [10, 11, 12],
  [26, 27, 28],
  [42, 43, 44],
] as const
type NineSlice = typeof SAND | typeof SHALLOWS
/** The art's grass island: a fixed 4×4 block, sand around grass. */
const GRASS = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
] as const
/** Wide rocks whose opaque part matches the reef collider. */
const REEF_ROCKS = [50, 66] as const
/** Corner tiles of the shallows, shrunk into a small patch around a reef. */
const REEF_SHALLOWS = 48
/** Fort pieces: corner towers with walls to their neighbours, then walls, gates and walls with cannons pointing out. */
const FORT = {
  towers: [77, 78, 93, 94],
  wall: { top: 16, bottom: 16, left: 15, right: 15 },
  gate: { top: 76, bottom: 76, left: 60, right: 60 },
  cannon: { top: 47, bottom: 48, left: 32, right: 31 },
} as const
const FORT_SIDES = ['top', 'right', 'bottom', 'left'] as const
type FortSide = (typeof FORT_SIDES)[number]
/** Chance that a grass island carries a fort rather than plants. */
const FORT_CHANCE = 0.5
type Decoration = { readonly tiles: readonly number[]; readonly size: number }
/** Palms and plants, rocks and sprouts, in that order of likelihood. */
const DECORATIONS: readonly Decoration[] = [
  { tiles: [70, 71, 72], size: 64 },
  { tiles: [70, 72], size: 56 },
  { tiles: [49, 51, 65, 67], size: 52 },
  { tiles: [87, 88], size: 64 },
]
/** Keeps decorations off the wavy edge of the sand. */
const DECORATION_EDGE = 12
const DECORATION_SPACING = 56
const DECORATION_TRIES = 12
/** Keeps the scenery's draws apart from the map's and the spawner's. */
const SCENERY_SALT = 0x7363656e
/**
 * A rowboat beached on half the islands, on a side that faces open water,
 * its bow towards the water: `inset` from the edge to its center, away from
 * the rounded corners and from the decorations, a little larger than the
 * atlas draws it so it reads next to the ships.
 */
const BOAT = { chance: 0.5, scale: 1.25, inset: 26, corner: 40, clearance: 48, tilt: 0.35, tries: 6 } as const
/** Boats draw from a stream of their own, so adding them never moved a decoration. */
const BOAT_SALT = 0x626f6174
/** Ship atlas sprites point their bow down: the turn that points it out of each side. */
const BOW_TOWARDS: Readonly<Record<FortSide, number>> = { top: Math.PI, right: -Math.PI / 2, bottom: 0, left: Math.PI / 2 }
/** Logical units per simulation step the water texture drifts by. */
const WATER_DRIFT = { x: 0.12, y: 0.05 } as const

/**
 * Static scenery: tiled water and, for every obstacle of the map, its ring of
 * shallow water and its art, baked together into a texture of their own that
 * this terrain owns and destroys, plus a rowboat from the ship atlas on some
 * beaches. Decorations and boats come from the match seed, so a seed always
 * shows the same picture. Visual only: colliders come from the map and never
 * from these sprites, and the art stays inside its obstacle.
 */
export class Terrain {
  readonly root = new Container()
  private readonly water: TilingSprite
  private readonly bakedTextures: Texture[] = []

  constructor(map: MapLayout, seed: number, textures: GameTextures) {
    const { width, height } = map.arena
    const waterTexture = this.bake(textures, TILE, TILE, [{ tile: WATER_TILE, x: 0, y: 0 }], true)
    this.water = new TilingSprite({ texture: waterTexture, width, height })
    this.root.addChild(this.water)

    const random = new SeededRandom(deriveSeed(seed, SCENERY_SALT))
    const boats = new SeededRandom(deriveSeed(seed, BOAT_SALT))
    const arena: Rect = { x: 0, y: 0, width, height }
    for (const obstacle of map.obstacles) {
      // The shallows reach past the obstacle; nothing is drawn outside the arena.
      const frame = intersection(expandRect(obstacle.area, obstacle.kind === 'reef' ? TILE / 4 : TILE), arena)
      const { ground, props } = artOf(obstacle, random)
      const placements = [...shallowsOf(obstacle), ...ground, ...props].map((placement) => ({
        ...placement,
        x: placement.x - frame.x,
        y: placement.y - frame.y,
      }))
      const texture = this.bake(textures, frame.width, frame.height, placements)
      this.root.addChild(new Sprite({ texture, x: frame.x, y: frame.y }))

      // Atlas sprites share the cached ship sheet, so only the sprite is the terrain's.
      const boat = beachedBoat(boats, obstacle, props)
      const boatTexture = boat ? textures.dinghies[boat.index % textures.dinghies.length] : undefined
      if (boat && boatTexture) {
        const sprite = new Sprite({ texture: boatTexture, anchor: 0.5, x: boat.x, y: boat.y, rotation: boat.rotation })
        sprite.scale.set(BOAT.scale)
        this.root.addChild(sprite)
      }
    }
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

  private bake(
    textures: GameTextures,
    width: number,
    height: number,
    placements: readonly TilePlacement[],
    tiling = false,
  ): Texture {
    const texture = textures.bakeTiles(width, height, placements, { tiling })
    this.bakedTextures.push(texture)
    return texture
  }
}

/** A tile-wide ring of shallow water around an island, or a small patch around a reef. */
function shallowsOf({ kind, area }: MapObstacle): TilePlacement[] {
  if (kind !== 'reef') {
    return nineSlice(SHALLOWS, expandRect(area, TILE), NO_COAST)
  }
  const size = REEF_SHALLOWS
  const x = area.x + area.width / 2 - size
  const y = area.y + area.height / 2 - size
  return [
    { tile: SHALLOWS[0][0], x, y, size },
    { tile: SHALLOWS[0][2], x: x + size, y, size },
    { tile: SHALLOWS[2][0], x, y: y + size, size },
    { tile: SHALLOWS[2][2], x: x + size, y: y + size, size },
  ]
}

/** The obstacle's ground tiles, and the props that stand on them: decorations or a fort. */
function artOf(obstacle: MapObstacle, random: SeededRandom): { ground: TilePlacement[]; props: TilePlacement[] } {
  const { kind, area, coast } = obstacle
  if (kind === 'reef') {
    return { ground: [{ tile: pick(random, REEF_ROCKS), x: area.x, y: area.y }], props: [] }
  }
  if (kind === 'grass') {
    const ground = GRASS.flatMap((row, r) => row.map((tile, c) => ({ tile, x: area.x + c * TILE, y: area.y + r * TILE })))
    // The grass fills the middle 2×2 tiles: a fort stands over it, or plants grow on it.
    const grass = { x: area.x + TILE, y: area.y + TILE, width: TILE * 2, height: TILE * 2 }
    const props = random.next() < FORT_CHANCE ? fort(random, area) : decorations(random, grass, NO_COAST, 3)
    return { ground, props }
  }
  const cells = Math.ceil(area.width / TILE) * Math.ceil(area.height / TILE)
  const count = Math.min(4, Math.max(1, Math.round(cells / 2.5)))
  return { ground: nineSlice(SAND, area, coast), props: decorations(random, area, coast, count) }
}

type BeachedBoat = { readonly index: number; readonly x: number; readonly y: number; readonly rotation: number }

/** A rowboat on the sand of a side that faces open water, clear of the props, or null. */
function beachedBoat(random: SeededRandom, obstacle: MapObstacle, props: readonly TilePlacement[]): BeachedBoat | null {
  const { kind, area, coast } = obstacle
  if (kind === 'reef' || random.next() >= BOAT.chance) {
    return null
  }
  const sides = FORT_SIDES.filter((side) => !coast[side])
  for (let attempt = 0; attempt < BOAT.tries && sides.length > 0; attempt += 1) {
    const side = pick(random, sides)
    const horizontal = side === 'top' || side === 'bottom'
    const along = horizontal
      ? random.range(area.x + BOAT.corner, area.x + area.width - BOAT.corner)
      : random.range(area.y + BOAT.corner, area.y + area.height - BOAT.corner)
    const x = side === 'left' ? area.x + BOAT.inset : side === 'right' ? area.x + area.width - BOAT.inset : along
    const y = side === 'top' ? area.y + BOAT.inset : side === 'bottom' ? area.y + area.height - BOAT.inset : along
    const clear = props.every((prop) => {
      const half = (prop.size ?? TILE) / 2
      return Math.hypot(x - (prop.x + half), y - (prop.y + half)) >= BOAT.clearance
    })
    if (clear) {
      return { index: random.integer(0, 5), x, y, rotation: BOW_TOWARDS[side] + random.range(-BOAT.tilt, BOAT.tilt) }
    }
  }
  return null
}

/**
 * Tiles of a nine-slice over a rectangle of whole tiles. A coast side has no
 * edge: its tiles carry on as if the island went on past the border.
 */
function nineSlice(slice: NineSlice, rect: Rect, coast: Coast): TilePlacement[] {
  const columns = Math.ceil(rect.width / TILE)
  const rows = Math.ceil(rect.height / TILE)
  const placements: TilePlacement[] = []
  for (let row = 0; row < rows; row += 1) {
    const vertical = row === 0 && !coast.top ? 0 : row === rows - 1 && !coast.bottom ? 2 : 1
    for (let column = 0; column < columns; column += 1) {
      const horizontal = column === 0 && !coast.left ? 0 : column === columns - 1 && !coast.right ? 2 : 1
      placements.push({ tile: slice[vertical][horizontal], x: rect.x + column * TILE, y: rect.y + row * TILE })
    }
  }
  return placements
}

/** A small fort over the middle of a grass island: towers at the corners, one gate and walls with cannons. */
function fort(random: SeededRandom, island: Rect): TilePlacement[] {
  const x = island.x + TILE / 2
  const y = island.y + TILE / 2
  const gate = pick(random, FORT_SIDES)
  const pieceOf = (side: FortSide): number => {
    if (side === gate) {
      return FORT.gate[side]
    }
    return random.next() < 0.5 ? FORT.cannon[side] : FORT.wall[side]
  }
  const [topLeft, topRight, bottomLeft, bottomRight] = FORT.towers
  return [
    { tile: topLeft, x, y },
    { tile: pieceOf('top'), x: x + TILE, y },
    { tile: topRight, x: x + TILE * 2, y },
    { tile: pieceOf('left'), x, y: y + TILE },
    { tile: pieceOf('right'), x: x + TILE * 2, y: y + TILE },
    { tile: bottomLeft, x, y: y + TILE * 2 },
    { tile: pieceOf('bottom'), x: x + TILE, y: y + TILE * 2 },
    { tile: bottomRight, x: x + TILE * 2, y: y + TILE * 2 },
  ]
}

/** Up to `count` decorations inside the area, apart from each other and off its non-coast edges. */
function decorations(random: SeededRandom, area: Rect, coast: Coast, count: number): TilePlacement[] {
  const placed: TilePlacement[] = []
  for (let attempt = 0; attempt < DECORATION_TRIES && placed.length < count; attempt += 1) {
    const { tiles, size } = pick(random, DECORATIONS)
    const tile = pick(random, tiles)
    const left = area.x + (coast.left ? 0 : DECORATION_EDGE)
    const top = area.y + (coast.top ? 0 : DECORATION_EDGE)
    const right = area.x + area.width - (coast.right ? 0 : DECORATION_EDGE) - size
    const bottom = area.y + area.height - (coast.bottom ? 0 : DECORATION_EDGE) - size
    if (right < left || bottom < top) {
      continue
    }
    const x = Math.round(random.range(left, right))
    const y = Math.round(random.range(top, bottom))
    const apart = placed.every(
      (other) =>
        Math.hypot(x + size / 2 - (other.x + (other.size ?? TILE) / 2), y + size / 2 - (other.y + (other.size ?? TILE) / 2)) >=
        DECORATION_SPACING,
    )
    if (apart) {
      placed.push({ tile, x, y, size })
    }
  }
  return placed
}

const NO_COAST: Coast = { top: false, right: false, bottom: false, left: false }

function pick<T>(random: SeededRandom, items: readonly T[]): T {
  const item = items[random.integer(0, items.length - 1)]
  if (item === undefined) {
    throw new RangeError('Nothing to pick from.')
  }
  return item
}

function intersection(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  }
}
