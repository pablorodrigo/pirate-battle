import { Application, Container, Graphics, GraphicsContext, Sprite, type Ticker } from 'pixi.js'
import type { GameTextures, ShipStages } from '../assets/gameTextures.ts'
import type { ArenaDefinition } from '../config/ArenaDefinition.ts'
import type { Projectile, Ship, ShipKind } from '../core/entities.ts'
import type { GameEvent } from '../core/events.ts'
import type { MapLayout } from '../core/map/MapLayout.ts'
import { deriveSeed, SeededRandom } from '../core/math/random.ts'
import type { World } from '../core/World.ts'
import { EffectLayer } from './EffectLayer.ts'
import { ShipView } from './ShipView.ts'
import { Terrain } from './Terrain.ts'

const MAX_RESOLUTION = 2
const LETTERBOX_COLOR = 0x0b2a3c
const ENEMY_SHOT_TINT = 0xffb1a3
const TRAIL_LENGTH = 22
/** Keeps the player's sail color apart from every other draw of the match seed. */
const PLAYER_SHIP_SALT = 0x73686970

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
  private readonly textures: GameTextures
  /** The sails the player flies this match. */
  private readonly playerShip: ShipStages
  private readonly app = new Application()
  private readonly scene = new Container()
  private readonly terrain: Terrain
  private readonly shipLayer = new Container()
  private readonly projectileLayer = new Container()
  private readonly effects: EffectLayer
  private readonly shipViews = new Map<number, ShipView>()
  private readonly projectileViews = new Map<number, Container>()
  // Shared by every projectile trail; destroyed once, after the trails.
  private readonly trailShape = new GraphicsContext()
    .rect(-TRAIL_LENGTH, -1.2, TRAIL_LENGTH, 2.4)
    .fill({ color: 0xffffff, alpha: 0.5 })
  private readonly seenIds = new Set<number>()
  private resizeObserver: ResizeObserver | null = null
  private state: RendererState = 'idle'

  /** `seed` is the match seed, from which the scenery picks its decorations. */
  constructor(map: MapLayout, seed: number, textures: GameTextures) {
    this.arena = map.arena
    this.textures = textures
    const { playerShips } = textures
    const pick = new SeededRandom(deriveSeed(seed, PLAYER_SHIP_SALT)).integer(0, playerShips.length - 1)
    const playerShip = playerShips[pick]
    if (!playerShip) {
      throw new Error('The player ship textures are missing.')
    }
    this.playerShip = playerShip
    this.terrain = new Terrain(map, seed, textures)
    this.effects = new EffectLayer(textures)
    // Attached up front so that destroying the application releases every
    // display object, even when it is destroyed before init() completes.
    this.scene.addChild(this.terrain.root, this.shipLayer, this.projectileLayer, this.effects.root)
    this.app.stage.addChild(this.scene)
  }

  get rendererName(): string {
    return this.app.renderer.name
  }

  /** Display objects currently alive, for leak checks in tests and profiling. */
  get viewCount(): number {
    return this.shipViews.size + this.projectileViews.size + this.effects.count
  }

  async mount(host: HTMLElement): Promise<void> {
    await this.app.init({
      preference: 'webgl',
      background: LETTERBOX_COLOR,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, MAX_RESOLUTION),
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      autoStart: false,
      sharedTicker: false,
    })

    if (this.state === 'destroyed') {
      this.release()
      return
    }

    this.state = 'running'
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

  render(world: World, alpha: number, events: readonly GameEvent[]): void {
    // Simulation time, in steps: animations use it so they freeze during pauses.
    const now = world.step + alpha
    for (const event of events) {
      this.effects.handle(event, now)
      if (event.type === 'shipDamaged') {
        this.shipViews.get(event.shipId)?.flash(now)
      } else if (event.type === 'shipDestroyed') {
        const pose = this.shipViews.get(event.shipId)?.hullPose
        if (pose) {
          const wreck = this.stagesOf(event.kind).wreck
          this.effects.sinkWreck(wreck, event.x, event.y, pose.rotation, pose.scale, now)
        }
      }
    }

    this.seenIds.clear()
    this.syncShip(world.player, alpha, now)
    for (const enemy of world.enemies) {
      this.syncShip(enemy, alpha, now)
    }
    for (const [id, view] of this.shipViews) {
      if (!this.seenIds.has(id)) {
        view.destroy()
        this.shipViews.delete(id)
      }
    }

    this.seenIds.clear()
    for (const projectile of world.projectiles) {
      this.syncProjectile(projectile, alpha)
    }
    for (const [id, view] of this.projectileViews) {
      if (!this.seenIds.has(id)) {
        view.destroy({ children: true })
        this.projectileViews.delete(id)
      }
    }

    this.terrain.update(now)
    this.effects.update(now)
  }

  destroy(): void {
    const wasRunning = this.state === 'running'
    this.state = 'destroyed'
    if (!wasRunning) {
      return
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.release()
  }

  private stagesOf(kind: ShipKind): ShipStages {
    return kind === 'player' ? this.playerShip : this.textures.ships[kind]
  }

  private syncShip(ship: Ship, alpha: number, now: number): void {
    this.seenIds.add(ship.id)
    let view = this.shipViews.get(ship.id)
    if (!view) {
      view = new ShipView(ship, this.stagesOf(ship.kind), this.textures.flames)
      this.shipViews.set(ship.id, view)
      this.shipLayer.addChild(view.root)
    }
    view.update(ship, alpha, now)
  }

  private syncProjectile(projectile: Projectile, alpha: number): void {
    this.seenIds.add(projectile.id)
    let view = this.projectileViews.get(projectile.id)
    if (!view) {
      view = new Container({ rotation: Math.atan2(projectile.stepY, projectile.stepX) })
      const ball = new Sprite({ texture: this.textures.cannonBall, anchor: 0.5 })
      if (projectile.faction === 'enemy') {
        ball.tint = ENEMY_SHOT_TINT
      }
      view.addChild(new Graphics(this.trailShape), ball)
      this.projectileViews.set(projectile.id, view)
      this.projectileLayer.addChild(view)
    }
    view.position.set(
      projectile.previousX + (projectile.x - projectile.previousX) * alpha,
      projectile.previousY + (projectile.y - projectile.previousY) * alpha,
    )
  }

  /**
   * Views go first, then the geometry they share, then the application.
   * Textures belong to the shared asset cache and are never destroyed here.
   */
  private release(): void {
    for (const view of this.shipViews.values()) {
      view.destroy()
    }
    this.shipViews.clear()
    for (const view of this.projectileViews.values()) {
      view.destroy({ children: true })
    }
    this.projectileViews.clear()
    this.effects.destroy()
    this.trailShape.destroy()
    this.terrain.destroy()
    // Everything left (layers and the scene) owns no shared resource.
    this.app.destroy({ removeView: true }, { children: true, context: true })
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
