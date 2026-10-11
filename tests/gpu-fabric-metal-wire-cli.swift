import Foundation
import Metal

// Explicit one-stage CLI for macOS CI. Never represents two physical GPUs.
@main
struct MetalWireCLI {
    static func main() throws {
        guard CommandLine.arguments.count == 3,
              let scalar = Float(CommandLine.arguments[2]), scalar.isFinite else {
            throw NSError(domain: "metal-wire-cli", code: 1)
        }
        let op = CommandLine.arguments[1]
        let input = try JSONDecoder().decode(AIVAULTFloat32TensorV01.self,
            from: FileHandle.standardInput.readDataToEndOfFile())
        let values = try input.verifiedValues(expectedReceiverNodeID: "metal-stage")
        guard let device = MTLCreateSystemDefaultDevice() else {
            fputs("BLOCKED: no Metal device\n", stderr); exit(2)
        }
        let result = try AIVAULTMetalCompute(device: device).execute(operation: op, input: values, scalar: scalar)
        let output = try AIVAULTFloat32TensorV01(tensorID: "h", senderNodeID: "metal-stage",
            receiverNodeID: "network-stage", values: result.output)
        let wire = try AIVAULTTensorTransportV01(tensor: output, jobID: "metal-network-job",
            operationID: "op-b", sessionExpiresAt: Date().addingTimeInterval(25))
        FileHandle.standardOutput.write(try JSONEncoder().encode(wire))
        fputs("CONFIRMED: local Metal stage " + op + " device=" + result.deviceName + "\n", stderr)
    }
}
