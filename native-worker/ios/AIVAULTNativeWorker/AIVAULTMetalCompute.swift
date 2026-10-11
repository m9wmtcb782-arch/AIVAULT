import Foundation
import Metal

/// A minimal, allowlisted real-Metal compute adapter for the AIVAULT iOS worker.
///
/// Scope: one local device, Float32 vectors, scalar multiply/add and bounded dense layers.
/// This file is intentionally not wired into the coordinator or app lifecycle.
/// A host app must call this explicitly after obtaining user consent.
public final class AIVAULTMetalCompute {
    public enum ComputeError: Error {
        case noMetalDevice
        case invalidInput
        case unsupportedOperation
        case bufferAllocationFailed
        case commandQueueUnavailable
        case pipelineUnavailable
        case commandBufferUnavailable
        case encoderUnavailable
        case executionFailed(String)
    }

    public struct Result {
        public let output: [Float]
        public let deviceName: String
        public let operation: String
        public let elementCount: Int
    }

    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private let library: MTLLibrary

    public init(device: MTLDevice? = MTLCreateSystemDefaultDevice()) throws {
        guard let device else { throw ComputeError.noMetalDevice }
        guard let queue = device.makeCommandQueue() else {
            throw ComputeError.commandQueueUnavailable
        }
        let source = """
        #include <metal_stdlib>
        using namespace metal;

        kernel void av_mul_scalar(
            device const float* input [[buffer(0)]],
            device float* output [[buffer(1)]],
            constant float& scalar [[buffer(2)]],
            constant uint& count [[buffer(3)]],
            uint gid [[thread_position_in_grid]]) {
            if (gid < count) { output[gid] = input[gid] * scalar; }
        }

        kernel void av_add_scalar(
            device const float* input [[buffer(0)]],
            device float* output [[buffer(1)]],
            constant float& scalar [[buffer(2)]],
            constant uint& count [[buffer(3)]],
            uint gid [[thread_position_in_grid]]) {
            if (gid < count) { output[gid] = input[gid] + scalar; }
        }
        kernel void av_dense(
            device const float* input [[buffer(0)]],
            device const float* weights [[buffer(1)]],
            device const float* bias [[buffer(2)]],
            device float* output [[buffer(3)]],
            constant uint& inputCount [[buffer(4)]],
            constant uint& outputCount [[buffer(5)]],
            constant uint& activation [[buffer(6)]],
            uint row [[thread_position_in_grid]]) {
            if (row >= outputCount) return;
            float sum = bias[row];
            for (uint col = 0; col < inputCount; col++) {
                sum += weights[row * inputCount + col] * input[col];
            }
            // Preserve overflow/NaN for host validation, including before ReLU.
            output[row] = !isfinite(sum) ? sum : (activation == 1 ? max(0.0f, sum) : sum);
        }
        """
        do {
            let options = MTLCompileOptions()
            if #available(iOS 18.0, macOS 15.0, *) {
                options.mathMode = .safe
                options.mathFloatingPointFunctions = .precise
            } else {
                options.fastMathEnabled = false
            }
            self.library = try device.makeLibrary(source: source, options: options)
        } catch {
            throw ComputeError.executionFailed("Metal shader compilation failed: \\(error.localizedDescription)")
        }
        self.device = device
        self.queue = queue
    }

    public func execute(
        operation: String,
        input: [Float],
        scalar: Float
    ) throws -> Result {
        guard !input.isEmpty,
              input.count <= Int(UInt32.max),
              input.allSatisfy({ $0.isFinite }),
              scalar.isFinite else {
            throw ComputeError.invalidInput
        }

        let functionName: String
        switch operation {
        case "mul_scalar": functionName = "av_mul_scalar"
        case "add_scalar": functionName = "av_add_scalar"
        default: throw ComputeError.unsupportedOperation
        }

        guard let function = library.makeFunction(name: functionName) else {
            throw ComputeError.pipelineUnavailable
        }
        let pipeline: MTLComputePipelineState
        do {
            pipeline = try device.makeComputePipelineState(function: function)
        } catch {
            throw ComputeError.executionFailed("Metal pipeline creation failed: \\(error.localizedDescription)")
        }

        let byteCount = input.count * MemoryLayout<Float>.stride
        let inputBuffer: MTLBuffer?
        inputBuffer = input.withUnsafeBytes { rawBuffer in
            guard let baseAddress = rawBuffer.baseAddress else { return nil }
            return device.makeBuffer(
                bytes: baseAddress,
                length: byteCount,
                options: .storageModeShared
            )
        }
        guard let inputBuffer,
              let outputBuffer = device.makeBuffer(
                length: byteCount,
                options: .storageModeShared
              ) else {
            throw ComputeError.bufferAllocationFailed
        }

        guard let commandBuffer = queue.makeCommandBuffer() else {
            throw ComputeError.commandBufferUnavailable
        }
        guard let encoder = commandBuffer.makeComputeCommandEncoder() else {
            throw ComputeError.encoderUnavailable
        }

        var scalarValue = scalar
        var countValue = UInt32(input.count)
        encoder.setComputePipelineState(pipeline)
        encoder.setBuffer(inputBuffer, offset: 0, index: 0)
        encoder.setBuffer(outputBuffer, offset: 0, index: 1)
        encoder.setBytes(&scalarValue, length: MemoryLayout<Float>.stride, index: 2)
        encoder.setBytes(&countValue, length: MemoryLayout<UInt32>.stride, index: 3)

        let width = max(1, min(pipeline.maxTotalThreadsPerThreadgroup, input.count))
        let threadsPerGroup = MTLSize(width: width, height: 1, depth: 1)
        let grid = MTLSize(width: input.count, height: 1, depth: 1)
        encoder.dispatchThreads(grid, threadsPerThreadgroup: threadsPerGroup)
        encoder.endEncoding()

        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        guard commandBuffer.status == .completed else {
            throw ComputeError.executionFailed(
                commandBuffer.error?.localizedDescription ?? "Metal command buffer did not complete"
            )
        }

        let pointer = outputBuffer.contents().bindMemory(to: Float.self, capacity: input.count)
        let output = Array(UnsafeBufferPointer(start: pointer, count: input.count))
        guard output.allSatisfy({ $0.isFinite }) else {
            throw ComputeError.executionFailed("Metal output contains non-finite values")
        }

        return Result(
            output: output,
            deviceName: device.name,
            operation: operation,
            elementCount: input.count
        )
    }
    /// One locally provisioned dense layer; weights are W[output][input].
    /// No arbitrary shaders, model download or bridge exposure.
    public func executeDense(input: [Float], weights: [Float], bias: [Float],
                             activation: String) throws -> Result {
        guard !input.isEmpty, !bias.isEmpty, input.count <= 4096, bias.count <= 4096,
              input.count * bias.count <= 1_048_576,
              weights.count == input.count * bias.count,
              input.allSatisfy({ $0.isFinite }), weights.allSatisfy({ $0.isFinite }),
              bias.allSatisfy({ $0.isFinite }) else { throw ComputeError.invalidInput }
        guard activation == "identity" || activation == "relu" else { throw ComputeError.unsupportedOperation }
        guard let function = library.makeFunction(name: "av_dense") else { throw ComputeError.pipelineUnavailable }
        let pipeline = try device.makeComputePipelineState(function: function)
        func buffer(_ values: [Float]) -> MTLBuffer? {
            values.withUnsafeBytes { raw in
                guard let address = raw.baseAddress else { return nil }
                return device.makeBuffer(bytes: address, length: raw.count, options: .storageModeShared)
            }
        }
        guard let x = buffer(input), let w = buffer(weights), let b = buffer(bias),
              let y = device.makeBuffer(length: bias.count * MemoryLayout<Float>.stride, options: .storageModeShared)
        else { throw ComputeError.bufferAllocationFailed }
        guard let command = queue.makeCommandBuffer() else { throw ComputeError.commandBufferUnavailable }
        guard let encoder = command.makeComputeCommandEncoder() else { throw ComputeError.encoderUnavailable }
        var inputCount = UInt32(input.count), outputCount = UInt32(bias.count)
        var relu: UInt32 = activation == "relu" ? 1 : 0
        encoder.setComputePipelineState(pipeline)
        encoder.setBuffer(x, offset: 0, index: 0)
        encoder.setBuffer(w, offset: 0, index: 1)
        encoder.setBuffer(b, offset: 0, index: 2)
        encoder.setBuffer(y, offset: 0, index: 3)
        encoder.setBytes(&inputCount, length: MemoryLayout<UInt32>.stride, index: 4)
        encoder.setBytes(&outputCount, length: MemoryLayout<UInt32>.stride, index: 5)
        encoder.setBytes(&relu, length: MemoryLayout<UInt32>.stride, index: 6)
        encoder.dispatchThreads(MTLSize(width: bias.count, height: 1, depth: 1),
            threadsPerThreadgroup: MTLSize(width: min(bias.count, pipeline.maxTotalThreadsPerThreadgroup), height: 1, depth: 1))
        encoder.endEncoding()
        command.commit(); command.waitUntilCompleted()
        guard command.status == .completed else {
            throw ComputeError.executionFailed(command.error?.localizedDescription ?? "Dense kernel did not complete")
        }
        let pointer = y.contents().bindMemory(to: Float.self, capacity: bias.count)
        let output = Array(UnsafeBufferPointer(start: pointer, count: bias.count))
        guard output.allSatisfy({ $0.isFinite }) else { throw ComputeError.executionFailed("Dense output contains non-finite values") }
        return Result(output: output, deviceName: device.name, operation: "dense", elementCount: output.count)
    }

}

