export type EnemyKind = 'chaser' | 'shooter'

export type ShipStats = {
  readonly maxHealth: number
  /** Logical units per second. */
  readonly speed: number
  /** Radians per second. */
  readonly turnSpeed: number
  readonly radius: number
}

export type CannonStats = {
  readonly damage: number
  /** Logical units per second. */
  readonly projectileSpeed: number
  readonly projectileLifetimeSeconds: number
  readonly cooldownSeconds: number
}

export type SpawnConfig = {
  readonly intervalSeconds: number
  /** Kinds used for the first spawns, so every match meets both enemies. */
  readonly openingSequence: readonly EnemyKind[]
  /** Relative weights of each kind after the opening sequence. */
  readonly weights: Readonly<Record<EnemyKind, number>>
  readonly minDistanceFromPlayer: number
  /** Random positions tried before falling back to the arena's safe points. */
  readonly attempts: number
}

export type PlayerConfig = ShipStats & {
  readonly frontCannon: CannonStats
  readonly sideCannons: CannonStats & {
    readonly count: number
    /** Distance between neighbouring side cannons along the hull. */
    readonly spacing: number
  }
}

export type ChaserConfig = ShipStats & {
  readonly contactDamage: number
}

export type ShooterConfig = ShipStats & {
  readonly cannon: CannonStats
  readonly range: number
  /** Extra distance an engaged Shooter tolerates before chasing again. */
  readonly rangeHysteresis: number
  /** Largest angle between the bow and the player at which a Shooter fires. */
  readonly aimToleranceRadians: number
}

export type NavigationConfig = {
  readonly cellSize: number
  readonly repathIntervalSeconds: number
}

export type IntegerRange = { readonly min: number; readonly max: number }

/** How every match draws its map. Lengths are in arena units, sizes in 64-unit tiles. */
export type MapConfig = {
  /** Sand and grass islands, not counting reefs. */
  readonly islandCount: IntegerRange
  /** Single rocks that block ships and projectiles like islands. */
  readonly reefCount: IntegerRange
  readonly sandColumns: IntegerRange
  readonly sandRows: IntegerRange
  /** Chance that a map has the large grass island. */
  readonly grassIslandChance: number
  /** Sand islands placed against a border, as stretches of coast; the rest stay in open water. */
  readonly coastCount: IntegerRange
  /** Narrowest water between two obstacles, or between an obstacle and a border it does not touch. */
  readonly minChannel: number
  /** Open water kept around the player's start. */
  readonly startClearance: number
  /** Share of the arena the obstacles may cover. */
  readonly coverage: { readonly min: number; readonly max: number }
  /** Layouts drawn before the classic map is used instead. */
  readonly attempts: number
}

/**
 * Every rule parameter of a match. A match runs on a frozen snapshot of this
 * object, so changing Options never affects a match in progress.
 */
export type GameplayConfig = {
  /** Bumped whenever balance or scoring changes, so rankings never mix rule sets. */
  readonly rulesVersion: number
  readonly stepsPerSecond: number
  readonly matchDurationSeconds: number
  readonly spawn: SpawnConfig
  readonly projectileRadius: number
  readonly player: PlayerConfig
  readonly chaser: ChaserConfig
  readonly shooter: ShooterConfig
  readonly navigation: NavigationConfig
  readonly map: MapConfig
}
