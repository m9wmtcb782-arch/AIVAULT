import Foundation

/// Native transport envelope compatible with the Node HTTPS receiver.
/// Only explicit calls send data; this does not start background workers.
public struct AIVAULTTensorTransportV01: Codable {
    public struct Context: Codable {
        public let job_id: String
        public let operation_id: String
        public init(jobID: String, operationID: String) {
            job_id = jobID
            operation_id = operationID
        }
    }
    public let protocol_version: String
    public let message_id: String
    public let expires_at: String
    public let context: Context
    public let tensor: AIVAULTFloat32TensorV01

    public init(tensor: AIVAULTFloat32TensorV01, jobID: String,
                operationID: String, sessionExpiresAt: Date, now: Date = Date()) throws {
        guard Self.validID(jobID), Self.validID(operationID),
              sessionExpiresAt > now else { throw TransportError.invalidSession }
        _ = try tensor.verifiedValues(expectedReceiverNodeID: tensor.receiver_node_id)
        protocol_version = "aivault.gpu-fabric-transport/0.1"
        message_id = UUID().uuidString
        expires_at = Self.timestamp(min(sessionExpiresAt, now.addingTimeInterval(30)))
        context = Context(jobID: jobID, operationID: operationID)
        self.tensor = tensor
    }

    public enum TransportError: Error {
        case invalidSession, invalidEndpoint, invalidToken, invalidEnvelope
        case httpFailure(Int), invalidReceipt, receiptTooLarge
    }
    static func validID(_ value: String) -> Bool {
        value.range(of: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$", options: .regularExpression) != nil
    }
    static func timestamp(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }
    static func date(_ value: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: value)
    }
}

private final class AIVAULTRejectTensorRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// HTTPS sender with normal system TLS certificate/hostname verification.
/// Provision endpoint and short-lived token externally; no credentials in UI.
/// Remote receipt is delivery evidence, not GPU execution attestation.
public final class AIVAULTTensorHTTPSClientV01 {
    public struct Receipt: Codable {
        public let status: String
        public let message_id: String
        public let tensor_id: String
        public let payload_sha256: String
        public let receiver_node_id: String
    }
    private let endpoint: URL
    private let localNodeID: String
    private let peerNodeID: String
    private let token: String
    private let sessionExpiresAt: Date
    private let session: URLSession
    private typealias Failure = AIVAULTTensorTransportV01.TransportError

    public convenience init(endpoint: URL, localNodeID: String, peerNodeID: String,
                            accessToken: String, sessionExpiresAt: Date) throws {
        try self.init(endpoint: endpoint, localNodeID: localNodeID, peerNodeID: peerNodeID,
                      accessToken: accessToken, sessionExpiresAt: sessionExpiresAt,
                      configuration: .ephemeral)
    }
    // Internal configuration seam for URLProtocol contract tests only.
    init(endpoint: URL, localNodeID: String, peerNodeID: String,
         accessToken: String, sessionExpiresAt: Date,
         configuration: URLSessionConfiguration) throws {
        guard endpoint.scheme?.lowercased() == "https",
              let host = endpoint.host, !host.isEmpty,
              endpoint.user == nil, endpoint.password == nil,
              endpoint.fragment == nil else { throw Failure.invalidEndpoint }
        guard AIVAULTTensorTransportV01.validID(localNodeID),
              AIVAULTTensorTransportV01.validID(peerNodeID),
              localNodeID != peerNodeID, sessionExpiresAt > Date() else {
            throw Failure.invalidSession
        }
        guard accessToken.utf8.count >= 16,
              accessToken.rangeOfCharacter(from: .newlines) == nil else { throw Failure.invalidToken }
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.urlCredentialStorage = nil
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 20
        self.endpoint = endpoint
        self.localNodeID = localNodeID
        self.peerNodeID = peerNodeID
        token = accessToken
        self.sessionExpiresAt = sessionExpiresAt
        session = URLSession(configuration: configuration,
                             delegate: AIVAULTRejectTensorRedirects(), delegateQueue: nil)
    }
    deinit { session.invalidateAndCancel() }

    public func send(_ wire: AIVAULTTensorTransportV01, maxBytes: Int = 1024 * 1024) async throws -> Receipt {
        let now = Date()
        guard sessionExpiresAt > now,
              wire.protocol_version == "aivault.gpu-fabric-transport/0.1",
              AIVAULTTensorTransportV01.validID(wire.message_id),
              AIVAULTTensorTransportV01.validID(wire.context.job_id),
              AIVAULTTensorTransportV01.validID(wire.context.operation_id),
              let expiry = AIVAULTTensorTransportV01.date(wire.expires_at),
              expiry > now, expiry <= sessionExpiresAt,
              expiry <= now.addingTimeInterval(30),
              wire.tensor.sender_node_id == localNodeID,
              wire.tensor.receiver_node_id == peerNodeID,
              wire.tensor.layout == "contiguous" else { throw Failure.invalidEnvelope }
        _ = try wire.tensor.verifiedValues(expectedReceiverNodeID: peerNodeID, maxBytes: maxBytes)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.setValue(localNodeID, forHTTPHeaderField: "x-aivault-sender-node")
        request.setValue(peerNodeID, forHTTPHeaderField: "x-aivault-receiver-node")
        request.httpBody = try JSONEncoder().encode(wire)
        let (bytes, response) = try await session.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw Failure.invalidReceipt }
        guard http.statusCode == 200 else { throw Failure.httpFailure(http.statusCode) }
        guard response.expectedContentLength <= 8192 else { throw Failure.receiptTooLarge }
        var body = Data()
        for try await byte in bytes {
            guard body.count < 8192 else { throw Failure.receiptTooLarge }
            body.append(byte)
        }
        let receipt = try JSONDecoder().decode(Receipt.self, from: body)
        guard receipt.status == "TENSOR_RECEIVED_VERIFIED",
              receipt.message_id == wire.message_id,
              receipt.tensor_id == wire.tensor.tensor_id,
              receipt.payload_sha256 == wire.tensor.payload_sha256,
              receipt.receiver_node_id == peerNodeID else { throw Failure.invalidReceipt }
        return receipt
    }
}
