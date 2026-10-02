// Minimal dispatch bridge. NOT APPLIED. NOT WIRED.
// Caller must pass an existing authenticated Supabase client.
// Does not start a scheduler. Does not touch Dark Star core.

export async function darkstarTick(supabase) {
  if (!supabase || typeof supabase.rpc !== "function") {
    return { data: null, error: { message: "authenticated supabase client required" } };
  }
  const { data, error } = await supabase.rpc("agent_darkstar_tick");
  return { data: data ?? null, error: error ?? null };
}
