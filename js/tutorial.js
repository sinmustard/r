const guide = { page: 0, required: false };
const guideIcons = [0, 1, 6, 8, 10].map(i => {
  const img = new Image();
  img.src = "assets/modules/" + i + ".png";
  return img;
});

const GUIDE_PAGES = [
  {
    title: "중앙 AI를 멈춰라",
    lines: [
      "중앙 AI가 인간을 말살하려 한다.",
      "쓰레기 처리공장이 거대 로봇으로 변신해 맞선다.",
      "",
      "당신은 이 공장 로봇을 조종한다.",
      "구역을 하나씩 돌파하고 마지막 구역의 보스를 쓰러뜨리면 클리어."
    ],
    art: "mech"
  },
  {
    title: "한 판의 흐름",
    lines: [
      "갈림길에서 다음 목적지를 2~3개 중 하나 고른다.",
      "전투 · 정예 전투 · 정비 · 사건 — 6칸을 지나면 구역 보스.",
      "",
      "처음에는 4구역 보스가 최종 보스다.",
      "누적 " + CONFIG.unlockZone5 + "회 클리어하면 5구역 · 중앙 AI가 열린다.",
      "쓰러지거나 클리어하면 모듈과 고철은 모두 초기화된다."
    ],
    art: "route"
  },
  {
    title: "고철과 정비",
    lines: [
      "적을 쓰러뜨리면 고철이 떨어진다.",
      "본체로 직접 줍거나 청소 로봇에게 주워 오게 한다.",
      "",
      "고철로 큐브와 지뢰를 만들고,",
      "정비 칸에서는 모듈을 개발해 스킬 카트리지에 꽂는다.",
      "스킬마다 슬롯은 4칸, 같은 종류는 하나만."
    ],
    art: "modules"
  },
  {
    title: "조작",
    lines: [],
    art: "controls"
  }
];

function tutorialDone() {
  return store("factory-tutorial") === "1";
}

function startGuide(required) {
  guide.page = 0;
  guide.required = required;
  state = "guide";
  mouse.spray = false;
}

function guideNext() {
  if (guide.page < GUIDE_PAGES.length - 1) guide.page++;
  else startTutorial(guide.required);
}

function guideKey(code) {
  if (["Space", "Enter", "ArrowRight", "KeyD"].includes(code)) guideNext();
  if (["ArrowLeft", "KeyA", "Backspace"].includes(code)) guide.page = Math.max(0, guide.page - 1);
  if (code === "Escape" && !guide.required) goTitle();
}

function drawGuideArt(kind) {
  const cx = 960;
  const cy = 330;
  if (kind === "mech") {
    const m = Object.assign({}, titleScene.mech, { x: cx, y: cy + 40, aim: Math.sin(performance.now() / 900) * 0.4, walk: performance.now() / 1000, moving: true });
    drawPlayer(m, 2.6);
  } else if (kind === "route") {
    const nodes = [["전투", "#e05252"], ["정예", "#b44ad8"], ["정비", "#e8b931"], ["사건", "#4fa3e0"], ["보스", "#ff6b4b"]];
    nodes.forEach(([label, color], i) => {
      const x = 800 + (i % 3) * 120;
      const y = 230 + Math.floor(i / 3) * 140 + (i % 2) * 20;
      if (i > 0) {
        const px = 800 + ((i - 1) % 3) * 120;
        const py = 230 + Math.floor((i - 1) / 3) * 140 + ((i - 1) % 2) * 20;
        ctx.strokeStyle = "#3a3f4a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#171a20";
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
    });
  } else if (kind === "modules") {
    for (let i = 0; i < 9; i++) {
      ctx.save();
      ctx.translate(820 + (i % 3) * 40 + Math.sin(i * 2.1) * 10, 190 + Math.floor(i / 3) * 34);
      ctx.rotate(i + performance.now() / 1500);
      ctx.fillStyle = "#9aa3ad";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeStyle = "#5d646e";
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }
    guideIcons.forEach((img, i) => {
      if (img.complete && img.naturalWidth) ctx.drawImage(img, 780 + (i % 3) * 110, 330 + Math.floor(i / 3) * 110, 96, 96);
    });
  } else if (kind === "controls") {
    CONTROLS.forEach(([key, desc], i) => {
      const col = i < 6 ? 0 : 1;
      const y = 250 + (i % 6) * 40;
      const x = col === 0 ? 120 : 620;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillStyle = "#e8b931";
      ctx.fillText(key, x, y);
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = "#d7dce3";
      ctx.fillText(desc, x + 100, y);
    });
  }
}

function drawGuide() {
  const p = GUIDE_PAGES[guide.page];
  ctx.fillStyle = "#13161b";
  ctx.fillRect(0, 0, W, H);
  drawStripes(0, 14);
  drawStripes(H - 14, 14);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8b931";
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText("튜토리얼 · 안내 " + (guide.page + 1) + " / " + GUIDE_PAGES.length, 120, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 48px ${FONT}`;
  ctx.fillText(p.title, 120, 170);
  ctx.font = `21px ${FONT}`;
  ctx.fillStyle = "#d7dce3";
  p.lines.forEach((l, i) => ctx.fillText(l, 120, 250 + i * 40));
  drawGuideArt(p.art);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const last = guide.page === GUIDE_PAGES.length - 1;
  drawPrompt(last ? "스페이스나 클릭으로 연습 전투 시작" : "스페이스나 클릭으로 다음", 610);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = "#6b717c";
  ctx.fillText((guide.page > 0 ? "← A 이전  ·  " : "") + (last ? "D → 연습 전투" : "D → 다음") + (guide.required ? "" : "  ·  Esc 시작 화면으로"), W / 2, 650);
}

function tutorialEnemy(type, x, y, opts) {
  const e = spawnEnemy(type);
  e.x = x;
  e.y = y;
  return Object.assign(e, opts || {});
}

const TUTORIAL_STEPS = [
  {
    title: "이동",
    text: "WASD로 본체를 움직여 보세요. 마우스로 조준해요.",
    setup: (g, t) => {
      t.moved = 0;
      t.last = { x: g.player.x, y: g.player.y };
    },
    update: (g, t) => {
      t.moved += dist(g.player, t.last);
      t.last = { x: g.player.x, y: g.player.y };
    },
    progress: (g, t) => Math.min(100, Math.floor(t.moved / 4)) + "%",
    done: (g, t) => t.moved >= 400
  },
  {
    title: "집게팔",
    text: "좌클릭으로 적을 잡고, 던질 방향을 조준한 뒤 다시 좌클릭해서 다른 적에게 던지세요.",
    setup: g => {
      tutorialEnemy("tow", 860, 300, { passive: true });
      tutorialEnemy("tow", 1060, 420, { passive: true });
    },
    update: (g, t) => {
      if (g.enemies.some(e => e.thrown)) t.threw = true;
    },
    progress: (g, t) => (t.threw ? "던짐!" : "잡아서 던지기"),
    done: (g, t) => t.threw && !g.enemies.some(e => e.thrown)
  },
  {
    title: "오염 폐수",
    text: "우클릭을 누르고 있으면 폐수가 나가요. 탱크는 쉬면 다시 차요. 적 4기를 쓸어버리세요.",
    setup: (g, t) => {
      t.left = [];
      for (let i = 0; i < 4; i++) t.left.push(tutorialEnemy("tow", 900 + (i % 2) * 60, 280 + i * 50, { passive: true }));
    },
    progress: (g, t) => t.left.filter(e => e.dead || e.hp <= 0).length + " / 4",
    done: (g, t) => t.left.every(e => e.dead || e.hp <= 0)
  },
  {
    title: "청소 로봇",
    text: "Q로 청소 로봇을 내보내면 고철을 주워요. R로 불러들이면 가져온 고철을 받아요.",
    setup: g => {
      g.delivered = 0;
      for (const [x, y] of [[260, 160], [1020, 560], [1080, 140], [220, 560]]) dropScrap(x, y, 3);
      for (const s of g.scraps) s.life = 999;
    },
    progress: g => "회수한 고철 " + Math.min(3, g.delivered) + " / 3",
    done: g => g.delivered >= 3
  },
  {
    title: "고철 압축",
    text: "F로 고철 큐브를 만들고, 큐브를 좌클릭으로 잡아 차단봇에게 던지세요.",
    setup: g => {
      g.scrap = Math.max(g.scrap, 12);
      g.cubeCooldown = 0;
      tutorialEnemy("blocker", 960, 360, { passive: true });
    },
    update: (g, t) => {
      if (g.cubes.some(c => c.thrown)) t.threw = true;
    },
    progress: (g, t) => (t.threw ? "던짐!" : g.cubes.length ? "큐브를 잡아서 던지기" : "F로 큐브 만들기"),
    done: (g, t) => t.threw && !g.cubes.some(c => c.thrown)
  },
  {
    title: "압축 지뢰",
    text: "E로 지뢰를 깔아 두세요. 다가오는 적이 밟으면 터져요.",
    setup: (g, t) => {
      g.scrap = Math.max(g.scrap, 12);
      g.mineCooldown = 0;
      t.left = [tutorialEnemy("tow", 1200, 200, { passive: true, walker: true, speed: 55 }), tutorialEnemy("tow", 1200, 520, { passive: true, walker: true, speed: 55 })];
      t.mines = 0;
    },
    update: (g, t) => {
      t.mines = Math.max(t.mines, g.mines.length);
      if (!t.mines) for (const e of t.left) e.x = Math.max(e.x, 1000);
    },
    progress: (g, t) => (t.mines ? t.left.filter(e => e.dead || e.hp <= 0).length + " / 2 처치" : "E로 지뢰 설치"),
    done: (g, t) => t.left.every(e => e.dead || e.hp <= 0)
  },
  {
    title: "가속과 오버클럭",
    text: "Shift로 청소 로봇을 빠르게 하고, Space로 오버클럭을 켜 보세요. 오버클럭이 끝나면 잠시 느려져요.",
    setup: (g, t) => {
      g.boostCooldown = 0;
      g.overclockCooldown = 0;
      t.boost = false;
      t.oc = false;
    },
    update: (g, t) => {
      if (g.boost > 0) t.boost = true;
      if (g.overclock > 0) t.oc = true;
    },
    progress: (g, t) => (t.boost ? "가속 ✓" : "Shift") + "  ·  " + (t.oc ? "오버클럭 ✓" : "Space"),
    done: (g, t) => t.boost && t.oc
  },
  {
    title: "실전",
    text: "견인봇 · 차단봇 · 고철 투사봇을 처치하세요. 공격 전에는 ! 표시와 바닥 예고가 나와요. 차단봇은 옆이나 뒤가 약해요.",
    setup: (g, t) => {
      t.left = [tutorialEnemy("tow", 1100, 200), tutorialEnemy("blocker", 1100, 360), tutorialEnemy("shooter", 1100, 520)];
    },
    progress: (g, t) => t.left.filter(e => e.dead || e.hp <= 0).length + " / 3",
    done: (g, t) => t.left.every(e => e.dead || e.hp <= 0)
  }
];

function startTutorial(required) {
  game = newGame();
  game.tutorial = { required, step: -1, wait: 0, finished: false };
  state = "play";
  mouse.spray = false;
  routeEl.hidden = true;
  upgradeEl.hidden = true;
  canvas.focus();
  nextTutorialStep();
}

function nextTutorialStep() {
  const g = game;
  const t = g.tutorial;
  for (const e of g.enemies) {
    e.dead = true;
    e.noReward = true;
  }
  g.hazards = [];
  g.bossShots = [];
  t.step++;
  t.data = {};
  if (t.step >= TUTORIAL_STEPS.length) {
    t.finished = true;
    t.wait = 2.5;
    showBanner("튜토리얼 완료!");
    return;
  }
  TUTORIAL_STEPS[t.step].setup(g, t.data);
}

function finishTutorial() {
  const required = game.tutorial.required;
  store("factory-tutorial", "1");
  if (required) {
    game = newGame();
    state = "play";
    mouse.spray = false;
    openRoute();
  } else goTitle();
}

function updateTutorial(dt) {
  const g = game;
  const t = g.tutorial;
  const p = g.player;
  if (p.hp < p.maxHp * 0.3) {
    p.hp = p.maxHp;
    addText(p.x, p.y - 60, "연습 중 · 자동 수리", "#7fd37f");
  }
  for (const e of g.enemies) {
    if (e.walker && !e.held && !e.thrown && !(e.stun > 0)) moveToward(e, p.x, p.y, e.speed * dt);
  }
  if (t.finished) {
    t.wait -= dt;
    if (t.wait <= 0) finishTutorial();
    return;
  }
  const s = TUTORIAL_STEPS[t.step];
  if (t.wait > 0) {
    t.wait -= dt;
    if (t.wait <= 0) nextTutorialStep();
    return;
  }
  if (s.update) s.update(g, t.data);
  if (s.done(g, t.data)) {
    t.wait = 1;
    addText(p.x, p.y - 70, "좋아요!", "#7fd37f");
  }
}

function drawTutorial() {
  const t = game.tutorial;
  if (t.finished) return;
  const s = TUTORIAL_STEPS[t.step];
  const w = 720;
  const x = W / 2 - w / 2;
  const y = 86;
  ctx.fillStyle = "rgba(13,15,19,0.88)";
  ctx.fillRect(x, y, w, 96);
  ctx.strokeStyle = t.wait > 0 ? "#7fd37f" : "#e8b931";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 96);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8b931";
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText("튜토리얼 " + (t.step + 1) + " / " + TUTORIAL_STEPS.length, x + 18, y + 20);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(s.title, x + 18, y + 48);
  ctx.textAlign = "right";
  ctx.fillStyle = t.wait > 0 ? "#7fd37f" : "#e8b931";
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(t.wait > 0 ? "완료!" : s.progress(game, t.data), x + w - 18, y + 48);
  ctx.textAlign = "left";
  ctx.fillStyle = "#cfd6e0";
  ctx.font = `15px ${FONT}`;
  ctx.fillText(s.text, x + 18, y + 76);
}
