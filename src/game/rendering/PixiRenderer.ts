import { Application, Container, Graphics, type Ticker } from 'pixi.js'
import type { ArenaDefinition } from '../config/ArenaDefinition.ts'

const MAX_RESOLUTION = 2
const SHIP_SPIN_RADIANS_PER_SECOND = Math.PI / 4

const COLORS = {
  letterbox: 0x0b2a3c,
  water: 0x1f6f99,
  sand: 0xe8d29b,
  shore: 0xc9a65f,
  ship: 0xf4efe1,
} as const

type RendererState = 'idle' | 'running' | 'destroyed'

/**
 * Owns the PixiJS application of one game screen.
 *
 * `Application.init()` is asynchronous, so React may clean up (Strict Mode
 * does it on purpose) before initialization finishes. `destroy()` is safe in
 * that window: `mount()` completes the teardown once `init()` settles.
 */
export class PixiRenderer {
  private readonly arena: ArenaDefinition
  private readonly app = new Application()
  private readonly world = new Container()
  private readonly terrain = new Container()
  private readonly ship = new Graphics()
  private resizeObserver: ResizeObserver | null = null
  private state: RendererState = 'idle'

  constructor(arena: ArenaDefinition) {
    this.arena = arena
    // Attached up front so that destroying the application releases every
    // display object, even when it is destroyed before init() completes.
    this.world.addChild(this.terrain, this.ship)
    this.app.stage.addChild(this.world)
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
    this.buildScene()
    host.appendChild(this.app.canvas)
    this.resizeObserver = new ResizeObserver(() => this.fitToHost(host))
    this.resizeObserver.observe(host)
    this.fitToHost(host)
    this.app.ticker.add(this.onTick)
    this.app.start()
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
  }

  private releaseApplication(): void {
    // `context: true` is required: Graphics only free their own
    // GraphicsContext when destroyed without options.
    this.app.destroy({ removeView: true }, { children: true, context: true })
  }

  private buildScene(): void {
    const { width, height, islands } = this.arena
    const water = new Graphics().rect(0, 0, width, height).fill(COLORS.water)
    const islandShapes = islands.map((island) =>
      new Graphics()
        .rect(island.x, island.y, island.width, island.height)
        .fill(COLORS.sand)
        .stroke({ width: 4, color: COLORS.shore }),
    )

    this.terrain.addChild(water, ...islandShapes)
    this.ship.poly([28, 0, -18, -16, -10, 0, -18, 16]).fill(COLORS.ship)
    this.ship.position.set(width / 2, height / 2)
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
    this.world.scale.set(scale)
    this.world.position.set(
      (width - this.arena.width * scale) / 2,
      (height - this.arena.height * scale) / 2,
    )
  }

  private readonly onTick = (ticker: Ticker): void => {
    this.ship.rotation += SHIP_SPIN_RADIANS_PER_SECOND * (ticker.deltaMS / 1000)
  }
}
