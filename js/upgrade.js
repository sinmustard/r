const upgradeEl = document.getElementById("upgrade");
let upgradeSel = "cleaner";
let upgradeInspect = null;

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

function moduleCost(type) {
  return type === "special" ? CONFIG.modules.specialCost : CONFIG.modules.basicCost;
}

function openUpgrade() {
  state = "upgrade";
  mouse.spray = false;
  game.beam = null;
  upgradeInspect = null;
  renderUpgrade();
  upgradeEl.hidden = false;
}

function closeUpgrade() {
  upgradeEl.hidden = true;
  openRoute();
}

function installModule(skill, type) {
  const g = game;
  const slots = g.cartridges[skill];
  const cost = moduleCost(type);
  if (slots.length >= CONFIG.modules.slots || slots.includes(type) || g.scrap < cost) return;
  g.scrap -= cost;
  slots.push(type);
  upgradeInspect = slots.length - 1;
  renderUpgrade();
}

function removeModule(skill, index) {
  const g = game;
  const slots = g.cartridges[skill];
  const type = slots[index];
  if (!type) return;
  slots.splice(index, 1);
  g.scrap += Math.floor(moduleCost(type) * CONFIG.modules.refund);
  upgradeInspect = null;
  renderUpgrade();
}

function renderUpgrade() {
  const g = game;
  const cart = cartridgeOf(upgradeSel);
  const slots = g.cartridges[cart.id];
  const max = CONFIG.modules.slots;
  const dock = CARTRIDGES.map(c => {
    const used = g.cartridges[c.id].length;
    const pips = Array.from({ length: max }, (_, i) => '<i class="' + (i < used ? "on" : "") + '"></i>').join("");
    return '<button type="button" class="circuit-dock' + (c.id === upgradeSel ? " sel" : "") + '" data-action="dock" data-id="' + c.id + '">' +
      '<span class="key">' + c.key + '</span><span class="nm">' + c.name + '</span><span class="pips">' + pips + "</span></button>";
  }).join("");
  const grid = Array.from({ length: max }, (_, i) => {
    const t = slots[i];
    if (!t) return '<div class="cartridge-slot empty">+</div>';
    return '<button type="button" class="cartridge-slot' + (t === "special" ? " modified" : "") + (upgradeInspect === i ? " sel" : "") +
      '" data-action="inspect" data-slot="' + i + '" title="' + moduleName(cart.id, t) + '"><img src="' + moduleIcon(cart.id, t) + '" alt=""></button>';
  }).join("");
  const inspected = upgradeInspect !== null ? slots[upgradeInspect] : null;
  const details = inspected
    ? '<div class="module-details"><b>' + moduleName(cart.id, inspected) + "</b><p>" + moduleText(cart.id, inspected) + "</p>" +
      '<button type="button" data-action="remove">빼기 (고철 ' + Math.floor(moduleCost(inspected) * CONFIG.modules.refund) + "개 돌려받기)</button></div>"
    : '<div class="module-details hint">장착한 모듈을 누르면 설명을 볼 수 있어요. 빈 칸은 오른쪽에서 모듈을 개발하면 채워져요.</div>';
  const cards = Object.keys(cart.mods).map(type => {
    const installed = slots.includes(type);
    const cost = moduleCost(type);
    const full = slots.length >= max;
    const poor = g.scrap < cost;
    const ok = !installed && !full && !poor;
    const status = installed ? "장착됨" : full ? "슬롯 가득" : poor ? "고철 부족" : "개발 · 장착";
    return '<button type="button" class="module-card' + (type === "special" ? " special" : "") + (installed ? " owned" : "") +
      '" data-action="develop" data-type="' + type + '"' + (ok ? "" : " disabled") + ">" +
      '<img src="' + moduleIcon(cart.id, type) + '" alt="">' +
      '<span class="body"><b>' + moduleName(cart.id, type) + "</b><em>" + (type === "special" ? "전용 모듈" : "기본 모듈") + '</em><span class="d">' + moduleText(cart.id, type) + "</span></span>" +
      '<span class="cost">' + status + "<br><strong>고철 " + cost + "</strong></span></button>";
  }).join("");
  const carrying = g.cleaners.reduce((n, r) => n + r.carry, 0);
  upgradeEl.innerHTML =
    '<div class="up-panel" role="dialog" aria-label="강화 구역">' +
    '<header><div><span class="cap">구역 ' + g.zone + ' · 강화 구역</span><h2>모듈 정비</h2></div>' +
    '<div class="scrap">고철 <b>' + g.scrap + "</b>" + (carrying ? '<small>청소 로봇이 든 고철 ' + carrying + "개는 회수해야 쓸 수 있어요</small>" : "") + "</div></header>" +
    '<div class="up-body"><nav class="dock-list" aria-label="카트리지">' + dock + "</nav>" +
    '<section class="cartridge-panel"><h3>' + cart.name + ' <span class="key">' + cart.key + "</span><small>장착 " + slots.length + " / " + max + "</small></h3>" +
    '<div class="cartridge-portrait"><div class="cartridge-art" aria-hidden="true"></div><div class="cartridge-grid">' + grid + "</div></div>" + details + "</section>" +
    '<section class="module-list"><h3>모듈 개발</h3>' + cards + "</section></div>" +
    '<footer><span class="rule">같은 종류는 카트리지마다 하나만 · 모듈을 빼면 고철 절반을 돌려받아요</span>' +
    '<button type="button" class="go" data-action="close">정비 끝내고 출발 (Enter)</button></footer></div>';
}

upgradeEl.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled || state !== "upgrade") return;
  const a = b.dataset.action;
  if (a === "dock") {
    upgradeSel = b.dataset.id;
    upgradeInspect = null;
    renderUpgrade();
  } else if (a === "inspect") {
    const i = Number(b.dataset.slot);
    upgradeInspect = upgradeInspect === i ? null : i;
    renderUpgrade();
  } else if (a === "develop") {
    installModule(upgradeSel, b.dataset.type);
  } else if (a === "remove") {
    removeModule(upgradeSel, upgradeInspect);
  } else if (a === "close") {
    closeUpgrade();
  }
});
