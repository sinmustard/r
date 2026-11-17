const MODULE_TYPES = {
  damage: { name: "데미지", icon: 0, mul: 1.35 },
  range: { name: "범위", icon: 1, mul: 1.3 },
  cooldown: { name: "쿨타임", icon: 2, mul: 0.7 },
  duration: { name: "지속시간", icon: 3, mul: 1.4 },
  cost: { name: "소모량 감소", icon: 4, mul: 0.7 },
  summonHp: { name: "소환체 체력 증가", icon: 5, mul: 1.6 },
  special: { name: "전용", icon: null, mul: 1 }
};

const CARTRIDGES = [
  {
    id: "cleaner",
    name: "청소 로봇 사출",
    key: "Q",
    mods: {
      damage: "청소 로봇 공격력 +35%",
      range: "청소 로봇이 적을 찾는 거리와 공격 거리 +30%",
      cooldown: "사출 대기시간 -30%",
      summonHp: "청소 로봇 최대 체력 +60%",
      special: { name: "융합 세척기", icon: 6, text: "두 번 사출한 청소 로봇이 만나면 더 강한 한 대로 합쳐진다. 융합 로봇은 적이 앞에 모이면 회전 솔로 여러 적을 동시에 공격한다." }
    }
  },
  {
    id: "sludge",
    name: "오염 폐수 방출",
    key: "우클릭",
    mods: {
      damage: "폐수 피해 +35%",
      range: "폐수 줄기의 굵기와 길이 +30%",
      cooldown: "탱크 충전 속도 +43%, 충전 시작 대기 -30%",
      cost: "초당 탱크 소모량 -30% (발사 시간 3초 → 약 4.3초)",
      special: { name: "잔류 오염", icon: 7, text: "폐수가 지나간 자리에 잠깐 웅덩이가 남고, 밟은 적은 느려진다." }
    }
  },
  {
    id: "claw",
    name: "집게팔",
    key: "좌클릭",
    mods: {
      damage: "던졌을 때 충돌 피해 +35%",
      range: "잡을 수 있는 거리와 충돌 범위 +30%",
      cooldown: "던진 뒤 다시 잡기까지 대기 -30%",
      duration: "충돌한 적의 기절 시간 +40%",
      special: { name: "연쇄 충돌", icon: 8, text: "던진 적에 맞은 적이 밀려나며, 밀려난 적도 다른 적을 넘어뜨릴 수 있다." }
    }
  },
  {
    id: "compress",
    name: "고철 압축",
    key: "F",
    mods: {
      damage: "큐브를 던졌을 때 피해 +35%",
      cooldown: "압축 대기시간 -30%",
      duration: "큐브 체력과 유지 시간 +40%",
      cost: "큐브 1개에 드는 고철 -30%",
      special: { name: "고철 흡수", icon: 9, text: "큐브를 압축할 때 본체 주변의 고철을 끌어당겨 회수한다. 제작에 필요한 고철은 먼저 확보해야 한다." }
    }
  },
  {
    id: "mine",
    name: "압축 지뢰",
    key: "E",
    mods: {
      damage: "지뢰 폭발 피해 +35%",
      range: "지뢰 폭발 범위 +30%",
      cooldown: "설치 대기시간 -30%",
      cost: "지뢰 1개에 드는 고철 -30%",
      special: { name: "예약 기폭", icon: 10, text: "E를 길게 누르면 설치한 지뢰를 모두 터뜨린다. 짧게 누르면 설치하고, 접촉하면 자동으로 폭발한다." }
    }
  },
  {
    id: "boost",
    name: "청소 가속화",
    key: "Shift",
    mods: {
      damage: "가속 중 청소 로봇 공격력 +35%",
      cooldown: "가속 대기시간 -30%",
      duration: "가속 지속 시간 +40%",
      special: { name: "긴급 회수", icon: 11, text: "가속 중 로봇을 회수하면 돌아오는 경로의 고철을 수거한다." }
    }
  },
  {
    id: "overclock",
    name: "오버클럭",
    key: "Space",
    mods: {
      cooldown: "오버클럭 대기시간 -30%",
      duration: "강화 지속 시간 +40%",
      special: { name: "비상 배기", icon: 12, text: "강화가 끝날 때 굴뚝에서 증기를 뿜어 주변의 작은 적을 밀어낸다." }
    }
  }
];

function newCartridges() {
  const out = {};
  for (const c of CARTRIDGES) out[c.id] = [];
  return out;
}

function modOn(skill, type) {
  return !!game.cartridges && game.cartridges[skill].includes(type);
}

function mm(skill, type) {
  return modOn(skill, type) ? MODULE_TYPES[type].mul : 1;
}
