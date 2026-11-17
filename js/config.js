const VERSION = "0.3";

const CONFIG = {
  width: 1280,
  height: 720,
  player: { radius: 34, speed: 230, hp: 300, pickupRange: 70 },
  sludge: { tank: 100, drainPerSec: 40, refillPerSec: 25, refillDelay: 0.6, minToFire: 20, length: 420, width: 46, dps: 70, push: 60 },
  cleaner: { max: 5, cooldown: 1.2, radius: 11, speed: 210, launchSpeed: 520, launchTime: 0.22, hp: 40, damage: 12, attackInterval: 0.5, attackRange: 8, carryMax: 5, sightRange: 380, grabRange: 110 },
  enemyAttackInterval: 0.8,
  enemies: {
    drone: { name: "소형 드론", radius: 13, speed: 120, hp: 30, damage: 10, scrap: 1, color: "#e0525a" },
    guard: { name: "경비 로봇", radius: 22, speed: 70, hp: 120, damage: 22, scrap: 3, color: "#b44ad8" }
  },
  waves: { firstDelay: 3, breakTime: 4, baseCount: 6, countPerWave: 3, hpPerWave: 0.08, guardFromWave: 2, guardRatio: 0.2, spawnInterval: 0.5 },
  scrap: { radius: 7, life: 25 }
};
