import Foundation
import Metal
import CryptoKit

@main
struct GPUFabricMetalSmoke {
    static func main() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fputs("BLOCKED: no Metal device on this runner\n", stderr)
            exit(2)
        }

        let compute = try AIVAULTMetalCompute(device: device)
        let multiplied = try compute.execute(operation: "mul_scalar", input: [1, 2, -1], scalar: 3)
        guard multiplied.output == [3, 6, -3] else {
            fputs("FAIL: mul_scalar output mismatch: \(multiplied.output)\n", stderr)
            exit(1)
        }

        let added = try compute.execute(operation: "add_scalar", input: multiplied.output, scalar: 2)
        guard added.output == [5, 8, -1] else {
            fputs("FAIL: add_scalar output mismatch: \(added.output)\n", stderr)
            exit(1)
        }

        print("PASS: Metal device=\(device.name)")
        print("PASS: mul_scalar [1, 2, -1] * 3 = \(multiplied.output)")
        print("PASS: add_scalar [3, 6, -3] + 2 = \(added.output)")

        let tensor = try AIVAULTFloat32TensorV01(
            tensorID: "metal-smoke-output",
            senderNodeID: "mac-metal-runner",
            receiverNodeID: "test-receiver",
            values: added.output
        )
        let decoded = try tensor.verifiedValues(expectedReceiverNodeID: "test-receiver")
        guard decoded == [5, 8, -1] else {
            fputs("FAIL: tensor round-trip mismatch: \(decoded)\\n", stderr)
            exit(1)
        }
        print("PASS: Float32 tensor encode/hash/verify/decode round-trip")

        do {
            _ = try tensor.verifiedValues(expectedReceiverNodeID: "wrong-receiver")
            fputs("FAIL: tensor accepted wrong receiver\\n", stderr)
            exit(1)
        } catch AIVAULTFloat32TensorV01.TensorError.invalidReceiver {
            print("PASS: tensor rejects wrong receiver")
        }
    }
}
