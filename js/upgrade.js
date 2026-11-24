const upgradeEl = document.getElementById("upgrade");
const MAINT_BOX = {
  title: [52, 40, 920, 85],
  tabs: [50, 175, 924, 42],
  cards: [[60, 267, 273, 336], [382, 267, 260, 336], [690, 267, 274, 336]],
  empty: [60, 267, 904, 336],
  pager: [400, 618, 224, 32],
  prev: [8, 395, 44, 80],
  next: [972, 395, 44, 80],
  board: [62, 664, 900, 108],
  info: [412, 856, 552, 284],
  recycle: [58, 1203, 908, 109],
  go: [62, 1376, 900, 72],
  slots: [[80, 869], [228, 869], [80, 1013], [228, 1013]],
  slotSize: 116
};

const maint = {
  tab: "rec",
  skill: "cleaner",
  recs: [],
  bought: false,
  sel: null,
  hover: null,
  notice: "",
  page: 0,
  pageSkill: null,
  drag: null
};

function cartridgeOf(skill) {
  return CARTRIDGES.find(c => c.id === skill);
}

function moduleIcon(skill, type) {
  const icon = type === "special" ? cartridgeOf(skill).mods.special.icon : MODULE_TYPES[type].icon;
  return "assets/modules/" + icon + ".png";
}

function moduleName(skill, type) {
  return type === "special" ? cartridgeOf(skill).mods.special.name : MODULE_TYPES[type].name;
}

function moduleText(skill, type) {
  const m = cartridgeOf(skill).mods[type];
  return type === "special" ? m.text : m;
}

function basePrice(type) {
  return type === "special" ? CONFIG.modules.specialCost : CONFIG.modules.basicCost;
}

function offerPrice(offer) {
  const m = CONFIG.modules;
  if (offer.kind === "boss") return m.bossCost;
  return Math.max(1, Math.round(basePrice(offer.type) * (offer.kind === "dev" ? m.devMul : m.recMul)));
}

function recWeight(o) {
  const m = CONFIG.modules;
  const installed = CARTRIDGES.reduce((n, c) => n + slotsOf(c.id).filter(Boolean).length, 0);
  let w = (m.recWeight[o.type] || 1) * (m.recSkill[o.skill] || 1);
  if (o.type === "special" && installed < m.earlyCount) w *= m.earlySpecial;
  return w;
}

function box(b) {
  return "left:" + b[0] / 10.24 + "%;top:" + b[1] / 15.36 + "%;width:" + b[2] / 10.24 + "%;height:" + b[3] / 15.36 + "%";
}

function slotsOf(skill) {
  return game.cartridges[skill];
}

function hasType(skill, type) {
  return slotsOf(skill).some(m => m && m.type === type);
}

function offerProblem(offer, slot) {
  if (maint.bought) return maint.mode === "boss" ? "보스 보상을 이미 받았어요" : "이번 정비에서 이미 모듈을 획득했어요";
  if (offer.type === "special" && !game.specialUnlocked) return "첫 보스를 쓰러뜨리면 전용 모듈이 열려요";
  if (hasType(offer.skill, offer.type)) return "같은 종류가 이미 장착돼 있어요";
  if (game.scrap < offerPrice(offer)) return "고철이 부족해요";
  if (!slotsOf(offer.skill).some(m => !m)) return "빈 슬롯이 없어요 · 회수로 자리를 만드세요";
  if (slot !== undefined && slotsOf(offer.skill)[slot]) return "빈 슬롯에 놓아 주세요";
  return "";
}

function makeRecs(kind = "rec") {
  const pool = [];
  for (const c of CARTRIDGES) {
    for (const type of Object.keys(c.mods)) {
      if (type === "special" && !game.specialUnlocked) continue;
      if (!hasType(c.id, type)) pool.push({ kind, skill: c.id, type });
    }
  }
  const out = [];
  if (kind === "boss") {
    for (let i = 0; i < CONFIG.modules.bossSpecials; i++) {
      const sp = pool.filter(o => o.type === "special" && !out.some(x => x.skill === o.skill));
      if (!sp.length) break;
      const pick = sp[Math.floor(Math.random() * sp.length)];
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
  }
  while (out.length < 3 && pool.length) {
    const fresh = pool.filter(o => !out.some(x => x.skill === o.skill));
    const from = fresh.length ? fresh : pool;
    let roll = Math.random() * from.reduce((n, o) => n + recWeight(o), 0);
    let pick = from[from.length - 1];
    for (const o of from) {
      roll -= recWeight(o);
      if (roll <= 0) {
        pick = o;
        break;
      }
    }
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

function openUpgrade(mode = "shop") {
  state = "upgrade";
  mouse.spray = false;
  game.beam = null;
  maint.mode = mode;
  maint.tab = "rec";
  maint.page = 0;
  maint.recs = makeRecs(mode === "boss" ? "boss" : "rec");
  maint.bought = false;
  maint.sel = null;
  maint.hover = null;
  maint.notice = mode === "boss" && game.unlockedNow ? "전용 모듈이 열렸어요!" : "";
  game.unlockedNow = false;
  maint.drag = null;
  maint.skill = maint.recs.length ? maint.recs[0].skill : "cleaner";
  renderUpgrade();
  upgradeEl.hidden = false;
  upgradeEl.scrollTop = 0;
}

function closeUpgrade() {
  endDrag();
  upgradeEl.hidden = true;
  openRoute();
}

function buyOffer(offer, slot) {
  const problem = offerProblem(offer, slot);
  if (problem) {
    maint.notice = problem;
    renderUpgrade();
    return false;
  }
  const slots = slotsOf(offer.skill);
  const at = slot !== undefined ? slot : slots.findIndex(m => !m);
  const price = offerPrice(offer);
  game.scrap -= price;
  slots[at] = { type: offer.type, paid: price };
  maint.bought = true;
  maint.sel = null;
  maint.skill = offer.skill;
  maint.hover = { kind: "slot", skill: offer.skill, slot: at };
  maint.notice = moduleName(offer.skill, offer.type) + " 장착 완료 · 이제 출발하세요";
  renderUpgrade();
  return true;
}

function refundOf(skill, slot) {
  const m = slotsOf(skill)[slot];
  return m ? Math.floor(m.paid * CONFIG.modules.refund) : 0;
}

function recycleSlot(skill, slot) {
  const slots = slotsOf(skill);
  const m = slots[slot];
  if (!m) return;
  const back = refundOf(skill, slot);
  game.scrap += back;
  slots[slot] = null;
  maint.sel = null;
  maint.hover = null;
  maint.notice = moduleName(skill, m.type) + " 회수 · 고철 " + back + "개 환급";
  renderUpgrade();
}

function moveSlot(skill, from, to) {
  const slots = slotsOf(skill);
  if (from === to || !slots[from] || slots[to]) return;
  slots[to] = slots[from];
  slots[from] = null;
  maint.sel = null;
  maint.hover = { kind: "slot", skill, slot: to };
  renderUpgrade();
}

function currentOffers() {
  if (maint.tab === "rec") return maint.recs;
  return Object.keys(cartridgeOf(maint.skill).mods).map(type => ({ kind: "dev", skill: maint.skill, type }));
}

function pageCount() {
  return Math.max(1, Math.ceil(currentOffers().length / 3));
}

function offerKey(o) {
  return o.kind + ":" + o.skill + ":" + o.type;
}

function describe() {
  const t = maint.drag ? maint.drag.item : maint.hover || maint.sel;
  const cart = cartridgeOf(maint.skill);
  const used = slotsOf(maint.skill).filter(Boolean).length;
  let body = '<p class="mi-hint">모듈 위에 마우스를 올리면 효과와 가격이 보여요. 카드를 아래 빈 슬롯으로 끌어 놓거나, 카드를 누른 뒤 빈 슬롯을 눌러 장착해요.</p>';
  if (t && t.kind === "slot") {
    const m = slotsOf(t.skill)[t.slot];
    if (m) {
      body = '<b class="mi-name">' + moduleName(t.skill, m.type) + '</b><span class="mi-kind">' + (m.type === "special" ? "전용 모듈" : "기본 모듈") + " · 장착됨</span>" +
        '<p class="mi-text">' + moduleText(t.skill, m.type) + '</p><p class="mi-price">회수하면 고철 <strong>' + refundOf(t.skill, t.slot) + "</strong>개 환급</p>";
    }
  } else if (t) {
    const problem = offerProblem(t);
    body = '<b class="mi-name">' + moduleName(t.skill, t.type) + '</b><span class="mi-kind">' + (t.type === "special" ? "전용 모듈" : "기본 모듈") + " · 대상 " + cartridgeOf(t.skill).name + "</span>" +
      '<p class="mi-text">' + moduleText(t.skill, t.type) + '</p><p class="mi-price">가격 고철 <strong>' + offerPrice(t) + "</strong>개" + (t.kind === "dev" ? " (지정 개발 · 기본가 " + basePrice(t.type) + "의 " + CONFIG.modules.devMul + "배)" : t.kind === "boss" ? " (보스 보상)" : " (추천 할인 · 기본가 " + basePrice(t.type) + ")") + "</p>" +
      (problem ? '<p class="mi-bad">' + problem + "</p>" : '<p class="mi-ok">장착할 수 있어요</p>');
  }
  return '<div class="mi-head">' + cart.name + ' <span class="key">' + cart.key + "</span><small>장착 " + used + " / " + CONFIG.modules.slots + "</small></div>" + body;
}

function renderUpgrade() {
  const g = game;
  const width = Math.min(window.innerWidth * 0.94, 700);
  const target = maint.drag ? maint.drag.item : maint.sel;
  const targetSkill = target && target.kind !== "slot" ? target.skill : null;
  if (maint.pageSkill !== maint.skill) {
    maint.page = 0;
    maint.pageSkill = maint.skill;
  }
  const pages = maint.tab === "rec" ? 1 : pageCount();
  maint.page = Math.min(maint.page, pages - 1);
  const offers = currentOffers();
  const first = maint.tab === "rec" ? 0 : maint.page * 3;
  const card = (o, i) => {
    const problem = offerProblem(o);
    const sel = maint.sel && maint.sel.kind !== "slot" && offerKey(maint.sel) === offerKey(o);
    return '<button type="button" class="mt-card' + (o.type === "special" ? " special" : "") + (sel ? " sel" : "") + (problem ? " off" : "") + '" data-offer="' + (first + i) + '" style="' + box(MAINT_BOX.cards[i]) + '">' +
      '<img class="mt-icon" src="' + moduleIcon(o.skill, o.type) + '" alt="" draggable="false">' +
      '<b class="mt-name">' + moduleName(o.skill, o.type) + "</b>" +
      '<span class="mt-skill"><img src="assets/ui/skills/' + o.skill + '.png" alt="" draggable="false">' + cartridgeOf(o.skill).name + "</span>" +
      '<span class="mt-price">' + (o.kind !== "dev" ? "<s>" + basePrice(o.type) + "</s> " : "") + (o.kind === "boss" && !offerPrice(o) ? "무료" : "고철 " + offerPrice(o)) + (o.kind === "rec" ? ' <em class="mt-sale">추천 할인</em>' : o.kind === "boss" ? ' <em class="mt-sale">보스 보상</em>' : "") + "</span></button>";
  };
  const shown = offers.slice(first, first + 3);
  let cardsHtml = shown.length ? shown.map(card).join("") : '<div class="mt-empty" style="' + box(MAINT_BOX.empty) + '">추천할 모듈이 없어요</div>';
  if (maint.tab === "dev") {
    cardsHtml +=
      '<button type="button" class="mt-arrow" data-page="-1" aria-label="이전 모듈" style="' + box(MAINT_BOX.prev) + '"' + (maint.page > 0 ? "" : " disabled") + ">◀</button>" +
      '<button type="button" class="mt-arrow" data-page="1" aria-label="다음 모듈" style="' + box(MAINT_BOX.next) + '"' + (maint.page < pages - 1 ? "" : " disabled") + ">▶</button>" +
      '<div class="mt-pager" style="' + box(MAINT_BOX.pager) + '">' + cartridgeOf(maint.skill).name + " · " + (maint.page + 1) + " / " + pages + "</div>";
  }
  const board = '<div class="mt-board" style="' + box(MAINT_BOX.board) + '">' + CARTRIDGES.map(c => {
    const used = slotsOf(c.id).filter(Boolean).length;
    return '<button type="button" class="mt-cart' + (c.id === maint.skill ? " cur" : "") + (c.id === targetSkill ? " target" : "") + '" data-skill="' + c.id + '" title="' + c.name + " (" + c.key + ')">' +
      '<img src="assets/ui/skills/' + c.id + '.png" alt="' + c.name + '" draggable="false"><span class="mt-used">' + used + "/" + CONFIG.modules.slots + "</span></button>";
  }).join("") + "</div>";
  const slots = slotsOf(maint.skill);
  const slotsHtml = MAINT_BOX.slots.map(([x, y], i) => {
    const m = slots[i];
    const canDrop = target && target.kind !== "slot" && target.skill === maint.skill && !m && !offerProblem(target, i);
    const canMove = target && target.kind === "slot" && target.skill === maint.skill && !m;
    const sel = maint.sel && maint.sel.kind === "slot" && maint.sel.skill === maint.skill && maint.sel.slot === i;
    return '<button type="button" class="mt-slot' + (m ? " full" : "") + (m && m.type === "special" ? " special" : "") + (canDrop || canMove ? " drop" : "") + (sel ? " sel" : "") + '" data-slot="' + i + '" style="' + box([x, y, MAINT_BOX.slotSize, MAINT_BOX.slotSize]) + '">' +
      (m ? '<img src="' + moduleIcon(maint.skill, m.type) + '" alt="' + moduleName(maint.skill, m.type) + '" draggable="false">' : "") + "</button>";
  }).join("");
  const dragSlot = maint.drag && maint.drag.item.kind === "slot" ? maint.drag.item : maint.sel && maint.sel.kind === "slot" ? maint.sel : null;
  const recycleText = dragSlot ? "여기에 놓거나 누르면 회수 · 고철 " + refundOf(dragSlot.skill, dragSlot.slot) + "개 환급" : "장착한 모듈을 여기로 끌어 놓으면 회수해요";
  upgradeEl.innerHTML =
    '<div class="maint" style="width:' + width + "px;font-size:" + width / 1024 * 20 + 'px" role="dialog" aria-label="모듈 정비">' +
    '<img class="mt-bg" src="assets/ui/maintenance.jpg" alt="" draggable="false">' +
    '<div class="mt-title" style="' + box(MAINT_BOX.title) + '"><b>' + (maint.mode === "boss" ? "보스 보상" : "모듈 정비") + "</b>" + '<em class="mt-notice">' + maint.notice + '</em><span>고철 <strong>' + g.scrap + "</strong>개</span></div>" +
    '<div class="mt-tabs" style="' + box(MAINT_BOX.tabs) + '">' +
    (maint.mode === "boss"
      ? '<span class="mt-tab on">보스 격파 보상 · 하나를 골라 장착하세요</span>'
      : '<button type="button" class="mt-tab' + (maint.tab === "rec" ? " on" : "") + '" data-tab="rec">추천 모듈 · 할인</button>' +
        '<button type="button" class="mt-tab' + (maint.tab === "dev" ? " on" : "") + '" data-tab="dev">지정 개발 · 가격 ' + CONFIG.modules.devMul + "배</button>") +
    "</div>" +
    cardsHtml + board + slotsHtml +
    '<div class="mt-info" style="' + box(MAINT_BOX.info) + '">' + describe() + "</div>" +
    '<button type="button" class="mt-recycle' + (dragSlot ? " armed" : "") + '" data-recycle="1" style="' + box(MAINT_BOX.recycle) + '">' + recycleText + "</button>" +
    '<button type="button" class="mt-go" data-go="1" style="' + box(MAINT_BOX.go) + '">' + (maint.bought ? "출발 (Enter)" : maint.mode === "boss" ? "보상 건너뛰기 (Enter)" : "그냥 출발 (Enter)") + "</button>" +
    "</div>";
  if (maint.drag) upgradeEl.appendChild(maint.drag.ghost);
}

function itemFromEl(el) {
  const offerEl = el.closest("[data-offer]");
  if (offerEl) return currentOffers()[Number(offerEl.dataset.offer)];
  const slotEl = el.closest("[data-slot]");
  if (slotEl && slotsOf(maint.skill)[Number(slotEl.dataset.slot)]) return { kind: "slot", skill: maint.skill, slot: Number(slotEl.dataset.slot) };
  return null;
}

function dropOn(item, el) {
  if (!el) return false;
  const slotEl = el.closest("[data-slot]");
  if (item.kind === "slot") {
    if (el.closest("[data-recycle]")) {
      recycleSlot(item.skill, item.slot);
      return true;
    }
    if (slotEl && item.skill === maint.skill && !slotsOf(maint.skill)[Number(slotEl.dataset.slot)]) {
      moveSlot(item.skill, item.slot, Number(slotEl.dataset.slot));
      return true;
    }
    return false;
  }
  if (slotEl && item.skill === maint.skill) return buyOffer(item, Number(slotEl.dataset.slot));
  return false;
}

function tap(el) {
  if (el.closest("[data-go]")) {
    closeUpgrade();
    return;
  }
  const pageEl = el.closest("[data-page]");
  if (pageEl) {
    if (!pageEl.disabled) {
      maint.page = Math.max(0, Math.min(pageCount() - 1, maint.page + Number(pageEl.dataset.page)));
      maint.hover = null;
      renderUpgrade();
    }
    return;
  }
  const tabEl = el.closest("[data-tab]");
  if (tabEl) {
    maint.tab = tabEl.dataset.tab;
    maint.page = 0;
    maint.sel = null;
    maint.hover = null;
    renderUpgrade();
    return;
  }
  const cartEl = el.closest("[data-skill]");
  if (cartEl) {
    maint.skill = cartEl.dataset.skill;
    if (maint.sel && maint.sel.kind === "slot") maint.sel = null;
    renderUpgrade();
    return;
  }
  if (el.closest("[data-recycle]")) {
    if (maint.sel && maint.sel.kind === "slot") recycleSlot(maint.sel.skill, maint.sel.slot);
    return;
  }
  const slotEl = el.closest("[data-slot]");
  if (slotEl) {
    const i = Number(slotEl.dataset.slot);
    const m = slotsOf(maint.skill)[i];
    if (!m && maint.sel && maint.sel.kind !== "slot") {
      maint.skill = maint.sel.skill;
      buyOffer(maint.sel, i);
      return;
    }
    if (!m && maint.sel && maint.sel.kind === "slot") {
      moveSlot(maint.sel.skill, maint.sel.slot, i);
      return;
    }
    if (m) {
      const same = maint.sel && maint.sel.kind === "slot" && maint.sel.slot === i && maint.sel.skill === maint.skill;
      maint.sel = same ? null : { kind: "slot", skill: maint.skill, slot: i };
      maint.hover = maint.sel;
      renderUpgrade();
    }
    return;
  }
  const item = itemFromEl(el);
  if (item) {
    const same = maint.sel && maint.sel.kind !== "slot" && offerKey(maint.sel) === offerKey(item);
    maint.sel = same ? null : item;
    maint.hover = maint.sel;
    if (maint.sel) maint.skill = item.skill;
    maint.notice = "";
    renderUpgrade();
  }
}

function endDrag() {
  const d = maint.drag;
  if (!d) return;
  if (d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
  cancelAnimationFrame(d.raf);
  maint.drag = null;
}

let pressInfo = null;

upgradeEl.addEventListener("pointerdown", e => {
  if (state !== "upgrade" || e.button !== 0) return;
  pressInfo = { x: e.clientX, y: e.clientY, item: itemFromEl(e.target), el: e.target };
});

window.addEventListener("pointermove", e => {
  if (state !== "upgrade") return;
  if (!maint.drag && pressInfo && pressInfo.item && Math.hypot(e.clientX - pressInfo.x, e.clientY - pressInfo.y) > 6) {
    const item = pressInfo.item;
    if (item.kind !== "slot" && maint.bought) return;
    const ghost = document.createElement("img");
    ghost.src = item.kind === "slot" ? moduleIcon(item.skill, slotsOf(item.skill)[item.slot].type) : moduleIcon(item.skill, item.type);
    ghost.className = "mt-ghost";
    maint.drag = { item, ghost, x: e.clientX, y: e.clientY, hoverSkill: null, hoverAt: 0, raf: 0 };
    maint.sel = null;
    maint.notice = "";
    if (item.kind !== "slot") maint.hover = item;
    renderUpgrade();
    const loop = () => {
      const dd = maint.drag;
      if (!dd) return;
      if (dd.y < 70) upgradeEl.scrollTop -= 14;
      else if (dd.y > window.innerHeight - 70) upgradeEl.scrollTop += 14;
      if (dd.hoverSkill && dd.hoverSkill !== maint.skill && performance.now() - dd.hoverAt > 350) {
        maint.skill = dd.hoverSkill;
        renderUpgrade();
      }
      dd.raf = requestAnimationFrame(loop);
    };
    maint.drag.raf = requestAnimationFrame(loop);
  }
  const dd = maint.drag;
  if (dd) {
    dd.x = e.clientX;
    dd.y = e.clientY;
    dd.ghost.style.left = e.clientX + "px";
    dd.ghost.style.top = e.clientY + "px";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cartEl = under && under.closest("[data-skill]");
    const skill = cartEl ? cartEl.dataset.skill : null;
    if (skill !== dd.hoverSkill) {
      dd.hoverSkill = skill;
      dd.hoverAt = performance.now();
    }
  }
});

window.addEventListener("pointerup", e => {
  if (state !== "upgrade") {
    pressInfo = null;
    return;
  }
  const d = maint.drag;
  if (d) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const item = d.item;
    endDrag();
    if (!dropOn(item, under)) {
      const overSlot = under && under.closest("[data-slot]");
      if (item.kind === "slot") maint.notice = "";
      else if (overSlot && item.skill !== maint.skill) maint.notice = cartridgeOf(item.skill).name + " 카트리지에만 장착할 수 있어요";
      else if (!overSlot) maint.notice = "슬롯 밖에 놓아 취소했어요";
      renderUpgrade();
    }
    pressInfo = null;
    return;
  }
  if (pressInfo && upgradeEl.contains(pressInfo.el)) tap(pressInfo.el);
  pressInfo = null;
});

upgradeEl.addEventListener("pointerover", e => {
  if (state !== "upgrade" || maint.drag) return;
  const item = itemFromEl(e.target);
  if (item && JSON.stringify(maint.hover) !== JSON.stringify(item)) {
    maint.hover = item;
    const info = upgradeEl.querySelector(".mt-info");
    if (info) info.innerHTML = describe();
  }
});

upgradeEl.addEventListener("focusin", e => {
  if (state !== "upgrade" || maint.drag) return;
  const item = itemFromEl(e.target);
  if (item) {
    maint.hover = item;
    const info = upgradeEl.querySelector(".mt-info");
    if (info) info.innerHTML = describe();
  }
});

upgradeEl.addEventListener("keydown", e => {
  if (state !== "upgrade" || (e.key !== "Enter" && e.key !== " ")) return;
  const b = e.target.closest("button");
  if (b && upgradeEl.contains(b)) {
    e.preventDefault();
    e.stopPropagation();
    tap(b);
  }
});

window.addEventListener("resize", () => {
  if (state === "upgrade") renderUpgrade();
});

const sewer = document.createElement("div");
sewer.className = "sewer";
sewer.hidden = true;
sewer.innerHTML = '<div class="sw-water"></div><b class="sw-bit"></b><b class="sw-bit"></b><b class="sw-bit"></b><div class="sw-scrap"><i></i><i></i><i></i></div>';
document.body.appendChild(sewer);
const sewerScrap = sewer.querySelector(".sw-scrap");
let sewerDrag = null;

function syncSewer() {
  const el = upgradeEl;
  const over = el.scrollHeight - el.clientHeight;
  sewer.hidden = el.hidden || over <= 2;
  if (sewer.hidden) return;
  const track = sewer.clientHeight;
  const h = sewerScrap.offsetHeight;
  sewerScrap.style.top = (track - h) * (el.scrollTop / over) + "px";
}

function sewerScrollTo(clientY) {
  const r = sewer.getBoundingClientRect();
  const h = sewerScrap.offsetHeight;
  const k = clamp((clientY - r.top - sewerDrag) / Math.max(1, r.height - h), 0, 1);
  upgradeEl.scrollTop = k * (upgradeEl.scrollHeight - upgradeEl.clientHeight);
}

sewer.addEventListener("pointerdown", e => {
  e.preventDefault();
  const sr = sewerScrap.getBoundingClientRect();
  sewerDrag = e.target.closest(".sw-scrap") ? e.clientY - sr.top : sr.height / 2;
  sewer.setPointerCapture(e.pointerId);
  sewer.classList.add("drag");
  sewerScrollTo(e.clientY);
});
sewer.addEventListener("pointermove", e => {
  if (sewerDrag !== null) sewerScrollTo(e.clientY);
});
sewer.addEventListener("pointerup", () => {
  sewerDrag = null;
  sewer.classList.remove("drag");
});
sewer.addEventListener("wheel", e => {
  upgradeEl.scrollTop += e.deltaY;
}, { passive: true });
upgradeEl.addEventListener("scroll", syncSewer);
window.addEventListener("resize", syncSewer);
new MutationObserver(syncSewer).observe(upgradeEl, { attributes: true, childList: true });
