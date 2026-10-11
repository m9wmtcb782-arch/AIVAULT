import CryptoKit
import Foundation

/// A typed, byte-level Float32 tensor payload compatible with the
/// AIVAULT GPU Fabric tensor-transfer v0.1 descriptor fields.
///
/// This is a serialization/integrity helper only. It does not authenticate
/// peers, encrypt data, open a network connection, or dispatch remote work.
public struct AIVAULTFloat32TensorV01: Codable {
    public let protocol_version: String
    public let tensor_id: String
    public let sender_node_id: String
    public let receiver_node_id: String
    public let dtype: String
    public let shape: [Int]
    public let layout: String
    public let byte_length: Int
    public let payload_sha256: String
    public let payload_base64: String

    public enum TensorError: Error {
        case invalidIdentifier
        case invalidShape
        case invalidPayload
        case invalidReceiver
        case hashMismatch
    }

    private static let protocolVersion = "aivault.gpu-fabric-tensor/0.1"
    private static let identifierPattern = try! NSRegularExpression(
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$"
    )

    private static func validIdentifier(_ value: String) -> Bool {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return identifierPattern.firstMatch(in: value, range: range) != nil
    }

    private static func bytes(from values: [Float]) -> Data {
        // The wire format is explicitly little-endian, independent of host CPU.
        var words = values.map { $0.bitPattern.littleEndian }
        return words.withUnsafeBytes { Data($0) }
    }

    private static func digest(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    public init(
        tensorID: String,
        senderNodeID: String,
        receiverNodeID: String,
        values: [Float],
        layout: String = "contiguous",
        maxBytes: Int = 64 * 1024 * 1024
    ) throws {
        guard Self.validIdentifier(tensorID),
              Self.validIdentifier(senderNodeID),
              Self.validIdentifier(receiverNodeID),
              senderNodeID != receiverNodeID else {
            throw TensorError.invalidIdentifier
        }
        guard !values.isEmpty,
              values.allSatisfy({ $0.isFinite }),
              maxBytes > 0,
              values.count <= maxBytes / MemoryLayout<UInt32>.size,
              layout.range(of: "^[A-Za-z0-9._:-]{1,64}$", options: .regularExpression) != nil else {
            throw TensorError.invalidPayload
        }

        let payload = Self.bytes(from: values)
        self.protocol_version = Self.protocolVersion
        self.tensor_id = tensorID
        self.sender_node_id = senderNodeID
        self.receiver_node_id = receiverNodeID
        self.dtype = "float32"
        self.shape = [values.count]
        self.layout = layout
        self.byte_length = payload.count
        self.payload_sha256 = Self.digest(payload)
        self.payload_base64 = payload.base64EncodedString()
    }

    /// Validates the receiver, descriptor, size, and SHA-256 before decoding.
    /// The returned values are not proof that the sender is trusted.
    public func verifiedValues(
        expectedReceiverNodeID: String,
        maxBytes: Int = 64 * 1024 * 1024
    ) throws -> [Float] {
        guard protocol_version == Self.protocolVersion,
              Self.validIdentifier(tensor_id),
              Self.validIdentifier(sender_node_id),
              Self.validIdentifier(receiver_node_id),
              sender_node_id != receiver_node_id else {
            throw TensorError.invalidIdentifier
        }
        guard receiver_node_id == expectedReceiverNodeID else {
            throw TensorError.invalidReceiver
        }
        guard dtype == "float32",
              shape.count == 1,
              shape[0] > 0,
              maxBytes > 0,
              shape[0] <= maxBytes / MemoryLayout<UInt32>.size,
              byte_length == shape[0] * MemoryLayout<UInt32>.size,
              layout.range(of: "^[A-Za-z0-9._:-]{1,64}$", options: .regularExpression) != nil,
              let payload = Data(base64Encoded: payload_base64),
              payload.count == byte_length else {
            throw TensorError.invalidShape
        }
        guard Self.digest(payload) == payload_sha256 else {
            throw TensorError.hashMismatch
        }

        let bytes = [UInt8](payload)
        var values = [Float]()
        values.reserveCapacity(shape[0])
        for offset in stride(from: 0, to: bytes.count, by: 4) {
            let word = UInt32(bytes[offset])
                | (UInt32(bytes[offset + 1]) << 8)
                | (UInt32(bytes[offset + 2]) << 16)
                | (UInt32(bytes[offset + 3]) << 24)
            let value = Float(bitPattern: word)
            guard value.isFinite else { throw TensorError.invalidPayload }
            values.append(value)
        }
        return values
    }
}
