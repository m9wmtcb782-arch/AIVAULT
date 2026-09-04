(function (w) {
  let timer = null, running = false;
  const ALLOW = ["npc_tick", "world_pressure", "embed_toy"];

  function batteryStopNeeded(bat) {
    return bat && (bat.level < 0.2 || (bat.charging === false && bat.level < 0.35));
  }

  async function oneTask() {
    if (document.hidden) return;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 2) return;
    let acc = 0;
    const start = performance.now();
    while (performance.now() - start < 12) {
      acc += Math.sin(acc + Math.random());
    }
    return {
      task_id: "local-" + Date.now(),
      task_type: ALLOW[Math.floor(Math.random() * ALLOW.length)],
      max_runtime: 12,
      result: acc
    };
  }

  async function loop() {
    if (!running) return;
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        if (batteryStopNeeded(b)) { stop(); return; }
      }
    } catch {}
    await oneTask();
    timer = setTimeout(loop, 4000);
  }

  function start() {
    if (running) return;
    running = true;
    loop();
  }
  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }
  w.FKCompute = { start, stop, isRunning: () => running };
})(window);
