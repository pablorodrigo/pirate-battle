import { Application, Container, Graphics, type Ticker } from 'pixi.js'
import type { ArenaDefinition } from '../config/ArenaDefinition.ts'
import type { Ship } from '../core/entities.ts'
import type { GameEvent } from '../core/events.ts'
import type { World } from '../core/World.ts'
import { ShipView } from './ShipView.ts'

const MAX_RESOLUTION = 2

const COLORS = {
  letterbox: 0x0b2a3c,
  water: 0x1f6f99,
  sand: 0xe8d29b,
  shore: 0xc9a65f,
} as const

type RendererState = 'idle' | 'running' | 'destroyed'

/**
 * Owns the PixiJS application of one game screen and draws the match state.
 *
 * `Application.init()` is asynchronous, so React may clean up (Strict Mode
 * does it on purpose) before initialization finishes. `destroy()` is safe in
 * that window: `mount()` completes the teardown once `init()` settles.
 */
export class PixiRenderer {
  private readonly arena: ArenaDefinition
  private readonly app = new Application()
  private readonly scene = new Container()
  private readonly terrain = new Container()
  private readonly shipLayer = new Container()
  private readonly shipViews = new Map<number, ShipView>()
  private readonly seenIds = new Set<number>()
  private resizeObserver: ResizeObserver | null = null
  private state: RendererState = 'idle'

  constructor(arena: ArenaDefinition) {
    this.arena = arena
    // Attached up front so that destroying the application releases every
    // display object, even when it is destroyed before init() completes.
    this.scene.addChild(this.terrain, this.shipLayer)
    this.app.stage.addChild(this.scene)
  }

  get rendererName(): string {
    return this.app.renderer.name
  }

  async mount(host: HTMLElement): Promise<void> {
    await this.app.init({
      preference: 'webgl',
      background: COLORS.letterbox,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, MAX_RESOLUTION),
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      autoStart: false,
      sharedTicker: false,
    })

    if (this.state === 'destroyed') {
      this.releaseApplication()
      return
    }

    this.state = 'running'
    this.drawTerrain()
    host.appendChild(this.app.canvas)
    this.resizeObserver = new ResizeObserver(() => this.fitToHost(host))
    this.resizeObserver.observe(host)
    this.fitToHost(host)
    this.app.start()
  }

  /** Runs `callback` before every render with the raw frame time in milliseconds. */
  onFrame(callback: (elapsedMs: number) => void): () => void {
    const listener = (ticker: Ticker): void => callback(ticker.elapsedMS)
    this.app.ticker.add(listener)
    return () => {
      if (this.state === 'running') {
        this.app.ticker.remove(listener)
      }
    }
  }

  render(world: World, alpha: number, _events: readonly GameEvent[]): void {
    this.seenIds.clear()
    this.syncShip(world.player, alpha)
    for (const enemy of world.enemies) {
      this.syncShip(enemy, alpha)
    }
    for (const [id, view] of this.shipViews) {
      if (!this.seenIds.has(id)) {
        view.destroy()
        this.shipViews.delete(id)
      }
    }
  }

  destroy(): void {
    const wasRunning = this.state === 'running'
    this.state = 'destroyed'
    if (!wasRunning) {
      return
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.releaseApplication()
    this.shipViews.clear()
  }

  private syncShip(ship: Ship, alpha: number): void {
    this.seenIds.add(ship.id)
    let view = this.shipViews.get(ship.id)
    if (!view) {
      view = new ShipView(ship)
      this.shipViews.set(ship.id, view)
      this.shipLayer.addChild(view.root)
    }
    view.update(ship, alpha)
  }

  private releaseApplication(): void {
    // `context: true` is required: Graphics only free their own
    // GraphicsContext when destroyed without options.
    this.app.destroy({ removeView: true }, { children: true, context: true })
  }

  private drawTerrain(): void {
    const { width, height, islands } = this.arena
    const water = new Graphics().rect(0, 0, width, height).fill(COLORS.water)
    const islandShapes = islands.map((island) =>
      new Graphics()
        .rect(island.x, island.y, island.width, island.height)
        .fill(COLORS.sand)
        .stroke({ width: 4, color: COLORS.shore }),
    )
    this.terrain.addChild(water, ...islandShapes)
  }

  /** Scales the logical arena uniformly and centers it inside the host. */
  private fitToHost(host: HTMLElement): void {
    const width = host.clientWidth
    const height = host.clientHeight
    if (this.state !== 'running' || width === 0 || height === 0) {
      return
    }
    this.app.renderer.resize(width, height)
    const scale = Math.min(width / this.arena.width, height / this.arena.height)
    this.scene.scale.set(scale)
    this.scene.position.set(
      (width - this.arena.width * scale) / 2,
      (height - this.arena.height * scale) / 2,
    )
  }
}
