import Foundation
import Security
import Metal

private actor Received {
    var calls = 0
    var output: [Float] = []
    func record(_ values: [Float]) { calls += 1; output = values }
    func snapshot() -> (Int, [Float]) { (calls, output) }
}
private final class ReceiveTestAnchor: AIVAULTRejectTensorRedirects {
    let certificate: SecCertificate
    init(_ der: Data) throws {
        guard let cert = SecCertificateCreateWithData(nil, der as CFData) else { throw Failure.test("certificate") }
        certificate = cert
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else { completionHandler(.performDefaultHandling, nil); return }
        guard SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, challenge.protectionSpace.host as CFString)) == errSecSuccess,
              SecTrustSetAnchorCertificates(trust, [certificate] as CFArray) == errSecSuccess,
              SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess,
              SecTrustEvaluateWithError(trust, nil) else { completionHandler(.cancelAuthenticationChallenge, nil); return }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}
private enum Failure: Error { case test(String) }
@main
struct NativeReceiverTest {
    struct Config: Decodable { let directory: String; let identityPath: String; let certDERPath: String }
    static func check(_ value: Bool, _ label: String) throws {
        guard value else { throw Failure.test(label) }
    }
    @MainActor static func main() async throws {
        let config = try JSONDecoder().decode(Config.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let directory = URL(fileURLWithPath: config.directory, isDirectory: true)
        let expiry = Date().addingTimeInterval(120)
        let token = "native-receiver-test-token-0001"
        func grant(_ token: String = "native-receiver-test-token-0001", operation: String = "op-b") -> AIVAULTTensorReceiverV01.Grant {
            .init(token: token, senderNodeID: "node-a", jobID: "native-receive-job", operationID: operation,
                  tensorID: "h", shape: [3], expiresAt: expiry)
        }
        func wire(operation: String = "op-b", job: String = "native-receive-job") throws -> AIVAULTTensorTransportV01 {
            let tensor = try AIVAULTFloat32TensorV01(tensorID: "h", senderNodeID: "node-a", receiverNodeID: "node-b", values: [3,6,-3])
            return try AIVAULTTensorTransportV01(tensor: tensor, jobID: job, operationID: operation, sessionExpiresAt: expiry)
        }
        let headers = ["authorization": "Bearer " + token, "content-type": "application/json",
                       "x-aivault-sender-node": "node-a", "x-aivault-receiver-node": "node-b"]
        let badID = AIVAULTTensorReceiverV01.Grant(token:token,senderNodeID:"node-a",jobID:"bad\n",
            operationID:"op-b",tensorID:"h",shape:[3],expiresAt:expiry)
        do {
            _ = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:badID,
                ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("bad-id-ledger")),
                onTensor:{ _,_ in throw Failure.test("invalid ID executed") })
            throw Failure.test("newline grant ID accepted")
        } catch AIVAULTTensorReceiverV01.ConfigurationError.invalidGrant {}
        let body = try JSONEncoder().encode(wire())
        func raw(_ extras: String = "", body: Data? = nil, length: String? = nil) -> Data {
            let data = body ?? Data("{}".utf8)
            return Data(("POST /tensor HTTP/1.1\r\nHost: localhost\r\nContent-Length: " + (length ?? String(data.count)) + "\r\n" + extras + "\r\n").utf8) + data
        }
        var parser = try AIVAULTTensorHTTPRequestV01()
        let request = raw()
        try check(try parser.append(request.prefix(7)) == nil, "fragment read prematurely complete")
        try check(try parser.append(request.dropFirst(7))?.body == Data("{}".utf8), "fragment parser")
        let invalidHTTP: [(Data, Int)] = [
            (raw("Transfer-Encoding: chunked\r\n"),400), (raw("content-length: 2\r\n"),400),
            (raw("Content-Encoding: gzip\r\n"),400), (raw("Expect: 100-continue\r\n"),400),
            (raw(length:"99999999999999999999"),400), (raw(length:"2000000"),413),
            (request + Data("extra".utf8),400), (Data(repeating:65,count:8193),431),
            (Data("GET /tensor HTTP/1.1\r\nHost: localhost\r\nContent-Length: 2\r\n\r\n{}".utf8),404),
            (Data("POST /tensor HTTP/1.1\r\nContent-Length: 2\r\n\r\n{}".utf8),400),
        ]
        for (data,status) in invalidHTTP {
            var p = try AIVAULTTensorHTTPRequestV01()
            do { _ = try p.append(data); throw Failure.test("bad HTTP accepted") }
            catch let error as AIVAULTTensorHTTPRequestV01.Failure { try check(error.statusCode == status,"HTTP status") }
        }
        let state = Received()
        let ledgerPath = directory.appendingPathComponent("core-ledger")
        let receiver = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant(),
            ledger: AIVAULTTensorReplayLedgerV01(directory:ledgerPath),onTensor: { tensor,_ in
                try await state.record(tensor.verifiedValues(expectedReceiverNodeID:"node-b"))
            })
        var invalidMessage = try JSONSerialization.jsonObject(with:body) as! [String:Any]
        invalidMessage["message_id"] = "invalid\n"
        try check(await receiver.receive(body:JSONSerialization.data(withJSONObject:invalidMessage),headers:headers).statusCode == 400,"newline message ID")
        var badHeaders = headers; badHeaders["authorization"] = "Bearer bad-token-native-test-0001"
        try check(await receiver.receive(body:body,headers:badHeaders).statusCode == 401,"bad token")
        badHeaders = headers; badHeaders["x-aivault-sender-node"] = "wrong-node"
        try check(await receiver.receive(body:body,headers:badHeaders).statusCode == 403,"bad peer")
        let wrongJob = try JSONEncoder().encode(wire(job:"wrong-job"))
        try check(await receiver.receive(body:wrongJob,headers:headers).statusCode == 403,"bad job")
        var corrupted = try JSONSerialization.jsonObject(with:body) as! [String:Any]
        var tensor = corrupted["tensor"] as! [String:Any]; tensor["payload_sha256"] = String(repeating:"a",count:64)
        corrupted["tensor"] = tensor
        let badHash = try JSONSerialization.data(withJSONObject:corrupted)
        try check(await receiver.receive(body:badHash,headers:headers).statusCode == 400,"bad hash")
        corrupted = try JSONSerialization.jsonObject(with:body) as! [String:Any]
        corrupted["expires_at"] = AIVAULTTensorTransportV01.timestamp(Date().addingTimeInterval(-1))
        try check(await receiver.receive(body:JSONSerialization.data(withJSONObject:corrupted),headers:headers).statusCode == 400,"expiry")
        async let one = receiver.receive(body:body,headers:headers)
        async let two = receiver.receive(body:body,headers:headers)
        let codes = await [one.statusCode,two.statusCode].sorted()
        try check(codes == [200,409],"concurrent duplicate")
        try check(await state.snapshot().0 == 1,"duplicate backend execution")
        let restartedState = Received()
        let restarted = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant("rotated-native-receiver-token-0002"),
            ledger:AIVAULTTensorReplayLedgerV01(directory:ledgerPath),onTensor:{ _,_ in await restartedState.record([]) })
        var rotatedHeaders = headers; rotatedHeaders["authorization"] = "Bearer rotated-native-receiver-token-0002"
        try check(await restarted.receive(body:JSONEncoder().encode(wire()),headers:rotatedHeaders).statusCode == 409,"restart replay")
        try check(await restartedState.snapshot().0 == 0,"restart executed")
        let stopped = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant(operation:"stopped"),
            ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("stop-ledger")),onTensor:{ _,_ in throw Failure.test("stopped executed") })
        stopped.revoke()
        try check(await stopped.receive(body:JSONEncoder().encode(wire(operation:"stopped")),headers:headers).statusCode == 503,"revoked receiver")
        let failed = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant(operation:"failed"),
            ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("failed-ledger")),onTensor:{ _,_ in throw Failure.test("backend error") })
        let failureBody = try JSONEncoder().encode(wire(operation:"failed"))
        let backendFailure = await failed.receive(body:failureBody,headers:headers)
        try check(backendFailure.statusCode == 500,"backend failure status=\(backendFailure.statusCode) body=\(String(data:backendFailure.body,encoding:.utf8) ?? "")")
        try check(await failed.receive(body:failureBody,headers:headers).statusCode == 409,"failed replay")
        let storagePath = directory.appendingPathComponent("storage-ledger")
        let storageState = Received()
        let storage = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant(operation:"storage"),
            ledger:AIVAULTTensorReplayLedgerV01(directory:storagePath),onTensor:{ _,_ in await storageState.record([]) })
        try FileManager.default.removeItem(at:storagePath)
        try Data("not-a-directory".utf8).write(to:storagePath)
        let storageResponse = await storage.receive(body:try JSONEncoder().encode(wire(operation:"storage")),headers:headers)
        try check(storageResponse.statusCode == 503,"storage failure status=\(storageResponse.statusCode) body=\(String(data:storageResponse.body,encoding:.utf8) ?? "")")
        try check(await storageState.snapshot().0 == 0,"storage failure executed")
        print("CONFIRMED: native HTTP bounds, task/peer/hash/expiry rejection, concurrency, revoke and restart replay")

        // Only ephemeral in-memory import: no persistent Keychain mutation.
        guard #available(macOS 15.0, *) else { throw Failure.test("memory-only identity import requires macOS 15") }
        var items: CFArray?
        let options: [String:Any] = [kSecImportExportPassphrase as String:"ephemeral-ci-only", kSecImportToMemoryOnly as String:true]
        let imported = SecPKCS12Import(try Data(contentsOf:URL(fileURLWithPath:config.identityPath)) as CFData,
                                      options as CFDictionary,&items)
        guard imported == errSecSuccess, let first = (items as? [[String:Any]])?.first,
              let item = first[kSecImportItemIdentity as String] else { throw Failure.test("identity import status \(imported)") }
        let identity = item as! SecIdentity
        guard let device = MTLCreateSystemDefaultDevice() else { throw Failure.test("BLOCKED: no Metal device") }
        // Actual loopback TLS listener owned by the foreground controller.
        // Stop BEFORE reservation; a valid new tensor must not execute.
        let probeState = Received()
        let probeReceiver = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant(operation:"foreground-probe"),
            ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("foreground-ledger")),
            onTensor:{ _,_ in await probeState.record([]) })
        let probeListener = try AIVAULTTensorTLSListenerV01(identity:identity,receiver:probeReceiver)
        let foregroundSession = AIVAULTForegroundSessionV01()
        foregroundSession.setForeground(true)
        foregroundSession.prepare(AIVAULTForegroundTLSV01(listener:probeListener),expiresAt:expiry)
        let probePort: UInt16 = try await withCheckedThrowingContinuation { continuation in
            foregroundSession.onChange = {
                if foregroundSession.status == .listening, let port=foregroundSession.port {
                    foregroundSession.onChange=nil; continuation.resume(returning:port)
                } else if foregroundSession.status == .failed || foregroundSession.status == .expired {
                    foregroundSession.onChange=nil; continuation.resume(throwing:Failure.test("foreground TLS start failed"))
                }
            }
            foregroundSession.join(consentGranted:true)
        }
        foregroundSession.setForeground(false)
        foregroundSession.setForeground(true)
        try check(foregroundSession.status == .stopped && !foregroundSession.canJoin,"foreground auto-resumed")
        let probeEndpoint=URL(string:"https://localhost:\(probePort)/tensor")!
        let probeDelegate=try ReceiveTestAnchor(Data(contentsOf:URL(fileURLWithPath:config.certDERPath)))
        let probeClient=try AIVAULTTensorHTTPSClientV01(endpoint:probeEndpoint,localNodeID:"node-a",peerNodeID:"node-b",accessToken:token,
            sessionExpiresAt:expiry,configuration:.ephemeral,testDelegate:probeDelegate)
        let probeWire=try wire(operation:"foreground-probe")
        var probeRejected=false
        do { _ = try await probeClient.send(probeWire) } catch { probeRejected=true }
        let probeCalls = await probeState.snapshot().0
        try check(probeRejected && probeCalls == 0,"foreground stop admitted GPU callback")
        print("CONFIRMED: foreground session starts actual native TLS and revokes on inactivity; fresh valid tensor cannot execute; no automatic resume")

        let nativeState = Received()
        let nativeReceiver = try AIVAULTTensorReceiverV01(localNodeID:"node-b",grant:grant(),
            ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("tls-ledger")),onTensor:{ tensor,_ in
                let values = try tensor.verifiedValues(expectedReceiverNodeID:"node-b")
                let result = try AIVAULTMetalCompute(device:device).execute(operation:"add_scalar",input:values,scalar:2)
                await nativeState.record(result.output)
            })
        let listener = try AIVAULTTensorTLSListenerV01(identity:identity,receiver:nativeReceiver)
        do { try listener.start(consentGranted:false,onReady:{ _ in },onFailure:{ _ in }); throw Failure.test("missing consent accepted") }
        catch AIVAULTTensorTLSListenerV01.ListenerError.consentRequired {}
        let port: UInt16 = try await withCheckedThrowingContinuation { continuation in
            do { try listener.start(consentGranted:true,onReady:{continuation.resume(returning:$0)},onFailure:{continuation.resume(throwing:$0)}) }
            catch { continuation.resume(throwing:error) }
        }
        defer { listener.stop() }
        let endpoint = URL(string:"https://localhost:\(port)/tensor")!
        let input = try AIVAULTMetalCompute(device:device).execute(operation:"mul_scalar",input:[1,2,-1],scalar:3)
        let payload = try AIVAULTFloat32TensorV01(tensorID:"h",senderNodeID:"node-a",receiverNodeID:"node-b",values:input.output)
        let nativeWire = try AIVAULTTensorTransportV01(tensor:payload,jobID:"native-receive-job",operationID:"op-b",sessionExpiresAt:expiry)
        let delegate = try ReceiveTestAnchor(Data(contentsOf:URL(fileURLWithPath:config.certDERPath)))
        func client(_ url: URL, trusted: Bool = true, accessToken: String? = nil) throws -> AIVAULTTensorHTTPSClientV01 {
            if !trusted { return try AIVAULTTensorHTTPSClientV01(endpoint:url,localNodeID:"node-a",peerNodeID:"node-b",accessToken:accessToken ?? token,sessionExpiresAt:expiry) }
            return try AIVAULTTensorHTTPSClientV01(endpoint:url,localNodeID:"node-a",peerNodeID:"node-b",accessToken:accessToken ?? token,
                sessionExpiresAt:expiry,configuration:.ephemeral,testDelegate:delegate)
        }
        var untrusted = false
        do { _ = try await client(endpoint,trusted:false).send(nativeWire) } catch { untrusted = true }
        try check(untrusted,"system trust accepted ephemeral identity")
        let trusted = try client(endpoint)
        _ = try await trusted.send(nativeWire)
        let result = await nativeState.snapshot()
        try check(result.0 == 1 && result.1 == [5,8,-1],"native TLS Metal result")
        do { _ = try await trusted.send(nativeWire); throw Failure.test("TLS replay accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(409) {}
        do { _ = try await client(endpoint,accessToken:"invalid-receiver-token-9999").send(nativeWire); throw Failure.test("TLS bad token accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(401) {}
        let wrongTLSJob = try AIVAULTTensorTransportV01(tensor:payload,jobID:"wrong-job",operationID:"op-b",sessionExpiresAt:expiry)
        do { _ = try await trusted.send(wrongTLSJob); throw Failure.test("TLS bad job accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(403) {}
        let mismatch = URL(string:"https://127.0.0.1:\(port)/tensor")!
        var rejectedHostname = false
        do { _ = try await client(mismatch).send(nativeWire) } catch { rejectedHostname = true }
        try check(rejectedHostname,"hostname accepted")
        listener.stop()
        print("CONFIRMED: local Metal -> native URLSession -> native NWListener TLS -> local Metal; y=[5,8,-1]")
        print("NOT VERIFIED: physical iPhone, two physical GPUs or foreground app integration; device=" + device.name)
    }
}
