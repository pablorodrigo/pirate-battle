import type { ShipKind } from './entities.ts'

export type CannonKind = 'front' | 'left' | 'right' | 'enemy'
export type EndReason = 'timeout' | 'death'

/**
 * Facts produced by a simulation step. Rules have already been applied when an
 * event is emitted: presentation reacts to events but never decides outcomes.
 */
export type GameEvent =
  | { readonly type: 'shotFired'; readonly shipId: number; readonly cannon: CannonKind; readonly x: number; readonly y: number; readonly angle: number }
  | { readonly type: 'projectileImpact'; readonly x: number; readonly y: number; readonly target: 'ship' | 'island' }
  | { readonly type: 'shipDamaged'; readonly shipId: number; readonly kind: ShipKind; readonly damage: number; readonly health: number }
  | { readonly type: 'shipDestroyed'; readonly shipId: number; readonly kind: ShipKind; readonly cause: 'projectile' | 'collision'; readonly x: number; readonly y: number }
  | { readonly type: 'enemySpawned'; readonly shipId: number; readonly kind: ShipKind }
  | { readonly type: 'scoreChanged'; readonly score: number }
  | { readonly type: 'matchEnded'; readonly reason: EndReason }
