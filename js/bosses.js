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
    const o = h.owner;
    if (o && !h.started && (o.dead || o.hp <= 0 || o.held || o.thrown || o.stun > 0)) {
      h.dead = true;
      continue;
    }
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
      moveToward(b, p.x, p.y, 150 * slowMul(b) * dt);
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

function inChem(x, y) {
  return game.hazards.some(h => h.chem && h.t >= h.warn && h.shape === "circle" && Math.hypot(x - h.x, y - h.y) < h.r);
}

function chemPuddle(x, y, r, type) {
  addHazard({ shape: "circle", x: clamp(x, 0, W), y: clamp(y, 0, H), r, active: 3.5, dps: 18, color: type === 2 ? "#a55bd6" : "#7ad13a", chem: type || 1 });
}

function chemBlast(x, y, r, damage) {
  addHazard({ shape: "circle", x, y, r, active: 0.15, damage, color: "#ffe27a" });
  burst(x, y, "#ffe27a", 22, 260);
  burst(x, y, "#7ad13a", 12, 200);
  game.shake = Math.min(10, game.shake + 5);
}

function throwBarrel(b, to, explodeAlways) {
  addHazard({ shape: "circle", x: to.x, y: to.y, r: 40, warn: 0.9, active: 0, color: "#7ad13a" });
  lobShot(b, to, 0.9, "barrel", s => {
    if (explodeAlways || inChem(s.x, s.y)) chemBlast(s.x, s.y, 70, 40);
    else dropBossObject(s.x, s.y, "barrel", 0);
  });
}

BOSS_DEFS["chemical-factory"] = {
  phases: [0.5],
  idle: [1.3, 0.8],
  patterns: {
    spray: () => {
      const ev = [];
      for (let i = 0; i < 3; i++) {
        ev.push([i * 0.4, (b, p) => {
          const a = aim(b, p) + (i - 1) * 0.5;
          const type = b.phase > 0 ? 1 + (i % 2) : 1;
          addHazard({
            shape: "cone", x: b.x, y: b.y, angle: a, spread: 0.85, len: 280, warn: 0.5, active: 0.3, damage: 18, color: type === 2 ? "#a55bd6" : "#7ad13a",
            onStart: h => {
              for (const d of [100, 180, 255]) chemPuddle(h.x + Math.cos(h.angle) * d, h.y + Math.sin(h.angle) * d, 26 + d * 0.06, type);
            }
          });
        }]);
      }
      return makeAct(1.9, ev, (dt, b, p) => moveToward(b, p.x, p.y, 40 * slowMul(b) * dt));
    },
    waves: b => {
      const n = b.phase > 0 ? 3 : 2;
      const ev = [];
      let gap = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const g0 = gap;
        gap += Math.PI * (0.6 + Math.random() * 0.6);
        ev.push([i * 1.0, bb => addHazard({
          shape: "ring", x: bb.x, y: bb.y, radius: bb.r, thick: 26, gap: g0, gapWidth: 1.0, warn: 0.5, active: 2.8, damage: 30, color: "#9fd8c0",
          move: (h, dt) => { if (h.t >= h.warn) h.radius += 300 * dt; }
        })]);
      }
      return makeAct(n * 1.0 + 2.5, ev);
    },
    barrels: () => {
      const ev = [];
      for (let i = 0; i < 3; i++) {
        ev.push([i * 0.3, (b, p) => throwBarrel(b, { x: clamp(p.x + rand(-80, 80), 30, W - 30), y: clamp(p.y + rand(-80, 80), 30, H - 30) }, false)]);
      }
      return makeAct(1.9, ev);
    },
    pipes: () => {
      const ev = [];
      const dir = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        ev.push([i * 0.35, (b, p) => {
          const a = aim(b, p) + dir * i * (Math.PI / 2) + dir * 0.3;
          lineHazard(b.x, b.y, a, 430, 44, { warn: 0.5, active: 0.5, dps: 60, color: "#e6e8ec" });
        }]);
      }
      return makeAct(2.4, ev);
    },
    flood: b => {
      const safe = [];
      let tries = 0;
      while (safe.length < 3 && tries++ < 200) {
        const s = { x: rand(130, W - 130), y: rand(150, H - 160), r: 80 };
        if (safe.every(o => dist(o, s) > 230)) safe.push(s);
      }
      const ev = [[0, () => {
        addHazard({ shape: "flood", safe, warn: 3, active: 5, dps: 30, color: "#7ad13a" });
        showBanner("긴급 배출 · 발판으로 피하세요");
      }]];
      if (b.floods > 0) ev.push([1.6, bb => throwBarrel(bb, safe[Math.floor(Math.random() * safe.length)], true)]);
      b.floods = (b.floods || 0) + 1;
      return makeAct(8.2, ev);
    }
  },
  update: (b, dt) => {
    if (b.phase < 1) return;
    const list = game.hazards.filter(h => h.chem && h.t >= h.warn && !h.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const c = list[j];
        if (a.chem !== c.chem && !a.dead && !c.dead && dist(a, c) < a.r + c.r) {
          a.dead = true;
          c.dead = true;
          chemBlast((a.x + c.x) / 2, (a.y + c.y) / 2, 60, 35);
        }
      }
    }
  }
};

BOSS_DEFS.executioner = {
  phases: [0.5],
  idle: [1.4, 1.0],
  combos2: [["barrage", "barrier"], ["burn", "crush"], ["barrage", "burn"]],
  patterns: {
    barrage: b => {
      const n = b.phase > 0 ? 12 : 8;
      const ev = [];
      for (let i = 0; i < n; i++) {
        ev.push([i * 0.18, (bb, pp) => addHazard({ shape: "circle", x: clamp(pp.x + rand(-200, 200), 20, W - 20), y: clamp(pp.y + rand(-200, 200), 20, H - 20), r: 52, warn: 0.8, active: 0.12, damage: 28, color: "#ff6b3c" })]);
      }
      return makeAct(n * 0.18 + 1.1, ev);
    },
    barrier: () => makeAct(3.8, [[0, () => {
      for (const side of [-1, 1]) {
        addHazard({
          shape: "wall", x: side < 0 ? 13 : W - 13, thick: 26, gapY: rand(130, H - 130), gapH: 130, warn: 0.6, active: 3, damage: 30, color: "#b44ad8", side,
          move: (h, dt) => { if (h.t >= h.warn) h.x += -h.side * (W / 2 - 13) / 3 * dt; }
        });
      }
    }]]),
    burn: () => {
      const rows = 6;
      const order = Array.from({ length: rows }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, rows - 1);
      const ev = order.map((row, i) => [i * 0.45, () => addHazard({ shape: "rect", x: W / 2, y: (row + 0.5) * H / rows, angle: 0, len: W, width: H / rows - 4, warn: 0.8, active: 1.0, dps: 45, color: "#ff7a1a", molten: true })]);
      return makeAct(order.length * 0.45 + 1.9, ev);
    },
    crush: () => makeAct(3.4, [[0, (b, p) => {
      b.crushA = aim(b, p);
      b.windup = 1;
      b.crushHit = false;
      lineHazard(b.x, b.y, b.crushA, 1600, b.r * 2 + 10, { warn: 1, active: 0, color: "#ff4b4b" });
    }]], (dt, b, p, t) => {
      b.windup = Math.max(0, b.windup - dt);
      if (t > 1 && t < 2.4) {
        const nx = b.x + Math.cos(b.crushA) * 760 * dt;
        const ny = b.y + Math.sin(b.crushA) * 760 * dt;
        if (nx < b.r || nx > W - b.r || ny < b.r || ny > H - b.r) {
          if (!b.crushStop) {
            b.crushStop = true;
            game.shake = Math.min(12, game.shake + 8);
          }
        } else {
          b.x = nx;
          b.y = ny;
        }
        if (!b.crushHit && dist(b, p) < b.r + p.r) {
          b.crushHit = true;
          hitTarget(p, 45);
        }
      }
      if (t >= 2.4) {
        b.crushStop = false;
        b.vulnerable = Math.max(b.vulnerable || 0, 0.1);
      }
    })
  }
};

function spawnClone(b, x, y) {
  const d = CONFIG.enemies.clone;
  const hp = d.hp * (1 + (game.zone - 1) * 0.3);
  const c = { type: "clone", sprite: b.sprite, kind: b.kind, phase: b.phase, alpha: 0.5, x, y, r: d.radius, hp, maxHp: hp, speed: 0, damage: d.damage, attackTimer: 0, flash: 0, angle: 0, life: 4.2 };
  game.enemies.push(c);
  burst(x, y, "#ff3b6b", 14, 180);
  return c;
}

function updateClones(dt) {
  const p = game.player;
  for (const c of game.enemies) {
    if (c.type !== "clone" || c.dead) continue;
    c.life -= dt;
    if (c.life <= 0) {
      c.dead = true;
      c.hp = 0;
      c.noReward = true;
      burst(c.x, c.y, "#ff3b6b", 10, 140);
      continue;
    }
    if (c.charge) {
      c.x = clamp(c.x + c.charge.vx * dt, c.r, W - c.r);
      c.y = clamp(c.y + c.charge.vy * dt, c.r, H - c.r);
      c.charge.t -= dt;
      if (!c.charge.hit && dist(c, p) < c.r + p.r) {
        c.charge.hit = true;
        hitTarget(p, c.damage);
      }
      if (c.charge.t <= 0) c.charge = null;
    }
  }
}

function securityTiles(share, warn) {
  const size = 160;
  for (let x = 0; x < W; x += size) {
    for (let y = 0; y < H; y += size) {
      if (Math.random() < share) addHazard({ shape: "rect", x: x + size / 2, y: y + size / 2, angle: 0, len: size - 6, width: size - 6, warn, active: 0.4, damage: 35, color: "#ff3b6b" });
    }
  }
}

BOSS_DEFS["central-ai"] = {
  phases: [2 / 3, 1 / 3],
  idle: [1.4, 1.1, 0.9],
  still: true,
  phasePatterns: [["security"], ["clone", "security"], ["collapse", "security"]],
  patterns: {
    security: () => makeAct(2.6, [[0, () => {
      securityTiles(0.35, 1.2);
      for (let i = 0; i < 2; i++) {
        const a = Math.random() < 0.5 ? 0 : Math.PI / 2;
        addHazard({ shape: "rect", x: rand(200, W - 200), y: rand(180, H - 180), angle: a, len: 380, width: 22, warn: 0.6, active: 4, damage: 20, color: "#5ff0c8" });
      }
    }]]),
    clone: b => {
      const spots = [[180, 200], [W - 180, 200], [W / 2, H - 170]];
      const ev = [[0, bb => {
        bb.clones = spots.map(([x, y]) => spawnClone(bb, x, y));
      }]];
      for (let i = 0; i < 3; i++) {
        ev.push([0.9 + i * 0.7, (bb, pp) => {
          const c = bb.clones[i];
          if (!c || c.dead) return;
          for (let k = 0; k < 8; k++) {
            const t = k / 8;
            const life = 0.4;
            game.particles.push({ x: bb.x + (c.x - bb.x) * t, y: bb.y + (c.y - bb.y) * t, vx: 0, vy: 0, life, max: life, color: "#ff3b6b", size: 5 });
          }
          c.aimA = aim(c, pp);
          lineHazard(c.x, c.y, c.aimA, 600 * 0.5 + c.r, c.r * 2, { warn: 0.6, active: 0, color: "#ff3b6b" });
        }]);
        ev.push([1.5 + i * 0.7, () => {
          const c = b.clones[i];
          if (!c || c.dead) return;
          c.charge = { vx: Math.cos(c.aimA) * 600, vy: Math.sin(c.aimA) * 600, t: 0.5, hit: false };
        }]);
      }
      return makeAct(4.2, ev);
    },
    collapse: () => makeAct(8, [[0, () => {
      showBanner("시스템 붕괴 · 가운데로 모이세요");
      addHazard({
        shape: "outside", sx: 0, sy: 0, sw: W, sh: H, warn: 1, active: 6, dps: 35, color: "#ff3b6b",
        move: h => {
          const k = clamp((h.t - h.warn) / 3, 0, 1) * 0.45;
          h.sw = W * (1 - k);
          h.sh = H * (1 - k);
          h.sx = (W - h.sw) / 2;
          h.sy = (H - h.sh) / 2;
        }
      });
    }], [3.5, () => securityTiles(0.15, 1)], [5.5, () => securityTiles(0.15, 1)], [7.2, b => {
      b.vulnerable = 3.5;
      showBanner("코어 노출!");
      burst(b.x, b.y, "#ffe27a", 30, 260);
    }]])
  },
  update: (b, dt) => {
    b.hover = (b.hover || 0) + dt;
    b.x += (W / 2 + Math.sin(b.hover * 0.6) * 180 - b.x) * Math.min(1, dt * 1.5);
    b.y += (170 - b.y) * Math.min(1, dt * 1.5);
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

function phaseShift(b, def) {
  showBanner(b.name + " · " + (b.phase + 1) + "페이즈");
  burst(b.x, b.y, "#ff4b4b", 30, 260);
  game.shake = Math.min(12, game.shake + 8);
  if (def.onPhase) def.onPhase(b);
}

function startBossTransition(b, sheet) {
  const g = game;
  g.hazards = [];
  g.bossShots = [];
  g.beam = null;
  if (g.held && g.held !== b) {
    g.held.held = false;
    g.held = null;
  }
  for (const c of g.enemies) {
    if (c.type !== "clone") continue;
    c.dead = true;
    c.noReward = true;
  }
  b.transition = { t: 0, frame: -1, zoom: 1, fromX: b.x, fromY: b.y, sheet };
}

function updateBossTransition(dt) {
  const g = game;
  const b = g.boss;
  const a = CONFIG.bossAnim;
  const tr = b.transition;
  tr.t += dt;
  const play = a.frameTime * 6;
  const tx = W / 2;
  const ty = H / 2 - 40;
  if (tr.t < a.moveTime) {
    const k = tr.t / a.moveTime;
    const e = k * k * (3 - 2 * k);
    b.x = tr.fromX + (tx - tr.fromX) * e;
    b.y = tr.fromY + (ty - tr.fromY) * e;
    tr.zoom = 1 + (a.zoom - 1) * e;
    b.moveT = (b.moveT || 0) + dt;
    const p = g.player;
    const need = b.r + p.r + 70;
    const d = Math.hypot(p.x - tx, p.y - ty);
    if (d < need) {
      const ang = d > 1 ? Math.atan2(p.y - ty, p.x - tx) : Math.PI / 2;
      p.x = clamp(p.x + Math.cos(ang) * Math.min(need - d, 400 * dt), p.r, W - p.r);
      p.y = clamp(p.y + Math.sin(ang) * Math.min(need - d, 400 * dt), p.r, H - p.r);
    }
    b.dir = 0;
    return;
  }
  b.x = tx;
  b.y = ty;
  b.px = tx;
  b.py = ty;
  b.moveT = 0;
  b.dir = 0;
  const pt = tr.t - a.moveTime;
  if (pt < play) {
    const f = Math.floor(pt / a.frameTime);
    if (f !== tr.frame) {
      tr.frame = f;
      g.shake = Math.min(10, g.shake + 3);
      burst(b.x, b.y, "#ff4b4b", 10, 200);
    }
    tr.zoom = a.zoom;
    return;
  }
  tr.frame = 6;
  const back = pt - play;
  if (back < a.holdTime) {
    tr.zoom = a.zoom - (a.zoom - 1) * (back / a.holdTime);
    return;
  }
  b.transition = null;
  phaseShift(b, bossDef(b));
}

function updateBoss(dt) {
  const g = game;
  const b = g.boss;
  const p = g.player;
  if (!b || b.dead) {
    updateHazards(dt);
    updateShots(dt);
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
    b.act2 = null;
    b.queue = [];
    b.idle = 1.2;
    b.windup = 0;
    const trKey = b.phase === 1 ? "trans-" : b.phase === 2 ? "trans3-" : "";
    if (trKey && SPRITES[trKey + b.kind]) {
      startBossTransition(b, trKey);
      return;
    }
    phaseShift(b, def);
  }
  if (def.update) def.update(b, dt);
  if (b.act2 && stepAct(b.act2, dt, b, p)) b.act2 = null;
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
    if (d > 300) moveToward(b, p.x, p.y, 70 * slowMul(b) * dt);
    else if (d < 170) moveToward(b, b.x * 2 - p.x, b.y * 2 - p.y, 50 * slowMul(b) * dt);
    b.x = clamp(b.x, b.r, W - b.r);
    b.y = clamp(b.y, b.r, H - b.r);
  }
  if (b.idle <= 0) {
    const names = def.phasePatterns ? def.phasePatterns[b.phase] : null;
    const name = names ? names[Math.floor(Math.random() * names.length)] : pickPattern(b, def);
    if (def.combos2 && b.phase > 0) {
      const pair = def.combos2[Math.floor(Math.random() * def.combos2.length)];
      b.act = def.patterns[pair[0]](b);
      b.act2 = def.patterns[pair[1]](b);
      b.lastPattern = pair[0];
    } else {
      b.act = def.patterns[name](b);
      if (def.combo && b.phase > 0 && !names) b.queue = [pickPattern(b, def)];
    }
  }
}

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
  if (h.shape === "flood") {
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#e8b931";
    for (const s of h.safe) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  if (s.draw) {
    s.draw(s);
    ctx.restore();
    return;
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
