const routeEl = document.getElementById("route");
let routeChoices = [];
let routeEvent = null;
let routeResult = null;

const NODE_INFO = {
  battle: { name: "전투", tag: "전투", text: "중앙 AI의 작업봇 무리와 싸운다. 처치한 적에게서 고철을 얻는다.", color: "#e05252" },
  elite: { name: "정예 전투", tag: "전투", text: "구역 전용 적이 많고 더 단단하다. 대신 고철을 더 많이 얻는다.", color: "#b44ad8" },
  event: { name: "사건", tag: "사건", text: "무슨 일이 기다리고 있을지 모른다.", color: "#4fa3e0" },
  upgrade: { name: "강화 구역", tag: "강화", text: "고철로 모듈을 개발하고 카트리지에 장착한다.", color: "#e8b931" },
  boss: { name: "구역 보스", tag: "보스", text: "이 구역을 지키는 중앙 AI의 대형 기체. 쓰러뜨리면 다음 구역으로 간다.", color: "#ff6b3c" }
};

const EVENTS = [
  {
    title: "정비 차량 발견",
    text: "버려진 정비 차량이 아직 움직인다. 고철을 넣으면 본체를 수리해 준다.",
    options: [
      {
        label: () => "고철 " + CONFIG.events.repairCost + "개로 수리한다 (내구도 +" + CONFIG.events.repairHp + ")",
        ok: g => g.scrap >= CONFIG.events.repairCost && g.player.hp < g.player.maxHp,
        run: g => {
          g.scrap -= CONFIG.events.repairCost;
          g.player.hp = Math.min(g.player.maxHp, g.player.hp + CONFIG.events.repairHp);
          return "정비 차량이 본체를 수리했다.";
        }
      },
      { label: () => "그냥 지나간다", ok: () => true, run: () => "정비 차량을 두고 떠났다." }
    ]
  },
  {
    title: "고철 더미",
    text: "무너진 처리장 옆에 고철이 잔뜩 쌓여 있다. 날카로운 파편이 섞여 있다.",
    options: [
      {
        label: () => "전부 쓸어 담는다 (고철 +" + CONFIG.events.pileBig + ", 내구도 -" + CONFIG.events.pileHurt + ")",
        ok: () => true,
        run: g => {
          g.scrap += CONFIG.events.pileBig;
          g.player.hp = Math.max(1, g.player.hp - CONFIG.events.pileHurt);
          return "고철을 잔뜩 챙겼지만 파편에 긁혔다.";
        }
      },
      {
        label: () => "조심히 담는다 (고철 +" + CONFIG.events.pileSmall + ")",
        ok: () => true,
        run: g => {
          g.scrap += CONFIG.events.pileSmall;
          return "쓸 만한 고철만 골라 담았다.";
        }
      }
    ]
  },
  {
    title: "보급 상자",
    text: "중앙 AI 보급선에서 떨어진 상자다. 안에 무엇이 들었을지 모른다.",
    options: [
      {
        label: () => "연다",
        ok: () => true,
        run: g => {
          if (Math.random() < 0.5) {
            g.scrap += CONFIG.events.crateScrap;
            return "고철 " + CONFIG.events.crateScrap + "개가 들어 있었다.";
          }
          g.player.hp = Math.min(g.player.maxHp, g.player.hp + CONFIG.events.crateHp);
          return "수리 키트가 들어 있었다. 내구도 +" + CONFIG.events.crateHp;
        }
      },
      { label: () => "열지 않는다", ok: () => true, run: () => "상자를 그대로 두었다." }
    ]
  }
];

function bossInfo(zone = game.zone) {
  const list = CONFIG.bosses;
  return list[Math.min(zone, list.length) - 1];
}

function showBanner(text) {
  game.bannerText = text;
  game.banner = 2;
}

function makeChoices() {
  const g = game;
  const rc = CONFIG.route;
  if (g.step >= rc.nodesPerZone) return ["boss"];
  const pool = g.step === 0 ? ["battle", "elite"] : ["battle", "elite", "event", "upgrade"].filter(t => !(t === "upgrade" && g.lastNode === "upgrade"));
  const weight = { battle: 4, elite: 2, event: 2, upgrade: 2 };
  const n = Math.min(pool.length, rc.minChoices + Math.floor(Math.random() * (rc.maxChoices - rc.minChoices + 1)));
  const out = [];
  while (out.length < n) {
    const left = pool.filter(t => !out.includes(t));
    let r = Math.random() * left.reduce((s, t) => s + weight[t], 0);
    for (const t of left) {
      r -= weight[t];
      if (r <= 0) {
        out.push(t);
        break;
      }
    }
  }
  if (!out.includes("battle") && !out.includes("elite")) out[0] = "battle";
  return out;
}

function openRoute() {
  state = "route";
  mouse.spray = false;
  game.beam = null;
  routeChoices = makeChoices();
  routeEvent = null;
  routeResult = null;
  renderRoute();
  routeEl.hidden = false;
}

function routeHeader(cap, title) {
  const g = game;
  return '<header><div><span class="cap">' + cap + "</span><h2>" + title + "</h2></div>" +
    '<div class="scrap">고철 <b>' + g.scrap + '</b><small class="hp">내구도 ' + Math.ceil(g.player.hp) + " / " + g.player.maxHp + "</small></div></header>";
}

function renderRoute() {
  const g = game;
  const rc = CONFIG.route;
  const atBoss = g.step >= rc.nodesPerZone;
  const track = Array.from({ length: rc.nodesPerZone }, (_, i) => '<i class="' + (i < g.step ? "done" : i === g.step ? "now" : "") + '"></i>').join("") +
    '<b class="' + (atBoss ? "now" : "") + '">보스</b>';
  const cards = routeChoices.map((t, i) => {
    const n = t === "boss" ? Object.assign({}, NODE_INFO.boss, { name: bossInfo().name }) : NODE_INFO[t];
    return '<button type="button" class="route-card" data-action="pick" data-i="' + i + '" style="--c:' + n.color + '">' +
      '<span class="num">' + (i + 1) + '</span><span class="tag">' + n.tag + "</span><b>" + n.name + '</b><span class="d">' + n.text + "</span></button>";
  }).join("");
  routeEl.innerHTML = '<div class="up-panel route-panel" role="dialog" aria-label="다음 목적지">' +
    routeHeader("구역 " + g.zone + " · " + Math.min(g.step + 1, rc.nodesPerZone) + "번째 칸", atBoss ? "보스가 기다리고 있습니다" : "다음 목적지를 고르세요") +
    '<div class="route-track">' + track + '</div><div class="route-cards">' + cards + "</div>" +
    '<footer><span class="rule">' + rc.nodesPerZone + "칸을 지나면 보스와 싸워요 · 숫자 키 1~" + routeChoices.length + "로도 고를 수 있어요</span></footer></div>";
}

function pickRoute(i) {
  const g = game;
  const t = routeChoices[i];
  if (!t) return;
  routeEl.hidden = true;
  g.lastNode = t;
  if (t !== "boss") g.step++;
  if (t === "battle" || t === "elite" || t === "boss") startBattle(t);
  else if (t === "upgrade") openUpgrade();
  else if (t === "event") openEvent();
}

function startBattle(t) {
  const g = game;
  const bc = CONFIG.battle;
  g.node = t;
  g.level = Math.max(0, (g.zone - 1) * CONFIG.route.nodesPerZone + g.step - 1);
  g.clearTimer = -1;
  g.hazards = [];
  g.bossShots = [];
  state = "play";
  canvas.focus();
  if (t === "boss") {
    g.toSpawn = 0;
    const info = bossInfo();
    const b = spawnEnemy("boss");
    b.r = info.radius;
    b.sprite = "boss-" + info.sprite;
    b.kind = info.sprite;
    b.name = info.name;
    b.x = W / 2;
    b.y = -b.r;
    b.phase = 0;
    b.idle = 1;
    b.windup = 0;
    b.act = null;
    b.queue = [];
    g.boss = b;
    showBanner("보스 등장 · " + info.name);
  } else {
    g.toSpawn = bc.baseCount + g.level * bc.countPerLevel;
    g.spawnTimer = 1;
    showBanner(t === "elite" ? "정예 전투" : "전투 시작");
  }
}

function finishBattle() {
  const g = game;
  if (g.node === "boss") {
    g.zone++;
    g.step = 0;
    g.lastNode = null;
  }
  g.node = null;
  g.clearTimer = -1;
  openRoute();
}

function updateBattle(dt) {
  const g = game;
  const bc = CONFIG.battle;
  if (!g.node) return;
  if (g.toSpawn > 0) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      spawnEnemy();
      g.toSpawn--;
      g.spawnTimer = bc.spawnInterval;
    }
    return;
  }
  if (g.enemies.length === 0 && g.clearTimer < 0) {
    g.clearTimer = bc.collectTime;
    showBanner(g.node === "boss" ? "구역 " + g.zone + " 돌파!" : "전투 완료!");
  }
  if (g.clearTimer >= 0) {
    g.clearTimer -= dt;
    if (g.clearTimer < 0) finishBattle();
  }
}

function drawBossBar() {
  const b = game.boss;
  if (!b || b.dead) return;
  const w = 460;
  const x = W / 2 - w / 2;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 2, 82, w + 4, 18);
  ctx.fillStyle = "#3a1414";
  ctx.fillRect(x, 84, w, 14);
  ctx.fillStyle = b.vulnerable > 0 ? "#ffe27a" : "#ff6b3c";
  ctx.fillRect(x, 84, w * clamp(b.hp / b.maxHp, 0, 1), 14);
  const def = bossDef(b);
  if (def) {
    ctx.fillStyle = "#171a20";
    for (const t of def.phases) ctx.fillRect(x + w * t - 1, 82, 3, 18);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText((b.name || CONFIG.enemies.boss.name) + " · 구역 " + game.zone, W / 2, 80);
}

function openEvent() {
  state = "event";
  routeEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  routeResult = null;
  renderEvent();
  routeEl.hidden = false;
}

function renderEvent() {
  const g = game;
  const ev = routeEvent;
  const body = routeResult
    ? '<div class="event-text result">' + routeResult + '</div><div class="event-options"><button type="button" class="event-option go-on" data-action="continue">계속 (Enter)</button></div>'
    : '<div class="event-text">' + ev.text + '</div><div class="event-options">' +
      ev.options.map((o, i) => '<button type="button" class="event-option" data-action="choose" data-i="' + i + '"' + (o.ok(g) ? "" : " disabled") + '><span class="num">' + (i + 1) + "</span>" + o.label() + "</button>").join("") + "</div>";
  routeEl.innerHTML = '<div class="up-panel route-panel" role="dialog" aria-label="사건">' + routeHeader("사건", ev.title) + body + "</div>";
}

function chooseEvent(i) {
  const o = routeEvent && routeEvent.options[i];
  if (!o || routeResult || !o.ok(game)) return;
  routeResult = o.run(game);
  renderEvent();
}

function routeKey(code) {
  const digit = /^Digit([1-9])$/.exec(code);
  if (state === "route" && digit) pickRoute(Number(digit[1]) - 1);
  else if (state === "event") {
    if (routeResult && (code === "Enter" || code === "Space")) {
      routeEl.hidden = true;
      openRoute();
    } else if (digit) chooseEvent(Number(digit[1]) - 1);
  }
}

routeEl.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  if (a === "pick" && state === "route") pickRoute(Number(b.dataset.i));
  else if (a === "choose" && state === "event") chooseEvent(Number(b.dataset.i));
  else if (a === "continue" && state === "event") {
    routeEl.hidden = true;
    openRoute();
  }
});
