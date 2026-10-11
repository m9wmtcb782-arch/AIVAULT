import Foundation
import Metal

// CI-only CLI. Layer parameters arrive from the test controller via a private
// local file, never from the incoming network tensor descriptor.
@main
struct MetalDenseCLI {
    struct Layer: Decodable {
        let input_size: Int
        let output_size: Int
        let weights: [Float]
        let bias: [Float]
        let activation: String
    }
    static func main() throws {
        guard CommandLine.arguments.count == 2 else { throw AIVAULTMetalCompute.ComputeError.invalidInput }
        let layer = try JSONDecoder().decode(Layer.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let tensor = try JSONDecoder().decode(AIVAULTFloat32TensorV01.self, from: FileHandle.standardInput.readDataToEndOfFile())
        let input = try tensor.verifiedValues(expectedReceiverNodeID: "metal-stage")
        guard input.count == layer.input_size, layer.bias.count == layer.output_size else { throw AIVAULTMetalCompute.ComputeError.invalidInput }
        let compute = try AIVAULTMetalCompute()
        // Negative cases must reject before GPU work, or reject non-finite output.
        for run in [
            { try compute.executeDense(input: [], weights: [], bias: [0], activation: "identity") },
            { try compute.executeDense(input: [1], weights: [], bias: [0], activation: "relu") },
            { try compute.executeDense(input: [1], weights: [1], bias: [0], activation: "unknown") },
            { try compute.executeDense(input: [.infinity], weights: [1], bias: [0], activation: "identity") },
            { try compute.executeDense(input: [1], weights: [.nan], bias: [0], activation: "relu") },
            { try compute.executeDense(input: [2], weights: [3e38], bias: [0], activation: "relu") }
        ] {
            do { _ = try run(); throw NSError(domain: "unexpected-dense-accept", code: 1) }
            catch let error as NSError where error.domain == "unexpected-dense-accept" { throw error }
            catch { /* expected validation failure */ }
        }
        let result = try compute.executeDense(input: input, weights: layer.weights, bias: layer.bias, activation: layer.activation)
        let output = try AIVAULTFloat32TensorV01(tensorID: "h", senderNodeID: "metal-stage", receiverNodeID: "network-stage", values: result.output)
        let wire = try AIVAULTTensorTransportV01(tensor: output, jobID: "metal-network-job", operationID: "op-b", sessionExpiresAt: Date().addingTimeInterval(25))
        FileHandle.standardOutput.write(try JSONEncoder().encode(wire))
        fputs("CONFIRMED: local dense Metal device=" + result.deviceName + " dimensions=" + String(input.count) + "->" + String(result.output.count) + " activation=" + layer.activation + "\n", stderr)
    }
}
