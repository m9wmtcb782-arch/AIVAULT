import Foundation
import CryptoKit
import Darwin

/// Verify a bounded signed config with a key pinned by trusted native enrollment.
/// Neither the package nor a web page may supply its own trusted public key.
final class AIVAULTSignedStagePackageV01 {
    enum Failure: Error { case invalidPackage, invalidSignature, expired, wrongNode, replay, storage }
    struct TrustedPackage {
        let packageID: String
        let keyID: String
        let configuration: AIVAULTPlannedDenseStageV01.Configuration
        fileprivate init(packageID: String, keyID: String, configuration: AIVAULTPlannedDenseStageV01.Configuration) {
            self.packageID=packageID; self.keyID=keyID; self.configuration=configuration
        }
    }
    private struct Envelope: Decodable {
        let protocol_version: String; let key_id: String; let payload_base64: String; let signature_base64: String
    }
    private struct Grant: Decodable {
        let token: String; let sender_node_id: String; let job_id: String; let operation_id: String
        let tensor_id: String; let shape: [Int]; let expires_at: String
        func native() throws -> AIVAULTTensorReceiverV01.Grant {
            guard let expiry=AIVAULTTensorTransportV01.date(expires_at) else { throw Failure.invalidPackage }
            return .init(token:token,senderNodeID:sender_node_id,jobID:job_id,operationID:operation_id,tensorID:tensor_id,shape:shape,expiresAt:expiry)
        }
    }
    private struct Layer: Decodable {
        let input_size: Int; let output_size: Int; let weights: [Float]; let bias: [Float]; let activation: String
    }
    private struct Operation: Decodable {
        let operation_id: String; let node_id: String; let input_tensor_id: String; let output_tensor_id: String
        let dependency_id: String?; let layer: Layer
    }
    private struct Route: Decodable { let endpoint: String; let grant: Grant }
    private struct Payload: Decodable {
        let package_id: String; let node_id: String; let job_id: String
        let issued_at: String; let expires_at: String; let operations: [Operation]
        let incoming_grant: Grant; let next: Route?
    }
    static func verify(_ data: Data, expectedNodeID: String, pinnedKeyID: String,
                       pinnedPublicKey: Data, now: Date = Date()) throws -> TrustedPackage {
        guard data.count <= 6*1024*1024, pinnedPublicKey.count == 65 else { throw Failure.invalidPackage }
        let e=try JSONDecoder().decode(Envelope.self,from:data)
        guard e.protocol_version == "aivault.gpu-fabric-stage-package/0.1", e.key_id == pinnedKeyID,
              e.payload_base64.utf8.count <= ((4*1024*1024+2)/3)*4,
              e.signature_base64.utf8.count <= 128,
              let payload=Data(base64Encoded:e.payload_base64), payload.count <= 4*1024*1024,
              payload.base64EncodedString() == e.payload_base64,
              let signature=Data(base64Encoded:e.signature_base64), signature.base64EncodedString() == e.signature_base64 else { throw Failure.invalidPackage }
        let key=try P256.Signing.PublicKey(x963Representation:pinnedPublicKey)
        let sig=try P256.Signing.ECDSASignature(derRepresentation:signature)
        let signedBytes=Data((e.protocol_version+"\n"+e.key_id+"\n").utf8)+payload
        guard key.isValidSignature(sig,for:signedBytes) else { throw Failure.invalidSignature }
        // Decode model/credentials only after signature verification.
        let p=try JSONDecoder().decode(Payload.self,from:payload)
        guard p.node_id == expectedNodeID else { throw Failure.wrongNode }
        guard let packageID=UUID(uuidString:p.package_id),
              let issued=AIVAULTTensorTransportV01.date(p.issued_at), let expiry=AIVAULTTensorTransportV01.date(p.expires_at),
              issued <= now, expiry > now, expiry > issued, expiry.timeIntervalSince(issued) <= 600 else { throw Failure.expired }
        let grant=try p.incoming_grant.native()
        guard expiry == grant.expiresAt else { throw Failure.invalidPackage }
        let operations=p.operations.map { op in
            AIVAULTPlannedDenseStageV01.Operation(operationID:op.operation_id,nodeID:op.node_id,inputTensorID:op.input_tensor_id,
                outputTensorID:op.output_tensor_id,dependencyID:op.dependency_id,
                layer:.init(inputSize:op.layer.input_size,outputSize:op.layer.output_size,weights:op.layer.weights,bias:op.layer.bias,activation:op.layer.activation))
        }
        let route: AIVAULTPlannedDenseStageV01.Route?
        if let next=p.next {
            guard let endpoint=URL(string:next.endpoint) else { throw Failure.invalidPackage }
            route = .init(endpoint:endpoint,grant:try next.grant.native())
        } else { route=nil }
        let configuration=AIVAULTPlannedDenseStageV01.Configuration(localNodeID:expectedNodeID,jobID:p.job_id,
            operations:operations,incomingGrant:grant,next:route)
        _ = try configuration.validate(now:now)
        return TrustedPackage(packageID:packageID.uuidString.lowercased(),keyID:pinnedKeyID,configuration:configuration)
    }
    /// One-shot import, durable before listener preparation. Failures stay consumed.
    static func reserve(_ package: TrustedPackage, directory: URL) throws {
        // Reuse the existing strict private-directory validation, not execution claims.
        _ = try AIVAULTTensorReplayLedgerV01(directory:directory)
        let identity=try JSONEncoder().encode([package.configuration.localNodeID,package.keyID,package.packageID])
        let key=SHA256.hash(data:identity).map{String(format:"%02x",$0)}.joined()
        let claim=directory.appendingPathComponent("config-"+key,isDirectory:true)
        guard mkdir(claim.path,0o700) == 0 else {
            if errno == EEXIST { throw Failure.replay }
            throw Failure.storage
        }
        for path in [claim,directory] {
            let fd=open(path.path,O_RDONLY|O_NOFOLLOW)
            guard fd >= 0 else { throw Failure.storage }
            defer { close(fd) }
            guard fsync(fd) == 0 else { throw Failure.storage }
        }
    }
}
