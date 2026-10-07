import Foundation
import UIKit
import Metal

public struct AIVAULTNativeHardware: Codable {
    public struct Device: Codable {
        public let platform: String
        public let model: String
        public let modelIdentifier: String?
        public let modelSource: String
        public let osName: String
        public let osVersion: String
        public let architecture: String
    }
    public struct CPU: Codable {
        public let logicalCores: Int
        public let physicalCores: Int?
        public let activeCores: Int
    }
    public struct Memory: Codable {
        public let physicalMemoryBytes: UInt64
        public let physicalMemoryGB: Double
    }
    public struct GPU: Codable {
        public let metalDeviceName: String?
        public let recommendedMaxWorkingSetSize: UInt64?
        public let maxThreadsPerThreadgroup: Int?
        public let supportsRaytracing: Bool?
        public let registryID: UInt64?
    }
    public struct NPU: Codable {
        public let detected: Bool
        public let model: String?
        public let cores: Int?
        public let tops: Double?
        public let source: String
    }

    public let schemaVersion: String
    public let source: String
    public let collectedAt: String
    public let device: Device
    public let cpu: CPU
    public let memory: Memory
    public let gpu: GPU
    public let npu: NPU
    public let display: [String: Double]
    public let capability: [String: AnyCodableValue]
}

public enum AnyCodableValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode(Int.self) { self = .int(v); return }
        if let v = try? c.decode(Double.self) { self = .double(v); return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported value")
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        }
    }
}

public enum AIVAULTNativeHardwareCollector {
    public static func collect() -> AIVAULTNativeHardware {
        let device = UIDevice.current
        let processInfo = ProcessInfo.processInfo
        let metalDevice = MTLCreateSystemDefaultDevice()
        let machineIdentifier = sysctlString("hw.machine")

        let logical = sysctlInt("hw.logicalcpu")
        let physical = sysctlInt("hw.physicalcpu")
        let physicalMemory = processInfo.physicalMemory
        let screen = UIScreen.main

        let gpu = AIVAULTNativeHardware.GPU(
            metalDeviceName: metalDevice?.name,
            recommendedMaxWorkingSetSize: metalDevice?.recommendedMaxWorkingSetSize,
            maxThreadsPerThreadgroup: metalDevice.map {
                $0.maxThreadsPerThreadgroup.width *
                $0.maxThreadsPerThreadgroup.height *
                $0.maxThreadsPerThreadgroup.depth
            },
            supportsRaytracing: metalDevice?.supportsRaytracing,
            registryID: metalDevice?.registryID
        )

        let capability: [String: AnyCodableValue] = [
            "platform_family": .string("apple_mobile"),
            "runtime": .string("native_ios"),
            "metal": .bool(metalDevice != nil),
            "webgpu_bridge": .bool(true),
            "gpu_available": .bool(metalDevice != nil),
            "hardware_inventory_source": .string("AIVAULT Native Worker"),
            "model_identity_status": .string(machineIdentifier == nil ? "NOT_VERIFIED" : "REQUIRES_TEST")
        ]

        return AIVAULTNativeHardware(
            schemaVersion: "aivault-native-hardware-v1",
            source: "AIVAULT Native Worker",
            collectedAt: ISO8601DateFormatter().string(from: Date()),
            device: .init(
                platform: "iOS",
                model: device.model,
                modelIdentifier: machineIdentifier,
                modelSource: machineIdentifier == nil
                    ? "UIDevice.model — generic iOS model string"
                    : "native sysctl hw.machine — REQUIRES TEST / mapping verification",
                osName: device.systemName,
                osVersion: device.systemVersion,
                architecture: machineIdentifier ?? "NOT_EXPOSED"
            ),
            cpu: .init(
                logicalCores: logical ?? processInfo.processorCount,
                physicalCores: physical,
                activeCores: processInfo.activeProcessorCount
            ),
            memory: .init(
                physicalMemoryBytes: physicalMemory,
                physicalMemoryGB: Double(physicalMemory) / 1_073_741_824.0
            ),
            gpu: gpu,
            npu: .init(
                detected: false,
                model: nil,
                cores: nil,
                tops: nil,
                source: "iOS public app API does not provide a generic NPU core/TOPS field; do not guess"
            ),
            display: [
                "width_points": Double(screen.bounds.width),
                "height_points": Double(screen.bounds.height),
                "scale": screen.scale
            ],
            capability: capability
        )
    }

    private static func sysctlString(_ name: String) -> String? {
        var size: size_t = 0
        guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 0 else { return nil }
        var buffer = [CChar](repeating: 0, count: Int(size))
        guard sysctlbyname(name, &buffer, &size, nil, 0) == 0 else { return nil }
        return String(cString: buffer)
    }

    private static func sysctlInt(_ name: String) -> Int? {
        var value: Int32 = 0
        var size = MemoryLayout<Int32>.size
        guard sysctlbyname(name, &value, &size, nil, 0) == 0 else { return nil }
        return Int(value)
    }
}
