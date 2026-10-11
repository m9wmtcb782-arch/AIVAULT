import Foundation
import Metal

/// A minimal, allowlisted real-Metal compute adapter for the AIVAULT iOS worker.
///
/// Scope: one local device, Float32 vectors, scalar multiply/add only.
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
        """
        do {
            self.library = try device.makeLibrary(source: source, options: nil)
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
        guard let inputBuffer = device.makeBuffer(
            bytes: input,
            length: byteCount,
            options: .storageModeShared
        ), let outputBuffer = device.makeBuffer(
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
}
