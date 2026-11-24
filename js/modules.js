const MODULE_TYPES = {
  damage: { name: "데미지", icon: 0, mul: 1.35 },
  range: { name: "범위", icon: 1, mul: 1.3 },
  cooldown: { name: "스킬 쿨타임 감소", icon: 2, mul: 0.7 },
  duration: { name: "지속시간", icon: 3, mul: 1.4 },
  cost: { name: "소모량 감소", icon: 4, mul: 0.7 },
  summonHp: { name: "소환체 체력 증가", icon: 5, mul: 1.6 },
  moveSpeed: { name: "소환체 이동속도", icon: 13, mul: 1.25 },
  carry: { name: "운반량", icon: 14, mul: 1, add: 3 },
  knockback: { name: "밀쳐내기", icon: 15, mul: 1.5 },
  slow: { name: "감속", icon: 16, mul: 1, amount: 0.25, time: 2 },
  shield: { name: "보호막", icon: 17, mul: 1, ratio: 0.15 },
  special: { name: "전용", icon: null, mul: 1 }
};

const CARTRIDGES = [
  {
    id: "cleaner",
    name: "청소 로봇 사출",
    key: "Q",
    mods: {
      damage: "청소 로봇 공격 피해 ×1.35",
      range: "청소 로봇이 적을 찾는 거리와 공격 거리 ×1.3",
      cooldown: "사출 대기시간 ×0.7",
      summonHp: "청소 로봇 최대 체력 ×1.6",
      moveSpeed: "청소 로봇의 전투 · 수거 · 회수 이동속도 ×1.25",
      carry: "청소 로봇 고철 운반 한도 +3개",
      special: { name: "융합 세척기", icon: 6, text: "기본 로봇 두 대가 닿으면 한 대로 합쳐진다. 공격력은 2배, 체력과 운반 고철 · 운반 한도는 두 대의 합. 소환 한도에서 두 대로 센다. 적이 2대 이상 모이면 0.6초마다 회전 솔로 주변을 공격한다." }
    }
  },
  {
    id: "sludge",
    name: "오염 폐수 방출",
    key: "우클릭",
    mods: {
      damage: "폐수 초당 피해 ×1.35",
      range: "물줄기의 길이와 폭 ×1.3 (잔류 오염 웅덩이도 커짐)",
      cooldown: "탱크 완충 시간 ×0.7",
      cost: "초당 탱크 소모량 ×0.7 (발사 시간 3초 → 약 4.3초)",
      knockback: "물줄기가 적을 미는 거리 ×1.5",
      special: { name: "잔류 오염", icon: 7, text: "물줄기가 닿은 바닥에 2.5초간 웅덩이가 남는다. 밟은 적은 50% 느려진다. 웅덩이끼리는 겹쳐도 효과가 쌓이지 않는다." }
    }
  },
  {
    id: "claw",
    name: "집게팔",
    key: "좌클릭",
    mods: {
      damage: "던졌을 때 충돌 피해 ×1.35",
      range: "잡을 수 있는 거리와 충돌 범위 ×1.3",
      cooldown: "다시 잡기까지 대기 ×0.7",
      duration: "충돌한 적의 기절 시간 ×1.4",
      knockback: "충돌한 적이 밀려나는 거리 ×1.5",
      slow: "충돌에 맞은 적이 2초간 25% 느려진다 (보스 포함)",
      special: { name: "연쇄 충돌", icon: 8, text: "던진 적에 맞은 적도 밀려나 다시 충돌한다. 최대 두 번 이어지고 피해는 매번 직전의 60%. 같은 적은 한 번만 맞는다. 보스는 피해만 받는다." }
    }
  },
  {
    id: "compress",
    name: "고철 압축",
    key: "F",
    mods: {
      damage: "큐브를 던졌을 때 피해 ×1.35",
      cooldown: "압축 대기시간 ×0.7",
      duration: "큐브 유지 시간 ×1.4",
      cost: "큐브 1개에 드는 고철 ×0.7 (올림)",
      special: { name: "고철 흡수", icon: 9, text: "큐브를 만들면 평소 줍기 범위의 3배 안에 있는 고철을 빨아들인다. 제작 고철은 먼저 있어야 한다." }
    }
  },
  {
    id: "mine",
    name: "압축 지뢰",
    key: "E",
    mods: {
      damage: "지뢰 폭발 피해 ×1.35",
      range: "지뢰 폭발 범위 ×1.3",
      cooldown: "설치 대기시간 ×0.7",
      cost: "지뢰 1개에 드는 고철 ×0.7 (올림)",
      slow: "폭발에 맞은 적이 2초간 25% 느려진다 (보스 포함)",
      special: { name: "예약 기폭", icon: 10, text: "E를 0.4초 넘게 누르면 설치한 지뢰를 모두 터뜨린다. 짧게 누르면 뗄 때 설치한다. 닿으면 터지는 것은 그대로다." }
    }
  },
  {
    id: "boost",
    name: "청소 가속화",
    key: "Shift",
    mods: {
      damage: "가속 중 청소 로봇 공격 피해 ×1.35",
      cooldown: "가속 대기시간 ×0.7",
      duration: "가속 유지 시간 ×1.4",
      moveSpeed: "가속 중 청소 로봇 이동속도 ×1.25",
      special: { name: "긴급 회수", icon: 11, text: "가속 중에 회수(R)한 로봇이 돌아오는 길의 고철을 줍는다. 가속이 끝나도 돌아올 때까지 유지된다. 운반 한도를 넘는 고철은 바닥에 남는다." }
    }
  },
  {
    id: "overclock",
    name: "오버클럭",
    key: "Space",
    mods: {
      cooldown: "오버클럭 대기시간 ×0.7",
      duration: "강화 유지 시간 ×1.4 (반동 3초는 그대로)",
      shield: "발동할 때 최대 내구도 15%만큼 보호막. 강화가 끝나면 사라진다",
      special: { name: "비상 배기", icon: 12, text: "강화가 끝날 때 줍기 범위 2배 안의 작은 적을 범위 밖으로 밀어내고 1초 기절시킨다. 그다음 반동이 시작된다." }
    }
  }
];

function newCartridges() {
  const out = {};
  for (const c of CARTRIDGES) out[c.id] = new Array(CONFIG.modules.slots).fill(null);
  return out;
}

function modOn(skill, type) {
  return !!game.cartridges && game.cartridges[skill].some(m => m && m.type === type);
}

function mm(skill, type) {
  return modOn(skill, type) ? MODULE_TYPES[type].mul : 1;
}
