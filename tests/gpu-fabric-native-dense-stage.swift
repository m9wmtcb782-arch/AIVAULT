import Foundation
import Security

private final class DenseStageTestAnchor: AIVAULTRejectTensorRedirects {
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
struct NativeDenseStageTest {
    struct Config: Decodable { let directory: String; let identityPath: String; let certDERPath: String }
    static func check(_ value: Bool, _ label: String) throws { guard value else { throw Failure.test(label) } }
    @MainActor static func start(_ listener: AIVAULTTensorTLSListenerV01, expiry: Date) async throws -> (AIVAULTForegroundSessionV01, UInt16) {
        let session=AIVAULTForegroundSessionV01()
        session.setForeground(true)
        session.prepare(AIVAULTForegroundTLSV01(listener:listener),expiresAt:expiry)
        let port: UInt16=try await withCheckedThrowingContinuation { continuation in
            session.onChange = {
                if session.status == .listening, let port=session.port {
                    session.onChange=nil; continuation.resume(returning:port)
                } else if session.status == .failed || session.status == .expired {
                    session.onChange=nil; continuation.resume(throwing:Failure.test("session start"))
                }
            }
            session.join(consentGranted:true)
        }
        return (session,port)
    }
    @MainActor static func main() async throws {
        let c=try JSONDecoder().decode(Config.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
        let directory=URL(fileURLWithPath:c.directory,isDirectory:true), expiry=Date().addingTimeInterval(120)
        guard #available(macOS 15.0, *) else { throw Failure.test("memory-only identity requires macOS15") }
        var items: CFArray?
        let options:[String:Any]=[kSecImportExportPassphrase as String:"ephemeral-ci-only",kSecImportToMemoryOnly as String:true]
        let imported=SecPKCS12Import(try Data(contentsOf:URL(fileURLWithPath:c.identityPath)) as CFData,options as CFDictionary,&items)
        guard imported == errSecSuccess, let first=(items as? [[String:Any]])?.first,
              let value=first[kSecImportItemIdentity as String] else { throw Failure.test("identity import") }
        let identity=value as! SecIdentity
        let anchor=try DenseStageTestAnchor(Data(contentsOf:URL(fileURLWithPath:c.certDERPath)))
        typealias Stage=AIVAULTPlannedDenseStageV01
        var weights:[Float]=[1,0,-1, 0,1,1, -1,-1,0, 0.5,0.5,0.5]
        let layerA=Stage.Layer(inputSize:3,outputSize:4,weights:weights,bias:[0,1,0,-0.5],activation:"relu")
        let layerB=Stage.Layer(inputSize:4,outputSize:2,weights:[1,2,-1,0.5, -1,0,1,2],bias:[0.25,-0.5],activation:"identity")
        let operations=[
            Stage.Operation(operationID:"op-a",nodeID:"node-a",inputTensorID:"x",outputTensorID:"h",dependencyID:nil,layer:layerA),
            Stage.Operation(operationID:"op-b",nodeID:"node-b",inputTensorID:"h",outputTensorID:"y",dependencyID:"op-a",layer:layerB)]
        func grant(sender: String, job: String = "native-model-job", op: String, tensor: String, shape: [Int]) -> AIVAULTTensorReceiverV01.Grant {
            .init(token:"test-native-dense-token-"+op,senderNodeID:sender,jobID:job,operationID:op,tensorID:tensor,shape:shape,expiresAt:expiry)
        }
        let gA=grant(sender:"submitter",op:"op-a",tensor:"x",shape:[3]), gB=grant(sender:"node-a",op:"op-b",tensor:"h",shape:[4])
        let configB=Stage.Configuration(localNodeID:"node-b",jobID:"native-model-job",operations:operations,incomingGrant:gB)
        let b=try Stage(configuration:configB,ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("dense-b")))
        try check(await b.snapshot().status == "WAITING_FOR_TENSOR","GPU started during configuration")
        let (sessionB,portB)=try await start(b.makeListener(identity:identity),expiry:expiry)
        defer { sessionB.stop() }
        let route=Stage.Route(endpoint:URL(string:"https://localhost:\(portB)/tensor")!,grant:gB)
        let configA=Stage.Configuration(localNodeID:"node-a",jobID:"native-model-job",operations:operations,incomingGrant:gA,next:route)
        let a=try Stage(configuration:configA,ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("dense-a")),testDelegate:anchor)
        weights[0]=999 // Caller mutation must not change trusted copied weights.
        try check(await a.snapshot().status == "WAITING_FOR_TENSOR","GPU started before input")
        let (sessionA,portA)=try await start(a.makeListener(identity:identity),expiry:expiry)
        defer { sessionA.stop() }
        let endpointA=URL(string:"https://localhost:\(portA)/tensor")!
        let client=try AIVAULTTensorHTTPSClientV01(endpoint:endpointA,localNodeID:"submitter",peerNodeID:"node-a",accessToken:gA.token,
            sessionExpiresAt:expiry,configuration:.ephemeral,testDelegate:anchor)
        let tensor=try AIVAULTFloat32TensorV01(tensorID:"x",senderNodeID:"submitter",receiverNodeID:"node-a",values:[1,2,-1])
        let wrongJob=try AIVAULTTensorTransportV01(tensor:tensor,jobID:"wrong-job",operationID:"op-a",sessionExpiresAt:expiry)
        do { _ = try await client.send(wrongJob); throw Failure.test("wrong job accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(403) {}
        let wire=try AIVAULTTensorTransportV01(tensor:tensor,jobID:"native-model-job",operationID:"op-a",sessionExpiresAt:expiry)
        _ = try await client.send(wire)
        let resultA=await a.snapshot(), resultB=await b.snapshot()
        try check(resultA.status == "PLANNED_STAGE_COMPLETED" && resultA.output == [2,2,0,0.5] && resultA.downstreamReceiptVerified,"stage A outcome")
        try check(resultB.status == "PLANNED_STAGE_COMPLETED" && resultB.output == [6.5,-1.5] && !resultB.downstreamReceiptVerified,"stage B baseline mismatch")
        do { _ = try await client.send(wire); throw Failure.test("model replay accepted") }
        catch AIVAULTTensorTransportV01.TransportError.httpFailure(409) {}

        func invalid(_ configuration: Stage.Configuration) throws {
            do { _ = try configuration.validate(); throw Failure.test("invalid graph accepted") }
            catch is Stage.StageError {}
        }
        try invalid(Stage.Configuration(localNodeID:"missing",jobID:"native-model-job",operations:operations,incomingGrant:gB))
        try invalid(Stage.Configuration(localNodeID:"node-b",jobID:"other-job",operations:operations,incomingGrant:gB))
        try invalid(Stage.Configuration(localNodeID:"node-b",jobID:"native-model-job",operations:operations,
            incomingGrant:grant(sender:"node-a",op:"op-b",tensor:"h",shape:[3])))
        try invalid(Stage.Configuration(localNodeID:"node-b",jobID:"native-model-job",operations:Array(operations.reversed()),incomingGrant:gB))
        try invalid(Stage.Configuration(localNodeID:"node-a",jobID:"native-model-job",operations:operations,incomingGrant:gA))
        try invalid(Stage.Configuration(localNodeID:"node-b",jobID:"native-model-job",operations:operations,incomingGrant:gB,next:route))
        try invalid(Stage.Configuration(localNodeID:"node-a",jobID:"native-model-job",operations:operations,incomingGrant:gA,
            next:Stage.Route(endpoint:URL(string:"http://localhost/tensor")!,grant:gB)))
        let badLayer=Stage.Layer(inputSize:3,outputSize:4,weights:[],bias:[0,0,0,0],activation:"relu")
        try invalid(Stage.Configuration(localNodeID:"node-a",jobID:"native-model-job",operations:[
            .init(operationID:"op-a",nodeID:"node-a",inputTensorID:"x",outputTensorID:"y",dependencyID:nil,layer:badLayer)],incomingGrant:gA))
        let badSender=grant(sender:"wrong-node",op:"op-b",tensor:"h",shape:[4])
        try invalid(Stage.Configuration(localNodeID:"node-b",jobID:"native-model-job",operations:operations,incomingGrant:badSender))

        // Direct actor failure-path test, NOT transport evidence: wrong downstream
        // job cannot yield a completed stage, and a new message cannot retry it.
        let failA=grant(sender:"submitter",job:"failed-model-job",op:"op-a",tensor:"x",shape:[3])
        let failB=grant(sender:"node-a",job:"failed-model-job",op:"op-b",tensor:"h",shape:[4])
        let failed=try Stage(configuration:.init(localNodeID:"node-a",jobID:"failed-model-job",operations:operations,incomingGrant:failA,
            next:.init(endpoint:route.endpoint,grant:failB)),ledger:AIVAULTTensorReplayLedgerV01(directory:directory.appendingPathComponent("dense-failed")),testDelegate:anchor)
        let failWire=try AIVAULTTensorTransportV01(tensor:tensor,jobID:"failed-model-job",operationID:"op-a",sessionExpiresAt:expiry)
        let headers=["authorization":"Bearer "+failA.token,"content-type":"application/json","x-aivault-sender-node":"submitter","x-aivault-receiver-node":"node-a"]
        try check(await failed.receiver.receive(body:JSONEncoder().encode(failWire),headers:headers).statusCode == 500,"forwarding failure reported completed")
        try check(await failed.snapshot().status == "FAILED_REQUIRES_NEW_JOB","failure state")
        let freshMessage=try AIVAULTTensorTransportV01(tensor:tensor,jobID:"failed-model-job",operationID:"op-a",sessionExpiresAt:expiry)
        try check(await failed.receiver.receive(body:JSONEncoder().encode(freshMessage),headers:headers).statusCode == 409,"failed stage retried")
        sessionA.setForeground(false); sessionB.setForeground(false)
        print("CONFIRMED: immutable native graph -> native Metal Dense A -> native URLSession TLS -> native NWListener -> native Metal Dense B; y=[6.5,-1.5]")
        print("CONFIRMED: grants/graph/dimensions/routes pinned, no pre-input GPU, replay denied, failed forwarding stays consumed")
        print("NOT VERIFIED: two physical GPUs, iPhone install or trusted provisioning service; one macOS runner device="+(resultA.deviceName ?? "unknown"))
    }
}
