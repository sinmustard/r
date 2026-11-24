const VERSION = "0.12";

const CONFIG = {
  width: 1280,
  height: 720,
  player: { radius: 34, speed: 230, hp: 300, pickupRange: 70 },
  sludge: { tank: 100, drainPerSec: 100 / 3, refillPerSec: 25, refillDelay: 0.6, length: 420, width: 46, dps: 70, push: 60 },
  cleaner: { max: 5, cooldown: 1.2, radius: 11, speed: 210, launchSpeed: 520, launchTime: 0.22, hp: 40, damage: 12, attackInterval: 0.5, attackRange: 8, carryMax: 5, sightRange: 380, grabRange: 110 },
  claw: { reach: 170, pickRange: 70, pullTime: 0.15, cooldown: 0.4, throwSpeed: 720, throwTime: 0.6, impactDamage: 45, impactRadius: 60, selfDamage: 45, stun: 0.6 },
  cube: { cost: 5, cooldown: 0.8, max: 4, radius: 18, hp: 150, life: 30, throwDamage: 90, throwRadius: 75 },
  mine: { cost: 4, cooldown: 0.6, max: 3, radius: 12, trigger: 22, blastRadius: 95, damage: 90, armTime: 0.5, detonateHold: 0.4 },
  boost: { cooldown: 15, duration: 5, speedMul: 1.7 },
  overclock: { cooldown: 25, duration: 6, recoil: 3, boostMul: 2, recoilMul: 0.5 },
  modules: { slots: 4, basicCost: 6, specialCost: 12, devMul: 2, refund: 0.5 },
  fusion: { radius: 16, hpMul: 1.2, damageMul: 2.2, spinRange: 42, spinInterval: 0.6, spinDamage: 0.8 },
  puddle: { interval: 0.1, radius: 26, life: 2.5, slow: 0.5 },
  chain: { speed: 380, time: 0.25, falloff: 0.6, depth: 2 },
  absorb: { range: 260 },
  emergency: { range: 40 },
  steam: { range: 160, push: 90, stun: 1 },
  enemyAttackInterval: 0.8,
  enemies: {
    drone: { name: "소형 드론", radius: 13, speed: 120, hp: 30, damage: 10, scrap: 1, color: "#e0525a" },
    guard: { name: "경비 로봇", radius: 22, speed: 70, hp: 120, damage: 22, scrap: 3, color: "#b44ad8" },
    boss: { name: "구역 관리 기체", radius: 40, speed: 55, hp: 1400, damage: 35, scrap: 25, color: "#c0392b" },
    clone: { name: "복제 프로그램", radius: 30, speed: 0, hp: 120, damage: 30, scrap: 0, color: "#ff3b6b" }
  },
  battle: { spawnInterval: 0.5, baseCount: 6, countPerLevel: 2, hpPerLevel: 0.08, guardFromLevel: 2, guardRatio: 0.2, eliteGuardRatio: 0.5, eliteHp: 1.3, collectTime: 3 },
  route: { nodesPerZone: 6, minChoices: 2, maxChoices: 3 },
  bosses: [
    { name: "철강공장", sprite: "steel-factory", radius: 46 },
    { name: "자동차공장", sprite: "auto-factory", radius: 48 },
    { name: "화학공장", sprite: "chemical-factory", radius: 46 },
    { name: "집행자", sprite: "executioner", radius: 50 },
    { name: "중앙 AI", sprite: "central-ai", radius: 44 }
  ],
  bossDrawScale: 3.3,
  boss: { hpPerZone: 0.5, contactDamage: 30, vulnerableMul: 1.5, enterY: 150, objectLife: 20 },
  events: { repairCost: 8, repairHp: 120, pileBig: 12, pileHurt: 20, pileSmall: 6, crateScrap: 8, crateHp: 60 },
  scrap: { radius: 7, life: 25 }
};
