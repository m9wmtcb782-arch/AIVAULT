// CPU forward pass for the fixed Alice1M checkpoint format. No Node APIs.
export function createOriginCpu(weights, links, tensorIndex) {
  const width = 128;
  const layers = 2;
  const experts = 8;
  const tensors = new Map();
  for (const line of tensorIndex.trim().split("\n")) {
    const [name, rows, cols, offset] = line.trim().split(/\s+/);
    tensors.set(name, {
      cols: Number(cols),
      values: weights.subarray(Number(offset) / 4, Number(offset) / 4 + Number(rows) * Number(cols)),
    });
  }
  function matvec(name, input) {
    const { values, cols } = tensors.get(name);
    const result = new Float32Array(values.length / cols);
    for (let row = 0; row < result.length; row++) {
      let sum = 0;
      const offset = row * cols;
      for (let col = 0; col < cols; col++) sum += values[offset + col] * input[col];
      result[row] = sum;
    }
    return result;
  }
  return (prompt, count) => {
    const state = tensors.get("initial").values.slice();
    const embedding = tensors.get("embedding").values;
    function step(token) {
      let x = embedding.subarray(token * width, (token + 1) * width);
      for (let layer = 0; layer < layers; layer++) {
        const start = layer * width;
        const h = matvec("A" + layer, x);
        const prior = matvec("B" + layer, state.subarray(start, start + width));
        for (let i = 0; i < width; i++) h[i] = Math.tanh(h[i] + prior[i]);
        const scores = matvec("R" + layer, h);
        let expert = 0;
        for (let i = 1; i < experts; i++) if (scores[i] > scores[expert]) expert = i;
        let denominator = 0;
        for (const score of scores) denominator += Math.exp(score - scores[expert]);
        const permuted = new Float32Array(width);
        const linkOffset = (layer * experts + expert) * width;
        for (let i = 0; i < width; i++) permuted[i] = h[links[linkOffset + i]];
        const name = layer + "_" + expert;
        const activation = matvec("U" + name, permuted);
        for (let i = 0; i < activation.length; i++) activation[i] = Math.tanh(activation[i]);
        const update = matvec("D" + name, activation);
        x = new Float32Array(width);
        for (let i = 0; i < width; i++) {
          x[i] = state[start + i] = Math.tanh(h[i] + update[i] / denominator);
        }
      }
      return matvec("embedding", x);
    }
    let logits;
    for (const token of prompt) logits = step(token);
    const prefill = logits;
    const generated = new Uint8Array(count);
    let seed = 42;
    for (let index = 0; index < count; index++) {
      const ids = Array.from(logits.keys()).sort((a, b) => logits[b] - logits[a]).slice(0, 20);
      const chances = ids.map((id) => Math.exp((logits[id] - logits[ids[0]]) / 0.8));
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      let target = ((seed >>> 0) + 0.5) / 4294967296 * chances.reduce((a, b) => a + b, 0);
      let chosen = ids.at(-1);
      for (const [i, chance] of chances.entries()) {
        target -= chance;
        if (target < 0) { chosen = ids[i]; break; }
      }
      generated[index] = chosen;
      if (index + 1 < count) logits = step(chosen);
    }
    return { prefill, generated };
  };
}
