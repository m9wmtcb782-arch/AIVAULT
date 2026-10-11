import Foundation
import CryptoKit
import Darwin

/// Durable at-most-once reservation. No automatic cleanup or execution retry.
/// Caller supplies a private directory on durable local storage, not a cache.
public final class AIVAULTTensorReplayLedgerV01 {
    public enum LedgerError: Error { case invalidDirectory, storageFailure, invalidClaim }
    private let directory: URL
    private static func syncDirectory(_ url: URL) throws {
        let fd = open(url.path, O_RDONLY | O_NOFOLLOW)
        guard fd >= 0 else { throw LedgerError.storageFailure }
        defer { close(fd) }
        guard fsync(fd) == 0 else { throw LedgerError.storageFailure }
    }
    public init(directory: URL) throws {
        guard directory.isFileURL, directory.path.hasPrefix("/") else { throw LedgerError.invalidDirectory }
        if mkdir(directory.path, 0o700) != 0 && errno != EEXIST { throw LedgerError.storageFailure }
        var info = stat()
        guard lstat(directory.path, &info) == 0,
              (info.st_mode & mode_t(S_IFMT)) == mode_t(S_IFDIR), (info.st_mode & 0o077) == 0 else {
            throw LedgerError.invalidDirectory
        }
        self.directory = directory
        try Self.syncDirectory(directory)
        try Self.syncDirectory(directory.deletingLastPathComponent())
    }
    func reserve(localNodeID: String, wire: AIVAULTTensorTransportV01) throws -> Bool {
        let identity = [localNodeID, wire.tensor.sender_node_id, wire.context.job_id,
                        wire.context.operation_id, wire.tensor.tensor_id]
        guard identity.allSatisfy(AIVAULTTensorTransportV01.validID),
              AIVAULTTensorTransportV01.validID(wire.message_id) else { throw LedgerError.invalidClaim }
        let data = try JSONSerialization.data(withJSONObject: identity)
        let key = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let claim = directory.appendingPathComponent(key, isDirectory: true)
        if mkdir(claim.path, 0o700) != 0 {
            if errno == EEXIST { return false }
            throw LedgerError.storageFailure
        }
        // Incomplete reservations also block restart; failures never release it.
        let marker = claim.appendingPathComponent("reservation.json")
        let fd = open(marker.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        guard fd >= 0 else { throw LedgerError.storageFailure }
        defer { close(fd) }
        let record = try JSONSerialization.data(withJSONObject: ["version": 1, "identity": identity,
            "message_id": wire.message_id, "payload_sha256": wire.tensor.payload_sha256,
            "state": "RESERVED_OUTCOME_UNKNOWN"] as [String: Any], options: .sortedKeys)
        try FileHandle(fileDescriptor: fd, closeOnDealloc: false).write(contentsOf: record)
        guard fsync(fd) == 0 else { throw LedgerError.storageFailure }
        try Self.syncDirectory(claim)
        try Self.syncDirectory(directory)
        return true
    }
}

private final class AIVAULTReceiveAdmissionV01: @unchecked Sendable {
    enum Closed: Error { case stopped }
    private let lock = NSLock()
    private var active = true
    func close() { lock.lock(); defer { lock.unlock() }; active = false }
    func reserve(_ action: () throws -> Bool) throws -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard active else { throw Closed.stopped }
        return try action()
    }
}

/// Single granted tensor stage. Transport adapters must enforce TLS themselves.
/// Reservation precedes the callback; callback failure keeps the stage consumed.
public actor AIVAULTTensorReceiverV01 {
    public struct Grant {
        public let token: String
        public let senderNodeID: String
        public let jobID: String
        public let operationID: String
        public let tensorID: String
        public let shape: [Int]
        public let expiresAt: Date
        public init(token: String, senderNodeID: String, jobID: String, operationID: String,
                    tensorID: String, shape: [Int], expiresAt: Date) {
            self.token = token; self.senderNodeID = senderNodeID; self.jobID = jobID
            self.operationID = operationID; self.tensorID = tensorID
            self.shape = shape; self.expiresAt = expiresAt
        }
    }
    public struct Response {
        public let statusCode: Int
        public let body: Data
        static func error(_ code: Int, _ message: String) -> Response {
            Response(statusCode: code, body: (try? JSONSerialization.data(withJSONObject: ["error": message])) ?? Data())
        }
    }
    public enum ConfigurationError: Error { case invalidGrant }
    private let localNodeID: String
    private let grant: Grant
    private let ledger: AIVAULTTensorReplayLedgerV01
    private let maxBytes: Int
    private let onTensor: (AIVAULTFloat32TensorV01, AIVAULTTensorTransportV01.Context) async throws -> Void
    private let admission = AIVAULTReceiveAdmissionV01()
    private var used = false
    /// Synchronously stops future reservations; an already-reserved callback may finish.
    public nonisolated func revoke() { admission.close() }
    public init(localNodeID: String, grant: Grant, ledger: AIVAULTTensorReplayLedgerV01,
                maxBytes: Int = 1024 * 1024,
                onTensor: @escaping (AIVAULTFloat32TensorV01, AIVAULTTensorTransportV01.Context) async throws -> Void) throws {
        guard [localNodeID, grant.senderNodeID, grant.jobID, grant.operationID, grant.tensorID]
                .allSatisfy(AIVAULTTensorTransportV01.validID),
              localNodeID != grant.senderNodeID, grant.token.utf8.count >= 16,
              grant.token.rangeOfCharacter(from: .newlines) == nil, grant.expiresAt > Date(),
              maxBytes > 0, maxBytes <= 64 * 1024 * 1024,
              grant.shape.count == 1, grant.shape[0] > 0, grant.shape[0] <= maxBytes / 4 else {
            throw ConfigurationError.invalidGrant
        }
        self.localNodeID = localNodeID; self.grant = grant; self.ledger = ledger
        self.maxBytes = maxBytes; self.onTensor = onTensor
    }
    private func sameToken(_ value: String) -> Bool {
        let a = Array(value.utf8), b = Array(grant.token.utf8)
        guard a.count == b.count else { return false }
        var difference: UInt8 = 0
        for i in a.indices { difference |= a[i] ^ b[i] }
        return difference == 0
    }
    public func receive(body: Data, headers: [String: String], now: Date = Date()) async -> Response {
        guard grant.expiresAt > now,
              let authorization = headers["authorization"], authorization.hasPrefix("Bearer "),
              sameToken(String(authorization.dropFirst(7))) else { return .error(401, "UNAUTHORIZED") }
        guard headers["x-aivault-sender-node"] == grant.senderNodeID,
              headers["x-aivault-receiver-node"] == localNodeID else { return .error(403, "PEER_MISMATCH") }
        guard headers["content-type"] == "application/json" else { return .error(415, "JSON_REQUIRED") }
        guard body.count <= ((maxBytes + 2) / 3) * 4 + 8192 else { return .error(413, "BODY_TOO_LARGE") }
        guard let wire = try? JSONDecoder().decode(AIVAULTTensorTransportV01.self, from: body),
              wire.protocol_version == "aivault.gpu-fabric-transport/0.1",
              AIVAULTTensorTransportV01.validID(wire.message_id),
              let expiry = AIVAULTTensorTransportV01.date(wire.expires_at),
              expiry > now, expiry <= grant.expiresAt, expiry <= now.addingTimeInterval(30) else {
            return .error(400, "INVALID_ENVELOPE")
        }
        guard wire.context.job_id == grant.jobID, wire.context.operation_id == grant.operationID,
              wire.tensor.tensor_id == grant.tensorID, wire.tensor.sender_node_id == grant.senderNodeID,
              wire.tensor.receiver_node_id == localNodeID, wire.tensor.shape == grant.shape,
              wire.tensor.dtype == "float32", wire.tensor.layout == "contiguous" else {
            return .error(403, "STAGE_MISMATCH")
        }
        guard (try? wire.tensor.verifiedValues(expectedReceiverNodeID: localNodeID, maxBytes: maxBytes)) != nil else {
            return .error(400, "INVALID_TENSOR")
        }
        guard !used else { return .error(409, "REPLAY_OR_STAGE_CONSUMED") }
        guard Date() < grant.expiresAt, Date() < expiry else { return .error(401, "EXPIRED") }
        used = true // Before any actor suspension or backend callback.
        do {
            guard try admission.reserve({ try ledger.reserve(localNodeID: localNodeID, wire: wire) }) else {
                return .error(409, "DURABLE_STAGE_ALREADY_RESERVED")
            }
        } catch AIVAULTReceiveAdmissionV01.Closed.stopped { return .error(503, "RECEIVER_STOPPED") }
        catch { return .error(503, "REPLAY_STORAGE_FAILED") }
        do {
            try await onTensor(wire.tensor, wire.context)
            let receipt = AIVAULTTensorHTTPSClientV01.Receipt(status: "TENSOR_RECEIVED_VERIFIED",
                message_id: wire.message_id, tensor_id: wire.tensor.tensor_id,
                payload_sha256: wire.tensor.payload_sha256, receiver_node_id: localNodeID)
            return Response(statusCode: 200, body: try JSONEncoder().encode(receipt))
        } catch { return .error(500, "STAGE_FAILED_REQUIRES_NEW_JOB") }
    }
}
