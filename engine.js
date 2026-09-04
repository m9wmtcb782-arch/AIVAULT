(function (w) {
  const BUILDINGS = [
    { type: "castle", name: "王城熔爐", base: { wood: 80, stone: 60, iron: 20, food: 0 }, time: 20 },
    { type: "lumber", name: "伐木場", base: { wood: 40, stone: 20, iron: 0, food: 10 }, time: 15 },
    { type: "farm", name: "農場", base: { wood: 30, stone: 10, iron: 0, food: 0 }, time: 15 },
    { type: "stone", name: "採石場", base: { wood: 40, stone: 10, iron: 10, food: 10 }, time: 18 },
    { type: "iron", name: "鐵礦場", base: { wood: 50, stone: 30, iron: 10, food: 10 }, time: 20 },
    { type: "barracks", name: "軍營", base: { wood: 60, stone: 40, iron: 30, food: 20 }, time: 24 },
    { type: "hospital", name: "醫院", base: { wood: 50, stone: 40, iron: 20, food: 30 }, time: 22 },
    { type: "tech", name: "科技中心", base: { wood: 70, stone: 50, iron: 40, food: 20 }, time: 28 }
  ];
  const TROOPS = {
    warrior: { name: "戰士", cost: { food: 10, iron: 4, wood: 2 }, time: 8, atk: 10, def: 12 },
    archer: { name: "弓手", cost: { food: 8, iron: 6, wood: 4 }, time: 9, atk: 12, def: 7 },
    cavalry: { name: "騎兵", cost: { food: 14, iron: 8, wood: 4 }, time: 12, atk: 15, def: 10 },
    mage: { name: "法師", cost: { food: 12, iron: 10, wood: 2 }, time: 14, atk: 18, def: 6 }
  };
  const TECHS = [
    { id: "economy", name: "經濟", branch: "Economy" },
    { id: "military", name: "軍事", branch: "Military" },
    { id: "defense", name: "防禦", branch: "Defense" },
    { id: "ai", name: "智慧核心", branch: "AI" },
    { id: "construction", name: "營造", branch: "Construction" },
    { id: "research", name: "研究", branch: "Research" }
  ];

  function costScale(base, level) {
    const m = Math.pow(1.35, level);
    return {
      wood: Math.floor(base.wood * m),
      stone: Math.floor((base.stone || 0) * m),
      iron: Math.floor((base.iron || 0) * m),
      food: Math.floor((base.food || 0) * m)
    };
  }
  function upgradeSeconds(baseTime, level) {
    return Math.floor(baseTime * Math.pow(1.25, level));
  }
  function prodPerTick(type, level, techEconomy) {
    const n = Math.max(1, level);
    const bonus = 1 + (techEconomy || 0) * 0.04;
    const table = { lumber: 8, farm: 8, stone: 5, iron: 3, castle: 1 };
    return Math.floor((table[type] || 0) * n * bonus);
  }
  function canPay(res, cost) {
    return ["wood", "stone", "iron", "food"].every((k) => (res[k] || 0) >= (cost[k] || 0));
  }
  function pay(res, cost) {
    const next = { ...res };
    Object.keys(cost).forEach((k) => { next[k] = (next[k] || 0) - (cost[k] || 0); });
    return next;
  }
  function troopPower(army, techMilitary) {
    const m = 1 + (techMilitary || 0) * 0.05;
    let p = 0;
    Object.keys(TROOPS).forEach((k) => {
      p += (army[k] || 0) * TROOPS[k].atk * m;
    });
    return Math.floor(p);
  }
  function resolveBattle(atkArmy, defArmy, atkTech, defTech) {
    const ap = Math.max(1, troopPower(atkArmy, atkTech));
    const dp = Math.max(1, troopPower(defArmy, defTech) * 1.08);
    const ratio = ap / (ap + dp);
    const win = ap >= dp ? "win" : ap / dp > 0.92 ? "draw" : "lose";
    const atkLossRate = win === "win" ? 0.18 + (1 - ratio) * 0.25 : 0.45;
    const defLossRate = win === "win" ? 0.42 : 0.16;
    const atkRemain = {};
    const defRemain = {};
    const atkWounded = {};
    const defWounded = {};
    const loot = { wood: 0, food: 0, stone: 0, iron: 0 };
    Object.keys(TROOPS).forEach((k) => {
      const a = atkArmy[k] || 0;
      const d = defArmy[k] || 0;
      const al = Math.floor(a * atkLossRate);
      const dl = Math.floor(d * defLossRate);
      atkRemain[k] = a - al;
      defRemain[k] = d - dl;
      atkWounded[k] = Math.floor(al * 0.6);
      defWounded[k] = Math.floor(dl * 0.6);
    });
    if (win === "win") {
      loot.wood = 40 + Math.floor(dp * 0.4);
      loot.food = 40 + Math.floor(dp * 0.3);
      loot.stone = 20 + Math.floor(dp * 0.2);
      loot.iron = 10 + Math.floor(dp * 0.15);
    }
    return { result: win, atkRemain, defRemain, atkWounded, defWounded, loot, ap, dp };
  }

  const AI_NAMES = ["霜語部落", "北風哨站", "白熊營地", "裂冰堡", "暮雪關", "鐵爐村", "寒鴉丘", "永夜崗", "晶礦鎮", "嵐角城"];

  w.FKEngine = {
    BUILDINGS, TROOPS, TECHS, costScale, upgradeSeconds, prodPerTick, canPay, pay, troopPower, resolveBattle, AI_NAMES
  };
})(window);
