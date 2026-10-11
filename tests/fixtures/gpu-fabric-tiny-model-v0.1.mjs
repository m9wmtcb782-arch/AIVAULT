// Test-only fixed 3 -> 4 (ReLU) -> 2 (identity) model, no external APIs.
export function tinyModelOperations() {
  return [
    { operation_id: 'op-a', operator: 'dense', backend: 'layer-a',
      input_size: 3, output_size: 4, weights: [1,0,-1, 0,1,1, -1,-1,0, 0.5,0.5,0.5],
      bias: [0,1,0,-0.5], activation: 'relu', dependency_ids: [],
      input_tensor_ids: ['x'], output_tensor_ids: ['h'], estimated_memory_bytes: 92 },
    { operation_id: 'op-b', operator: 'dense', backend: 'layer-b',
      input_size: 4, output_size: 2, weights: [1,2,-1,0.5, -1,0,1,2],
      bias: [0.25,-0.5], activation: 'identity', dependency_ids: ['op-a'],
      input_tensor_ids: ['h'], output_tensor_ids: ['y'], estimated_memory_bytes: 64 },
  ];
}
// Independent algebraic single-host baseline, not the dense implementation.
export function tinyModelBaseline([a,b,c]) {
  const h = [Math.max(0,a-c), Math.max(0,b+c+1), Math.max(0,-a-b), Math.max(0,(a+b+c)/2-0.5)];
  return [h[0]+2*h[1]-h[2]+h[3]/2+0.25, -h[0]+h[2]+2*h[3]-0.5];
}
