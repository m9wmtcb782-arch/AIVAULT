import Foundation
import Security

/// Immutable, trusted native graph configuration. Not decoded from tensor traffic.
public final class AIVAULTPlannedDenseStageV01 {
    public enum StageError: Error { case invalidGraph, invalidGrant, invalidRoute, invalidLayer }
    public struct Layer: Sendable {
        public let inputSize: Int
        public let outputSize: Int
        public let weights: [Float]
        public let bias: [Float]
        public let activation: String
        public init(inputSize: Int, outputSize: Int, weights: [Float], bias: [Float], activation: String) {
            self.inputSize=inputSize; self.outputSize=outputSize; self.weights=weights; self.bias=bias; self.activation=activation
        }
        func validate() throws {
            guard inputSize > 0, outputSize > 0, inputSize <= 4096, outputSize <= 4096,
                  inputSize * outputSize <= 1_048_576, weights.count == inputSize * outputSize,
                  bias.count == outputSize, weights.allSatisfy({$0.isFinite}), bias.allSatisfy({$0.isFinite}),
                  ["identity","relu"].contains(activation) else { throw StageError.invalidLayer }
        }
    }
    public struct Operation: Sendable {
        public let operationID: String
        public let nodeID: String
        public let inputTensorID: String
        public let outputTensorID: String
        public let dependencyID: String?
        public let layer: Layer
        public init(operationID: String, nodeID: String, inputTensorID: String, outputTensorID: String,
                    dependencyID: String?, layer: Layer) {
            self.operationID=operationID; self.nodeID=nodeID; self.inputTensorID=inputTensorID
            self.outputTensorID=outputTensorID; self.dependencyID=dependencyID; self.layer=layer
        }
    }
    public struct Route: Sendable {
        public let endpoint: URL
        public let grant: AIVAULTTensorReceiverV01.Grant
        public init(endpoint: URL, grant: AIVAULTTensorReceiverV01.Grant) { self.endpoint=endpoint; self.grant=grant }
    }
    public struct Configuration: Sendable {
        public let localNodeID: String
        public let jobID: String
        public let operations: [Operation] // Trusted topological order; linear, one operation per node.
        public let incomingGrant: AIVAULTTensorReceiverV01.Grant
        public let next: Route?
        public init(localNodeID: String, jobID: String, operations: [Operation],
                    incomingGrant: AIVAULTTensorReceiverV01.Grant, next: Route? = nil) {
            self.localNodeID=localNodeID; self.jobID=jobID; self.operations=operations; self.incomingGrant=incomingGrant; self.next=next
        }
        func validate(now: Date = Date()) throws -> Operation {
            guard AIVAULTPlannedDenseStageV01.validID(localNodeID), AIVAULTPlannedDenseStageV01.validID(jobID), !operations.isEmpty, operations.count <= 32 else { throw StageError.invalidGraph }
            var ids=Set<String>(), nodes=Set<String>(), tensors=Set<String>()
            for (i,op) in operations.enumerated() {
                try op.layer.validate()
                guard [op.operationID,op.nodeID,op.inputTensorID,op.outputTensorID].allSatisfy(AIVAULTPlannedDenseStageV01.validID),
                      ids.insert(op.operationID).inserted, nodes.insert(op.nodeID).inserted,
                      tensors.insert(op.outputTensorID).inserted, op.inputTensorID != op.outputTensorID else { throw StageError.invalidGraph }
                if i == 0 {
                    guard op.dependencyID == nil else { throw StageError.invalidGraph }
                } else {
                    let prior=operations[i-1]
                    guard op.dependencyID == prior.operationID, op.inputTensorID == prior.outputTensorID,
                          op.layer.inputSize == prior.layer.outputSize else { throw StageError.invalidGraph }
                }
            }
            guard !tensors.contains(operations[0].inputTensorID),
                  let index=operations.firstIndex(where:{$0.nodeID == localNodeID}) else { throw StageError.invalidGraph }
            let op=operations[index], g=incomingGrant
            let duration=g.expiresAt.timeIntervalSince(now)
            guard AIVAULTPlannedDenseStageV01.validID(g.senderNodeID), g.senderNodeID != localNodeID,
                  g.jobID == jobID, g.operationID == op.operationID, g.tensorID == op.inputTensorID,
                  g.shape == [op.layer.inputSize], duration.isFinite, duration > 0, duration <= 600,
                  g.token.utf8.count >= 16, g.token.rangeOfCharacter(from:.newlines) == nil,
                  index == 0 || g.senderNodeID == operations[index-1].nodeID else { throw StageError.invalidGrant }
            if index+1 < operations.count {
                let target=operations[index+1]
                guard let next, next.endpoint.scheme?.lowercased() == "https", next.endpoint.host?.isEmpty == false,
                      next.endpoint.user == nil, next.endpoint.password == nil, next.endpoint.fragment == nil,
                      next.endpoint.path == "/tensor", next.endpoint.query == nil,
                      next.grant.senderNodeID == localNodeID, next.grant.jobID == jobID,
                      next.grant.operationID == target.operationID, next.grant.tensorID == op.outputTensorID,
                      next.grant.shape == [op.layer.outputSize], next.grant.expiresAt > now,
                      next.grant.expiresAt.timeIntervalSince(now) <= 600,
                      next.grant.token.utf8.count >= 16, next.grant.token.rangeOfCharacter(from:.newlines) == nil else { throw StageError.invalidRoute }
            } else if next != nil { throw StageError.invalidRoute }
            return op
        }
    }
    private static func validID(_ value: String) -> Bool {
        let bytes=Array(value.utf8)
        func alnum(_ b: UInt8) -> Bool { (48...57).contains(b) || (65...90).contains(b) || (97...122).contains(b) }
        return !bytes.isEmpty && bytes.count <= 200 && alnum(bytes[0]) && bytes.allSatisfy { alnum($0) || [46,95,58,45].contains($0) }
    }
    public struct Outcome: Sendable {
        public let status: String
        public let output: [Float]?
        public let deviceName: String?
        public let downstreamReceiptVerified: Bool
    }
    private actor State {
        var value=Outcome(status:"WAITING_FOR_TENSOR",output:nil,deviceName:nil,downstreamReceiptVerified:false)
        func set(_ value: Outcome) { self.value=value }
        func snapshot() -> Outcome { value }
    }
    public let receiver: AIVAULTTensorReceiverV01
    public let configuration: Configuration
    private let state: State
    public convenience init(configuration: Configuration, ledger: AIVAULTTensorReplayLedgerV01) throws {
        try self.init(configuration:configuration,ledger:ledger,testDelegate:nil)
    }
    // Test-only trust-anchor seam. Public construction uses normal system TLS.
    init(configuration: Configuration, ledger: AIVAULTTensorReplayLedgerV01,
         testDelegate: URLSessionTaskDelegate?) throws {
        let op=try configuration.validate(), state=State()
        let target=configuration.operations.first(where:{$0.dependencyID == op.operationID})
        let client: AIVAULTTensorHTTPSClientV01?
        if let route=configuration.next, let target {
            client=try AIVAULTTensorHTTPSClientV01(endpoint:route.endpoint,localNodeID:configuration.localNodeID,
                peerNodeID:target.nodeID,accessToken:route.grant.token,sessionExpiresAt:route.grant.expiresAt,
                configuration:.ephemeral,testDelegate:testDelegate)
        } else { client=nil }
        self.configuration=configuration; self.state=state
        receiver=try AIVAULTTensorReceiverV01(localNodeID:configuration.localNodeID,grant:configuration.incomingGrant,ledger:ledger,
            onTensor:{ tensor,_ in
                await state.set(Outcome(status:"EXECUTING",output:nil,deviceName:nil,downstreamReceiptVerified:false))
                do {
                    let input=try tensor.verifiedValues(expectedReceiverNodeID:configuration.localNodeID)
                    // Only after user consent, verified input and durable reservation.
                    let result=try AIVAULTMetalCompute().executeDense(input:input,weights:op.layer.weights,bias:op.layer.bias,activation:op.layer.activation)
                    if let client, let target, let route=configuration.next {
                        await state.set(Outcome(status:"FORWARDING",output:nil,deviceName:result.deviceName,downstreamReceiptVerified:false))
                        let output=try AIVAULTFloat32TensorV01(tensorID:op.outputTensorID,senderNodeID:configuration.localNodeID,
                            receiverNodeID:target.nodeID,values:result.output)
                        let wire=try AIVAULTTensorTransportV01(tensor:output,jobID:configuration.jobID,
                            operationID:target.operationID,sessionExpiresAt:route.grant.expiresAt)
                        _ = try await client.send(wire) // Bounded matching receipt required.
                    }
                    await state.set(Outcome(status:"PLANNED_STAGE_COMPLETED",output:result.output,deviceName:result.deviceName,downstreamReceiptVerified:client != nil))
                } catch {
                    await state.set(Outcome(status:"FAILED_REQUIRES_NEW_JOB",output:nil,deviceName:nil,downstreamReceiptVerified:false))
                    throw error // Reservation remains consumed; no hidden retry.
                }
            })
    }
    public func snapshot() async -> Outcome { await state.snapshot() }
    public func makeListener(identity: SecIdentity, bindHost: String = "127.0.0.1") throws -> AIVAULTTensorTLSListenerV01 {
        try AIVAULTTensorTLSListenerV01(identity:identity,receiver:receiver,bindHost:bindHost)
    }
}
