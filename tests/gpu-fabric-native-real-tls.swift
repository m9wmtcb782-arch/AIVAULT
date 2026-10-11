import Foundation
import Security
import Metal

// Test-only trust provisioning: evaluate a supplied ephemeral CA with the
// actual endpoint hostname and normal certificate checks. Never accept blindly.
final class TestAnchorDelegate: AIVAULTRejectTensorRedirects {
    let certificate: SecCertificate
    init(der: Data) throws {
        guard let cert = SecCertificateCreateWithData(nil, der as CFData) else {
            throw NSError(domain: "test-anchor", code: 1)
        }
        certificate = cert
    }
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil); return
        }
        let policy = SecPolicyCreateSSL(true, challenge.protectionSpace.host as CFString)
        guard SecTrustSetPolicies(trust, policy) == errSecSuccess,
              SecTrustSetAnchorCertificates(trust, [certificate] as CFArray) == errSecSuccess,
              SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess,
              SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil); return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}

@main
struct NativeRealTLS {
    struct Config: Decodable { let endpoint: String; let certDERPath: String; let token: String; let expiresAt: Double }
    static func main() async throws {
        let config = try JSONDecoder().decode(Config.self,
            from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let endpoint = URL(string: config.endpoint)!
        let expiry = Date(timeIntervalSince1970: config.expiresAt / 1000)
        let delegate = try TestAnchorDelegate(der: Data(contentsOf: URL(fileURLWithPath: config.certDERPath)))
        func client(_ url: URL, token: String? = nil, systemTrust: Bool = false) throws -> AIVAULTTensorHTTPSClientV01 {
            if systemTrust {
                return try AIVAULTTensorHTTPSClientV01(endpoint: url, localNodeID: "metal-native",
                    peerNodeID: "node-b", accessToken: token ?? config.token, sessionExpiresAt: expiry)
            }
            return try AIVAULTTensorHTTPSClientV01(endpoint: url, localNodeID: "metal-native",
                peerNodeID: "node-b", accessToken: token ?? config.token, sessionExpiresAt: expiry,
                configuration: .ephemeral, testDelegate: delegate)
        }
        guard let device = MTLCreateSystemDefaultDevice() else {
            fputs("BLOCKED: no Metal device\n", stderr); exit(2)
        }
        let result = try AIVAULTMetalCompute(device: device).execute(operation: "mul_scalar", input: [1, 2, -1], scalar: 3)
        let tensor = try AIVAULTFloat32TensorV01(tensorID: "h", senderNodeID: "metal-native",
            receiverNodeID: "node-b", values: result.output)
        let wire = try AIVAULTTensorTransportV01(tensor: tensor, jobID: "native-tls-job",
            operationID: "op-b", sessionExpiresAt: expiry)
        var untrustedRejected = false
        do { _ = try await client(endpoint, systemTrust: true).send(wire) }
        catch { untrustedRejected = true }
        precondition(untrustedRejected, "system trust accepted an untrusted test certificate")
        let trusted = try client(endpoint)
        let receipt = try await trusted.send(wire)
        precondition(receipt.payload_sha256 == tensor.payload_sha256)
        do { _ = try await trusted.send(wire); fatalError("replay accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(409) {}
        do { _ = try await client(endpoint, token: "invalid-native-test-token-0001").send(wire); fatalError("bad token accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(401) {}
        let wrongJob = try AIVAULTTensorTransportV01(tensor: tensor, jobID: "wrong-job",
            operationID: "op-b", sessionExpiresAt: expiry)
        do { _ = try await trusted.send(wrongJob); fatalError("wrong job accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(403) {}
        let base = endpoint.deletingLastPathComponent()
        do { _ = try await client(base.appendingPathComponent("redirect")).send(wire); fatalError("redirect followed") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(307) {}
        do { _ = try await client(base.appendingPathComponent("bad-receipt")).send(wire); fatalError("wrong receipt accepted") }
        catch AIVAULTTensorTransportV01.TransportError.invalidReceipt {}
        do { _ = try await client(base.appendingPathComponent("large")).send(wire); fatalError("large receipt accepted") }
        catch AIVAULTTensorTransportV01.TransportError.receiptTooLarge {}
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.host = "127.0.0.1"
        var hostnameRejected = false
        do { _ = try await client(components.url!).send(wire) }
        catch { hostnameRejected = true }
        precondition(hostnameRejected, "certificate hostname mismatch accepted")
        print("CONFIRMED: Metal output -> native URLSession -> actual loopback TLS -> authenticated Node receiver")
        print("CONFIRMED: untrusted cert, hostname mismatch, replay, bad token/job, redirect and invalid/oversized receipts rejected")
        print("NOT VERIFIED: physical iPhone and two physical GPUs; device=" + result.deviceName)
    }
}
