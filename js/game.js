const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = CONFIG.width;
const H = CONFIG.height;
const FONT = "'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

const MECH = {
  scale: 0.095,
  spriteScale: 0.25,
  anchor: [780, 520],
  body: [82, 132],
  legLeft: [448, 836],
  legRight: [876, 836],
  shoulder: [41, -1],
  pipeSegments: 3,
  pipeSegment: 11,
  nozzle: 11,
  pipeLength: 48,
  chimney: [31, -20],
  shutter: [0, 27],
  claw: [-60, 28],
  clawShoulder: [-43, 4]
};

const SPRITES = {};

function loadSprite(name, src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      SPRITES[name] = img;
      resolve();
    };
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function nearest(list, from, range) {
  let best = null;
  let bestDist = range;
  for (const o of list) {
    if (o.dead) continue;
    const d = dist(o, from);
    if (d < bestDist) {
      bestDist = d;
      best = o;
    }
  }
  return best;
}

function moveToward(o, tx, ty, step) {
  const dx = tx - o.x;
  const dy = ty - o.y;
  const d = Math.hypot(dx, dy);
  if (d <= step || d === 0) {
    o.x = tx;
    o.y = ty;
    return;
  }
  o.x += (dx / d) * step;
  o.y += (dy / d) * step;
}

function separate(list, strength) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d > 0 && d < min) {
        const push = ((min - d) / 2) * strength;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
}

function pushOut(o, from) {
  const dx = o.x - from.x;
  const dy = o.y - from.y;
  const d = Math.hypot(dx, dy);
  const min = o.r + from.r;
  if (d > 0 && d < min) {
    o.x = from.x + (dx / d) * min;
    o.y = from.y + (dy / d) * min;
  }
}

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = W * s + "px";
  canvas.style.height = H * s + "px";
  canvas.width = Math.round(W * s * dpr);
  canvas.height = Math.round(H * s * dpr);
}
window.addEventListener("resize", resize);
resize();

const keys = new Set();
const mouse = { x: W / 2, y: H / 2, spray: false };
let state = "title";
let overAt = 0;
let game = newGame();

function newGame() {
  return {
    player: { x: W / 2, y: H / 2, r: CONFIG.player.radius, hp: CONFIG.player.hp, maxHp: CONFIG.player.hp, aim: 0, facing: 1, moving: false, flash: 0, walk: 0, smoke: 0 },
    tank: CONFIG.sludge.tank,
    tankLocked: false,
    held: null,
    clawCooldown: 0,
    cubes: [],
    mines: [],
    rings: [],
    cubeCooldown: 0,
    mineCooldown: 0,
    boost: 0,
    boostFx: { damage: 1, speed: 1, sweep: false },
    boostCooldown: 0,
    shield: 0,
    ocSteam: false,
    overclock: 0,
    recoil: 0,
    overclockCooldown: 0,
    cartridges: newCartridges(),
    puddles: [],
    hazards: [],
    bossShots: [],
    puddleTimer: 0,
    eDownAt: null,
    refillWait: 0,
    beam: null,
    cleaners: [],
    enemies: [],
    scraps: [],
    particles: [],
    texts: [],
    ejectCooldown: 0,
    scrap: 0,
    scrapPulse: 0,
    kills: 0,
    zone: 1,
    lastZone: finalZone(),
    step: 0,
    node: null,
    lastNode: null,
    level: 0,
    boss: null,
    toSpawn: 0,
    spawnTimer: 0,
    clearTimer: -1,
    banner: 0,
    bannerText: "",
    shake: 0,
    time: 0
  };
}

function startGame() {
  if (!tutorialDone()) {
    startGuide(true);
    return;
  }
  game = newGame();
  state = "play";
  mouse.spray = false;
  openRoute();
}

function finalZone() {
  return clearCount() >= CONFIG.unlockZone5 ? CONFIG.bosses.length : CONFIG.bosses.length - 1;
}

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    return null;
  }
  return null;
}

const settings = Object.assign({ shake: true }, JSON.parse(store("factory-settings") || "{}"));

function saveSettings() {
  store("factory-settings", JSON.stringify(settings));
}

function clearCount() {
  try {
    return Number(localStorage.getItem("factory-clears")) || 0;
  } catch (e) {
    return 0;
  }
}

function addClear() {
  const n = clearCount() + 1;
  try {
    localStorage.setItem("factory-clears", String(n));
  } catch (e) {
    return n;
  }
  return n;
}

function canRestart() {
  return state === "over" && performance.now() - overAt > 800;
}

function goTitle() {
  routeEl.hidden = true;
  upgradeEl.hidden = true;
  state = "title";
  titleView = "menu";
  titleIndex = 0;
  mouse.spray = false;
}

let titleView = "menu";
let titleIndex = 0;

function setView(v) {
  titleView = v;
  titleIndex = 0;
}

function titleButtonsFor(view) {
  if (view === "settings") {
    return [
      { label: "화면 흔들림 · " + (settings.shake ? "켜짐" : "꺼짐"), action: () => { settings.shake = !settings.shake; saveSettings(); } },
      { label: "전체 화면 · " + (document.fullscreenElement ? "켜짐" : "꺼짐"), action: toggleFullscreen },
      { label: "돌아가기", action: () => setView("menu") }
    ];
  }
  if (view === "reset") {
    return [
      { label: "기록 지우기", action: () => { store("factory-clears", null); setView("menu"); } },
      { label: "취소", action: () => setView("menu") }
    ];
  }
  return [
    { label: "게임 시작", action: () => startGame() },
    { label: "튜토리얼", action: () => startGuide(false) },
    { label: "조작법", action: () => setView("controls") },
    { label: "설정", action: () => setView("settings") },
    { label: "기록 초기화", action: () => setView("reset") }
  ];
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
const titleBack = { x: 120, y: 604, w: 220, h: 48 };
const titleScene = {
  t: 0,
  scale: 2.4,
  mech: { x: 860, y: 470, r: 34, aim: 0, facing: 1, moving: false, flash: 0, walk: 0 },
  drones: [],
  particles: [],
  spawn: 0,
  fire: 1.5,
  beam: null,
  smoke: 0
};

function titleButtonRect(i) {
  return { x: 120, y: 392 + i * 54, w: 300, h: 44 };
}

function inRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function titleHover() {
  if (titleView === "controls") return inRect(titleBack, mouse.x, mouse.y);
  const titleButtons = titleButtonsFor(titleView);
  for (let i = 0; i < titleButtons.length; i++) {
    if (inRect(titleButtonRect(i), mouse.x, mouse.y)) {
      titleIndex = i;
      return true;
    }
  }
  return false;
}

function titleClick() {
  if (titleView === "controls") {
    if (inRect(titleBack, mouse.x, mouse.y)) setView("menu");
    return;
  }
  const titleButtons = titleButtonsFor(titleView);
  for (let i = 0; i < titleButtons.length; i++) {
    if (inRect(titleButtonRect(i), mouse.x, mouse.y)) {
      titleButtons[i].action();
      return;
    }
  }
}

function titleKey(code) {
  if (titleView === "controls") {
    if (["Escape", "Space", "Enter", "Backspace"].includes(code)) setView("menu");
    return;
  }
  if (titleView !== "menu" && (code === "Escape" || code === "Backspace")) {
    setView("menu");
    return;
  }
  const titleButtons = titleButtonsFor(titleView);
  const n = titleButtons.length;
  if (code === "KeyW" || code === "ArrowUp") titleIndex = (titleIndex + n - 1) % n;
  if (code === "KeyS" || code === "ArrowDown") titleIndex = (titleIndex + 1) % n;
  if (code === "Space" || code === "Enter") titleButtons[titleIndex].action();
}

window.addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  onPress(e.code);
});
window.addEventListener("keyup", e => {
  keys.delete(e.code);
  if (state === "play" && e.code === "KeyE") releaseMine();
});
window.addEventListener("blur", () => {
  keys.clear();
  mouse.spray = false;
  if (state === "play") state = "pause";
});
window.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * W;
  mouse.y = ((e.clientY - rect.top) / rect.height) * H;
  canvas.style.cursor = state === "title" && titleHover() ? "pointer" : "crosshair";
});
window.addEventListener("mousedown", e => {
  if (e.button === 2) {
    if (state === "play") mouse.spray = true;
    return;
  }
  if (e.button !== 0) return;
  if (state === "title") {
    titleClick();
    return;
  }
  if (state === "guide") {
    guideNext();
    return;
  }
  if (state === "over") {
    if (canRestart()) startGame();
    return;
  }
  if (state === "pause") {
    state = "play";
    return;
  }
  if (state === "play") useClaw();
});
window.addEventListener("mouseup", e => {
  if (e.button === 2) mouse.spray = false;
});
window.addEventListener("contextmenu", e => e.preventDefault());

function onPress(code) {
  if (state === "title") {
    titleKey(code);
    return;
  }
  if (state === "guide") {
    guideKey(code);
    return;
  }
  if (state === "pause" && code === "Backspace" && game.tutorial && !game.tutorial.required) {
    goTitle();
    return;
  }
  if (state === "upgrade") {
    if (code === "Enter" && !upgradeEl.contains(document.activeElement)) closeUpgrade();
    return;
  }
  if (state === "route" || state === "event") {
    routeKey(code);
    return;
  }
  if (state === "over") {
    if (!canRestart()) return;
    if (code === "Space" || code === "Enter") startGame();
    if (code === "Escape") goTitle();
    return;
  }
  if (code === "Escape" || code === "KeyP") {
    state = state === "play" ? "pause" : "play";
    mouse.spray = false;
    return;
  }
  if (state !== "play") return;
  if (code === "KeyQ") ejectCleaner();
  if (code === "KeyR") recallCleaners();
  if (code === "KeyE") pressMine();
  if (code === "KeyF") compressScrap();
  if (code === "ShiftLeft" || code === "ShiftRight") startBoost();
  if (code === "Space") startOverclock();
}

function addText(x, y, text, color) {
  game.texts.push({ x, y, text, color, life: 1 });
}

function burst(x, y, color, n, speed, list = game.particles) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * rand(0.3, 1);
    const life = rand(0.3, 0.7);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: rand(2, 5) });
  }
}

function dropScrap(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rand(40, 140);
    game.scraps.push({ x, y, r: CONFIG.scrap.radius, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: CONFIG.scrap.life, spin: Math.random() * Math.PI });
  }
}

function spawnEnemy(force) {
  const g = game;
  const bc = CONFIG.battle;
  const type = force || pickEnemyType();
  const d = CONFIG.enemies[type];
  const side = Math.floor(Math.random() * 4);
  let x;
  let y;
  if (side === 0) {
    x = Math.random() * W;
    y = -d.radius;
  } else if (side === 1) {
    x = W + d.radius;
    y = Math.random() * H;
  } else if (side === 2) {
    x = Math.random() * W;
    y = H + d.radius;
  } else {
    x = -d.radius;
    y = Math.random() * H;
  }
  const hp = type === "boss"
    ? d.hp * (1 + (g.zone - 1) * CONFIG.boss.hpPerZone)
    : d.hp * (1 + g.level * bc.hpPerLevel) * (g.node === "elite" ? bc.eliteHp : 1);
  const e = { type, x, y, r: d.radius, hp, maxHp: hp, speed: d.speed, damage: d.damage, attackTimer: 0, flash: 0, angle: 0 };
  g.enemies.push(e);
  return e;
}

function ejectCleaner() {
  const g = game;
  const c = CONFIG.cleaner;
  const p = g.player;
  if (g.ejectCooldown > 0 || cleanerCount() >= c.max) return;
  const hp = c.hp * mm("cleaner", "summonHp");
  const reachMul = mm("cleaner", "range");
  const a = p.aim;
  const door = mechPoint(p, MECH.shutter[0], MECH.shutter[1]);
  g.cleaners.push({
    x: door.x,
    y: door.y,
    r: c.radius,
    vx: Math.cos(a) * c.launchSpeed,
    vy: Math.sin(a) * c.launchSpeed,
    launch: c.launchTime,
    hp,
    maxHp: hp,
    carry: 0,
    carryMax: c.carryMax + (modOn("cleaner", "carry") ? MODULE_TYPES.carry.add : 0),
    dmg: c.damage * mm("cleaner", "damage"),
    sight: c.sightRange * reachMul,
    reach: c.attackRange * reachMul,
    speed: c.speed * mm("cleaner", "moveSpeed"),
    interval: c.attackInterval,
    mode: "work",
    attackTimer: 0,
    bump: 0,
    flash: 0,
    angle: a
  });
  g.ejectCooldown = c.cooldown * mm("cleaner", "cooldown");
  burst(door.x, door.y, "#e8b931", 6, 120);
}

function useClaw() {
  const g = game;
  const k = CONFIG.claw;
  const p = g.player;
  if (g.held) {
    const e = g.held;
    const a = Math.atan2(mouse.y - e.y, mouse.x - e.x);
    e.held = false;
    e.pull = 0;
    e.thrown = { vx: Math.cos(a) * k.throwSpeed, vy: Math.sin(a) * k.throwSpeed, t: k.throwTime };
    g.held = null;
    g.clawCooldown = k.cooldown * mm("claw", "cooldown");
    burst(e.x, e.y, "#e8b931", 6, 140);
    return;
  }
  if (g.clawCooldown > 0) return;
  const target = clawTarget();
  g.clawCooldown = k.cooldown * mm("claw", "cooldown");
  if (!target) {
    addText(p.x, p.y - 50, "잡을 적이 없음", "#9aa3ad");
    return;
  }
  target.held = true;
  if (target.ai) target.ai = "move";
  target.windup = 0;
  target.pull = k.pullTime;
  target.stun = 0;
  g.held = target;
  g.clawCooldown = 0;
}

function clawTarget() {
  const g = game;
  const k = CONFIG.claw;
  const p = g.player;
  const reach = k.reach * mm("claw", "range");
  let target = null;
  let best = k.pickRange;
  for (const e of g.enemies.concat(g.cubes)) {
    if (e.dead || e.thrown || e.held || e.hot > 0 || e.type === "boss" || e.type === "clone" || dist(e, p) > reach) continue;
    const d = Math.hypot(e.x - mouse.x, e.y - mouse.y);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  return target;
}

function clawImpact(e) {
  const g = game;
  const k = CONFIG.claw;
  const depth = e.thrown && e.thrown.chain ? e.thrown.chain : 0;
  const hits = e.thrown && e.thrown.hits ? e.thrown.hits : new Set();
  const chain = modOn("claw", "special") && depth < CONFIG.chain.depth;
  const dmg = mm("claw", "damage") * ocMul() * Math.pow(CONFIG.chain.falloff, depth);
  const stun = k.stun * mm("claw", "duration");
  const push = mm("claw", "knockback");
  const slow = modOn("claw", "slow");
  e.thrown = null;
  e.stun = stun;
  if (!hits.has(e)) {
    hits.add(e);
    damageEnemy(e, k.selfDamage * dmg);
    if (slow) applySlow(e);
  }
  for (const o of g.enemies) {
    if (o === e || o.dead || o.held || hits.has(o)) continue;
    const d = dist(o, e);
    if (d <= k.impactRadius * mm("claw", "range") + o.r) {
      hits.add(o);
      damageEnemy(o, k.impactDamage * dmg);
      if (slow) applySlow(o);
      if (isBossLike(o)) continue;
      o.stun = Math.max(o.stun || 0, stun);
      if (chain && d > 0 && !o.thrown) {
        o.thrown = { vx: ((o.x - e.x) / d) * CONFIG.chain.speed * push, vy: ((o.y - e.y) / d) * CONFIG.chain.speed * push, t: CONFIG.chain.time, chain: depth + 1, ignore: e, hits };
      } else if (d > 0) {
        o.x += ((o.x - e.x) / d) * 24 * push;
        o.y += ((o.y - e.y) / d) * 24 * push;
      }
    }
  }
  burst(e.x, e.y, "#cfd6e0", 18, 220);
  burst(e.x, e.y, "#e8b931", 8, 160);
  g.shake = Math.min(8, g.shake + 3);
  if (e.onImpact) e.onImpact(e);
}

function updateClaw(dt) {
  const g = game;
  const k = CONFIG.claw;
  g.clawCooldown = Math.max(0, g.clawCooldown - dt);
  const e = g.held;
  if (e) {
    const hold = mechPoint(g.player, MECH.claw[0], MECH.claw[1]);
    if (e.pull > 0) {
      e.pull -= dt;
      moveToward(e, hold.x, hold.y, Math.max(dist(e, hold) / Math.max(e.pull, dt), 600) * dt);
    } else {
      e.x = hold.x;
      e.y = hold.y;
    }
  }
  for (const t of g.enemies.concat(g.cubes)) {
    if (!t.thrown || t.dead) continue;
    t.x += t.thrown.vx * dt;
    t.y += t.thrown.vy * dt;
    t.thrown.t -= dt;
    t.angle += dt * 20;
    let hit = t.x < t.r || t.x > W - t.r || t.y < t.r || t.y > H - t.r;
    if (!hit) {
      for (const o of g.enemies) {
        if (o !== t && o !== t.thrown.ignore && !o.dead && !o.held && !o.thrown && dist(o, t) < o.r + t.r) {
          hit = true;
          break;
        }
      }
    }
    t.x = clamp(t.x, t.r, W - t.r);
    t.y = clamp(t.y, t.r, H - t.r);
    if (t.kind === "cube" && (hit || t.thrown.t <= 0)) cubeImpact(t);
    else if (hit) clawImpact(t);
    else if (t.thrown.t <= 0) {
      t.thrown = null;
      t.stun = k.stun;
    }
  }
}

function recallCleaners() {
  const g = game;
  for (const r of g.cleaners) {
    r.mode = "return";
    if (g.boost > 0 && g.boostFx.sweep) r.sweep = true;
  }
}

function cleanerCount() {
  return game.cleaners.reduce((n, r) => n + (r.fused ? 2 : 1), 0);
}

function isBossLike(e) {
  return e.type === "boss" || e.type === "clone";
}

function hitTarget(t, dmg) {
  const g = game;
  if (t === g.player && g.shield > 0) {
    const soak = Math.min(g.shield, dmg);
    g.shield -= soak;
    dmg -= soak;
    burst(t.x, t.y, "#5ab0ff", 6, 120);
  }
  t.hp -= dmg;
  t.flash = 0.12;
  if (t === g.player) {
    g.shake = Math.min(8, g.shake + 4);
    burst(t.x, t.y, "#ffb347", 6, 140);
  } else if (t.kind === "cube") {
    if (t.hp <= 0 && !t.dead) {
      t.dead = true;
      burst(t.x, t.y, "#9aa3ad", 14, 160);
    }
  } else if (t.hp <= 0 && !t.dead) {
    t.dead = true;
    dropScrap(t.x, t.y, t.carry);
    burst(t.x, t.y, "#4fc3a1", 12, 160);
    addText(t.x, t.y - 20, "청소 로봇 파괴", "#ff7b7b");
  }
}

function damageEnemy(e, amount) {
  if (e.transition) return;
  amount *= enemyDamageMul(e);
  e.hp -= amount * (e.vulnerable > 0 ? CONFIG.boss.vulnerableMul : 1);
  e.flash = 0.08;
}

function update(dt) {
  const g = game;
  g.time += dt;
  if (g.boss && g.boss.transition) {
    updateBossTransition(dt);
    g.shake = Math.max(0, g.shake - dt * 20);
    updateEffects(dt);
    cleanup();
    return;
  }
  g.ejectCooldown = Math.max(0, g.ejectCooldown - dt);
  g.shake = Math.max(0, g.shake - dt * 20);
  g.banner = Math.max(0, g.banner - dt);
  g.scrapPulse = Math.max(0, g.scrapPulse - dt);
  updateBattle(dt);
  updatePlayer(dt);
  updateClaw(dt);
  updateSkills(dt);
  updateSludge(dt);
  updateCleaners(dt);
  updateBoss(dt);
  updateEnemies(dt);
  updateScraps(dt);
  updateEffects(dt);
  cleanup();
  if (g.tutorial) updateTutorial(dt);
  if (g.player.hp <= 0) {
    g.player.hp = 0;
    g.beam = null;
    state = "over";
    overAt = performance.now();
  }
}

function updatePlayer(dt) {
  const p = game.player;
  const c = CONFIG.player;
  let dx = 0;
  let dy = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (p.moving) {
    p.x += (dx / len) * c.speed * ocMul() * dt;
    p.y += (dy / len) * c.speed * ocMul() * dt;
    p.walk += dt;
  }
  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r, H - p.r);
  p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  updateFacing(p);
  p.flash = Math.max(0, p.flash - dt);
  p.smoke -= dt;
  if (p.smoke <= 0) {
    p.smoke = 0.18;
    const life = rand(0.8, 1.2);
    const cp = mechPoint(p, MECH.chimney[0], MECH.chimney[1]);
    game.particles.push({ x: cp.x, y: cp.y, vx: rand(-10, 10), vy: rand(-40, -25), life, max: life, color: "#6b707a", size: rand(4, 7) });
  }
}

function updateSludge(dt) {
  const g = game;
  const s = CONFIG.sludge;
  const p = g.player;
  if (g.tankLocked && !mouse.spray) g.tankLocked = false;
  const firing = mouse.spray && !g.tankLocked && g.tank > 0;
  if (!firing) {
    g.beam = null;
    if (g.refillWait > 0) g.refillWait -= dt;
    else g.tank = Math.min(s.tank, g.tank + (s.refillPerSec / mm("sludge", "cooldown")) * ocMul() * dt);
    return;
  }
  g.tank = Math.max(0, g.tank - s.drainPerSec * mm("sludge", "cost") * dt);
  g.refillWait = s.refillDelay * mm("sludge", "cooldown");
  if (g.tank <= 0) g.tankLocked = true;
  const cos = Math.cos(p.aim);
  const sin = Math.sin(p.aim);
  const nozzle = mechNozzle(p);
  const sx = nozzle.x;
  const sy = nozzle.y;
  const reach = mm("sludge", "range");
  const width = s.width * reach;
  const ex = sx + cos * s.length * reach;
  const ey = sy + sin * s.length * reach;
  g.beam = { sx, sy, ex, ey, w: width };
  if (modOn("sludge", "special")) {
    g.puddleTimer -= dt;
    if (g.puddleTimer <= 0) {
      g.puddleTimer = CONFIG.puddle.interval;
      spawnPuddle(g.beam);
    }
  }
  for (const e of g.enemies) {
    if (distToSegment(e.x, e.y, sx, sy, ex, ey) <= width / 2 + e.r) {
      damageEnemy(e, s.dps * mm("sludge", "damage") * ocMul() * dt);
      if (!e.held && !isBossLike(e)) {
        e.x += cos * s.push * mm("sludge", "knockback") * dt;
        e.y += sin * s.push * mm("sludge", "knockback") * dt;
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const t = Math.random();
    const side = rand(-1, 1) * 90;
    const life = rand(0.2, 0.4);
    g.particles.push({ x: sx + (ex - sx) * t, y: sy + (ey - sy) * t, vx: -sin * side + cos * 60, vy: cos * side + sin * 60, life, max: life, color: "#9fb83a", size: rand(2, 4) });
  }
}

function updateCleaners(dt) {
  const g = game;
  const c = CONFIG.cleaner;
  const p = g.player;
  const boosted = g.boost > 0;
  const quick = boosted ? CONFIG.boost.speedMul : 1;
  const moveMul = boosted ? CONFIG.boost.speedMul * g.boostFx.speed : 1;
  const dmgMul = boosted ? g.boostFx.damage : 1;
  g.cleaners.forEach((r, i) => {
    const speed = r.speed * moveMul;
    const interval = r.interval / quick;
    const damage = r.dmg * dmgMul;
    const sight = r.sight;
    const reach = r.reach;
    r.flash = Math.max(0, r.flash - dt);
    r.bump = Math.max(0, r.bump - dt);
    r.attackTimer -= dt;
    if (r.launch > 0) {
      r.launch -= dt;
      r.x = clamp(r.x + r.vx * dt, r.r, W - r.r);
      r.y = clamp(r.y + r.vy * dt, r.r, H - r.r);
      return;
    }
    let tx = null;
    let ty = null;
    if (r.mode === "return") {
      tx = p.x;
      ty = p.y;
      if (dist(r, p) < p.r + r.r + 6) {
        r.dead = true;
        g.delivered = (g.delivered || 0) + r.carry;
        if (r.carry > 0) {
          g.scrap += r.carry;
          g.scrapPulse = 0.4;
          addText(p.x, p.y - 50, "+" + r.carry + " 고철", "#cfd6e0");
        }
        return;
      }
    } else {
      const enemy = nearest(g.enemies.filter(e => !e.held && !e.thrown), r, sight);
      const nearScrap = r.carry < r.carryMax ? nearest(g.scraps, r, c.grabRange) : null;
      if (nearScrap && (!enemy || dist(r, enemy) > dist(r, nearScrap) + 40)) {
        tx = nearScrap.x;
        ty = nearScrap.y;
      } else if (enemy) {
        r.angle = Math.atan2(enemy.y - r.y, enemy.x - r.x);
        if (dist(r, enemy) <= enemy.r + r.r + reach) {
          if (r.attackTimer <= 0) {
            damageEnemy(enemy, damage);
            r.attackTimer = interval;
            r.bump = 0.12;
            burst(enemy.x, enemy.y, "#e8f0f2", 3, 90);
          }
        } else {
          tx = enemy.x;
          ty = enemy.y;
        }
      } else {
        const s = r.carry < r.carryMax ? nearest(g.scraps, r, sight) : null;
        if (s) {
          tx = s.x;
          ty = s.y;
        } else {
          const a = g.time * 0.8 + (i * Math.PI * 2) / c.max;
          tx = p.x + Math.cos(a) * 80;
          ty = p.y + Math.sin(a) * 80;
        }
      }
    }
    if (tx !== null) {
      r.angle = Math.atan2(ty - r.y, tx - r.x);
      moveToward(r, tx, ty, speed * dt);
    }
    if (r.carry < r.carryMax) {
      for (const s of g.scraps) {
        if (!s.dead && dist(r, s) < r.r + s.r + 4) {
          s.dead = true;
          r.carry++;
          if (r.carry >= r.carryMax) break;
        }
      }
    }
  });
  updateCleanerSpecials(dt, dmgMul);
  separate(g.cleaners.filter(r => !r.dead), 0.5);
  for (const r of g.cleaners) {
    pushOut(r, p);
    r.x = clamp(r.x, r.r, W - r.r);
    r.y = clamp(r.y, r.r, H - r.r);
  }
}

function updateEnemies(dt) {
  const g = game;
  const p = g.player;
  for (const e of g.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.slowT > 0) e.slowT -= dt;
    if (e.kind) trackBossMove(e, dt);
    if (e.held || e.thrown) continue;
    if (e.type === "boss" || e.type === "clone") {
      e.stun = 0;
      continue;
    }
    if (e.stun > 0) {
      e.stun -= dt;
      e.angle += dt * 8;
      if (e.ai && e.ai !== "move") e.ai = "move";
      e.windup = 0;
      continue;
    }
    if (e.passive) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      continue;
    }
    if (runEnemyAi(e, dt)) continue;
    e.attackTimer -= dt;
    let target = p;
    let best = dist(e, p) - p.r;
    for (const r of g.cleaners.concat(g.cubes)) {
      if (r.launch > 0 || r.dead || r.held || r.thrown) continue;
      const d = dist(e, r) - r.r;
      if (d < best) {
        best = d;
        target = r;
      }
    }
    e.angle = Math.atan2(target.y - e.y, target.x - e.x);
    if (best - e.r > 3) {
      moveToward(e, target.x, target.y, e.speed * slowMul(e) * dt);
    } else if (e.attackTimer <= 0) {
      e.attackTimer = CONFIG.enemyAttackInterval;
      hitTarget(target, e.damage);
    }
  }
  const free = g.enemies.filter(e => !e.held && !e.thrown);
  separate(free, 0.5);
  for (const e of free) {
    pushOut(e, p);
    for (const c of g.cubes) if (!c.held && !c.thrown && !c.dead) pushOut(e, c);
  }
}

function updateScraps(dt) {
  const g = game;
  const p = g.player;
  const friction = Math.pow(0.02, dt);
  for (const s of g.scraps) {
    if (s.dead) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.dead = true;
      continue;
    }
    s.x = clamp(s.x + s.vx * dt, s.r, W - s.r);
    s.y = clamp(s.y + s.vy * dt, s.r, H - s.r);
    s.vx *= friction;
    s.vy *= friction;
    const d = dist(s, p);
    if (d < CONFIG.player.pickupRange) moveToward(s, p.x, p.y, 420 * dt);
    if (dist(s, p) < p.r) {
      s.dead = true;
      g.scrap++;
      g.scrapPulse = 0.4;
    }
  }
}

function updateParticles(list, dt) {
  const friction = Math.pow(0.05, dt);
  for (const pt of list) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= friction;
    pt.vy *= friction;
  }
}

function updateEffects(dt) {
  updateParticles(game.particles, dt);
  for (const t of game.texts) {
    t.life -= dt;
    t.y -= 30 * dt;
  }
}

function cleanup() {
  const g = game;
  for (const e of g.enemies) {
    if (e.dead && e.noReward) continue;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      if (e.onDeath) e.onDeath(e);
      g.kills++;
      dropScrap(e.x, e.y, CONFIG.enemies[e.type].scrap);
      burst(e.x, e.y, CONFIG.enemies[e.type].color, 14, 180);
    }
  }
  if (g.held && g.held.dead) g.held = null;
  if (g.boss && g.boss.dead) {
    g.boss = null;
    g.hazards = [];
    g.bossShots = [];
  }
  cleanupSkills();
  g.enemies = g.enemies.filter(e => !e.dead);
  g.cleaners = g.cleaners.filter(r => !r.dead);
  g.scraps = g.scraps.filter(s => !s.dead);
  g.particles = g.particles.filter(pt => pt.life > 0);
  g.texts = g.texts.filter(t => t.life > 0);
}

function drawFloor() {
  ctx.fillStyle = "#171a20";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#20242c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
  ctx.strokeStyle = "#3a3f4a";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
}

function drawHpBar(x, y, w, ratio) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = ratio > 0.4 ? "#7fd37f" : "#ff6b6b";
  ctx.fillRect(x - w / 2, y, w * clamp(ratio, 0, 1), 4);
}

function drawScraps() {
  for (const s of game.scraps) {
    if (s.life < 4 && Math.floor(s.life * 8) % 2 === 0) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.spin + game.time * 2);
    ctx.fillStyle = "#9aa3ad";
    ctx.fillRect(-s.r * 0.7, -s.r * 0.7, s.r * 1.4, s.r * 1.4);
    ctx.strokeStyle = "#5d646e";
    ctx.lineWidth = 2;
    ctx.strokeRect(-s.r * 0.7, -s.r * 0.7, s.r * 1.4, s.r * 1.4);
    ctx.restore();
  }
}

function drawCleaners() {
  for (const r of game.cleaners) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    const f = r.bump > 0 ? 3 : 0;
    const spin = game.time * 18;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(r.r * 0.45 + f, side * r.r * 0.85);
      ctx.fillStyle = "#e8b931";
      ctx.strokeStyle = "#1e1c21";
      ctx.beginPath();
      ctx.arc(0, 0, r.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.rotate(spin * side);
      ctx.strokeStyle = "#7a5f12";
      ctx.beginPath();
      ctx.moveTo(-r.r * 0.35, 0);
      ctx.lineTo(r.r * 0.35, 0);
      ctx.moveTo(0, -r.r * 0.35);
      ctx.lineTo(0, r.r * 0.35);
      ctx.stroke();
      ctx.restore();
    }
    if (r.fused) {
      ctx.strokeStyle = r.spinFx > 0 ? "#ffe27a" : "rgba(232,185,49,0.7)";
      ctx.lineWidth = r.spinFx > 0 ? 4 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, r.spinFx > 0 ? r.r + ((r.r + r.reach) * CONFIG.fusion.spinRangeMul - r.r) * (1 - r.spinFx / 0.25) : r.r + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (game.boost > 0) {
      ctx.strokeStyle = "rgba(95,240,200,0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, Math.PI * 2);
    ctx.fillStyle = r.flash > 0 ? "#ffffff" : "#b9b2bd";
    ctx.fill();
    ctx.strokeStyle = "#1e1c21";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r.r * 0.68, 0, Math.PI * 2);
    ctx.strokeStyle = r.mode === "return" ? "#5ff0c8" : "#9fd8c0";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r.r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#dcd7df";
    ctx.fill();
    ctx.fillStyle = "#e8b931";
    ctx.fillRect(r.r * 0.55, -2, 4, 4);
    ctx.restore();
    for (let i = 0; i < r.carry; i++) {
      ctx.fillStyle = "#cfd6e0";
      ctx.fillRect(r.x - r.carry * 3 + i * 6, r.y - r.r - 9, 4, 4);
    }
    if (r.hp < r.maxHp) drawHpBar(r.x, r.y + r.r + 4, 22, r.hp / r.maxHp);
  }
}

function drawEnemies() {
  for (const e of game.enemies) if (!e.held && !e.thrown) drawEnemy(e);
}

function bossFrame(e) {
  const k = e.kind;
  const tr = e.transition;
  if (tr && tr.frame >= 0 && SPRITES["trans-" + k]) return { img: SPRITES["trans-" + k], cols: 3, rows: 2, i: Math.min(5, tr.frame) };
  const sheet = SPRITES[(e.phase > 0 ? "move2-" : "move-") + k];
  if (!sheet) return null;
  const row = e.moveT > 0 ? Math.floor(e.moveT / CONFIG.bossAnim.step) % 2 : 0;
  return { img: sheet, cols: 4, rows: 2, i: row * 4 + (e.dir || 0) };
}

function trackBossMove(e, dt) {
  const vx = e.x - (e.px === undefined ? e.x : e.px);
  const vy = e.y - (e.py === undefined ? e.y : e.py);
  e.px = e.x;
  e.py = e.y;
  const sp = Math.hypot(vx, vy) / Math.max(dt, 0.001);
  let ax = vx;
  let ay = vy;
  if (sp > CONFIG.bossAnim.minSpeed) e.moveT = (e.moveT || 0) + dt;
  else {
    e.moveT = 0;
    ax = game.player.x - e.x;
    ay = game.player.y - e.y;
  }
  if (e.transition) e.dir = 0;
  else e.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 2) : ay < 0 ? 3 : 0;
}

function drawBossSprite(e) {
  const img = SPRITES[e.sprite];
  const fr = bossFrame(e);
  const size = e.r * CONFIG.bossDrawScale;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.38, size * 0.42, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  const shake = e.windup > 0 ? rand(-2, 2) : 0;
  if (e.phase > 0) {
    ctx.shadowColor = "rgba(255,60,40,0.9)";
    ctx.shadowBlur = 16 + Math.sin(performance.now() / 120) * 6;
  }
  if (e.alpha) ctx.globalAlpha = e.alpha;
  if (e.flash > 0) ctx.filter = "brightness(2.2)";
  else if (e.vulnerable > 0 && Math.floor(performance.now() / 120) % 2 === 0) ctx.filter = "brightness(1.6) saturate(0.6)";
  else if (e.windup > 0 && Math.floor(performance.now() / 80) % 2 === 0) ctx.filter = "sepia(1) saturate(5) hue-rotate(-25deg)";
  if (fr) {
    const fw = fr.img.naturalWidth / fr.cols;
    const fh = fr.img.naturalHeight / fr.rows;
    ctx.drawImage(fr.img, (fr.i % fr.cols) * fw, Math.floor(fr.i / fr.cols) * fh, fw, fh, -size / 2 + shake, -size / 2, size, size);
  } else ctx.drawImage(img, -size / 2 + shake, -size / 2, size, size);
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawEnemy(e) {
  if ((e.type === "boss" || e.type === "clone") && e.sprite && (SPRITES[e.sprite] || bossFrame(e))) {
    drawBossSprite(e);
    return;
  }
  if (drawRobotEnemy(e)) return;
  const color = e.flash > 0 ? "#ffffff" : CONFIG.enemies[e.type].color;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.beginPath();
  if (e.type === "boss") {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
    }
  } else if (e.type === "drone") {
    ctx.moveTo(e.r, 0);
    ctx.lineTo(-e.r * 0.8, e.r * 0.8);
    ctx.lineTo(-e.r * 0.4, 0);
    ctx.lineTo(-e.r * 0.8, -e.r * 0.8);
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
    }
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a0f14";
  ctx.stroke();
  if (e.type === "boss") {
    ctx.fillStyle = "#5a1a1a";
    ctx.fillRect(-e.r * 0.55, -e.r * 0.55, e.r * 1.1, e.r * 1.1);
    ctx.strokeStyle = "#2a0f14";
    ctx.strokeRect(-e.r * 0.55, -e.r * 0.55, e.r * 1.1, e.r * 1.1);
    ctx.fillStyle = e.windup > 0 ? "#ffffff" : "#ff4b4b";
    ctx.beginPath();
    ctx.arc(e.r * 0.35, 0, e.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8b931";
    for (const y of [-e.r * 0.75, e.r * 0.6]) ctx.fillRect(-e.r * 0.4, y, e.r * 0.8, e.r * 0.15);
  }
  if (e.type === "guard") {
    ctx.fillStyle = "#ffdf6b";
    ctx.beginPath();
    ctx.arc(e.r * 0.35, 0, e.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (e.hp < e.maxHp && e.type !== "boss") drawHpBar(e.x, e.y - e.r - 9, e.r * 2, e.hp / e.maxHp);
}

function strokeBeam(b, width, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(b.sx, b.sy);
  ctx.lineTo(b.ex, b.ey);
  ctx.stroke();
}

function drawBeam(b = game.beam, w = (b && b.w) || CONFIG.sludge.width) {
  if (!b) return;
  ctx.save();
  ctx.lineCap = "round";
  strokeBeam(b, w + Math.sin(performance.now() / 25) * 4, "#5d6b1f", 0.35);
  strokeBeam(b, w * 0.6, "#8fa832", 0.85);
  strokeBeam(b, w * 0.22, "#c9de5c", 1);
  ctx.restore();
}

function drawPipeArm(flash) {
  const fill = flash ? "#ffffff" : "#9a8f9e";
  const light = flash ? "#ffffff" : "#b4aab8";
  const shade = "#655f6a";
  const line = "#1e1c21";
  ctx.lineWidth = 2;
  ctx.strokeStyle = line;
  for (let i = 0; i < MECH.pipeSegments; i++) {
    const x = 4 + i * MECH.pipeSegment;
    const h = 15 + i * 1.5;
    ctx.fillStyle = fill;
    ctx.fillRect(x, -h / 2, MECH.pipeSegment + 1, h);
    ctx.strokeRect(x, -h / 2, MECH.pipeSegment + 1, h);
    ctx.fillStyle = light;
    ctx.fillRect(x + 2, -h / 2 + 2, MECH.pipeSegment - 3, 3);
    ctx.fillStyle = shade;
    ctx.fillRect(x + 2, h / 2 - 5, MECH.pipeSegment - 3, 3);
  }
  const nx = 4 + MECH.pipeSegments * MECH.pipeSegment;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(nx, -13, MECH.nozzle, 26, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3a3640";
  ctx.beginPath();
  ctx.roundRect(nx + MECH.nozzle - 6, -9, 5, 18, 2);
  ctx.fill();
  ctx.fillStyle = "#6f6874";
  for (const y of [-5, 0, 5]) ctx.fillRect(nx + MECH.nozzle - 5, y - 1, 3, 2);
  ctx.fillStyle = flash ? "#ffffff" : "#5a5560";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#8a828e";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(p = game.player, scale = 1) {
  const f = p.facing || 1;
  const k = MECH.scale / MECH.spriteScale;
  const moving = p.moving ? 1 : 0;
  const step = Math.sin(p.walk * 12) * 2.2 * moving;
  const bob = -Math.abs(Math.sin(p.walk * 12)) * 1.2 * moving;
  const local = f === 1 ? p.aim : Math.PI - p.aim;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(scale * f, scale);
  const hot = p === game.player && state !== "title" ? game.overclock > 0 : false;
  const cold = p === game.player && state !== "title" ? game.recoil > 0 : false;
  if (hot) {
    ctx.shadowColor = "rgba(255,140,40,0.95)";
    ctx.shadowBlur = 18 + Math.sin(performance.now() / 60) * 6;
  }
  if (p.flash > 0) ctx.filter = "brightness(2.5)";
  else if (cold) ctx.filter = "grayscale(0.8) brightness(0.8)";
  for (const [img, leg, dy] of [[SPRITES.legLeft, MECH.legLeft, step], [SPRITES.legRight, MECH.legRight, -step]]) {
    ctx.drawImage(img, (leg[0] - MECH.anchor[0]) * MECH.scale, (leg[1] - MECH.anchor[1]) * MECH.scale + dy, img.width * k, img.height * k);
  }
  const b = SPRITES.body;
  ctx.drawImage(b, (MECH.body[0] - MECH.anchor[0]) * MECH.scale, (MECH.body[1] - MECH.anchor[1]) * MECH.scale + bob, b.width * k, b.height * k);
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.translate(MECH.shoulder[0], MECH.shoulder[1] + bob);
  ctx.rotate(local);
  drawPipeArm(p.flash > 0);
  ctx.restore();
}

function mechPoint(p, lx, ly, scale = 1) {
  return { x: p.x + (p.facing || 1) * lx * scale, y: p.y + ly * scale };
}

function mechNozzle(p, scale = 1) {
  const f = p.facing || 1;
  const local = f === 1 ? p.aim : Math.PI - p.aim;
  const len = MECH.pipeLength + 2;
  return mechPoint(p, MECH.shoulder[0] + Math.cos(local) * len, MECH.shoulder[1] + Math.sin(local) * len, scale);
}

function updateFacing(p) {
  const c = Math.cos(p.aim);
  if (c > 0.2) p.facing = 1;
  else if (c < -0.2) p.facing = -1;
}

function drawHeld(o) {
  if (o.kind === "cube") drawCube(o);
  else drawEnemy(o);
}

function drawClaw() {
  const g = game;
  for (const t of g.enemies.concat(g.cubes)) if (t.thrown) drawHeld(t);
  const e = g.held;
  if (e) {
    const sh = mechPoint(g.player, MECH.clawShoulder[0], MECH.clawShoulder[1]);
    ctx.strokeStyle = "#1e1c21";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.strokeStyle = "#e8b931";
    ctx.lineWidth = 3;
    ctx.stroke();
    drawHeld(e);
    ctx.strokeStyle = "#e8b931";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (state === "play" && !e && g.clawCooldown <= 0) {
    const best = clawTarget();
    if (best) {
      ctx.strokeStyle = "rgba(232,185,49,0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(best.x, best.y, best.r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawParticles(list = game.particles) {
  for (const pt of list) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawTexts() {
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of game.texts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawBar(x, y, w, h, ratio, color, label, value) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = "#2a2e36";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 13px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 8, y + h / 2 + 1);
  ctx.textAlign = "right";
  ctx.fillText(value, x + w - 8, y + h / 2 + 1);
}

function drawSlot(x, y, key, name, info, cooldown, active) {
  const w = 150;
  const h = 54;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, h);
  if (cooldown > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, w * cooldown, h);
  }
  ctx.strokeStyle = active || "#3a3f4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.font = `bold 12px ${FONT}`;
  const kw = ctx.measureText(key).width + 12;
  ctx.fillStyle = "#e8b931";
  ctx.fillRect(x + 8, y + 8, kw, 18);
  ctx.fillStyle = "#171a20";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(key, x + 8 + kw / 2, y + 18);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(name, x + kw + 14, y + 18);
  ctx.fillStyle = "#9aa3ad";
  ctx.font = `11px ${FONT}`;
  ctx.fillText(info, x + 10, y + 40);
}

function drawHud() {
  const g = game;
  const p = g.player;
  const c = CONFIG.cleaner;
  drawBar(20, 20, 260, 22, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? "#4caf6a" : "#e05252", "내구도", Math.ceil(p.hp) + " / " + p.maxHp + (g.shield > 0 ? " + 보호막 " + Math.ceil(g.shield) : ""));
  if (g.shield > 0) {
    ctx.fillStyle = "rgba(90, 176, 255, 0.75)";
    ctx.fillRect(20, 38, 260 * clamp(g.shield / p.maxHp, 0, 1), 4);
  }
  drawBar(20, 50, 260, 16, g.tank / CONFIG.sludge.tank, g.tank <= 0 || g.tankLocked ? "#5b6170" : "#8fa832", g.tankLocked ? "폐수 탱크 (버튼을 뗐다가 다시)" : "폐수 탱크", Math.floor(g.tank) + "%");

  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("구역 " + g.zone, W - 20, 18);
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = "#cfd6e0";
  const where = g.node === "boss" ? "보스전" : Math.min(g.step, CONFIG.route.nodesPerZone) + " / " + CONFIG.route.nodesPerZone + "칸";
  ctx.fillText(where + " · 남은 적 " + (g.toSpawn + g.enemies.length), W - 20, 46);
  ctx.fillText("처치 " + g.kills, W - 20, 68);
  ctx.fillStyle = g.scrapPulse > 0 ? "#ffe27a" : "#cfd6e0";
  ctx.fillText("고철 " + g.scrap, W - 20, 90);

  const carrying = g.cleaners.reduce((n, r) => n + r.carry, 0);
  const y = H - 74;
  const secs = t => Math.ceil(t) + "초";
  const ready = (cd, total) => (cd > 0 ? "대기 " + secs(cd) : "준비");
  const slots = [
    ["좌클릭", "집게팔", g.held ? "잡는 중 · 클릭해 던지기" : "적 · 큐브 잡기", g.clawCooldown / (CONFIG.claw.cooldown * mm("claw", "cooldown")), g.held ? "#e8b931" : null],
    ["우클릭", "오염 폐수", "누르고 있기 · " + Math.floor(g.tank) + "%", 0, g.beam ? "#8fa832" : null],
    ["Q", "청소 로봇", "출동 " + cleanerCount() + " / " + c.max, g.ejectCooldown / (c.cooldown * mm("cleaner", "cooldown")), null],
    ["R", "로봇 회수", "고철 " + carrying + "개 수거 중", 0, null],
    ["E", "압축 지뢰", "고철 " + scrapCost(CONFIG.mine.cost, "mine") + " · 설치 " + g.mines.length + "/" + CONFIG.mine.max, g.mineCooldown / (CONFIG.mine.cooldown * mm("mine", "cooldown")), null],
    ["F", "고철 압축", "고철 " + scrapCost(CONFIG.cube.cost, "compress") + " · 큐브 " + g.cubes.length + "/" + CONFIG.cube.max, g.cubeCooldown / (CONFIG.cube.cooldown * mm("compress", "cooldown")), null],
    ["Shift", "청소 가속", g.boost > 0 ? "가속 중 " + secs(g.boost) : ready(g.boostCooldown), g.boost > 0 ? 0 : g.boostCooldown / (CONFIG.boost.cooldown * mm("boost", "cooldown")), g.boost > 0 ? "#5ff0c8" : null],
    ["Space", "오버클럭", g.overclock > 0 ? "강화 " + secs(g.overclock) : g.recoil > 0 ? "반동 " + secs(g.recoil) : ready(g.overclockCooldown), g.overclock > 0 ? 0 : g.overclockCooldown / (CONFIG.overclock.cooldown * mm("overclock", "cooldown")), g.overclock > 0 ? "#ff9a3c" : g.recoil > 0 ? "#6b717c" : null]
  ];
  slots.forEach((sl, i) => drawSlot(20 + i * 156, y, sl[0], sl[1], sl[2], sl[3], sl[4]));

  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#5d646e";
  ctx.fillText("v" + VERSION, W - 12, H - 10);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawBossBar();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (g.banner > 0) {
    ctx.globalAlpha = clamp(g.banner, 0, 1);
    ctx.font = `900 44px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(g.bannerText, W / 2, 150);
    ctx.globalAlpha = 1;
  }
  if (state === "play" && g.clearTimer >= 0) {
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = "#cfd6e0";
    ctx.fillText("고철을 모으세요 · " + Math.max(1, Math.ceil(g.clearTimer)) + "초 뒤 다음 목적지", W / 2, 40);
  }
}

function drawOverlay() {
  ctx.fillStyle = "rgba(10,12,16,0.82)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
}

function drawPrompt(text, y) {
  ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 250) * 0.4;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, W / 2, y);
  ctx.globalAlpha = 1;
}

const CONTROLS = [
  ["WASD", "이동"],
  ["마우스", "조준"],
  ["좌클릭", "집게팔 잡기 · 던지기"],
  ["우클릭", "오염 폐수 (누르고 있기)"],
  ["Q", "청소 로봇 사출"],
  ["R", "청소 로봇 회수"],
  ["E", "압축 지뢰 설치"],
  ["F", "고철 압축 (큐브)"],
  ["Shift", "청소 가속화"],
  ["Space", "오버클럭"],
  ["Esc", "일시정지"]
];

function updateTitle(dt) {
  const s = titleScene;
  const m = s.mech;
  s.t += dt;
  s.spawn -= dt;
  if (s.spawn <= 0) {
    s.spawn = rand(0.5, 1.1);
    s.drones.push({ type: "drone", x: W + 20, y: rand(130, H - 150), r: 13, hp: 1, maxHp: 1, flash: 0, angle: Math.PI, speed: rand(50, 90), wobble: Math.random() * 6 });
  }
  for (const d of s.drones) {
    d.x -= d.speed * dt;
    d.y += Math.sin(s.t * 2 + d.wobble) * 20 * dt;
  }
  let target = null;
  let best = Infinity;
  for (const d of s.drones) {
    const dd = dist(d, m);
    if (d.x > m.x + 140 && dd < best) {
      best = dd;
      target = d;
    }
  }
  if (target) {
    const want = Math.atan2(target.y - m.y, target.x - m.x);
    m.aim += (want - m.aim) * Math.min(1, dt * 4);
  }
  updateFacing(m);
  s.fire -= dt;
  if (s.fire <= 0) s.fire = 2.4;
  s.beam = null;
  if (s.fire < 0.9 && target) {
    const cos = Math.cos(m.aim);
    const sin = Math.sin(m.aim);
    const nozzle = mechNozzle(m, s.scale);
    const sx = nozzle.x;
    const sy = nozzle.y;
    s.beam = { sx, sy, ex: sx + cos * 560, ey: sy + sin * 560 };
    for (const d of s.drones) {
      if (!d.dead && distToSegment(d.x, d.y, s.beam.sx, s.beam.sy, s.beam.ex, s.beam.ey) < 44) {
        d.dead = true;
        burst(d.x, d.y, CONFIG.enemies.drone.color, 14, 180, s.particles);
      }
    }
    for (let i = 0; i < 4; i++) {
      const t = Math.random();
      const side = rand(-1, 1) * 120;
      const life = rand(0.2, 0.4);
      s.particles.push({ x: sx + (s.beam.ex - sx) * t, y: sy + (s.beam.ey - sy) * t, vx: -sin * side + cos * 80, vy: cos * side + sin * 80, life, max: life, color: "#9fb83a", size: rand(3, 6) });
    }
  }
  s.smoke -= dt;
  if (s.smoke <= 0) {
    s.smoke = 0.12;
    const life = rand(1.2, 1.8);
    const cp = mechPoint(m, MECH.chimney[0], MECH.chimney[1], s.scale);
    s.particles.push({ x: cp.x, y: cp.y, vx: rand(-15, 15), vy: rand(-70, -45), life, max: life, color: "#6b707a", size: rand(8, 14) });
  }
  s.drones = s.drones.filter(d => !d.dead && d.x > -40);
  updateParticles(s.particles, dt);
  s.particles = s.particles.filter(pt => pt.life > 0);
}

function drawStripes(y, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  ctx.fillStyle = "#e8b931";
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = "#171a20";
  const off = (titleScene.t * 30) % 40;
  for (let x = -40 - h + off; x < W + h; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + 20, y + h);
    ctx.lineTo(x + 20 + h, y);
    ctx.lineTo(x + h, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTitleButton(r, label, selected) {
  ctx.fillStyle = selected ? "#e8b931" : "rgba(23,26,32,0.85)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = selected ? "#e8b931" : "#3a3f4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = selected ? "#171a20" : "#d7dce3";
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText((selected ? "▶  " : "    ") + label, r.x + 22, r.y + r.h / 2 + 1);
}

function drawTitle() {
  const s = titleScene;
  ctx.fillStyle = "#13161b";
  ctx.fillRect(0, 0, W, H);
  const off = (s.t * 20) % 40;
  ctx.strokeStyle = "#1e2229";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -off; x <= W; x += 40) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();

  for (const d of s.drones) drawEnemy(d);
  drawBeam(s.beam, CONFIG.sludge.width * 1.6);
  drawPlayer(s.mech, s.scale);
  drawParticles(s.particles);

  const shade = ctx.createLinearGradient(0, 0, 760, 0);
  shade.addColorStop(0, "rgba(13,15,19,0.97)");
  shade.addColorStop(0.6, "rgba(13,15,19,0.85)");
  shade.addColorStop(1, "rgba(13,15,19,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 760, H);

  drawStripes(0, 14);
  drawStripes(H - 14, 14);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8b931";
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText("중앙 AI 대응 프로젝트", 124, 150);
  ctx.font = `900 120px ${FONT}`;
  ctx.fillStyle = "#7a5f12";
  ctx.fillText("공장장", 126, 268);
  ctx.fillStyle = "#e8b931";
  ctx.fillText("공장장", 120, 262);
  ctx.font = `20px ${FONT}`;
  ctx.fillStyle = "#9aa3ad";
  ctx.fillText("(가제)", 500, 262);
  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = "#d7dce3";
  ctx.fillText("중앙 AI가 인간을 말살하려 한다.", 124, 318);
  ctx.fillText("쓰레기 처리공장이 거대 로봇으로 변신해 맞선다.", 124, 346);

  if (titleView !== "controls") {
    if (titleView === "reset") {
      ctx.fillStyle = "#ff9a9a";
      ctx.font = `bold 18px ${FONT}`;
      ctx.textBaseline = "middle";
      ctx.fillText("누적 클리어 기록(" + clearCount() + "회)을 지울까요? 되돌릴 수 없어요.", 124, 372);
    }
    titleButtonsFor(titleView).forEach((b, i) => drawTitleButton(titleButtonRect(i), b.label, i === titleIndex));
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 22px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText("조작법", 124, 404);
    CONTROLS.forEach(([key, desc], i) => {
      const col = i < 6 ? 0 : 1;
      const y = 440 + (i % 6) * 26;
      const x = col === 0 ? 124 : 430;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillStyle = "#e8b931";
      ctx.fillText(key, x, y);
      ctx.font = `15px ${FONT}`;
      ctx.fillStyle = "#d7dce3";
      ctx.fillText(desc, x + 70, y);
    });
    drawTitleButton(titleBack, "돌아가기", true);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = "#6b717c";
  const hint = titleView === "controls" ? "Esc 또는 스페이스로 돌아가기" : titleView === "menu" ? "W/S 또는 마우스로 고르고, 스페이스나 클릭으로 결정" : "W/S로 고르고 스페이스로 결정 · Esc로 돌아가기";
  ctx.fillText(hint, 124, H - 40);
  ctx.textAlign = "right";
  ctx.fillText("v" + VERSION, W - 24, H - 40);
  const clears = clearCount();
  const open = clears >= CONFIG.unlockZone5;
  ctx.fillStyle = "#e8b931";
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText("누적 클리어 " + clears + "회", W - 24, H - 88);
  ctx.fillStyle = open ? "#7fd37f" : "#9aa3ad";
  ctx.font = `14px ${FONT}`;
  ctx.fillText(open ? "5구역 · 중앙 AI 열림" : "5구역 잠김 · " + clears + " / " + CONFIG.unlockZone5 + "회 클리어 후 열림", W - 24, H - 64);
}

function drawGameOver() {
  const g = game;
  drawOverlay();
  ctx.fillStyle = g.won ? "#e8b931" : "#ff6b6b";
  ctx.font = `900 72px ${FONT}`;
  ctx.fillText(g.won ? bossInfo(g.lastZone).name + " 격파!" : "공장 정지", W / 2, 250);
  ctx.fillStyle = "#d7dce3";
  ctx.font = `20px ${FONT}`;
  ctx.fillText(g.won ? "모든 구역 돌파  ·  처치 " + g.kills + "  ·  고철 " + g.scrap : "구역 " + g.zone + " · " + Math.max(1, g.step) + "번째 칸  ·  처치 " + g.kills + "  ·  고철 " + g.scrap, W / 2, 330);
  ctx.fillStyle = "#e8b931";
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText("누적 클리어 " + clearCount() + "회", W / 2, 370);
  if (canRestart()) {
    drawPrompt("클릭하거나 스페이스를 눌러 다시 시작", 430);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = "#9aa3ad";
    ctx.fillText("Esc를 누르면 시작 화면으로", W / 2, 474);
  }
}

function drawPause() {
  drawOverlay();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText("일시정지", W / 2, 300);
  drawPrompt("클릭하거나 Esc를 눌러 계속", 380);
  if (game.tutorial && !game.tutorial.required) {
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = "#9aa3ad";
    ctx.fillText("Backspace를 누르면 튜토리얼을 그만두고 시작 화면으로", W / 2, 424);
  }
}

function draw() {
  const g = game;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (state === "title") {
    drawTitle();
    return;
  }
  if (state === "guide") {
    drawGuide();
    return;
  }
  ctx.save();
  if (state === "play" && g.shake > 0 && settings.shake) ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake);
  const zoom = g.boss && g.boss.transition ? g.boss.transition.zoom : 1;
  if (zoom > 1) {
    const b = g.boss;
    ctx.translate(b.x, b.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-b.x, -b.y);
  }
  drawFloor();
  drawPuddles();
  drawMines();
  drawScraps();
  drawCubes();
  drawCleaners();
  drawBossTelegraph();
  drawEnemies();
  drawBeam();
  drawPlayer();
  if (game.shield > 0) {
    const p = game.player;
    ctx.strokeStyle = "rgba(90, 176, 255, " + (0.45 + Math.sin(game.time * 6) * 0.15) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawClaw();
  drawParticles();
  drawRings();
  drawTexts();
  ctx.restore();
  drawHud();
  if (g.tutorial) drawTutorial();
  if (state === "pause") drawPause();
  else if (state === "over") drawGameOver();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === "play") update(dt);
  else if (state === "title") updateTitle(dt);
  draw();
  requestAnimationFrame(frame);
}

Promise.all([
  loadSprite("body", "assets/mech-body.png"),
  loadSprite("legLeft", "assets/mech-leg-left.png"),
  loadSprite("legRight", "assets/mech-leg-right.png"),
  ...CONFIG.bosses.map(b => loadSprite("boss-" + b.sprite, "assets/bosses/game/" + b.sprite + ".png"))
]).then(() => {
  for (const b of CONFIG.bosses) {
    for (const [key, dir] of [["move-", "move/"], ["move2-", "move2/"], ["trans-", "transition/"]]) loadSprite(key + b.sprite, "assets/bosses/game/" + dir + b.sprite + ".png").catch(() => {});
  }
  for (const d of Object.values(CONFIG.enemies)) if (d.sheet) loadSprite("enemy-" + d.sheet, "assets/enemies/game/" + d.sheet + ".png").catch(() => {});
  last = performance.now();
  requestAnimationFrame(frame);
});
