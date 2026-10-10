import type { GameplayConfig } from './GameplayConfig.ts'
import { deepFreeze } from './deepFreeze.ts'

export const RULES_VERSION = 1

export const defaultGameplayConfig: GameplayConfig = deepFreeze({
  rulesVersion: RULES_VERSION,
  stepsPerSecond: 60,
  matchDurationSeconds: 120,
  spawn: {
    intervalSeconds: 2.5,
    openingSequence: ['chaser', 'shooter'],
    weights: { chaser: 1, shooter: 1 },
    minDistanceFromPlayer: 360,
    attempts: 32,
  },
  projectileRadius: 4,
  player: {
    maxHealth: 100,
    speed: 180,
    turnSpeed: Math.PI,
    radius: 22,
    frontCannon: {
      damage: 20,
      projectileSpeed: 600,
      projectileLifetimeSeconds: 1.4,
      cooldownSeconds: 0.25,
    },
    sideCannons: {
      damage: 15,
      projectileSpeed: 500,
      projectileLifetimeSeconds: 1.2,
      cooldownSeconds: 0.9,
      count: 3,
      spacing: 14,
    },
  },
  chaser: {
    maxHealth: 30,
    speed: 100,
    turnSpeed: 2.4,
    radius: 20,
    contactDamage: 25,
  },
  shooter: {
    maxHealth: 40,
    speed: 75,
    turnSpeed: 1.8,
    radius: 22,
    cannon: {
      damage: 10,
      projectileSpeed: 400,
      projectileLifetimeSeconds: 1.5,
      cooldownSeconds: 1.5,
    },
    range: 280,
    rangeHysteresis: 40,
    aimToleranceRadians: 0.15,
  },
  navigation: {
    cellSize: 40,
    repathIntervalSeconds: 0.25,
  },
})
