const ENEMY_POOLS = {
  base: ["tow", "blocker", "shooter"],
  1: ["stamp", "ironcart"],
  2: ["rusher", "tire"],
  3: ["leak", "reactor"],
  4: ["demolisher", "relay"],
  5: ["glitch", "cursor"]
};

function pickEnemyType() {
  const g = game;
  if (g.level < 2) return Math.random() < 0.7 ? "tow" : "shooter";
  const pool = ENEMY_POOLS.base.slice();
  const extra = ENEMY_POOLS[Math.min(5, g.zone)] || [];
  for (const t of extra) pool.push(t, t);
  if (g.node === "elite") pool.push("blocker", ...extra);
  return pool[Math.floor(Math.random() * pool.length)];
}

function aiDt(e, dt) {
  return dt * (e.buffT > 0 ? CONFIG.enemyAi.buffMul : 1);
}

function enemySpeed(e) {
  return e.speed * slowMul(e) * (e.buffT > 0 ? CONFIG.enemyAi.buffMul : 1);
}

function chaseAttack(e, dt) {
  const g = game;
  const p = g.player;
  e.attackTimer -= aiDt(e, dt);
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
  if (best - e.r > 3) moveToward(e, target.x, target.y, enemySpeed(e) * dt);
  else if (e.attackTimer <= 0 && e.damage > 0) {
    e.attackTimer = CONFIG.enemyAttackInterval;
    hitTarget(target, e.damage);
  }
  return true;
}

function keepRange(e, dt, near, far) {
  const p = game.player;
  const d = dist(e, p);
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  e.angle = a;
  const step = enemySpeed(e) * dt;
  if (d < near) moveToward(e, e.x - Math.cos(a) * 100, e.y - Math.sin(a) * 100, step);
  else if (d > far) moveToward(e, p.x, p.y, step);
  else {
    e.strafe = e.strafe || (Math.random() < 0.5 ? 1 : -1);
    e.x += -Math.sin(a) * e.strafe * step * 0.4;
    e.y += Math.cos(a) * e.strafe * step * 0.4;
    if (e.x < e.r + 20 || e.x > W - e.r - 20 || e.y < e.r + 20 || e.y > H - e.r - 20) e.strafe *= -1;
  }
  e.x = clamp(e.x, e.r, W - e.r);
  e.y = clamp(e.y, e.r, H - e.r);
}

function setAi(e, ai, t) {
  e.ai = ai;
  e.aiT = t;
}

function front(e, d) {
  return { x: e.x + Math.cos(e.angle) * d, y: e.y + Math.sin(e.angle) * d };
}

function dashStep(e, dt, speed, damage) {
  const p = game.player;
  e.x += Math.cos(e.aim) * speed * dt;
  e.y += Math.sin(e.aim) * speed * dt;
  const wall = e.x < e.r || e.x > W - e.r || e.y < e.r || e.y > H - e.r;
  e.x = clamp(e.x, e.r, W - e.r);
  e.y = clamp(e.y, e.r, H - e.r);
  if (!e.hitDone && dist(e, p) < e.r + p.r) {
    e.hitDone = true;
    hitTarget(p, damage);
    return "hit";
  }
  return wall ? "wall" : "";
}

const ENEMY_AI = {
  tow(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.tow;
    if (e.ai === "wind") {
      e.aiT -= k;
      e.windup = e.aiT;
      e.angle = e.aim;
      if (e.aiT <= 0) {
        setAi(e, "dash", c.dash);
        e.hitDone = false;
      }
      return true;
    }
    if (e.ai === "dash") {
      e.aiT -= k;
      const r = dashStep(e, dt, c.speed, c.damage);
      if (r === "hit") {
        const d = Math.max(1, dist(e, p));
        p.x = clamp(p.x + ((e.x - p.x) / d) * c.pull, p.r, W - p.r);
        p.y = clamp(p.y + ((e.y - p.y) / d) * c.pull, p.r, H - p.r);
        setAi(e, "rest", 0.6);
      } else if (e.aiT <= 0 || r === "wall") {
        setAi(e, "rest", c.stuck);
        e.vulnerable = c.stuck;
        burst(e.x, e.y, "#9aa3ad", 6, 90);
      }
      return true;
    }
    if (e.ai === "rest") {
      e.aiT -= k;
      if (e.aiT <= 0) {
        setAi(e, "move", 0);
        e.cool = rand(1.4, 2.4);
      }
      return true;
    }
    e.cool = (e.cool === undefined ? rand(0.5, 1.5) : e.cool) - k;
    const d = dist(e, p);
    if (e.cool <= 0 && d < c.range) {
      e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      setAi(e, "wind", c.wind);
      lineHazard(e.x, e.y, e.aim, c.speed * c.dash + e.r, e.r * 2 + 6, { warn: c.wind, active: 0, owner: e, color: "#ffb347" });
      return true;
    }
    return chaseAttack(e, dt);
  },
  glitch(e, dt) {
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.glitch;
    e.exposed = Math.max(0, (e.exposed || 0) - dt);
    e.blinkT = (e.blinkT === undefined ? rand(1, 2) : e.blinkT) - k;
    if ((!e.ai || e.ai === "move") && e.blinkT <= 0) {
      const p = game.player;
      const a = Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() < 0.5 ? 1 : -1) * rand(0.6, 1.1);
      for (let i = 0; i < 4; i++) game.particles.push({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), vx: 0, vy: 0, life: 0.4, max: 0.4, color: i % 2 ? "#3ff0ff" : "#ff3bd0", size: e.r });
      e.x = clamp(e.x + Math.cos(a) * c.blink, e.r, W - e.r);
      e.y = clamp(e.y + Math.sin(a) * c.blink, e.r, H - e.r);
      e.exposed = c.exposed;
      e.vulnerable = c.exposed;
      e.blinkT = rand(c.every * 0.8, c.every * 1.2);
    }
    return ENEMY_AI.tow(e, dt);
  },
  blocker(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.blocker;
    if (e.ai === "wind") {
      e.aiT -= k;
      e.windup = e.aiT;
      e.angle = e.aim;
      if (e.aiT <= 0) {
        setAi(e, "stuck", c.stuck);
        e.vulnerable = c.stuck;
        game.shake = Math.min(8, game.shake + 3);
        const f = front(e, e.r + c.len / 2);
        burst(f.x, f.y, "#e05252", 10, 140);
      }
      return true;
    }
    if (e.ai === "stuck") {
      e.aiT -= k;
      if (e.aiT <= 0) {
        setAi(e, "move", 0);
        e.cool = c.cool;
      }
      return true;
    }
    e.cool = (e.cool || 0) - k;
    if (e.cool <= 0 && dist(e, p) < e.r + p.r + c.len * 0.7) {
      e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = e.aim;
      setAi(e, "wind", c.wind);
      lineHazard(e.x, e.y, e.aim, e.r + c.len, c.width, { warn: c.wind, active: 0.12, damage: c.damage, owner: e, color: "#ff4b4b" });
      return true;
    }
    return chaseAttack(e, dt);
  },
  shooter(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.shooter;
    if (e.ai === "aim") {
      e.aiT -= k;
      e.windup = e.aiT;
      e.angle = e.aim;
      if (e.aiT <= 0) {
        const f = front(e, e.r + 6);
        straightShot(f, e.aim, c.shotSpeed, "scrap", c.damage, null, { r: 9, draw: drawScrapShot });
        setAi(e, "reload", c.reload);
      }
      return true;
    }
    if (e.ai === "reload") {
      e.aiT -= k;
      if (e.aiT <= 0) {
        setAi(e, "move", 0);
        e.cool = rand(0.2, 0.6);
      }
      return true;
    }
    keepRange(e, dt, c.near, c.far);
    e.cool = (e.cool === undefined ? rand(0.5, 1.5) : e.cool) - k;
    if (e.cool <= 0 && dist(e, p) < c.far + 80) {
      e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      setAi(e, "aim", c.aimTime);
      lineHazard(e.x, e.y, e.aim, 520, 8, { warn: c.aimTime, active: 0, owner: e, color: "#ffd24d" });
    }
    return true;
  },
  stamp(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.stamp;
    if (e.ai === "wind") {
      e.aiT -= k;
      e.windup = e.aiT;
      if (e.aiT <= 0) {
        setAi(e, "stuck", c.stuck);
        e.vulnerable = c.stuck;
        game.shake = Math.min(8, game.shake + 4);
        burst(e.target.x, e.target.y, "#c0392b", 12, 150);
      }
      return true;
    }
    if (e.ai === "stuck") {
      e.aiT -= k;
      if (e.aiT <= 0) {
        setAi(e, "move", 0);
        e.cool = c.cool;
      }
      return true;
    }
    e.cool = (e.cool || 0) - k;
    if (e.cool <= 0 && dist(e, p) < c.range) {
      e.target = { x: p.x, y: p.y };
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      setAi(e, "wind", c.wind);
      addHazard({ shape: "circle", x: p.x, y: p.y, r: c.radius, warn: c.wind, active: 0.12, damage: c.damage, owner: e, color: "#ff4b4b" });
      return true;
    }
    return chaseAttack(e, dt);
  },
  ironcart(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.ironcart;
    if (e.ai === "brake") {
      e.aiT -= k;
      e.windup = e.aiT;
      if (e.aiT <= 0) {
        const f = front(e, e.r + c.radius * 0.6);
        dropBossObject(f.x, f.y, "block", c.hot);
        e.empty = true;
        e.speed *= c.emptySpeed;
        setAi(e, "move", 0);
      }
      return true;
    }
    if (!e.empty && dist(e, p) < c.range) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      const f = front(e, e.r + c.radius * 0.6);
      setAi(e, "brake", c.brake);
      addHazard({ shape: "circle", x: f.x, y: f.y, r: c.radius, warn: c.brake, active: c.pourTime, dps: c.dps, owner: e, color: "#ff7a1a" });
      return true;
    }
    return chaseAttack(e, dt);
  },
  rusher(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.rusher;
    if (e.ai === "wind") {
      e.aiT -= k;
      e.windup = e.aiT;
      e.angle = e.aim;
      if (e.aiT <= 0) {
        setAi(e, "dash", c.dash);
        e.hitDone = false;
      }
      return true;
    }
    if (e.ai === "dash") {
      e.aiT -= k;
      const r = dashStep(e, dt, c.speed, c.damage);
      if (r === "hit") game.shake = Math.min(8, game.shake + 4);
      if (e.aiT <= 0 || r === "wall") {
        setAi(e, "stuck", c.stuck);
        e.vulnerable = c.stuck;
        burst(e.x, e.y, "#9aa3ad", 8, 110);
      }
      return true;
    }
    if (e.ai === "stuck") {
      e.aiT -= k;
      if (e.aiT <= 0) {
        setAi(e, "move", 0);
        e.cool = c.cool;
      }
      return true;
    }
    e.cool = (e.cool === undefined ? rand(0.5, 1.5) : e.cool) - k;
    const d = dist(e, p);
    if (e.cool <= 0 && d < c.range) {
      e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      setAi(e, "wind", c.wind);
      lineHazard(e.x, e.y, e.aim, c.speed * c.dash + e.r, e.r * 2 + 8, { warn: c.wind, active: 0, owner: e, color: "#ff4b4b" });
      return true;
    }
    keepRange(e, dt, c.near, c.range - 40);
    return true;
  },
  tire(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.tire;
    if (e.ai === "aim") {
      e.aiT -= k;
      e.windup = e.aiT;
      e.angle = e.aim;
      if (e.aiT <= 0) {
        setAi(e, "roll", 0);
        e.shots = c.count;
        e.shotT = 0;
      }
      return true;
    }
    if (e.ai === "roll") {
      e.angle = e.aim;
      e.shotT -= k;
      if (e.shotT <= 0 && e.shots > 0) {
        e.shots--;
        e.shotT = c.gap;
        straightShot(front(e, e.r + 10), e.aim, c.shotSpeed, "tire", c.damage, null, { r: 12, draw: drawTireShot });
      }
      if (e.shots <= 0 && e.shotT <= 0) {
        setAi(e, "move", 0);
        e.cool = c.cool;
      }
      return true;
    }
    keepRange(e, dt, c.near, c.far);
    e.cool = (e.cool === undefined ? rand(0.8, 1.6) : e.cool) - k;
    if (e.cool <= 0) {
      e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      setAi(e, "aim", c.aimTime);
      lineHazard(e.x, e.y, e.aim, 640, 24, { warn: c.aimTime, active: 0, owner: e, color: "#ffb347" });
    }
    return true;
  },
  leak(e, dt) {
    const c = CONFIG.enemyAi.leak;
    e.dripT = (e.dripT || 0) - aiDt(e, dt);
    if (e.dripT <= 0) {
      e.dripT = c.every;
      if (game.hazards.filter(h => h.leak).length < c.max) {
        addHazard({ shape: "circle", x: e.x, y: e.y, r: c.radius, warn: 0.25, active: c.life, dps: c.dps, leak: true, color: "#7fd13b" });
      }
    }
    return chaseAttack(e, dt);
  },
  reactor(e, dt) {
    const p = game.player;
    const c = CONFIG.enemyAi.reactor;
    e.onImpact = explodeReactor;
    if (e.ai === "fuse") {
      if (e.hz && e.hz.dead && !e.hz.started) {
        setAi(e, "move", 0);
        e.windup = 0;
        return chaseAttack(e, dt);
      }
      e.aiT -= dt;
      e.windup = e.aiT;
      e.angle += dt * 20;
      return true;
    }
    if (dist(e, p) < e.r + p.r + c.trigger) {
      setAi(e, "fuse", c.fuse);
      e.hz = addHazard({ shape: "circle", x: e.x, y: e.y, r: c.radius, warn: c.fuse, active: 0.1, damage: c.damage, owner: e, color: "#7fd13b", onStart: () => explodeReactor(e), move: h => { h.x = e.x; h.y = e.y; } });
      return true;
    }
    return chaseAttack(e, dt);
  },
  demolisher(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.demolisher;
    if (e.ai === "spin") {
      e.aiT -= k;
      e.windup = e.aiT;
      e.spin = (e.spin || 0) + dt * 12;
      if (e.aiT <= 0) {
        lobShot(e, e.target, c.flight, "ball", null, { draw: drawBallShot, r: 14 });
        setAi(e, "reel", c.reel);
        e.vulnerable = c.reel;
      }
      return true;
    }
    if (e.ai === "reel") {
      e.aiT -= k;
      if (e.aiT <= 0) {
        setAi(e, "move", 0);
        e.cool = c.cool;
      }
      return true;
    }
    e.cool = (e.cool === undefined ? rand(0.8, 1.6) : e.cool) - k;
    if (e.cool <= 0 && dist(e, p) < c.range) {
      e.target = { x: p.x, y: p.y };
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      setAi(e, "spin", c.wind);
      addHazard({ shape: "circle", x: p.x, y: p.y, r: c.radius, warn: c.wind + c.flight, active: 0.12, damage: c.damage, owner: e, color: "#ff4b4b" });
      return true;
    }
    return chaseAttack(e, dt);
  },
  relay(e, dt) {
    const c = CONFIG.enemyAi.relay;
    e.links = [];
    for (const o of game.enemies) {
      if (o === e || o.dead || isBossLike(o) || o.type === "relay" || dist(o, e) > c.range) continue;
      o.buffT = 0.3;
      e.links.push(o);
    }
    e.onDeath = relayDown;
    keepRange(e, dt, c.near, c.far);
    return true;
  },
  cursor(e, dt) {
    const p = game.player;
    const k = aiDt(e, dt);
    const c = CONFIG.enemyAi.cursor;
    keepRange(e, dt, c.near, c.far);
    e.cool = (e.cool === undefined ? rand(1, 2) : e.cool) - k;
    if (e.cool <= 0) {
      e.cool = c.cool;
      e.windup = c.wind;
      addHazard({ shape: "rect", x: p.x, y: p.y, angle: 0, len: c.size, width: c.size, warn: c.wind, active: 0.15, damage: c.damage, owner: e, color: "#ff5fd2" });
    }
    e.windup = Math.max(0, (e.windup || 0) - dt);
    return true;
  }
};

function explodeReactor(e) {
  const g = game;
  const c = CONFIG.enemyAi.reactor;
  if (e.blown) return;
  e.blown = true;
  for (const o of g.enemies) {
    if (o === e || o.dead) continue;
    if (dist(o, e) <= c.radius + o.r) damageEnemy(o, c.enemyDamage);
  }
  e.hp = 0;
  g.rings.push({ x: e.x, y: e.y, r: 0, max: c.radius, life: 0.35, total: 0.35, color: "#7fd13b" });
  burst(e.x, e.y, "#7fd13b", 24, 280);
  g.shake = Math.min(10, g.shake + 6);
}

function relayDown(e) {
  for (const o of e.links || []) {
    if (o.dead) continue;
    o.stun = Math.max(o.stun || 0, CONFIG.enemyAi.relay.stun);
    o.buffT = 0;
  }
  addText(e.x, e.y - 20, "신호 끊김", "#7fd3ff");
}

function enemyDamageMul(e) {
  if (e.type === "blocker" && e.ai !== "stuck") {
    const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
    if (angleDiff(a, e.angle) < CONFIG.enemyAi.blocker.guardArc) return CONFIG.enemyAi.blocker.guardMul;
  }
  if (e.type === "glitch" && !(e.exposed > 0)) return CONFIG.enemyAi.glitch.ghostMul;
  return 1;
}

function runEnemyAi(e, dt) {
  e.buffT = Math.max(0, (e.buffT || 0) - dt);
  const fn = ENEMY_AI[e.type];
  if (!fn) return false;
  if (e.windup > 0 && !e.ai) e.windup = 0;
  return fn(e, dt);
}

function drawScrapShot(s) {
  ctx.rotate(game.time * 12);
  ctx.fillStyle = "#9aa3ad";
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = "#5d646e";
  ctx.lineWidth = 2;
  ctx.strokeRect(-7, -7, 14, 14);
}

function drawTireShot(s) {
  ctx.fillStyle = "#1e1c21";
  ctx.fillRect(-7, -12, 14, 24);
  ctx.fillStyle = "#3a3640";
  const off = (game.time * 40) % 8;
  for (let y = -12 + off; y < 12; y += 8) ctx.fillRect(-7, y, 14, 3);
  ctx.strokeStyle = "#6b717c";
  ctx.lineWidth = 2;
  ctx.strokeRect(-7, -12, 14, 24);
}

function drawBallShot(s) {
  ctx.fillStyle = "#3a3640";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b717c";
  ctx.beginPath();
  ctx.arc(-4, -4, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegs(e, n) {
  const t = game.time * 12 + e.x * 0.05;
  const per = Math.max(2, Math.floor(n / 2));
  ctx.strokeStyle = "#2a2d33";
  ctx.lineWidth = 3;
  for (let i = 0; i < per * 2; i++) {
    const side = i % 2 ? 1 : -1;
    const j = Math.floor(i / 2);
    const lx = e.r * (0.55 - (1.1 * j) / (per - 1));
    const swing = Math.sin(t + i * 1.7) * e.r * 0.2;
    ctx.beginPath();
    ctx.moveTo(lx * 0.6, side * e.r * 0.4);
    ctx.lineTo(lx * 1.2 + swing * 0.5, side * e.r * 1.1);
    ctx.lineTo(lx * 1.5 + swing, side * e.r * 1.5);
    ctx.stroke();
  }
}

function drawGear(e, d) {
  const r = e.r;
  const t = e.type;
  if (t === "tow" || t === "glitch") {
    ctx.strokeStyle = "#e8b931";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 1.4, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 1.4, r * 0.35, r * 0.35, -Math.PI / 2, Math.PI * 0.8);
    ctx.stroke();
  } else if (t === "blocker") {
    if (e.ai === "stuck") {
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(r * 0.9, -r * 0.9, r * 1.6, r * 1.8);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(r * 1.5, -r * 0.7, r * 0.4, r * 1.4);
    } else {
      const lift = e.ai === "wind" ? 4 : 0;
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(r * 0.95 - lift, -r * 1.15, 8, r * 2.3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(r * 0.95 - lift, -r * 0.5, 8, r);
    }
  } else if (t === "shooter") {
    ctx.fillStyle = "#6b717c";
    ctx.fillRect(0, -5, r * 1.6, 10);
    ctx.fillStyle = "#3a3640";
    ctx.fillRect(r * 1.3, -6, 6, 12);
  } else if (t === "stamp") {
    const up = e.ai === "wind" ? 1.25 : 1;
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-r * 0.6 * up, -r * 0.6 * up, r * 1.2 * up, r * 1.2 * up);
    ctx.fillStyle = "#ffd3cf";
    ctx.fillRect(-r * 0.25 * up, -r * 0.4 * up, r * 0.5 * up, r * 0.8 * up);
  } else if (t === "ironcart") {
    ctx.fillStyle = "#3a3640";
    ctx.fillRect(-r * 0.9, -r * 0.7, r * 1.2, r * 1.4);
    ctx.fillStyle = e.empty ? "#6b717c" : Math.floor(game.time * 6) % 2 ? "#ff7a1a" : "#ffb347";
    ctx.fillRect(-r * 0.75, -r * 0.55, r * 0.9, r * 1.1);
  } else if (t === "rusher") {
    ctx.fillStyle = "#6b717c";
    ctx.fillRect(-r * 1.2, -r * 0.6, r * 0.7, r * 0.4);
    ctx.fillRect(-r * 1.2, r * 0.2, r * 0.7, r * 0.4);
    if (e.ai === "wind" || e.ai === "dash") {
      ctx.fillStyle = e.ai === "dash" ? "#ffd24d" : "#ff7a1a";
      const f = e.ai === "dash" ? 1.6 : 0.8 + Math.random() * 0.4;
      ctx.fillRect(-r * (1.2 + 0.6 * f), -r * 0.55, r * 0.6 * f, r * 0.3);
      ctx.fillRect(-r * (1.2 + 0.6 * f), r * 0.25, r * 0.6 * f, r * 0.3);
    }
  } else if (t === "tire") {
    const n = e.ai === "roll" ? e.shots : 3;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = "#1e1c21";
      ctx.beginPath();
      ctx.arc(-r * 0.3, 0, r * (0.75 - i * 0.15), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6b717c";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (t === "leak") {
    ctx.fillStyle = "#4a7a2a";
    ctx.beginPath();
    ctx.arc(-r * 0.3, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7fd13b";
    ctx.beginPath();
    ctx.arc(-r * 1.0, Math.sin(game.time * 8) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (t === "demolisher") {
    const a = e.ai === "spin" ? e.spin : Math.PI;
    const bx = Math.cos(a) * r * 1.6;
    const by = Math.sin(a) * r * 1.6;
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bx, by);
    ctx.stroke();
    if (e.ai !== "reel") {
      ctx.fillStyle = "#3a3640";
      ctx.beginPath();
      ctx.arc(bx, by, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (t === "relay") {
    ctx.fillStyle = "#c8ccd4";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, s * r * 0.3);
      ctx.lineTo(r * 0.9, s * r * 0.9);
      ctx.lineTo(r * 0.4, s * r * 1.1);
      ctx.lineTo(-r * 0.2, s * r * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawCursorEnemy(e, d) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = "#ff5fd2";
  ctx.shadowBlur = 10;
  ctx.fillStyle = e.flash > 0 ? "#ffd0f2" : "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-e.r * 0.6, -e.r);
  ctx.lineTo(-e.r * 0.6, e.r * 0.7);
  ctx.lineTo(-e.r * 0.15, e.r * 0.25);
  ctx.lineTo(e.r * 0.25, e.r * 1.05);
  ctx.lineTo(e.r * 0.5, e.r * 0.9);
  ctx.lineTo(e.r * 0.1, e.r * 0.15);
  ctx.lineTo(e.r * 0.7, e.r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#1e1c21";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawRobotEnemy(e) {
  const d = CONFIG.enemies[e.type];
  if (!d || !d.look) return false;
  if (e.type === "cursor") drawCursorEnemy(e, d);
  else {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === "glitch" && !(e.exposed > 0)) ctx.globalAlpha = 0.55;
    const shake = e.windup > 0 || e.ai === "fuse" ? rand(-1.5, 1.5) : 0;
    ctx.translate(shake, 0);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, e.r * 0.5, e.r * 1.2, e.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(e.angle);
    drawLegs(e, d.legs || 4);
    if (e.type === "glitch") {
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = "#3ff0ff";
      ctx.fillRect(-e.r * 0.9 + 3, -e.r * 0.7, e.r * 1.8, e.r * 1.4);
      ctx.fillStyle = "#ff3bd0";
      ctx.fillRect(-e.r * 0.9 - 3, -e.r * 0.7, e.r * 1.8, e.r * 1.4);
      ctx.globalAlpha *= 2;
    }
    const hot = e.windup > 0 && Math.floor(performance.now() / 90) % 2 === 0;
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : hot ? "#ff6b4b" : e.type === "reactor" ? "#5fbf3a" : "#4a4f5a";
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r * 0.95, e.r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e1c21";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (e.type === "reactor") {
      ctx.fillStyle = "#e8b931";
      ctx.fillRect(-e.r * 0.95, -2, e.r * 1.9, 4);
    } else {
      ctx.fillStyle = d.color;
      ctx.fillRect(-e.r * 0.45, -e.r * 0.35, e.r * 0.7, e.r * 0.7);
    }
    drawGear(e, d);
    ctx.fillStyle = "#ff2a2a";
    ctx.beginPath();
    ctx.arc(e.r * 0.7, 0, Math.max(2.5, e.r * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (e.type === "relay" && e.links) {
      ctx.strokeStyle = "rgba(127, 211, 255, " + (0.35 + 0.25 * Math.sin(game.time * 10)) + ")";
      ctx.lineWidth = 1.5;
      for (const o of e.links) {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
    }
  }
  if (e.windup > 0 || e.ai === "fuse") {
    ctx.fillStyle = "#ff4b4b";
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("!", e.x, e.y - e.r - 6);
  }
  if (e.stun > 0) {
    ctx.fillStyle = "#ffe27a";
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("★", e.x + Math.cos(game.time * 8) * 8, e.y - e.r - 4);
  }
  if (e.hp < e.maxHp) drawHpBar(e.x, e.y + e.r + 6, e.r * 2, e.hp / e.maxHp);
  return true;
}
