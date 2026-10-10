import { Assets, CanvasSource, Rectangle, Texture, type TextureSource } from 'pixi.js'
import shipSheetUrl from '../../../assets/spritesheet/ships_miscellaneous_sheet.png'
import shipAtlasUrl from '../../../assets/spritesheet/ships_miscellaneous_sheet.xml?url'
import tileSheetUrl from '../../../assets/tilesheet/tiles_sheet.png'
import tileSheetRetinaUrl from '../../../assets/tilesheet/tiles_sheet_retina.png'
import type { ShipKind } from '../core/entities.ts'
import { parseSparrowAtlas, type AtlasFrame } from './sparrowAtlas.ts'

export type DamageStage = 'intact' | 'damaged' | 'critical' | 'wreck'

export type TilePlacement = {
  readonly tile: number
  /** Top-left corner in logical units. */
  readonly x: number
  readonly y: number
  /** Drawn size in logical units; tiles are 64 units. */
  readonly size?: number
}

export type GameTextures = {
  readonly ships: Readonly<Record<ShipKind, Readonly<Record<DamageStage, Texture>>>>
  readonly cannonBall: Texture
  /** Large, medium and small explosion. */
  readonly explosions: readonly [Texture, Texture, Texture]
  readonly flames: readonly [Texture, Texture]
  /** Sailors who jump overboard when their ship goes down. */
  readonly crew: readonly Texture[]
  /**
   * Draws tiles onto a new canvas texture at whole-unit positions. Static
   * scenery is baked this way so neighbouring atlas texels never bleed into
   * seams when the scene is scaled. The caller owns the texture and releases
   * it with `destroyBakedTexture`. Only a `tiling` texture repeats past its
   * edges; any other clamps to them, so its borders never blend in pixels of
   * the opposite border.
   */
  readonly bakeTiles: (
    width: number,
    height: number,
    placements: readonly TilePlacement[],
    options?: { readonly tiling?: boolean },
  ) => Texture
}

/** Sail color of each ship kind: 2 is black, 3 red and 5 blue in the asset pack. */
const SHIP_COLOR: Readonly<Record<ShipKind, number>> = { player: 5, chaser: 3, shooter: 2 }
/** Sprite n is intact; n + 6, n + 12 and n + 18 show increasing damage and the wreck. */
const DAMAGE_OFFSET: Readonly<Record<DamageStage, number>> = { intact: 0, damaged: 6, critical: 12, wreck: 18 }
const TILE_SIZE = 64
const TILE_COLUMNS = 16
/** A stalled connection must surface as a recoverable error rather than an endless spinner. */
const LOAD_TIMEOUT_MS = 20_000

let loading: Promise<GameTextures> | null = null

/**
 * Loads the textures of a match once and shares them across matches. A
 * failed load is forgotten, so the next attempt fetches the files again.
 */
export function loadGameTextures(onProgress: (fraction: number) => void): Promise<GameTextures> {
  if (!loading) {
    loading = withTimeout(fetchGameTextures(onProgress), LOAD_TIMEOUT_MS).catch((error: unknown) => {
      loading = null
      throw error
    })
  } else {
    onProgress(1)
  }
  return loading
}

async function fetchGameTextures(onProgress: (fraction: number) => void): Promise<GameTextures> {
  // Image loads inside PixiJS's worker never settle when a request fails, so
  // they run on the main thread, where failures reject and can be retried.
  Assets.setPreferences({ preferWorkers: false })
  onProgress(0)
  const response = await fetch(shipAtlasUrl)
  if (!response.ok) {
    throw new Error(`Could not load the ship atlas (HTTP ${response.status}).`)
  }
  const frames = parseSparrowAtlas(await response.text())
  onProgress(0.1)

  // Only the tile sheet has a true 2× version; the ship sheet is 1× in both.
  const tileResolution = window.devicePixelRatio > 1 ? 2 : 1
  const loaded = await Assets.load<Texture>(
    [
      { alias: 'pirate-battle:ships', src: shipSheetUrl },
      {
        alias: 'pirate-battle:tiles',
        src: tileResolution === 2 ? tileSheetRetinaUrl : tileSheetUrl,
        data: { resolution: tileResolution },
      },
    ],
    (fraction) => onProgress(0.1 + fraction * 0.9),
  )
  const shipSheet = loaded['pirate-battle:ships']
  const tileSheet = loaded['pirate-battle:tiles']
  if (!shipSheet || !tileSheet) {
    throw new Error('The game textures did not load.')
  }
  return createGameTextures(frames, shipSheet, tileSheet)
}

/**
 * Builds the shared textures in a scope of their own. Closures that outlive
 * the load, such as `bakeTiles`, keep their whole scope alive, so they must
 * not share it with the first caller's progress callback, which would keep
 * that caller's game screen in memory for the rest of the session.
 */
function createGameTextures(
  frames: ReadonlyMap<string, AtlasFrame>,
  shipSheet: Texture,
  tileSheet: Texture,
): GameTextures {
  const fromAtlas = (name: string): Texture => {
    const frame = frames.get(name)
    if (!frame) {
      throw new Error(`Missing sprite "${name}" in the ship atlas.`)
    }
    return frameTexture(shipSheet.source, frame)
  }
  const shipTextures = (kind: ShipKind) => {
    const color = SHIP_COLOR[kind]
    const stage = (damage: DamageStage) => fromAtlas(`ship_${color + DAMAGE_OFFSET[damage]}`)
    return { intact: stage('intact'), damaged: stage('damaged'), critical: stage('critical'), wreck: stage('wreck') }
  }
  return {
    ships: { player: shipTextures('player'), chaser: shipTextures('chaser'), shooter: shipTextures('shooter') },
    cannonBall: fromAtlas('cannon_ball'),
    explosions: [fromAtlas('explosion_1'), fromAtlas('explosion_2'), fromAtlas('explosion_3')],
    flames: [fromAtlas('fire_1'), fromAtlas('fire_2')],
    crew: [1, 2, 3, 4, 5, 6].map((index) => fromAtlas(`crew_${index}`)),
    bakeTiles: (width, height, placements, options) =>
      bakeTiles(tileSheet.source, width, height, placements, options?.tiling ?? false),
  }
}

function bakeTiles(
  sheet: TextureSource,
  width: number,
  height: number,
  placements: readonly TilePlacement[],
  tiling: boolean,
): Texture {
  const resolution = sheet.resolution
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * resolution)
  canvas.height = Math.ceil(height * resolution)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('A 2D canvas is required to draw the scenery.')
  }
  const image = sheet.resource as CanvasImageSource
  const tilePixels = TILE_SIZE * resolution
  for (const { tile, x, y, size = TILE_SIZE } of placements) {
    const index = tile - 1
    context.drawImage(
      image,
      (index % TILE_COLUMNS) * tilePixels,
      Math.floor(index / TILE_COLUMNS) * tilePixels,
      tilePixels,
      tilePixels,
      Math.round(x * resolution),
      Math.round(y * resolution),
      Math.round(size * resolution),
      Math.round(size * resolution),
    )
  }
  const source = new CanvasSource({ resource: canvas, resolution })
  source.addressMode = tiling ? 'repeat' : 'clamp-to-edge'
  return new Texture({ source })
}

/**
 * Destroys a texture made by `bakeTiles` and gives its canvas pixels back at
 * once. PixiJS keeps the sources of its last draw batches in a global pool
 * until it reuses the batches, which would hold the pixels after the match.
 */
export function destroyBakedTexture(texture: Texture): void {
  const canvas: unknown = texture.source.resource
  texture.destroy(true)
  if (canvas instanceof HTMLCanvasElement) {
    canvas.width = 0
    canvas.height = 0
  }
}

/** Frames are in logical units, so a 2× sheet keeps the same layout as the 1× one. */
function frameTexture(source: TextureSource, frame: AtlasFrame): Texture {
  return new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) })
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Loading the game assets timed out.')), milliseconds)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
