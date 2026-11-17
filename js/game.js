const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = CONFIG.width;
const H = CONFIG.height;
const FONT = "'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

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
const mouse = { x: W / 2, y: H / 2, down: false };
let state = "title";
let overAt = 0;
let game = newGame();

function newGame() {
  return {
    player: { x: W / 2, y: H / 2, r: CONFIG.player.radius, hp: CONFIG.player.hp, maxHp: CONFIG.player.hp, aim: 0, flash: 0, walk: 0, smoke: 0 },
    tank: CONFIG.sludge.tank,
    tankLocked: false,
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
    wave: 0,
    toSpawn: 0,
    spawnTimer: 0,
    breakTimer: CONFIG.waves.firstDelay,
    banner: 0,
    shake: 0,
    time: 0
  };
}

function startGame() {
  game = newGame();
  state = "play";
  mouse.down = false;
}

function canRestart() {
  return state === "title" || (state === "over" && performance.now() - overAt > 800);
}

window.addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  onPress(e.code);
});
window.addEventListener("keyup", e => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  mouse.down = false;
  if (state === "play") state = "pause";
});
window.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * W;
  mouse.y = ((e.clientY - rect.top) / rect.height) * H;
});
window.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  if (canRestart()) {
    startGame();
    return;
  }
  if (state === "pause") {
    state = "play";
    return;
  }
  mouse.down = true;
});
window.addEventListener("mouseup", e => {
  if (e.button === 0) mouse.down = false;
});
window.addEventListener("contextmenu", e => e.preventDefault());

function onPress(code) {
  if (state === "title" || state === "over") {
    if ((code === "Space" || code === "Enter") && canRestart()) startGame();
    return;
  }
  if (code === "Escape" || code === "KeyP") {
    state = state === "play" ? "pause" : "play";
    mouse.down = false;
    return;
  }
  if (state !== "play") return;
  if (code === "KeyQ") ejectCleaner();
  if (code === "KeyR") recallCleaners();
}

function addText(x, y, text, color) {
  game.texts.push({ x, y, text, color, life: 1 });
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * rand(0.3, 1);
    const life = rand(0.3, 0.7);
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: rand(2, 5) });
  }
}

function dropScrap(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rand(40, 140);
    game.scraps.push({ x, y, r: CONFIG.scrap.radius, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: CONFIG.scrap.life, spin: Math.random() * Math.PI });
  }
}

function spawnEnemy() {
  const g = game;
  const wc = CONFIG.waves;
  const type = g.wave >= wc.guardFromWave && Math.random() < wc.guardRatio ? "guard" : "drone";
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
  const hp = d.hp * (1 + (g.wave - 1) * wc.hpPerWave);
  g.enemies.push({ type, x, y, r: d.radius, hp, maxHp: hp, speed: d.speed, damage: d.damage, attackTimer: 0, flash: 0, angle: 0 });
}

function ejectCleaner() {
  const g = game;
  const c = CONFIG.cleaner;
  const p = g.player;
  if (g.ejectCooldown > 0 || g.cleaners.length >= c.max) return;
  const a = p.aim;
  g.cleaners.push({
    x: p.x + Math.cos(a) * (p.r + c.radius + 2),
    y: p.y + Math.sin(a) * (p.r + c.radius + 2),
    r: c.radius,
    vx: Math.cos(a) * c.launchSpeed,
    vy: Math.sin(a) * c.launchSpeed,
    launch: c.launchTime,
    hp: c.hp,
    maxHp: c.hp,
    carry: 0,
    mode: "work",
    attackTimer: 0,
    bump: 0,
    flash: 0,
    angle: a
  });
  g.ejectCooldown = c.cooldown;
  burst(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, "#4fc3a1", 6, 120);
}

function recallCleaners() {
  for (const r of game.cleaners) r.mode = "return";
}

function hitTarget(t, dmg) {
  const g = game;
  t.hp -= dmg;
  t.flash = 0.12;
  if (t === g.player) {
    g.shake = Math.min(8, g.shake + 4);
    burst(t.x, t.y, "#ffb347", 6, 140);
  } else if (t.hp <= 0 && !t.dead) {
    t.dead = true;
    dropScrap(t.x, t.y, t.carry);
    burst(t.x, t.y, "#4fc3a1", 12, 160);
    addText(t.x, t.y - 20, "청소 로봇 파괴", "#ff7b7b");
  }
}

function damageEnemy(e, amount) {
  e.hp -= amount;
  e.flash = 0.08;
}

function update(dt) {
  const g = game;
  g.time += dt;
  g.ejectCooldown = Math.max(0, g.ejectCooldown - dt);
  g.shake = Math.max(0, g.shake - dt * 20);
  g.banner = Math.max(0, g.banner - dt);
  g.scrapPulse = Math.max(0, g.scrapPulse - dt);
  updateWaves(dt);
  updatePlayer(dt);
  updateSludge(dt);
  updateCleaners(dt);
  updateEnemies(dt);
  updateScraps(dt);
  updateEffects(dt);
  cleanup();
  if (g.player.hp <= 0) {
    g.player.hp = 0;
    g.beam = null;
    state = "over";
    overAt = performance.now();
  }
}

function updateWaves(dt) {
  const g = game;
  const wc = CONFIG.waves;
  if (g.toSpawn > 0) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      spawnEnemy();
      g.toSpawn--;
      g.spawnTimer = wc.spawnInterval;
    }
  } else if (g.enemies.length === 0) {
    g.breakTimer -= dt;
    if (g.breakTimer <= 0) {
      g.wave++;
      g.toSpawn = wc.baseCount + (g.wave - 1) * wc.countPerWave;
      g.spawnTimer = 0;
      g.breakTimer = wc.breakTime;
      g.banner = 2;
    }
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
  if (len > 0) {
    p.x += (dx / len) * c.speed * dt;
    p.y += (dy / len) * c.speed * dt;
    p.walk += dt;
  }
  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r, H - p.r);
  p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  p.flash = Math.max(0, p.flash - dt);
  p.smoke -= dt;
  if (p.smoke <= 0) {
    p.smoke = 0.18;
    const life = rand(0.8, 1.2);
    game.particles.push({ x: p.x - 12, y: p.y + 10, vx: rand(-10, 10), vy: rand(-40, -25), life, max: life, color: "#6b707a", size: rand(4, 7) });
  }
}

function updateSludge(dt) {
  const g = game;
  const s = CONFIG.sludge;
  const p = g.player;
  if (g.tankLocked && g.tank >= s.minToFire) g.tankLocked = false;
  const firing = mouse.down && !g.tankLocked && g.tank > 0;
  if (!firing) {
    g.beam = null;
    if (g.refillWait > 0) g.refillWait -= dt;
    else g.tank = Math.min(s.tank, g.tank + s.refillPerSec * dt);
    return;
  }
  g.tank = Math.max(0, g.tank - s.drainPerSec * dt);
  g.refillWait = s.refillDelay;
  if (g.tank <= 0) g.tankLocked = true;
  const cos = Math.cos(p.aim);
  const sin = Math.sin(p.aim);
  const sx = p.x + cos * (p.r + 20);
  const sy = p.y + sin * (p.r + 20);
  const ex = sx + cos * s.length;
  const ey = sy + sin * s.length;
  g.beam = { sx, sy, ex, ey };
  for (const e of g.enemies) {
    if (distToSegment(e.x, e.y, sx, sy, ex, ey) <= s.width / 2 + e.r) {
      damageEnemy(e, s.dps * dt);
      e.x += cos * s.push * dt;
      e.y += sin * s.push * dt;
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
  g.cleaners.forEach((r, i) => {
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
        if (r.carry > 0) {
          g.scrap += r.carry;
          g.scrapPulse = 0.4;
          addText(p.x, p.y - 50, "+" + r.carry + " 고철", "#cfd6e0");
        }
        return;
      }
    } else {
      const enemy = nearest(g.enemies, r, c.sightRange);
      const nearScrap = r.carry < c.carryMax ? nearest(g.scraps, r, c.grabRange) : null;
      if (nearScrap && (!enemy || dist(r, enemy) > dist(r, nearScrap) + 40)) {
        tx = nearScrap.x;
        ty = nearScrap.y;
      } else if (enemy) {
        r.angle = Math.atan2(enemy.y - r.y, enemy.x - r.x);
        if (dist(r, enemy) <= enemy.r + r.r + c.attackRange) {
          if (r.attackTimer <= 0) {
            damageEnemy(enemy, c.damage);
            r.attackTimer = c.attackInterval;
            r.bump = 0.12;
            burst(enemy.x, enemy.y, "#e8f0f2", 3, 90);
          }
        } else {
          tx = enemy.x;
          ty = enemy.y;
        }
      } else {
        const s = r.carry < c.carryMax ? nearest(g.scraps, r, c.sightRange) : null;
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
      moveToward(r, tx, ty, c.speed * dt);
    }
    if (r.carry < c.carryMax) {
      for (const s of g.scraps) {
        if (!s.dead && dist(r, s) < r.r + s.r + 4) {
          s.dead = true;
          r.carry++;
          if (r.carry >= c.carryMax) break;
        }
      }
    }
  });
  separate(g.cleaners, 0.5);
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
    e.attackTimer -= dt;
    let target = p;
    let best = dist(e, p) - p.r;
    for (const r of g.cleaners) {
      if (r.launch > 0 || r.dead) continue;
      const d = dist(e, r) - r.r;
      if (d < best) {
        best = d;
        target = r;
      }
    }
    e.angle = Math.atan2(target.y - e.y, target.x - e.x);
    if (best - e.r > 3) {
      moveToward(e, target.x, target.y, e.speed * dt);
    } else if (e.attackTimer <= 0) {
      e.attackTimer = CONFIG.enemyAttackInterval;
      hitTarget(target, e.damage);
    }
  }
  separate(g.enemies, 0.5);
  for (const e of g.enemies) pushOut(e, p);
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

function updateEffects(dt) {
  const friction = Math.pow(0.05, dt);
  for (const pt of game.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= friction;
    pt.vy *= friction;
  }
  for (const t of game.texts) {
    t.life -= dt;
    t.y -= 30 * dt;
  }
}

function cleanup() {
  const g = game;
  for (const e of g.enemies) {
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      g.kills++;
      dropScrap(e.x, e.y, CONFIG.enemies[e.type].scrap);
      burst(e.x, e.y, CONFIG.enemies[e.type].color, 14, 180);
    }
  }
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
    const f = r.bump > 0 ? 4 : 0;
    ctx.fillStyle = "#2b6b5a";
    ctx.fillRect(r.r - 3 + f, -7, 7, 14);
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, Math.PI * 2);
    ctx.fillStyle = r.flash > 0 ? "#ffffff" : r.mode === "return" ? "#8fd8c4" : "#4fc3a1";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1f4d41";
    ctx.stroke();
    ctx.fillStyle = "#1f4d41";
    ctx.beginPath();
    ctx.arc(4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < r.carry; i++) {
      ctx.fillStyle = "#cfd6e0";
      ctx.fillRect(r.x - r.carry * 3 + i * 6, r.y - r.r - 9, 4, 4);
    }
    if (r.hp < r.maxHp) drawHpBar(r.x, r.y + r.r + 4, 22, r.hp / r.maxHp);
  }
}

function drawEnemies() {
  for (const e of game.enemies) {
    const color = e.flash > 0 ? "#ffffff" : CONFIG.enemies[e.type].color;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.beginPath();
    if (e.type === "drone") {
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
    if (e.type === "guard") {
      ctx.fillStyle = "#ffdf6b";
      ctx.beginPath();
      ctx.arc(e.r * 0.35, 0, e.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (e.hp < e.maxHp) drawHpBar(e.x, e.y - e.r - 9, e.r * 2, e.hp / e.maxHp);
  }
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

function drawBeam() {
  const b = game.beam;
  if (!b) return;
  const w = CONFIG.sludge.width;
  ctx.save();
  ctx.lineCap = "round";
  strokeBeam(b, w + Math.sin(game.time * 40) * 4, "#5d6b1f", 0.35);
  strokeBeam(b, w * 0.6, "#8fa832", 0.85);
  strokeBeam(b, w * 0.22, "#c9de5c", 1);
  ctx.restore();
}

function drawPlayer() {
  const p = game.player;
  const body = p.flash > 0 ? "#ffffff" : "#e8b931";
  ctx.save();
  ctx.translate(p.x, p.y);
  const offset = (p.walk * 60) % 10;
  for (const side of [-1, 1]) {
    const x = side < 0 ? -38 : 26;
    ctx.fillStyle = "#3b4049";
    ctx.fillRect(x, -30, 12, 60);
    ctx.fillStyle = "#262a31";
    for (let y = -30 + offset; y < 30; y += 10) ctx.fillRect(x, y, 12, 3);
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-28, -28, 56, 56, 8);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#7a5f12";
  ctx.stroke();
  ctx.fillStyle = p.flash > 0 ? "#ffffff" : "#c99a1f";
  ctx.fillRect(-20, -6, 40, 12);
  ctx.fillStyle = "#2a2e36";
  for (let x = -18; x < 20; x += 10) ctx.fillRect(x, -6, 5, 12);
  ctx.fillStyle = "#4a505b";
  ctx.beginPath();
  ctx.arc(-12, 12, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.aim);
  ctx.fillStyle = "#4a505b";
  ctx.fillRect(6, -9, 44, 18);
  ctx.strokeStyle = "#2a2e36";
  ctx.lineWidth = 2;
  ctx.strokeRect(6, -9, 44, 18);
  ctx.fillStyle = "#8fa832";
  ctx.fillRect(48, -7, 8, 14);
  ctx.fillStyle = "#5d646e";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const pt of game.particles) {
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

function drawSlot(x, y, key, name, info, cooldown) {
  const w = 170;
  const h = 54;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, h);
  if (cooldown > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, w * cooldown, h);
  }
  ctx.strokeStyle = "#3a3f4a";
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
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(name, x + kw + 16, y + 18);
  ctx.fillStyle = "#9aa3ad";
  ctx.font = `12px ${FONT}`;
  ctx.fillText(info, x + 10, y + 40);
}

function drawHud() {
  const g = game;
  const p = g.player;
  const c = CONFIG.cleaner;
  drawBar(20, 20, 260, 22, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? "#4caf6a" : "#e05252", "내구도", Math.ceil(p.hp) + " / " + p.maxHp);
  drawBar(20, 50, 260, 16, g.tank / CONFIG.sludge.tank, g.tankLocked ? "#5b6170" : "#8fa832", g.tankLocked ? "폐수 탱크 (충전 중)" : "폐수 탱크", Math.floor(g.tank) + "%");

  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("웨이브 " + g.wave, W - 20, 18);
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = "#cfd6e0";
  ctx.fillText("처치 " + g.kills, W - 20, 46);
  ctx.fillStyle = g.scrapPulse > 0 ? "#ffe27a" : "#cfd6e0";
  ctx.fillText("고철 " + g.scrap, W - 20, 68);

  const carrying = g.cleaners.reduce((n, r) => n + r.carry, 0);
  const y = H - 74;
  drawSlot(20, y, "좌클릭", "오염 폐수 방출", "누르고 있으면 계속 발사", 0);
  drawSlot(200, y, "Q", "청소 로봇 사출", "출동 " + g.cleaners.length + " / " + c.max, g.ejectCooldown / c.cooldown);
  drawSlot(380, y, "R", "청소 로봇 회수", "수거 중인 고철 " + carrying + "개", 0);

  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#5d646e";
  ctx.fillText("v" + VERSION, W - 12, H - 10);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (g.banner > 0) {
    ctx.globalAlpha = clamp(g.banner, 0, 1);
    ctx.font = `900 48px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("웨이브 " + g.wave, W / 2, 140);
    ctx.globalAlpha = 1;
  } else if (state === "play" && g.toSpawn === 0 && g.enemies.length === 0) {
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = "#cfd6e0";
    const text = g.wave === 0 ? "곧 중앙 AI의 공격이 시작됩니다" : "다음 웨이브까지 " + Math.ceil(g.breakTimer) + "초";
    ctx.fillText(text, W / 2, 40);
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

function drawTitle() {
  drawOverlay();
  ctx.fillStyle = "#e8b931";
  ctx.font = `900 88px ${FONT}`;
  ctx.fillText("공장장", W / 2, 160);
  ctx.fillStyle = "#9aa3ad";
  ctx.font = `20px ${FONT}`;
  ctx.fillText("(가제)  v" + VERSION, W / 2, 222);
  ctx.fillStyle = "#d7dce3";
  ctx.font = `18px ${FONT}`;
  ctx.fillText("중앙 AI가 인간을 말살하려 한다. 쓰레기 처리공장이 거대 로봇으로 변신해 맞선다.", W / 2, 280);
  const lines = [
    ["WASD", "이동"],
    ["마우스", "조준"],
    ["좌클릭 (누르고 있기)", "오염 폐수 방출"],
    ["Q", "청소 로봇 사출"],
    ["R", "청소 로봇 회수 (수거한 고철을 가져옴)"],
    ["Esc", "일시정지"]
  ];
  lines.forEach(([key, desc], i) => {
    const y = 350 + i * 32;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = "#e8b931";
    ctx.textAlign = "right";
    ctx.fillText(key, W / 2 - 16, y);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = "#d7dce3";
    ctx.textAlign = "left";
    ctx.fillText(desc, W / 2 + 16, y);
  });
  ctx.textAlign = "center";
  drawPrompt("클릭하거나 스페이스를 눌러 시작", 610);
}

function drawGameOver() {
  const g = game;
  drawOverlay();
  ctx.fillStyle = "#ff6b6b";
  ctx.font = `900 72px ${FONT}`;
  ctx.fillText("공장 정지", W / 2, 250);
  ctx.fillStyle = "#d7dce3";
  ctx.font = `20px ${FONT}`;
  ctx.fillText("웨이브 " + g.wave + "  ·  처치 " + g.kills + "  ·  고철 " + g.scrap, W / 2, 330);
  if (canRestart()) drawPrompt("클릭하거나 스페이스를 눌러 다시 시작", 430);
}

function drawPause() {
  drawOverlay();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText("일시정지", W / 2, 300);
  drawPrompt("클릭하거나 Esc를 눌러 계속", 380);
}

function draw() {
  const g = game;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.save();
  if (state === "play" && g.shake > 0) ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake);
  drawFloor();
  drawScraps();
  drawCleaners();
  drawEnemies();
  drawBeam();
  drawPlayer();
  drawParticles();
  drawTexts();
  ctx.restore();
  if (state !== "title") drawHud();
  if (state === "title") drawTitle();
  else if (state === "pause") drawPause();
  else if (state === "over") drawGameOver();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === "play") update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
