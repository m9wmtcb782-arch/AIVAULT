Deno.test("edge SDK flag OFF leaves Deno.serve untouched", async () => {
  const before = Deno.serve; await import("../sdk/neural-bus.ts"); if (Deno.serve !== before) throw new Error("Deno.serve was patched while flag off");
});
