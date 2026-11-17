const VERSION = "0.5";

const CONFIG = {
  width: 1280,
  height: 720,
  player: { radius: 34, speed: 230, hp: 300, pickupRange: 70 },
  sludge: { tank: 100, drainPerSec: 100 / 3, refillPerSec: 25, refillDelay: 0.6, length: 420, width: 46, dps: 70, push: 60 },
  cleaner: { max: 5, cooldown: 1.2, radius: 11, speed: 210, launchSpeed: 520, launchTime: 0.22, hp: 40, damage: 12, attackInterval: 0.5, attackRange: 8, carryMax: 5, sightRange: 380, grabRange: 110 },
  claw: { reach: 170, pickRange: 70, pullTime: 0.15, cooldown: 0.4, throwSpeed: 720, throwTime: 0.6, impactDamage: 45, impactRadius: 60, selfDamage: 45, stun: 0.6 },
  cube: { cost: 5, cooldown: 0.8, max: 4, radius: 18, hp: 150, life: 30, throwDamage: 90, throwRadius: 75 },
  mine: { cost: 4, cooldown: 0.6, max: 3, radius: 12, trigger: 22, blastRadius: 95, damage: 90, armTime: 0.5 },
  boost: { cooldown: 15, duration: 5, speedMul: 1.7 },
  overclock: { cooldown: 25, duration: 6, recoil: 3, boostMul: 2, recoilMul: 0.5 },
  enemyAttackInterval: 0.8,
  enemies: {
    drone: { name: "소형 드론", radius: 13, speed: 120, hp: 30, damage: 10, scrap: 1, color: "#e0525a" },
    guard: { name: "경비 로봇", radius: 22, speed: 70, hp: 120, damage: 22, scrap: 3, color: "#b44ad8" }
  },
  waves: { firstDelay: 3, breakTime: 4, baseCount: 6, countPerWave: 3, hpPerWave: 0.08, guardFromWave: 2, guardRatio: 0.2, spawnInterval: 0.5 },
  scrap: { radius: 7, life: 25 }
};
