import { defaultArena } from '../../config/defaultArena.ts'
import type { GameplayConfig } from '../../config/GameplayConfig.ts'
import { distanceSquared, resolveCircleRect, type Point, type Rect } from '../math/geometry.ts'
import { deriveSeed, SeededRandom } from '../math/random.ts'
import { enemyClearance, NavigationGrid } from '../navigation/NavigationGrid.ts'
import { SPAWN_CLEARANCE } from '../systems/Spawner.ts'
import { classicMap } from './classicMap.ts'
import { MAP_TILE, type MapLayout, type MapObstacle, type ObstacleKind } from './MapLayout.ts'

/** Keeps the map's draws apart from the spawner's, which use the bare match seed. */
const MAP_SALT = 0x6d617073
/** The grass island is the art's 4×4 block, so its size is fixed. */
const GRASS_TILES = 4
/** Where the reef's rock sits in its tile: the opaque part of the art's wide rock. */
const REEF_ROCK: Rect = { x: 5, y: 9, width: 54, height: 46 }
/** Positions tried for each obstacle before the whole layout is drawn again. */
const PLACEMENT_TRIES = 60
/** Spacing of the candidate fallback spawn points. */
const SPAWN_LATTICE = 80
const SPAWN_POINTS = 8
const MIN_SPAWN_POINTS = 4

type Shape = {
  readonly kind: ObstacleKind
  readonly columns: number
  readonly rows: number
  /** A coast touches a border; every other obstacle keeps a channel away from all of them. */
  readonly coast: boolean
}

/**
 * Draws the map of a match from its seed: sand islands, sometimes the large
 * grass island, and reef rocks, on the 64-unit grid of the art, inside the
 * classic arena and around its player start. A layout is kept only when the
 * start is open, every channel is wide enough for any ship, enemies can reach
 * all of the water and the obstacles cover a bounded share of the arena, so
 * matches stay comparable. Otherwise the layout is drawn again, and after the
 * configured attempts the classic map is used. The same seed always gives
 * the same map.
 */
export function generateMap(seed: number, config: GameplayConfig): MapLayout {
  const random = new SeededRandom(deriveSeed(seed, MAP_SALT))
  for (let attempt = 0; attempt < config.map.attempts; attempt += 1) {
    const layout = drawLayout(random, config)
    if (layout) {
      return layout
    }
  }
  return classicMap
}

function drawLayout(random: SeededRandom, config: GameplayConfig): MapLayout | null {
  const { width, height, playerStart } = defaultArena
  const obstacles: MapObstacle[] = []
  for (const shape of drawShapes(random, config)) {
    const obstacle = placeShape(random, shape, obstacles, config)
    if (!obstacle) {
      return null
    }
    obstacles.push(obstacle)
  }

  const islands = obstacles.map((obstacle) => obstacle.collider)
  const covered = islands.reduce((sum, island) => sum + island.width * island.height, 0) / (width * height)
  if (covered < config.map.coverage.min || covered > config.map.coverage.max) {
    return null
  }

  const arena = { width, height, islands, playerStart, safeSpawnPoints: [] }
  const grid = new NavigationGrid(arena, config.navigation.cellSize, enemyClearance(config))
  grid.setTarget(playerStart.x, playerStart.y)
  if (grid.countUnreachableCells() > 0) {
    return null
  }
  const safeSpawnPoints = spawnPoints(islands, grid, config)
  if (safeSpawnPoints.length < MIN_SPAWN_POINTS) {
    return null
  }
  return { kind: 'generated', arena: { ...arena, safeSpawnPoints }, obstacles }
}

/**
 * The obstacles of a layout, in placing order: the grass island and the open
 * sand islands from the largest, while there is the most room, then the
 * coasts, which only need a stretch of border, and the reefs last.
 */
function drawShapes(random: SeededRandom, config: GameplayConfig): Shape[] {
  const { map } = config
  const islandCount = random.integer(map.islandCount.min, map.islandCount.max)
  const grass: Shape[] =
    random.next() < map.grassIslandChance ? [{ kind: 'grass', columns: GRASS_TILES, rows: GRASS_TILES, coast: false }] : []
  const sandCount = islandCount - grass.length
  const coastCount = Math.min(sandCount, random.integer(map.coastCount.min, map.coastCount.max))
  const sand = Array.from({ length: sandCount }, (_, index): Shape => ({
    kind: 'sand',
    columns: random.integer(map.sandColumns.min, map.sandColumns.max),
    rows: random.integer(map.sandRows.min, map.sandRows.max),
    coast: index < coastCount,
  }))
  const open = sand.filter((shape) => !shape.coast).sort((a, b) => b.columns * b.rows - a.columns * a.rows)
  const coasts = sand.filter((shape) => shape.coast)
  const reefCount = random.integer(map.reefCount.min, map.reefCount.max)
  const reefs = Array.from({ length: reefCount }, (): Shape => ({ kind: 'reef', columns: 1, rows: 1, coast: false }))
  return [...grass, ...open, ...coasts, ...reefs]
}

function placeShape(
  random: SeededRandom,
  shape: Shape,
  placed: readonly MapObstacle[],
  config: GameplayConfig,
): MapObstacle | null {
  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt += 1) {
    const obstacle = shape.coast ? drawCoast(random, shape) : drawOpen(random, shape, config)
    if (obstacle && fits(obstacle, placed, config)) {
      return obstacle
    }
  }
  return null
}

/** Anywhere a whole channel away from every border. */
function drawOpen(random: SeededRandom, shape: Shape, config: GameplayConfig): MapObstacle | null {
  const margin = Math.ceil(config.map.minChannel / MAP_TILE)
  const lastColumn = Math.floor((defaultArena.width - config.map.minChannel) / MAP_TILE) - shape.columns
  const lastRow = Math.floor((defaultArena.height - config.map.minChannel) / MAP_TILE) - shape.rows
  if (lastColumn < margin || lastRow < margin) {
    return null
  }
  return obstacleAt(shape, random.integer(margin, lastColumn), random.integer(margin, lastRow))
}

/** Against one border, with its longer side along it, anywhere along that border. */
function drawCoast(random: SeededRandom, shape: Shape): MapObstacle | null {
  const columns = Math.floor(defaultArena.width / MAP_TILE)
  const rows = Math.floor(defaultArena.height / MAP_TILE)
  const long = Math.max(shape.columns, shape.rows)
  const short = Math.min(shape.columns, shape.rows)
  const side = random.integer(0, 3)
  if (side === 0 || side === 2) {
    const along = { ...shape, columns: long, rows: short }
    return obstacleAt(along, random.integer(0, columns - long), side === 0 ? 0 : rows - short)
  }
  const along = { ...shape, columns: short, rows: long }
  return obstacleAt(along, side === 1 ? columns - short : 0, random.integer(0, rows - long))
}

/** The obstacle with its top-left tile at (column, row), or null when it touches a border it should not. */
function obstacleAt(shape: Shape, column: number, row: number): MapObstacle | null {
  const { width, height } = defaultArena
  const x = column * MAP_TILE
  const y = row * MAP_TILE
  let bottom = y + shape.rows * MAP_TILE
  // The arena is not a whole number of tiles high, so a coast on the last row runs down to the border.
  if (height - bottom < MAP_TILE) {
    bottom = height
  }
  const area: Rect = { x, y, width: shape.columns * MAP_TILE, height: bottom - y }
  const coast = { top: y === 0, right: x + area.width === width, bottom: bottom === height, left: x === 0 }
  if ((coast.top || coast.right || coast.bottom || coast.left) !== shape.coast) {
    return null
  }
  const collider =
    shape.kind === 'reef'
      ? { x: x + REEF_ROCK.x, y: y + REEF_ROCK.y, width: REEF_ROCK.width, height: REEF_ROCK.height }
      : area
  return { kind: shape.kind, area, collider, coast }
}

function fits(obstacle: MapObstacle, placed: readonly MapObstacle[], config: GameplayConfig): boolean {
  const { width, height, playerStart } = defaultArena
  const { minChannel, startClearance } = config.map
  const { area, coast } = obstacle
  // Each border is either touched or left a whole channel away.
  const bordersClear =
    (coast.left || area.x >= minChannel) &&
    (coast.top || area.y >= minChannel) &&
    (coast.right || width - (area.x + area.width) >= minChannel) &&
    (coast.bottom || height - (area.y + area.height) >= minChannel)
  return (
    bordersClear &&
    distanceToRect(playerStart, obstacle.collider) >= startClearance &&
    placed.every((other) => gapBetween(area, other.area) >= minChannel)
  )
}

/**
 * Fallback spawn points: open water every enemy can reach, far from the
 * start, spread out by always adding the candidate farthest from those taken.
 */
function spawnPoints(islands: readonly Rect[], grid: NavigationGrid, config: GameplayConfig): Point[] {
  const { width, height, playerStart } = defaultArena
  const radius = Math.max(config.chaser.radius, config.shooter.radius) + SPAWN_CLEARANCE
  const minDistance = config.spawn.minDistanceFromPlayer
  const candidates: Point[] = []
  for (let y = SPAWN_LATTICE / 2; y < height; y += SPAWN_LATTICE) {
    for (let x = SPAWN_LATTICE / 2; x < width; x += SPAWN_LATTICE) {
      const inside = x >= radius && y >= radius && x <= width - radius && y <= height - radius
      const far = distanceSquared(x, y, playerStart.x, playerStart.y) >= minDistance * minDistance
      const open = islands.every((island) => !resolveCircleRect(x, y, radius, island))
      if (inside && far && open && grid.isReachable(x, y)) {
        candidates.push({ x, y })
      }
    }
  }
  const chosen: Point[] = []
  let next = farthest(candidates, (point) => distanceSquared(point.x, point.y, playerStart.x, playerStart.y))
  while (next && chosen.length < SPAWN_POINTS) {
    chosen.push(next)
    const remaining = candidates.filter((candidate) => !chosen.includes(candidate))
    next = farthest(remaining, (point) =>
      Math.min(...chosen.map((other) => distanceSquared(point.x, point.y, other.x, other.y))),
    )
  }
  return chosen
}

/** The candidate with the largest score; the first one on ties. */
function farthest(candidates: readonly Point[], score: (point: Point) => number): Point | undefined {
  let best: Point | undefined
  let bestScore = Number.NEGATIVE_INFINITY
  for (const candidate of candidates) {
    const value = score(candidate)
    if (value > bestScore) {
      best = candidate
      bestScore = value
    }
  }
  return best
}

/** Width of the water between two rectangles; their true distance is never shorter. */
function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width))
  const dy = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height))
  return Math.max(dx, dy)
}

function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return Math.hypot(dx, dy)
}
