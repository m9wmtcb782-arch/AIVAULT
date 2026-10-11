/** Trusted single-vector dense contract: row-major W[out][in].
 * Weights are provisioned locally, never taken from a network tensor envelope.
 * CPU reference is for conformance, not GPU evidence.
 */
export const MAX_DENSE_WEIGHTS = 1048576;
export function validateDenseOperation(op) {
  if (op?.operator !== 'dense' || !Number.isSafeInteger(op.input_size) ||
      !Number.isSafeInteger(op.output_size) || op.input_size < 1 || op.output_size < 1 ||
      op.input_size > 4096 || op.output_size > 4096 ||
      op.input_size * op.output_size > MAX_DENSE_WEIGHTS ||
      !['identity', 'relu'].includes(op.activation) ||
      !Array.isArray(op.weights) || op.weights.length !== op.input_size * op.output_size ||
      !Array.isArray(op.bias) || op.bias.length !== op.output_size ||
      [...op.weights, ...op.bias].some(v => typeof v !== 'number' || !Number.isFinite(v) || !Number.isFinite(Math.fround(v)))) {
    throw new Error('invalid bounded Float32 dense operation');
  }
  return { inputSize: op.input_size, outputSize: op.output_size,
    memoryBytes: 4 * (op.weights.length + op.input_size + 2 * op.output_size) };
}
export function executeDenseReference(operation, input) {
  const { inputSize, outputSize } = validateDenseOperation(operation);
  if (!Array.isArray(input) || input.length !== inputSize ||
      input.some(v => typeof v !== 'number' || !Number.isFinite(Math.fround(v)))) throw new Error('invalid dense input');
  return Array.from({ length: outputSize }, (_, row) => {
    let sum = Math.fround(operation.bias[row]);
    for (let col = 0; col < inputSize; col++) {
      sum = Math.fround(sum + Math.fround(Math.fround(operation.weights[row * inputSize + col]) * Math.fround(input[col])));
    }
    if (!Number.isFinite(sum)) throw new Error('dense accumulation exceeds Float32 range');
    return operation.activation === 'relu' ? Math.max(0, sum) : sum;
  });
}
