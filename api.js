(function (w) {
  function cfg() { return w.AIVAULT_CONFIG || {}; }
  function hasCloud() {
    return !!(cfg().supabaseUrl && cfg().supabaseAnonKey);
  }
  function useLocal() {
    return cfg().useLocalEngine || !hasCloud();
  }
  function sb() { return w.FKAuth && w.FKAuth.client(); }

  function missingRpc(error) {
    const m = (error && error.message) || "";
    const c = error && error.code;
    return c === "PGRST202" || /Could not find the function/i.test(m) || /schema cache/i.test(m);
  }

  async function rpc(name, args) {
    if (useLocal()) throw new Error("LOCAL");
    const { data, error } = await sb().rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function rpcOrLocal(name, args, localFn) {
    if (useLocal()) return localFn();
    try {
      return await rpc(name, args);
    } catch (e) {
      if (missingRpc(e) || /permission denied/i.test(e.message || "")) return localFn();
      throw new Error(e.message || String(e));
    }
  }

  const API = {
    mode() { return useLocal() ? "local" : "supabase"; },
    async signUp(email, password) {
      if (useLocal()) return FKLocal.register(email, password);
      const { data, error } = await sb().auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return data;
    },
    async signIn(email, password) {
      if (useLocal()) return FKLocal.login(email, password);
      const { data, error } = await sb().auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return data;
    },
    async signOut() {
      if (useLocal()) return FKLocal.logout();
      await sb().auth.signOut();
    },
    async session() {
      if (useLocal()) {
        const s = FKLocal.session();
        return s ? { user: { id: s.user_id, email: s.email } } : null;
      }
      const { data } = await sb().auth.getSession();
      return data.session;
    },
    async resetPassword(email) {
      if (useLocal()) return FKLocal.resetMail(email);
      const { error } = await sb().auth.resetPasswordForEmail(email);
      if (error) throw new Error(error.message);
    },
    async userId() {
      const s = await API.session();
      return s?.user?.id || null;
    },
    async getPlayer() {
      const uid = await API.userId();
      if (!uid) return null;
      if (useLocal()) return FKLocal.getPlayerByUser(uid);
      const { data, error } = await sb().from("aivault_game_players").select("*").eq("user_id", uid).maybeSingle();
      if (error) return FKLocal.getPlayerByUser(uid);
      return data || FKLocal.getPlayerByUser(uid);
    },
    async bootstrap(name) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_bootstrap_v1", { p_player_name: name }, () => FKLocal.bootstrap(uid, name));
    },
    async snapshot() {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_snapshot_v1", {}, () => FKLocal.snapshot(uid));
    },
    async world() {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_world_v1", {}, () => FKLocal.world(uid));
    },
    async playerPublic(id) {
      return rpcOrLocal("aivault_game_player_public_v1", { p_player_id: id }, () => FKLocal.playerPublic(id));
    },
    async upgrade(buildingId) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_upgrade_building_v1", { p_building_id: buildingId }, () => FKLocal.upgradeBuilding(uid, buildingId));
    },
    async research(techId) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_research_v1", { p_tech_id: techId }, () => FKLocal.research(uid, techId));
    },
    async train(type, qty) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_train_v1", { p_type: type, p_qty: qty }, () => FKLocal.train(uid, type, qty));
    },
    async heal() {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_heal_v1", {}, () => FKLocal.heal(uid));
    },
    async speedup(kind) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_speedup_v1", { p_kind: kind }, () => FKLocal.speedup(uid, kind, 5));
    },
    async attack(targetId, march) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_attack_v1", { p_target: targetId, p_march: march }, () => FKLocal.attack(uid, targetId, march));
    },
    async messages(channel, extra) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_messages_v1", { p_channel: channel, p_extra: extra || null }, () => FKLocal.messages(uid, channel, extra));
    },
    async sendMessage(channel, body, extra) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_send_message_v1", { p_channel: channel, p_body: body, p_extra: extra || null }, () => FKLocal.sendMessage(uid, channel, body, extra));
    },
    async createAlliance(name) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_alliance_create_v1", { p_name: name }, () => FKLocal.createAlliance(uid, name));
    },
    async listAlliances() {
      return rpcOrLocal("aivault_game_alliance_list_v1", {}, () => FKLocal.listAlliances());
    },
    async joinAlliance(id) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_alliance_join_v1", { p_id: id }, () => FKLocal.joinAlliance(uid, id));
    },
    async leaveAlliance() {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_alliance_leave_v1", {}, () => FKLocal.leaveAlliance(uid));
    },
    async setCompute(on) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_set_compute_v1", { p_on: on }, () => FKLocal.setCompute(uid, on));
    },
    async couponHistory() {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_coupon_history_v1", {}, () => FKLocal.couponHistory(uid));
    },
    async battles() {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_battles_v1", {}, () => FKLocal.battlesFor(uid));
    },
    async searchPlayers(q) {
      return rpcOrLocal("aivault_game_search_players_v1", { p_q: q }, () => FKLocal.searchPlayers(q));
    },
    async friendAction(id, act) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_friend_v1", { p_target: id, p_act: act }, () => FKLocal.friendAction(uid, id, act));
    },
    async shopBuy(sku) {
      const uid = await API.userId();
      return rpcOrLocal("aivault_game_shop_buy_v1", { p_sku: sku }, () => FKLocal.shopBuy(uid, sku));
    }
  };
  w.FKApi = API;
})(window);
