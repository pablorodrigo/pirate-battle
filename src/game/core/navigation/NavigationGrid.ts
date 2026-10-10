import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import { expandRect, rectContains, segmentRectEntry, type Point, type Rect } from '../math/geometry.ts'
import { MinHeap } from './MinHeap.ts'

const NEIGHBOURS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const

/** Downhill cells examined when looking for the farthest visible waypoint. */
const LOOKAHEAD_CELLS = 8

/**
 * Coarse grid over the arena with islands inflated by a ship's clearance.
 *
 * Instead of one A* search per enemy, it keeps a single distance field to
 * the target (Dijkstra over 8 neighbours, without cutting corners). Every
 * enemy then walks downhill from its own cell, so the cost of an update does
 * not grow with the number of enemies.
 */
export class NavigationGrid {
  readonly cellSize: number
  readonly columns: number
  readonly rows: number
  private readonly blocked: Uint8Array
  private readonly distance: Float64Array
  private readonly obstacles: readonly Rect[]
  private target: Point | null = null

  constructor(arena: ArenaDefinition, cellSize: number, clearance: number) {
    this.cellSize = cellSize
    this.columns = Math.ceil(arena.width / cellSize)
    this.rows = Math.ceil(arena.height / cellSize)
    this.obstacles = arena.islands.map((island) => expandRect(island, clearance))
    this.blocked = new Uint8Array(this.columns * this.rows)
    this.distance = new Float64Array(this.columns * this.rows).fill(Number.POSITIVE_INFINITY)
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const { x, y } = this.centerOf(column, row)
        const outside = x < clearance || y < clearance || x > arena.width - clearance || y > arena.height - clearance
        const onIsland = this.obstacles.some((obstacle) => rectContains(obstacle, x, y))
        this.blocked[row * this.columns + column] = outside || onIsland ? 1 : 0
      }
    }
  }

  /** True when a ship with this grid's clearance can sail straight between the points. */
  hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    return this.obstacles.every((obstacle) => segmentRectEntry(fromX, fromY, toX, toY, obstacle) === null)
  }

  /** Recomputes the distance from every free cell to the target point. */
  setTarget(x: number, y: number): void {
    this.target = { x, y }
    this.distance.fill(Number.POSITIVE_INFINITY)
    const start = this.nearestFreeCell(this.cellIndexAt(x, y))
    if (start < 0) {
      return
    }
    const heap = new MinHeap()
    this.distance[start] = 0
    heap.push(start, 0)
    while (heap.size > 0) {
      const current = heap.pop()
      const currentDistance = this.distance[current] ?? Number.POSITIVE_INFINITY
      const column = current % this.columns
      const row = Math.floor(current / this.columns)
      for (const [dx, dy, cost] of NEIGHBOURS) {
        const next = this.passableNeighbour(column, row, dx, dy)
        if (next < 0) {
          continue
        }
        const candidate = currentDistance + cost
        if (candidate < (this.distance[next] ?? Number.POSITIVE_INFINITY)) {
          this.distance[next] = candidate
          heap.push(next, candidate)
        }
      }
    }
  }

  /** Whether the target can be reached from this point. */
  isReachable(x: number, y: number): boolean {
    const cell = this.nearestFreeCell(this.cellIndexAt(x, y))
    return cell >= 0 && Number.isFinite(this.distance[cell] ?? Number.POSITIVE_INFINITY)
  }

  /**
   * Where a ship at (x, y) should steer next: the target itself when it is in
   * sight, otherwise the farthest downhill cell that is still in sight. Null
   * when the target cannot be reached.
   */
  nextWaypoint(x: number, y: number): Point | null {
    const target = this.target
    if (!target) {
      return null
    }
    if (this.hasLineOfSight(x, y, target.x, target.y)) {
      return target
    }
    let cell = this.nearestFreeCell(this.cellIndexAt(x, y))
    if (cell < 0 || !Number.isFinite(this.distance[cell] ?? Number.POSITIVE_INFINITY)) {
      return null
    }
    let waypoint: Point | null = null
    for (let i = 0; i < LOOKAHEAD_CELLS; i += 1) {
      const next = this.downhillNeighbour(cell)
      if (next < 0) {
        break
      }
      const center = this.centerOfIndex(next)
      if (waypoint && !this.hasLineOfSight(x, y, center.x, center.y)) {
        break
      }
      waypoint = center
      cell = next
    }
    return waypoint ?? this.centerOfIndex(cell)
  }

  private downhillNeighbour(cell: number): number {
    const column = cell % this.columns
    const row = Math.floor(cell / this.columns)
    let best = -1
    let bestDistance = this.distance[cell] ?? Number.POSITIVE_INFINITY
    for (const [dx, dy] of NEIGHBOURS) {
      const next = this.passableNeighbour(column, row, dx, dy)
      const nextDistance = next < 0 ? Number.POSITIVE_INFINITY : (this.distance[next] ?? Number.POSITIVE_INFINITY)
      if (nextDistance < bestDistance) {
        best = next
        bestDistance = nextDistance
      }
    }
    return best
  }

  /** Neighbour index, or -1 when blocked; diagonals never cut a blocked corner. */
  private passableNeighbour(column: number, row: number, dx: number, dy: number): number {
    const nextColumn = column + dx
    const nextRow = row + dy
    if (!this.isFree(nextColumn, nextRow)) {
      return -1
    }
    if (dx !== 0 && dy !== 0 && (!this.isFree(column + dx, row) || !this.isFree(column, row + dy))) {
      return -1
    }
    return nextRow * this.columns + nextColumn
  }

  private isFree(column: number, row: number): boolean {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) {
      return false
    }
    return this.blocked[row * this.columns + column] === 0
  }

  /** Ships may legally touch an island, inside the inflated margin: start from the closest free cell. */
  private nearestFreeCell(cell: number): number {
    const column = cell % this.columns
    const row = Math.floor(cell / this.columns)
    if (this.isFree(column, row)) {
      return cell
    }
    for (let radius = 1; radius <= 3; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (this.isFree(column + dx, row + dy)) {
            return (row + dy) * this.columns + column + dx
          }
        }
      }
    }
    return -1
  }

  private cellIndexAt(x: number, y: number): number {
    const column = Math.min(this.columns - 1, Math.max(0, Math.floor(x / this.cellSize)))
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)))
    return row * this.columns + column
  }

  private centerOf(column: number, row: number): Point {
    return { x: (column + 0.5) * this.cellSize, y: (row + 0.5) * this.cellSize }
  }

  private centerOfIndex(cell: number): Point {
    return this.centerOf(cell % this.columns, Math.floor(cell / this.columns))
  }
}
