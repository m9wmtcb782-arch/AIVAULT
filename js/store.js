(function (w) {
  const KEY = "aivault_frost_kingdom_v1";
  const cfg = () => w.AIVAULT_CONFIG || {};

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || seed(); }
    catch { return seed(); }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now(); }
  function now() { return Date.now(); }

  function seed() {
    const db = {
      users: {},
      sessions: {},
      players: {},
      cities: {},
      buildings: {},
      resources: {},
      armies: {},
      techs: {},
      messages: [],
      battles: [],
      alliances: {},
      allianceMembers: {},
      friends: [],
      tasks: {},
      couponTx: [],
      worldSeeded: false
    };
    seedAI(db);
    save(db);
    return db;
  }

  function emptyArmy() {
    return { warrior: 0, archer: 0, cavalry: 0, mage: 0, wounded_warrior: 0, wounded_archer: 0, wounded_cavalry: 0, wounded_mage: 0, training: null, healing: null };
  }

  function placeCity(db) {
    const size = cfg().worldSize || 24;
    for (let i = 0; i < 200; i++) {
      const x = 1 + Math.floor(Math.random() * (size - 2));
      const y = 1 + Math.floor(Math.random() * (size - 2));
      const taken = Object.values(db.cities).some((c) => c.x === x && c.y === y);
      if (!taken) return { x, y };
    }
    return { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
  }

  function createCityBundle(db, playerId, isAi, name) {
    const pos = placeCity(db);
    const cityId = uid();
    db.cities[cityId] = {
      id: cityId, player_id: playerId, name: name + " 王城", level: 1,
      x: pos.x, y: pos.y, hp: 1000, shield_until: now() + 36e5, is_ai: !!isAi
    };
    FKEngine.BUILDINGS.forEach((b) => {
      const id = uid();
      db.buildings[id] = { id, city_id: cityId, building_type: b.type, level: b.type === "castle" ? 2 : 1, upgrade_started_at: null, upgrade_finish_at: null };
    });
    db.resources[playerId] = { player_id: playerId, wood: 500, food: 500, stone: 300, iron: 200, gold: 50, last_tick_at: now(), coupons: 0 };
    db.armies[playerId] = { player_id: playerId, ...emptyArmy(), warrior: isAi ? 20 + Math.floor(Math.random() * 40) : 12, archer: isAi ? 10 : 8 };
    db.techs[playerId] = FKEngine.TECHS.map((t) => ({ player_id: playerId, tech_id: t.id, level: isAi ? 1 + Math.floor(Math.random() * 2) : 0, research_finish_at: null }));
    return cityId;
  }

  function seedAI(db) {
    if (db.worldSeeded) return;
    FKEngine.AI_NAMES.forEach((name, i) => {
      const id = "ai-" + i;
      db.players[id] = {
        id, user_id: id, name, level: 2 + (i % 5), exp: 0, vip: 0, power: 0,
        avatar: "AI", alliance_id: null, compute_opt_in: false, is_ai: true, created_at: now()
      };
      createCityBundle(db, id, true, name);
    });
    db.worldSeeded = true;
  }

  function applyTicks(db, playerId) {
    const res = db.resources[playerId];
    if (!res) return;
    const interval = (cfg().tickSeconds || 30) * 1000;
    const passed = Math.floor((now() - (res.last_tick_at || now())) / interval);
    if (passed <= 0) return;
    const city = Object.values(db.cities).find((c) => c.player_id === playerId);
    const buildings = Object.values(db.buildings).filter((b) => b.city_id === city?.id);
    const eco = (db.techs[playerId] || []).find((t) => t.tech_id === "economy")?.level || 0;
    buildings.forEach((b) => {
      if (b.upgrade_finish_at && b.upgrade_finish_at <= now()) {
        b.level += 1;
        b.upgrade_started_at = null;
        b.upgrade_finish_at = null;
        if (b.building_type === "castle" && city) city.level = b.level;
      }
      const add = FKEngine.prodPerTick(b.building_type, b.level, eco) * passed;
      if (b.building_type === "lumber") res.wood += add;
      if (b.building_type === "farm") res.food += add;
      if (b.building_type === "stone") res.stone += add;
      if (b.building_type === "iron") res.iron += add;
      if (b.building_type === "castle") res.gold += Math.max(1, passed);
    });
    const army = db.armies[playerId];
    if (army?.training && army.training.finish_at <= now()) {
      army[army.training.type] = (army[army.training.type] || 0) + army.training.qty;
      army.training = null;
    }
    if (army?.healing && army.healing.finish_at <= now()) {
      ["warrior", "archer", "cavalry", "mage"].forEach((k) => {
        const wkey = "wounded_" + k;
        army[k] = (army[k] || 0) + (army[wkey] || 0);
        army[wkey] = 0;
      });
      army.healing = null;
    }
    (db.techs[playerId] || []).forEach((t) => {
      if (t.research_finish_at && t.research_finish_at <= now()) {
        t.level += 1;
        t.research_finish_at = null;
      }
    });
    res.last_tick_at = now();
    recalcPower(db, playerId);
  }

  function recalcPower(db, playerId) {
    const p = db.players[playerId];
    if (!p) return;
    const mil = (db.techs[playerId] || []).find((t) => t.tech_id === "military")?.level || 0;
    p.power = FKEngine.troopPower(db.armies[playerId] || {}, mil);
  }

  function hashPass(pw) { return "h:" + pw; }

  const Local = {
    register(email, password) {
      const db = load(); seedAI(db);
      const e = email.trim().toLowerCase();
      if (db.users[e]) throw new Error("此 Email 已註冊");
      if (password.length < 6) throw new Error("密碼至少 6 碼");
      const id = uid();
      db.users[e] = { id, email: e, password: hashPass(password), verified: true };
      db.sessions.current = { user_id: id, email: e };
      save(db);
      return { user: { id, email: e } };
    },
    login(email, password) {
      const db = load();
      const e = email.trim().toLowerCase();
      const u = db.users[e];
      if (!u || u.password !== hashPass(password)) throw new Error("帳號或密碼錯誤");
      db.sessions.current = { user_id: u.id, email: e };
      save(db);
      return { user: { id: u.id, email: e } };
    },
    logout() {
      const db = load();
      db.sessions.current = null;
      save(db);
    },
    session() {
      const db = load();
      return db.sessions.current || null;
    },
    resetMail(email) {
      const db = load();
      if (!db.users[email.trim().toLowerCase()]) throw new Error("找不到此 Email");
      return true;
    },
    getPlayerByUser(userId) {
      const db = load();
      return Object.values(db.players).find((p) => p.user_id === userId && !p.is_ai) || null;
    },
    bootstrap(userId, name) {
      const db = load(); seedAI(db);
      if (this.getPlayerByUser(userId)) throw new Error("角色已存在");
      const n = (name || "").trim();
      if (n.length < 2 || n.length > 20) throw new Error("名稱需 2～20 字");
      if (Object.values(db.players).some((p) => p.name === n)) throw new Error("名稱已被使用");
      const pid = uid();
      db.players[pid] = {
        id: pid, user_id: userId, name: n, level: 1, exp: 0, vip: 0, power: 0,
        avatar: n.slice(0, 1), alliance_id: null, compute_opt_in: false, is_ai: false, created_at: now()
      };
      createCityBundle(db, pid, false, n);
      save(db);
      return db.players[pid];
    },
    snapshot(userId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (!player) return null;
      applyTicks(db, player.id);
      save(db);
      const city = Object.values(db.cities).find((c) => c.player_id === player.id);
      const buildings = Object.values(db.buildings).filter((b) => b.city_id === city.id);
      return {
        player, city, buildings,
        resources: db.resources[player.id],
        army: db.armies[player.id],
        techs: db.techs[player.id],
        coupons: db.resources[player.id].coupons || 0
      };
    },
    world(userId) {
      const db = load();
      const me = this.getPlayerByUser(userId);
      if (me) applyTicks(db, me.id);
      const size = cfg().worldSize || 24;
      const tiles = [];
      Object.values(db.cities).forEach((c) => {
        const p = db.players[c.player_id];
        tiles.push({
          x: c.x, y: c.y, type: c.player_id === me?.id ? "me" : p?.is_ai ? "ai" : "other",
          city: c, player: p ? { id: p.id, name: p.name, level: p.level, power: p.power, is_ai: !!p.is_ai } : null
        });
      });
      for (let i = 0; i < 18; i++) {
        tiles.push({ x: (i * 3 + 2) % size, y: (i * 5 + 4) % size, type: "res", node: { id: "rn-" + i, kind: ["wood", "food", "stone", "iron"][i % 4] } });
      }
      save(db);
      return { size, tiles };
    },
    playerPublic(id) {
      const db = load();
      const p = db.players[id];
      if (!p) throw new Error("找不到玩家");
      const city = Object.values(db.cities).find((c) => c.player_id === id);
      return { player: p, city, power: p.power };
    },
    upgradeBuilding(userId, buildingId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (!player) throw new Error("沒有角色");
      applyTicks(db, player.id);
      const city = Object.values(db.cities).find((c) => c.player_id === player.id);
      const b = db.buildings[buildingId];
      if (!b || b.city_id !== city.id) throw new Error("建築不屬於你");
      if (b.upgrade_finish_at && b.upgrade_finish_at > now()) throw new Error("建築升級中");
      const def = FKEngine.BUILDINGS.find((x) => x.type === b.building_type);
      const cost = FKEngine.costScale(def.base, b.level);
      const res = db.resources[player.id];
      if (!FKEngine.canPay(res, cost)) throw new Error("資源不足");
      Object.assign(res, FKEngine.pay(res, cost));
      const cons = (db.techs[player.id] || []).find((t) => t.tech_id === "construction")?.level || 0;
      const sec = Math.max(5, Math.floor(FKEngine.upgradeSeconds(def.time, b.level) * (1 - cons * 0.03)));
      b.upgrade_started_at = now();
      b.upgrade_finish_at = now() + sec * 1000;
      save(db);
      return { building: b, resources: res, seconds: sec };
    },
    research(userId, techId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      applyTicks(db, player.id);
      const t = (db.techs[player.id] || []).find((x) => x.tech_id === techId);
      if (!t) throw new Error("未知科技");
      if (t.research_finish_at && t.research_finish_at > now()) throw new Error("研究進行中");
      const cost = FKEngine.costScale({ wood: 60, stone: 40, iron: 30, food: 20 }, t.level);
      const res = db.resources[player.id];
      if (!FKEngine.canPay(res, cost)) throw new Error("資源不足");
      Object.assign(res, FKEngine.pay(res, cost));
      t.research_finish_at = now() + Math.max(8, 20 + t.level * 12) * 1000;
      save(db);
      return { tech: t, resources: res };
    },
    train(userId, type, qty) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      applyTicks(db, player.id);
      qty = Math.floor(Number(qty));
      if (!FKEngine.TROOPS[type]) throw new Error("未知兵種");
      if (qty < 1 || qty > 999) throw new Error("數量不合法");
      const army = db.armies[player.id];
      if (army.training && army.training.finish_at > now()) throw new Error("訓練進行中");
      const unit = FKEngine.TROOPS[type];
      const cost = { wood: unit.cost.wood * qty, food: unit.cost.food * qty, iron: unit.cost.iron * qty, stone: 0 };
      const res = db.resources[player.id];
      if (!FKEngine.canPay(res, cost)) throw new Error("資源不足");
      Object.assign(res, FKEngine.pay(res, cost));
      army.training = { type, qty, finish_at: now() + unit.time * qty * 1000 };
      save(db);
      return { army, resources: res };
    },
    heal(userId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      applyTicks(db, player.id);
      const army = db.armies[player.id];
      const wounded = ["warrior", "archer", "cavalry", "mage"].reduce((s, k) => s + (army["wounded_" + k] || 0), 0);
      if (!wounded) throw new Error("沒有傷兵");
      if (army.healing && army.healing.finish_at > now()) throw new Error("治療進行中");
      const cost = { food: wounded * 2, wood: 0, stone: 0, iron: 0 };
      const res = db.resources[player.id];
      if (!FKEngine.canPay(res, cost)) throw new Error("資源不足");
      Object.assign(res, FKEngine.pay(res, cost));
      army.healing = { finish_at: now() + wounded * 2000 };
      save(db);
      return { army, resources: res };
    },
    speedup(userId, kind, couponCost) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      const res = db.resources[player.id];
      const cost = couponCost || 5;
      if ((res.coupons || 0) < cost) throw new Error("Coupons 不足");
      const before = res.coupons;
      res.coupons -= cost;
      if (kind === "building") {
        Object.values(db.buildings).forEach((b) => {
          const city = Object.values(db.cities).find((c) => c.id === b.city_id);
          if (city?.player_id === player.id && b.upgrade_finish_at) b.upgrade_finish_at = now();
        });
      }
      if (kind === "train" && db.armies[player.id].training) db.armies[player.id].training.finish_at = now();
      if (kind === "heal" && db.armies[player.id].healing) db.armies[player.id].healing.finish_at = now();
      if (kind === "tech") (db.techs[player.id] || []).forEach((t) => { if (t.research_finish_at) t.research_finish_at = now(); });
      db.couponTx.push({
        id: uid(), user_id: player.user_id, player_id: player.id, amount: -cost,
        transaction_type: "spend", reference_type: "speedup", reference_id: kind,
        balance_before: before, balance_after: res.coupons, created_at: now()
      });
      applyTicks(db, player.id);
      save(db);
      return { coupons: res.coupons };
    },
    attack(userId, targetPlayerId, march) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (!player) throw new Error("沒有角色");
      if (player.id === targetPlayerId) throw new Error("不能攻擊自己");
      applyTicks(db, player.id);
      const target = db.players[targetPlayerId];
      if (!target) throw new Error("目標不存在");
      const city = Object.values(db.cities).find((c) => c.player_id === targetPlayerId);
      if (city.shield_until && city.shield_until > now() && !target.is_ai) throw new Error("目標處於護盾中");
      const army = db.armies[player.id];
      const sent = {};
      Object.keys(FKEngine.TROOPS).forEach((k) => {
        sent[k] = Math.max(0, Math.floor(Number(march[k] || 0)));
        if (sent[k] > (army[k] || 0)) throw new Error("兵力不足：" + k);
      });
      const total = Object.values(sent).reduce((a, b) => a + b, 0);
      if (!total) throw new Error("請派出部隊");
      Object.keys(sent).forEach((k) => { army[k] -= sent[k]; });
      const defArmy = { ...db.armies[targetPlayerId] };
      const atkTech = (db.techs[player.id] || []).find((t) => t.tech_id === "military")?.level || 0;
      const defTech = (db.techs[targetPlayerId] || []).find((t) => t.tech_id === "military")?.level || 0;
      const r = FKEngine.resolveBattle(sent, defArmy, atkTech, defTech);
      Object.keys(FKEngine.TROOPS).forEach((k) => {
        army[k] += r.atkRemain[k] || 0;
        army["wounded_" + k] = (army["wounded_" + k] || 0) + (r.atkWounded[k] || 0);
        db.armies[targetPlayerId][k] = r.defRemain[k] || 0;
        db.armies[targetPlayerId]["wounded_" + k] = (db.armies[targetPlayerId]["wounded_" + k] || 0) + (r.defWounded[k] || 0);
      });
      if (r.result === "win") {
        const lootRes = db.resources[targetPlayerId];
        const my = db.resources[player.id];
        Object.keys(r.loot).forEach((k) => {
          const take = Math.min(lootRes[k] || 0, r.loot[k]);
          r.loot[k] = take;
          lootRes[k] -= take;
          my[k] += take;
        });
      }
      const battle = {
        id: uid(), attacker_id: player.id, defender_id: targetPlayerId,
        result: r.result, report: r, created_at: now()
      };
      db.battles.unshift(battle);
      recalcPower(db, player.id);
      recalcPower(db, targetPlayerId);
      save(db);
      return battle;
    },
    messages(userId, channel, extra) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      return db.messages.filter((m) => {
        if (channel === "world") return m.channel_type === "world";
        if (channel === "alliance") return m.channel_type === "alliance" && m.alliance_id === player?.alliance_id;
        if (channel === "private") return m.channel_type === "private" && (m.sender_id === player.id || m.receiver_id === player.id) && (!extra || m.sender_id === extra || m.receiver_id === extra);
        return false;
      }).slice(-80);
    },
    sendMessage(userId, channel, body, extra) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (!player) throw new Error("沒有角色");
      const text = (body || "").trim();
      if (!text) throw new Error("訊息不可空白");
      if (!["world", "alliance", "private"].includes(channel)) throw new Error("未知頻道");
      if (channel === "alliance" && !player.alliance_id) throw new Error("尚未加入聯盟");
      if (channel === "private" && !extra) throw new Error("需要接收者");
      db.messages.push({
        id: uid(), channel_type: channel, alliance_id: player.alliance_id,
        sender_id: player.id, sender_name: player.name, receiver_id: extra || null,
        body: text.slice(0, 240), created_at: now()
      });
      save(db);
      return true;
    },
    createAlliance(userId, name) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (player.alliance_id) throw new Error("已在聯盟中");
      const id = uid();
      db.alliances[id] = { id, name, leader_id: player.id, level: 1 };
      player.alliance_id = id;
      db.allianceMembers[player.id] = { alliance_id: id, player_id: player.id, role: "Leader" };
      save(db);
      return db.alliances[id];
    },
    joinAlliance(userId, allianceId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (player.alliance_id) throw new Error("已在聯盟中");
      if (!db.alliances[allianceId]) throw new Error("聯盟不存在");
      player.alliance_id = allianceId;
      db.allianceMembers[player.id] = { alliance_id: allianceId, player_id: player.id, role: "Member" };
      save(db);
      return db.alliances[allianceId];
    },
    leaveAlliance(userId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (!player.alliance_id) throw new Error("未加入聯盟");
      const mem = db.allianceMembers[player.id];
      if (mem?.role === "Leader") throw new Error("盟主需先移交職位");
      delete db.allianceMembers[player.id];
      player.alliance_id = null;
      save(db);
    },
    listAlliances() {
      const db = load();
      return Object.values(db.alliances);
    },
    setCompute(userId, on) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      player.compute_opt_in = !!on;
      save(db);
      return player;
    },
    addCouponsDev(userId, n) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      const res = db.resources[player.id];
      const before = res.coupons || 0;
      res.coupons = before + n;
      db.couponTx.push({
        id: uid(), user_id: player.user_id, player_id: player.id, amount: n,
        transaction_type: "reward", reference_type: "dev", reference_id: "local",
        balance_before: before, balance_after: res.coupons, created_at: now()
      });
      save(db);
    },
    couponHistory(userId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      return db.couponTx.filter((t) => t.player_id === player.id);
    },
    battlesFor(userId) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      return db.battles.filter((b) => b.attacker_id === player.id || b.defender_id === player.id).slice(0, 30);
    },
    searchPlayers(q) {
      const db = load();
      const s = (q || "").trim();
      return Object.values(db.players).filter((p) => !s || p.name.includes(s)).slice(0, 20);
    },
    friendAction(userId, targetId, act) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      if (act === "add") {
        if (db.friends.some((f) => f.a === player.id && f.b === targetId)) throw new Error("已送出");
        db.friends.push({ a: player.id, b: targetId, status: "pending" });
      }
      if (act === "accept") {
        const f = db.friends.find((x) => x.a === targetId && x.b === player.id);
        if (f) f.status = "accepted";
      }
      if (act === "remove") {
        db.friends = db.friends.filter((x) => !((x.a === player.id && x.b === targetId) || (x.b === player.id && x.a === targetId)));
      }
      save(db);
      return db.friends.filter((f) => f.a === player.id || f.b === player.id);
    },
    shopBuy(userId, sku) {
      const db = load();
      const player = this.getPlayerByUser(userId);
      const catalog = {
        pack_small: { coupons: 10, grant: { wood: 200, food: 200, stone: 100, iron: 80 } },
        pack_army: { coupons: 15, grant: null, army: { warrior: 10 } }
      };
      const item = catalog[sku];
      if (!item) throw new Error("商品不存在");
      const res = db.resources[player.id];
      if ((res.coupons || 0) < item.coupons) throw new Error("Coupons 不足");
      const before = res.coupons;
      res.coupons -= item.coupons;
      if (item.grant) Object.keys(item.grant).forEach((k) => { res[k] += item.grant[k]; });
      if (item.army) Object.keys(item.army).forEach((k) => { db.armies[player.id][k] += item.army[k]; });
      db.couponTx.push({
        id: uid(), user_id: player.user_id, player_id: player.id, amount: -item.coupons,
        transaction_type: "spend", reference_type: "shop", reference_id: sku,
        balance_before: before, balance_after: res.coupons, created_at: now()
      });
      save(db);
      return { resources: res };
    }
  };

  w.FKLocal = Local;
})(window);
