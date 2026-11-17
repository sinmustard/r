function ocMul() {
  const g = game;
  if (g.overclock > 0) return CONFIG.overclock.boostMul;
  if (g.recoil > 0) return CONFIG.overclock.recoilMul;
  return 1;
}

function scrapCost(base, skill) {
  return Math.max(1, Math.round(base * mm(skill, "cost")));
}

function payScrap(n, x, y) {
  const g = game;
  if (g.scrap < n) {
    addText(x, y, "고철 부족 (" + n + "개 필요)", "#ff9a9a");
    return false;
  }
  g.scrap -= n;
  g.scrapPulse = 0.4;
  return true;
}

function compressScrap() {
  const g = game;
  const k = CONFIG.cube;
  const p = g.player;
  if (g.cubeCooldown > 0) return;
  const cost = scrapCost(k.cost, "compress");
  if (!payScrap(cost, p.x, p.y - 50)) return;
  if (modOn("compress", "special")) absorbScrap();
  const a = p.aim;
  const x = clamp(p.x + Math.cos(a) * (p.r + k.radius + 18), k.radius, W - k.radius);
  const y = clamp(p.y + Math.sin(a) * (p.r + k.radius + 18), k.radius, H - k.radius);
  const hp = k.hp * mm("compress", "duration");
  g.cubes.push({ kind: "cube", x, y, r: k.radius, hp, maxHp: hp, life: k.life * mm("compress", "duration"), flash: 0, angle: 0 });
  const free = g.cubes.filter(c => !c.held && !c.thrown && !c.dead);
  if (free.length > k.max) {
    free[0].dead = true;
    burst(free[0].x, free[0].y, "#9aa3ad", 10, 140);
  }
  g.cubeCooldown = k.cooldown * mm("compress", "cooldown");
  burst(x, y, "#9aa3ad", 12, 160);
  addText(x, y - 30, "-" + cost + " 고철", "#cfd6e0");
}

function cubeImpact(c) {
  const g = game;
  const k = CONFIG.cube;
  c.thrown = null;
  c.dead = true;
  const dmg = k.throwDamage * mm("compress", "damage");
  for (const e of g.enemies) {
    if (e.dead || e.held) continue;
    const d = dist(e, c);
    if (d <= k.throwRadius + e.r) {
      damageEnemy(e, dmg);
      e.stun = Math.max(e.stun || 0, CONFIG.claw.stun);
      if (d > 0) {
        e.x += ((e.x - c.x) / d) * 30;
        e.y += ((e.y - c.y) / d) * 30;
      }
    }
  }
  g.rings.push({ x: c.x, y: c.y, r: 0, max: k.throwRadius, life: 0.3, total: 0.3, color: "#cfd6e0" });
  burst(c.x, c.y, "#9aa3ad", 24, 260);
  g.shake = Math.min(8, g.shake + 5);
}

function placeMine() {
  const g = game;
  const k = CONFIG.mine;
  const p = g.player;
  if (g.mineCooldown > 0) return;
  if (g.mines.length >= k.max) {
    addText(p.x, p.y - 50, "지뢰는 " + k.max + "개까지", "#ff9a9a");
    return;
  }
  const cost = scrapCost(k.cost, "mine");
  if (!payScrap(cost, p.x, p.y - 50)) return;
  const at = mechPoint(p, MECH.shutter[0], MECH.shutter[1] + 12);
  g.mines.push({ x: at.x, y: at.y, r: k.radius, arm: k.armTime, blink: 0 });
  g.mineCooldown = k.cooldown * mm("mine", "cooldown");
  addText(at.x, at.y - 24, "-" + cost + " 고철", "#cfd6e0");
}

function explodeMine(m) {
  const g = game;
  const k = CONFIG.mine;
  if (m.dead) return;
  m.dead = true;
  const radius = k.blastRadius * mm("mine", "range");
  const dmg = k.damage * mm("mine", "damage");
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = dist(e, m);
    if (d <= radius + e.r) {
      damageEnemy(e, dmg);
      e.stun = Math.max(e.stun || 0, 0.4);
      if (!e.held && d > 0) {
        e.x += ((e.x - m.x) / d) * 36;
        e.y += ((e.y - m.y) / d) * 36;
      }
    }
  }
  g.rings.push({ x: m.x, y: m.y, r: 0, max: radius, life: 0.35, total: 0.35, color: "#ffb347" });
  burst(m.x, m.y, "#ffb347", 26, 300);
  burst(m.x, m.y, "#6b707a", 14, 160);
  g.shake = Math.min(10, g.shake + 6);
}

function startBoost() {
  const g = game;
  const k = CONFIG.boost;
  if (g.boostCooldown > 0) return;
  g.boost = k.duration * mm("boost", "duration");
  g.boostCooldown = k.cooldown * mm("boost", "cooldown");
  for (const r of g.cleaners) burst(r.x, r.y, "#5ff0c8", 6, 100);
  addText(g.player.x, g.player.y - 50, "청소 가속!", "#5ff0c8");
}

function startOverclock() {
  const g = game;
  const k = CONFIG.overclock;
  if (g.overclockCooldown > 0 || g.overclock > 0 || g.recoil > 0) return;
  g.overclock = k.duration * mm("overclock", "duration");
  g.overclockCooldown = k.cooldown * mm("overclock", "cooldown");
  burst(g.player.x, g.player.y, "#ff9a3c", 24, 240);
  addText(g.player.x, g.player.y - 50, "오버클럭!", "#ff9a3c");
  g.shake = Math.min(8, g.shake + 3);
}

function updateSkills(dt) {
  const g = game;
  g.cubeCooldown = Math.max(0, g.cubeCooldown - dt);
  g.mineCooldown = Math.max(0, g.mineCooldown - dt);
  g.boostCooldown = Math.max(0, g.boostCooldown - dt);
  g.overclockCooldown = Math.max(0, g.overclockCooldown - dt);
  g.boost = Math.max(0, g.boost - dt);
  if (g.overclock > 0) {
    g.overclock -= dt;
    if (g.overclock <= 0) {
      g.overclock = 0;
      g.recoil = CONFIG.overclock.recoil;
      addText(g.player.x, g.player.y - 50, "과열 반동", "#9aa3ad");
      if (modOn("overclock", "special")) emergencySteam();
    }
  } else {
    g.recoil = Math.max(0, g.recoil - dt);
  }
  for (const c of g.cubes) {
    c.flash = Math.max(0, c.flash - dt);
    if (c.held || c.thrown || c.dead) continue;
    c.life -= dt;
    if (c.life <= 0) {
      c.dead = true;
      burst(c.x, c.y, "#9aa3ad", 10, 120);
    }
  }
  for (const m of g.mines) {
    if (m.dead) continue;
    m.arm -= dt;
    m.blink += dt;
    if (m.arm > 0) continue;
    for (const e of g.enemies) {
      if (!e.dead && !e.held && dist(e, m) < CONFIG.mine.trigger + e.r) {
        explodeMine(m);
        break;
      }
    }
  }
  if (g.eDownAt !== null && keys.has("KeyE") && g.time - g.eDownAt >= CONFIG.mine.detonateHold) {
    g.eDownAt = null;
    detonateAll();
  }
  updatePuddles(dt);
  for (const r of g.rings) {
    r.life -= dt;
    r.r = r.max * (1 - r.life / r.total);
  }
}

function cleanupSkills() {
  const g = game;
  g.cubes = g.cubes.filter(c => !c.dead);
  g.mines = g.mines.filter(m => !m.dead);
  g.rings = g.rings.filter(r => r.life > 0);
}

function drawCube(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const s = c.r * 1.7;
  ctx.fillStyle = c.flash > 0 ? "#ffffff" : "#8d939c";
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = "#6b717c";
  ctx.fillRect(-s / 2 + 4, -s / 2 + 4, s / 2 - 4, s / 2 - 4);
  ctx.fillStyle = "#a9afb8";
  ctx.fillRect(2, 2, s / 2 - 6, s / 2 - 6);
  ctx.fillStyle = "#b5523b";
  ctx.fillRect(-s / 2 + 5, 4, 7, 5);
  ctx.fillStyle = "#e8b931";
  ctx.fillRect(4, -s / 2 + 5, 6, 4);
  ctx.strokeStyle = "#1e1c21";
  ctx.lineWidth = 2;
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  if (c.hp < c.maxHp && !c.thrown && !c.held) drawHpBar(c.x, c.y + c.r + 4, c.r * 2, c.hp / c.maxHp);
}

function drawCubes() {
  for (const c of game.cubes) if (!c.held && !c.thrown) drawCube(c);
}

function drawMines() {
  for (const m of game.mines) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = "#3a3640";
    ctx.beginPath();
    ctx.arc(0, 0, m.r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8b931";
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1c21";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, m.r, (i * Math.PI) / 2, (i * Math.PI) / 2 + Math.PI / 4);
      ctx.closePath();
      ctx.fill();
    }
    const on = m.arm > 0 ? Math.floor(m.blink * 10) % 2 === 0 : Math.floor(m.blink * 3) % 2 === 0;
    ctx.fillStyle = on ? "#ff4b4b" : "#7a2020";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e1c21";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, m.r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawRings() {
  for (const r of game.rings) {
    ctx.globalAlpha = clamp(r.life / r.total, 0, 1);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function pressMine() {
  if (modOn("mine", "special")) game.eDownAt = game.time;
  else placeMine();
}

function releaseMine() {
  const g = game;
  if (g.eDownAt === null) return;
  g.eDownAt = null;
  placeMine();
}

function detonateAll() {
  const g = game;
  const list = g.mines.filter(m => !m.dead);
  if (!list.length) {
    addText(g.player.x, g.player.y - 50, "터뜨릴 지뢰가 없음", "#9aa3ad");
    return;
  }
  for (const m of list) explodeMine(m);
  addText(g.player.x, g.player.y - 50, "예약 기폭!", "#ffb347");
}

function absorbScrap() {
  const g = game;
  const p = g.player;
  let n = 0;
  for (const s of g.scraps) {
    if (s.dead || dist(s, p) > CONFIG.absorb.range) continue;
    s.dead = true;
    n++;
    const life = 0.35;
    g.particles.push({ x: s.x, y: s.y, vx: (p.x - s.x) / life, vy: (p.y - s.y) / life, life, max: life, color: "#cfd6e0", size: 5 });
  }
  if (n > 0) {
    g.scrap += n;
    g.scrapPulse = 0.4;
    addText(p.x, p.y - 70, "+" + n + " 고철 흡수", "#ffe27a");
  }
}

function emergencySteam() {
  const g = game;
  const k = CONFIG.steam;
  const p = g.player;
  for (const e of g.enemies) {
    if (e.dead || e.held || e.type !== "drone") continue;
    const d = dist(e, p);
    if (d > k.range || d === 0) continue;
    e.x += ((e.x - p.x) / d) * k.push;
    e.y += ((e.y - p.y) / d) * k.push;
    e.x = clamp(e.x, e.r, W - e.r);
    e.y = clamp(e.y, e.r, H - e.r);
    e.stun = Math.max(e.stun || 0, k.stun);
  }
  const cp = mechPoint(p, MECH.chimney[0], MECH.chimney[1]);
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rand(80, 260);
    const life = rand(0.5, 1);
    g.particles.push({ x: cp.x, y: cp.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color: "#e6e8ec", size: rand(6, 12) });
  }
  g.rings.push({ x: p.x, y: p.y, r: 0, max: k.range, life: 0.4, total: 0.4, color: "#e6e8ec" });
  addText(p.x, p.y - 70, "비상 배기!", "#e6e8ec");
}

function spawnPuddle(b) {
  const t = rand(0.15, 1);
  game.puddles.push({ x: b.sx + (b.ex - b.sx) * t + rand(-8, 8), y: b.sy + (b.ey - b.sy) * t + rand(-8, 8), r: CONFIG.puddle.radius * rand(0.8, 1.2), life: CONFIG.puddle.life, total: CONFIG.puddle.life });
}

function inPuddle(e) {
  for (const pd of game.puddles) if (dist(e, pd) < pd.r + e.r * 0.5) return true;
  return false;
}

function updateCleanerSpecials(dt, damage) {
  const g = game;
  const f = CONFIG.fusion;
  const p = g.player;
  if (modOn("cleaner", "special")) {
    const pool = g.cleaners.filter(r => !r.dead && !r.fused && r.mode === "work" && r.launch <= 0);
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i];
        const b = pool[j];
        if (a.dead || b.dead || a.fused || b.fused || dist(a, b) > a.r + b.r + 2) continue;
        a.fused = true;
        a.r = f.radius;
        a.maxHp = (a.maxHp + b.maxHp) * f.hpMul;
        a.hp = (a.hp + b.hp) * f.hpMul;
        a.carry += b.carry;
        a.power = f.damageMul;
        a.x = (a.x + b.x) / 2;
        a.y = (a.y + b.y) / 2;
        b.dead = true;
        burst(a.x, a.y, "#e8b931", 16, 180);
        addText(a.x, a.y - 26, "융합!", "#e8b931");
      }
    }
  }
  for (const r of g.cleaners) {
    if (!r.fused || r.dead) continue;
    r.spinTimer = (r.spinTimer || 0) - dt;
    r.spinFx = Math.max(0, (r.spinFx || 0) - dt);
    if (r.mode !== "work" || r.spinTimer > 0) continue;
    const range = r.r + f.spinRange;
    const near = g.enemies.filter(e => !e.dead && !e.held && !e.thrown && dist(e, r) <= range + e.r);
    if (near.length < 2) continue;
    for (const e of near) damageEnemy(e, damage * f.spinDamage * r.power);
    r.spinTimer = f.spinInterval / (g.boost > 0 ? CONFIG.boost.speedMul : 1);
    r.spinFx = 0.25;
    burst(r.x, r.y, "#e8b931", 8, 160);
  }
  if (g.boost > 0 && modOn("boost", "special")) {
    for (const r of g.cleaners) {
      if (r.dead || r.mode !== "return") continue;
      for (const s of g.scraps) {
        if (!s.dead && dist(r, s) < r.r + CONFIG.emergency.range) {
          s.dead = true;
          r.carry++;
        }
      }
    }
  }
}

function updatePuddles(dt) {
  const g = game;
  for (const pd of g.puddles) pd.life -= dt;
  g.puddles = g.puddles.filter(pd => pd.life > 0);
}

function drawPuddles() {
  for (const pd of game.puddles) {
    ctx.globalAlpha = clamp(pd.life / pd.total, 0, 1) * 0.55;
    ctx.fillStyle = "#6f8f22";
    ctx.beginPath();
    ctx.ellipse(pd.x, pd.y, pd.r, pd.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a9c84a";
    ctx.beginPath();
    ctx.ellipse(pd.x - pd.r * 0.2, pd.y - pd.r * 0.15, pd.r * 0.45, pd.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
