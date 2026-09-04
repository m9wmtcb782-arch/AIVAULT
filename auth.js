(function (w) {
  let client = null;
  function getClient() {
    if (client) return client;
    const c = w.AIVAULT_CONFIG || {};
    if (c.supabaseUrl && c.supabaseAnonKey && w.supabase) {
      client = w.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey);
    }
    return client;
  }
  async function requireSession() {
    const s = await FKApi.session();
    if (!s) {
      location.href = "game-login.html";
      return null;
    }
    return s;
  }
  async function requirePlayer() {
    const s = await requireSession();
    if (!s) return null;
    const p = await FKApi.getPlayer();
    if (!p) {
      location.href = "game-create-player.html";
      return null;
    }
    return { session: s, player: p };
  }
  w.FKAuth = { client: getClient, requireSession, requirePlayer };
})(window);
