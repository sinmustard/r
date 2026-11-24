const BOSS_DEFS = {};

function addHazard(o) {
  const h = Object.assign({ t: 0, warn: 0, active: 0, damage: 0, dps: 0, color: "#ff4b4b", hit: false, started: false }, o);
  game.hazards.push(h);
  return h;
}

function hurtPlayer(amount) {
  const p = game.player;
  p.hp -= amount;
  p.flash = Math.max(p.flash, 0.05);
}

function circleHit(h, o, pad) {
  return dist(o, h) < h.r + pad;
}

function rectHit(h, o, pad) {
  const c = Math.cos(-h.angle);
  const s = Math.sin(-h.angle);
  const dx = o.x - h.x;
  const dy = o.y - h.y;
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= h.len / 2 + pad && Math.abs(ly) <= h.width / 2 + pad;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function hazardHits(h, o) {
  const pad = (o.r || 0) * 0.6;
  if (h.shape === "circle") return circleHit(h, o, pad);
  if (h.shape === "rect") return rectHit(h, o, pad);
  if (h.shape === "cone") {
    const d = dist(o, h);
    return d <= h.len + pad && angleDiff(Math.atan2(o.y - h.y, o.x - h.x), h.angle) <= h.spread / 2;
  }
  if (h.shape === "ring") {
    const d = dist(o, h);
    if (Math.abs(d - h.radius) > h.thick / 2 + pad) return false;
    return angleDiff(Math.atan2(o.y - h.y, o.x - h.x), h.gap) > h.gapWidth / 2;
  }
  if (h.shape === "flood") return !h.safe.some(s => dist(o, s) < s.r - pad * 0.5);
  if (h.shape === "outside") return o.x < h.sx || o.x > h.sx + h.sw || o.y < h.sy || o.y > h.sy + h.sh;
  if (h.shape === "wall") return Math.abs(o.x - h.x) < h.thick / 2 + pad && (o.y < h.gapY - h.gapH / 2 || o.y > h.gapY + h.gapH / 2);
  return false;
}

function lineHazard(x, y, angle, len, width, extra) {
  return addHazard(Object.assign({ shape: "rect", x: x + Math.cos(angle) * len / 2, y: y + Math.sin(angle) * len / 2, angle, len, width }, extra));
}

function updateHazards(dt) {
  const g = game;
  const p = g.player;
  for (const h of g.hazards) {
    h.t += dt;
    if (h.move) h.move(h, dt);
    const live = h.t >= h.warn;
    if (live && !h.started) {
      h.started = true;
      if (h.onStart) h.onStart(h);
    }
    if (live && hazardHits(h, p)) {
      if (h.damage && !h.hit) {
        h.hit = true;
        hitTarget(p, h.damage);
      }
      if (h.dps) hurtPlayer(h.dps * dt);
      if (h.push) {
        p.x = clamp(p.x + h.push.x * dt, p.r, W - p.r);
        p.y = clamp(p.y + h.push.y * dt, p.r, H - p.r);
      }
    }
    if (live && h.push) {
      for (const r of g.cleaners) {
        if (hazardHits(h, r)) {
          r.x = clamp(r.x + h.push.x * dt, r.r, W - r.r);
          r.y = clamp(r.y + h.push.y * dt, r.r, H - r.r);
        }
      }
    }
    if (h.t >= h.warn + h.active) {
      h.dead = true;
      if (h.onEnd) h.onEnd(h);
    }
  }
  g.hazards = g.hazards.filter(h => !h.dead);
}

function lobShot(from, to, flight, kind, onLand, extra) {
  game.bossShots.push(Object.assign({ mode: "lob", sx: from.x, sy: from.y, tx: to.x, ty: to.y, x: from.x, y: from.y, t: 0, flight, kind, onLand, r: 16 }, extra));
}

function straightShot(from, angle, speed, kind, damage, onLand, extra) {
  game.bossShots.push(Object.assign({ mode: "line", x: from.x, y: from.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, kind, damage, onLand, r: 16, hit: false, angle }, extra));
}

function updateShots(dt) {
  const g = game;
  const p = g.player;
  for (const s of g.bossShots) {
    if (s.mode === "lob") {
      s.t += dt;
      const k = clamp(s.t / s.flight, 0, 1);
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k;
      s.z = Math.sin(Math.PI * k) * 90;
      if (k >= 1) {
        s.dead = true;
        if (s.onLand) s.onLand(s);
      }
    } else {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (!s.hit && dist(s, p) < s.r + p.r * 0.7) {
        s.hit = true;
        hitTarget(p, s.damage);
      }
      if (s.x < s.r || s.x > W - s.r || s.y < s.r || s.y > H - s.r) {
        s.x = clamp(s.x, s.r + 2, W - s.r - 2);
        s.y = clamp(s.y, s.r + 2, H - s.r - 2);
        s.dead = true;
        if (s.onLand) s.onLand(s);
      }
    }
  }
  g.bossShots = g.bossShots.filter(s => !s.dead);
}

function dropBossObject(x, y, look, hot) {
  const k = CONFIG.cube;
  const hp = k.hp;
  game.cubes.push({ kind: "cube", look, x: clamp(x, k.radius, W - k.radius), y: clamp(y, k.radius, H - k.radius), r: k.radius, hp, maxHp: hp, life: CONFIG.boss.objectLife, flash: 0, angle: rand(-0.3, 0.3), hot: hot || 0, burnCd: 0 });
}

function makeAct(dur, events, update) {
  return { t: 0, dur, events: events.map(e => ({ at: e[0], fn: e[1], done: false })), update };
}

function stepAct(act, dt, b, p) {
  act.t += dt;
  for (const e of act.events) {
    if (!e.done && act.t >= e.at) {
      e.done = true;
      e.fn(b, p);
    }
  }
  if (act.update) act.update(dt, b, p, act.t);
  return act.t >= act.dur;
}

function aim(b, p) {
  return Math.atan2(p.y - b.y, p.x - b.x);
}

function chargeSteps(b, count, speed, windup, runTime, damage, recover) {
  const events = [];
  const span = windup + runTime;
  let runs = [];
  for (let i = 0; i < count; i++) {
    const t0 = i * span;
    events.push([t0, (bb, pp) => {
      const a = aim(bb, pp);
      runs[i] = { a, from: t0 + windup, to: t0 + span, hit: false };
      bb.windup = windup;
      lineHazard(bb.x, bb.y, a, speed * runTime + bb.r, bb.r * 2, { warn: windup, active: 0, color: "#ff4b4b" });
    }]);
  }
  return makeAct(count * span + recover, events, (dt, bb, pp, t) => {
    bb.windup = Math.max(0, bb.windup - dt);
    for (const r of runs) {
      if (r && t >= r.from && t < r.to) {
        bb.x = clamp(bb.x + Math.cos(r.a) * speed * dt, bb.r, W - bb.r);
        bb.y = clamp(bb.y + Math.sin(r.a) * speed * dt, bb.r, H - bb.r);
        if (!r.hit && dist(bb, pp) < bb.r + pp.r) {
          r.hit = true;
          hitTarget(pp, damage);
          game.shake = Math.min(12, game.shake + 8);
        }
      }
    }
    if (t >= count * span) bb.vulnerable = Math.max(bb.vulnerable || 0, 0.1);
  });
}

BOSS_DEFS["steel-factory"] = {
  phases: [0.5],
  idle: [1.4, 0.9],
  patterns: {
    roll: b => chargeSteps(b, b.phase > 0 ? 2 : 1, 460, 0.8, 0.6, 40, 1.4),
    pour: () => makeAct(3.2, [], (dt, b, p, t) => {
      moveToward(b, p.x, p.y, 150 * dt);
      b.trail = (b.trail || 0) - dt;
      if (b.trail <= 0) {
        b.trail = 0.14;
        addHazard({ shape: "circle", x: b.x + rand(-10, 10), y: b.y + b.r * 0.6, r: 26, active: 4, dps: 25, color: "#ff7a1a", molten: true });
      }
    }),
    blocks: b => {
      const ev = [];
      for (let i = 0; i < 3; i++) {
        ev.push([0.2 + i * 0.45, (bb, pp) => {
          const to = { x: clamp(pp.x + rand(-20, 20), 30, W - 30), y: clamp(pp.y + rand(-20, 20), 30, H - 30) };
          addHazard({ shape: "circle", x: to.x, y: to.y, r: 38, warn: 0.8, active: 0.05, damage: 30 });
          lobShot(bb, to, 0.8, "block", s => {
            burst(s.x, s.y, "#ff9a3c", 14, 200);
            dropBossObject(s.x, s.y, "block", b.phase > 0 ? 1 : 2);
          });
        }]);
      }
      return makeAct(1.8, ev);
    },
    sweep: () => makeAct(1.6, [[0, (b, p) => {
      addHazard({ shape: "cone", x: b.x, y: b.y, angle: aim(b, p), spread: Math.PI * 0.75, len: 270, warn: 0.9, active: 0.25, damage: 35, color: "#ffb347" });
    }]]),
    exhaust: () => makeAct(1.9, [[0, b => {
      addHazard({
        shape: "circle", x: b.x, y: b.y, r: 200, warn: 1.2, active: 0.35, damage: 30, color: "#cfd6e0",
        onStart: h => {
          const p = game.player;
          const d = dist(p, h);
          if (d < h.r && d > 0) {
            p.x = clamp(p.x + (p.x - h.x) / d * 80, p.r, W - p.r);
            p.y = clamp(p.y + (p.y - h.y) / d * 80, p.r, H - p.r);
          }
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2;
            const life = rand(0.5, 1);
            game.particles.push({ x: h.x, y: h.y, vx: Math.cos(a) * rand(120, 320), vy: Math.sin(a) * rand(120, 320), life, max: life, color: "#e6e8ec", size: rand(6, 12) });
          }
        }
      });
    }]], (dt, b, p, t) => {
      if (t < 1.2 && Math.random() < 0.4) {
        const life = rand(0.6, 1);
        game.particles.push({ x: b.x + rand(-20, 20), y: b.y - b.r, vx: rand(-15, 15), vy: rand(-80, -40), life, max: life, color: "#8a8f99", size: rand(6, 10) });
      }
    })
  }
};

BOSS_DEFS["auto-factory"] = {
  phases: [0.5],
  idle: [1.3, 0.5],
  combo: true,
  patterns: {
    press: b => {
      const n = b.phase > 0 ? 5 : 3;
      const ev = [];
      for (let i = 0; i < n; i++) ev.push([i * 0.35, (bb, pp) => addHazard({ shape: "circle", x: pp.x, y: pp.y, r: 55, warn: 0.75, active: 0.12, damage: 30, color: "#ffb347" })]);
      return makeAct(n * 0.35 + 1, ev);
    },
    cars: () => makeAct(1.5, [[0, (b, p) => {
      const a = aim(b, p);
      b.carAngles = [a - 0.32, a, a + 0.32];
      for (const ang of b.carAngles) lineHazard(b.x, b.y, ang, 1400, 34, { warn: 0.7, active: 0 });
    }], [0.7, b => {
      for (const ang of b.carAngles) {
        straightShot(b, ang, 380, "car", 25, s => {
          burst(s.x, s.y, "#cfd6e0", 10, 160);
          dropBossObject(s.x, s.y, "car", 0);
        });
      }
    }]]),
    conveyor: () => makeAct(1.0, [[0, (b, p) => {
      const dir = Math.random() < 0.5 ? -1 : 1;
      addHazard({ shape: "rect", x: W / 2, y: p.y, angle: 0, len: W, width: 130, warn: 0.8, active: 4, push: { x: dir * 170, y: 0 }, color: "#6fa8dc", belt: dir });
    }]]),
    weld: () => makeAct(2.6, [[0, (b, p) => {
      const n = 10;
      const side = Math.random() < 0.5 ? -1 : 1;
      const a = aim(b, p);
      const mx = (b.x + p.x) / 2 + Math.cos(a + Math.PI / 2) * 120 * side;
      const my = (b.y + p.y) / 2 + Math.sin(a + Math.PI / 2) * 120 * side;
      const ex = p.x + Math.cos(a) * 120;
      const ey = p.y + Math.sin(a) * 120;
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / n;
        const x = (1 - k) * (1 - k) * b.x + 2 * (1 - k) * k * mx + k * k * ex;
        const y = (1 - k) * (1 - k) * b.y + 2 * (1 - k) * k * my + k * k * ey;
        addHazard({ shape: "circle", x: clamp(x, 0, W), y: clamp(y, 0, H), r: 28, warn: 0.9 + i * 0.08, active: 2, dps: 30, color: "#ffd24d", spark: true });
      }
    }]]),
    crush: () => makeAct(1.9, [[0, (b, p) => {
      b.crushA = aim(b, p);
      b.windup = 0.9;
      lineHazard(b.x, b.y, b.crushA, 300, b.r * 2 + 120, { warn: 0.9, active: 0.45, damage: 40, color: "#ff4b4b" });
    }]], (dt, b, p, t) => {
      b.windup = Math.max(0, b.windup - dt);
      if (t > 0.9 && t < 1.35) {
        b.x = clamp(b.x + Math.cos(b.crushA) * 360 * dt, b.r, W - b.r);
        b.y = clamp(b.y + Math.sin(b.crushA) * 360 * dt, b.r, H - b.r);
      }
      if (t >= 1.35) b.vulnerable = Math.max(b.vulnerable || 0, 0.1);
    })
  }
};

BOSS_DEFS.basic = {
  phases: [],
  idle: [1.5],
  patterns: {
    charge: b => chargeSteps(b, 1, 420, 0.7, 0.55, 45, 1)
  }
};

function bossDef(b) {
  return BOSS_DEFS[b.kind] || BOSS_DEFS.basic;
}

function pickPattern(b, def) {
  const names = Object.keys(def.patterns).filter(n => n !== b.lastPattern);
  const name = names[Math.floor(Math.random() * names.length)];
  b.lastPattern = name;
  return name;
}

function updateBoss(dt) {
  const g = game;
  const b = g.boss;
  const p = g.player;
  if (!b || b.dead) {
    if (g.hazards.length || g.bossShots.length) {
      g.hazards = [];
      g.bossShots = [];
    }
    updateClones(dt);
    return;
  }
  const def = bossDef(b);
  b.vulnerable = Math.max(0, (b.vulnerable || 0) - dt);
  b.contactCd = (b.contactCd || 0) - dt;
  if (dist(b, p) < b.r + p.r && b.contactCd <= 0) {
    b.contactCd = 0.8;
    hitTarget(p, CONFIG.boss.contactDamage);
  }
  updateHazards(dt);
  updateShots(dt);
  updateClones(dt);
  if (b.y < CONFIG.boss.enterY) {
    b.y += 140 * dt;
    return;
  }
  const ratio = b.hp / b.maxHp;
  if (b.phase < def.phases.length && ratio <= def.phases[b.phase]) {
    b.phase++;
    b.act = null;
    b.queue = [];
    b.idle = 1.2;
    b.windup = 0;
    showBanner(b.name + " · " + (b.phase + 1) + "페이즈");
    burst(b.x, b.y, "#ff4b4b", 30, 260);
    g.shake = Math.min(12, g.shake + 8);
    if (def.onPhase) def.onPhase(b);
  }
  if (b.act) {
    if (stepAct(b.act, dt, b, p)) {
      b.act = null;
      if (b.queue && b.queue.length) {
        b.act = def.patterns[b.queue.shift()](b);
        b.idle = 0;
      } else b.idle = def.idle[Math.min(b.phase, def.idle.length - 1)];
    }
    return;
  }
  b.idle -= dt;
  const d = dist(b, p);
  if (!def.still) {
    if (d > 300) moveToward(b, p.x, p.y, 70 * dt);
    else if (d < 170) moveToward(b, b.x * 2 - p.x, b.y * 2 - p.y, 50 * dt);
    b.x = clamp(b.x, b.r, W - b.r);
    b.y = clamp(b.y, b.r, H - b.r);
  }
  if (b.idle <= 0) {
    const names = def.phasePatterns ? def.phasePatterns[b.phase] : null;
    const name = names ? names[Math.floor(Math.random() * names.length)] : pickPattern(b, def);
    b.act = def.patterns[name](b);
    if (def.combo && b.phase > 0 && !names) b.queue = [pickPattern(b, def)];
  }
}

function updateClones() {}

function drawHazard(h) {
  const live = h.t >= h.warn;
  const warnK = h.warn > 0 ? clamp(h.t / h.warn, 0, 1) : 1;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 70);
  ctx.save();
  ctx.fillStyle = h.color;
  ctx.strokeStyle = h.color;
  ctx.globalAlpha = live ? (h.dps || h.push ? 0.38 : 0.6) : 0.08 + 0.22 * warnK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (h.shape === "circle") ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
  else if (h.shape === "rect") {
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.rect(-h.len / 2, -h.width / 2, h.len, h.width);
  } else if (h.shape === "cone") {
    ctx.moveTo(h.x, h.y);
    ctx.arc(h.x, h.y, h.len, h.angle - h.spread / 2, h.angle + h.spread / 2);
    ctx.closePath();
  } else if (h.shape === "ring") {
    ctx.lineWidth = h.thick;
    ctx.arc(h.x, h.y, Math.max(1, h.radius), h.gap + h.gapWidth / 2, h.gap - h.gapWidth / 2 + Math.PI * 2);
    ctx.globalAlpha = live ? 0.7 : 0.25;
    ctx.stroke();
    ctx.restore();
    return;
  } else if (h.shape === "flood") {
    ctx.rect(0, 0, W, H);
    for (const s of h.safe) {
      ctx.moveTo(s.x + s.r, s.y);
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2, true);
    }
  } else if (h.shape === "outside") {
    ctx.rect(0, 0, W, H);
    ctx.moveTo(h.sx, h.sy);
    ctx.lineTo(h.sx, h.sy + h.sh);
    ctx.lineTo(h.sx + h.sw, h.sy + h.sh);
    ctx.lineTo(h.sx + h.sw, h.sy);
    ctx.closePath();
  } else if (h.shape === "wall") {
    ctx.rect(h.x - h.thick / 2, 0, h.thick, h.gapY - h.gapH / 2);
    ctx.rect(h.x - h.thick / 2, h.gapY + h.gapH / 2, h.thick, H - h.gapY - h.gapH / 2);
  }
  ctx.fill("evenodd");
  if (!live) {
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (h.belt && live) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#1e1c21";
    ctx.lineWidth = 4;
    const off = ((game.time * 120 * h.belt) % 40 + 40) % 40;
    for (let x = -h.len / 2 + off; x < h.len / 2; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x - h.belt * 8, -h.width / 2 + 10);
      ctx.lineTo(x + h.belt * 8, 0);
      ctx.lineTo(x - h.belt * 8, h.width / 2 - 10);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (live && (h.molten || h.spark) && Math.random() < 0.15) {
    const life = rand(0.2, 0.4);
    game.particles.push({ x: h.x + rand(-h.r, h.r) * 0.6, y: h.y + rand(-h.r, h.r) * 0.6, vx: rand(-30, 30), vy: rand(-60, -20), life, max: life, color: h.spark ? "#fff2a8" : "#ffb347", size: rand(2, 4) });
  }
}

function drawShot(s) {
  ctx.save();
  if (s.mode === "lob") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(s.x, s.y - (s.z || 0));
  } else {
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle || 0);
  }
  if (s.kind === "block") {
    ctx.fillStyle = "#ff7a1a";
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = "#ffd24d";
    ctx.fillRect(-8, -8, 16, 16);
  } else if (s.kind === "car") {
    ctx.fillStyle = "#3a3640";
    for (const [x, y] of [[-12, -13], [8, -13], [-12, 9], [8, 9]]) ctx.fillRect(x, y, 8, 4);
    ctx.fillStyle = "#9aa3ad";
    ctx.fillRect(-18, -10, 36, 20);
    ctx.fillStyle = "#6fa8dc";
    ctx.fillRect(2, -7, 9, 14);
  } else if (s.kind === "barrel") {
    ctx.fillStyle = "#5fbf3a";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8b931";
    ctx.fillRect(-13, -2, 26, 4);
  }
  ctx.strokeStyle = "#1e1c21";
  ctx.lineWidth = 2;
  ctx.restore();
}

function drawBossTelegraph() {
  const g = game;
  for (const h of g.hazards) drawHazard(h);
  for (const s of g.bossShots) drawShot(s);
}
