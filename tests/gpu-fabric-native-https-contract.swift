import Foundation

// Mock HTTP contract test only. It does not prove real native HTTPS/TLS I/O.
final class TensorReceiptProtocol: URLProtocol {
    static var mode = "valid"
    static var calls = 0
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            Self.calls += 1
            guard request.httpMethod == "POST",
                  request.value(forHTTPHeaderField: "Authorization") == "Bearer test-only-native-token-0001",
                  request.value(forHTTPHeaderField: "x-aivault-sender-node") == "node-a",
                  request.value(forHTTPHeaderField: "x-aivault-receiver-node") == "node-b" else {
                throw NSError(domain: "request-contract", code: 1)
            }
            var data = request.httpBody ?? Data()
            if data.isEmpty, let stream = request.httpBodyStream {
                stream.open()
                defer { stream.close() }
                var buffer = [UInt8](repeating: 0, count: 4096)
                while stream.hasBytesAvailable {
                    let count = stream.read(&buffer, maxLength: buffer.count)
                    if count <= 0 { break }
                    data.append(contentsOf: buffer.prefix(count))
                }
            }
            let wire = try JSONDecoder().decode(AIVAULTTensorTransportV01.self, from: data)
            let status = Self.mode == "unauthorized" ? 401 : 200
            let receipt: [String: String] = [
                "status": "TENSOR_RECEIVED_VERIFIED", "message_id": wire.message_id,
                "tensor_id": wire.tensor.tensor_id,
                "payload_sha256": Self.mode == "wrong-hash" ? String(repeating: "0", count: 64) : wire.tensor.payload_sha256,
                "receiver_node_id": "node-b",
            ]
            let body = Self.mode == "oversize" ? Data(repeating: 65, count: 9000) :
                try JSONSerialization.data(withJSONObject: receipt)
            let response = HTTPURLResponse(url: request.url!, statusCode: status,
                httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }
    override func stopLoading() {}
}

@main
struct NativeHTTPSContract {
    static func main() async throws {
        let expiry = Date().addingTimeInterval(60)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [TensorReceiptProtocol.self]
        let client = try AIVAULTTensorHTTPSClientV01(endpoint: URL(string: "https://test.invalid/tensor")!,
            localNodeID: "node-a", peerNodeID: "node-b", accessToken: "test-only-native-token-0001",
            sessionExpiresAt: expiry, configuration: config)
        let tensor = try AIVAULTFloat32TensorV01(tensorID: "h", senderNodeID: "node-a",
            receiverNodeID: "node-b", values: [3, 6, -3])
        let wire = try AIVAULTTensorTransportV01(tensor: tensor, jobID: "j", operationID: "op-b", sessionExpiresAt: expiry)
        let other = try AIVAULTTensorTransportV01(tensor: tensor, jobID: "j", operationID: "op-b", sessionExpiresAt: expiry)
        precondition(wire.message_id != other.message_id)
        let receipt = try await client.send(wire)
        precondition(receipt.payload_sha256 == tensor.payload_sha256)
        for mode in ["wrong-hash", "unauthorized", "oversize"] {
            TensorReceiptProtocol.mode = mode
            var rejected = false
            do { _ = try await client.send(wire) } catch { rejected = true }
            precondition(rejected, "invalid receipt accepted: " + mode)
        }
        do {
            _ = try AIVAULTTensorHTTPSClientV01(endpoint: URL(string: "http://test.invalid/tensor")!,
                localNodeID: "node-a", peerNodeID: "node-b", accessToken: "test-only-native-token-0001",
                sessionExpiresAt: expiry)
            fatalError("HTTP accepted")
        } catch AIVAULTTensorTransportV01.TransportError.invalidEndpoint {}
        let wrong = try AIVAULTFloat32TensorV01(tensorID: "h", senderNodeID: "node-a",
            receiverNodeID: "node-c", values: [3, 6, -3])
        let wrongWire = try AIVAULTTensorTransportV01(tensor: wrong, jobID: "j", operationID: "op-b", sessionExpiresAt: expiry)
        let before = TensorReceiptProtocol.calls
        do { _ = try await client.send(wrongWire); fatalError("wrong peer accepted") }
        catch AIVAULTTensorTransportV01.TransportError.invalidEnvelope {}
        precondition(TensorReceiptProtocol.calls == before)
        print("CONFIRMED: native envelope, request and bounded receipt contract; URLProtocol mock only")
        print("NOT VERIFIED: native URLSession across physical devices")
    }
}
