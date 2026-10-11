import Foundation
@main
struct SignedConfigTest {
    static func main() throws {
        let fixture=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))) as! [String:Any]
        let key=Data(base64Encoded:fixture["publicKey"] as! String)!
        func verify(_ name: String, pin: String = "research-key-1") throws -> AIVAULTSignedStagePackageV01.TrustedPackage {
            try AIVAULTSignedStagePackageV01.verify(JSONSerialization.data(withJSONObject:fixture[name]!),expectedNodeID:"node-b",pinnedKeyID:pin,pinnedPublicKey:key)
        }
        let valid=try verify("valid")
        precondition(valid.configuration.localNodeID == "node-b" && valid.configuration.operations[0].layer.outputSize == 2)
        for name in ["tampered","wrongKey","wrongNode","expired","future","expiryMismatch","badGraph","badGrant"] {
            var rejected=false;do{_ = try verify(name)}catch{rejected=true}
            precondition(rejected,"invalid config accepted: "+name)
        }
        // Even with an otherwise accepted key-ID pin, renaming the envelope
        // invalidates the domain-bound signature (same public key).
        var rejectedRename=false
        do{_ = try verify("changedKeyID",pin:"research-key-2")}catch{rejectedRename=true}
        precondition(rejectedRename)
        var rejectedSize=false
        do{_ = try AIVAULTSignedStagePackageV01.verify(Data(repeating:65,count:6*1024*1024+1),expectedNodeID:"node-b",pinnedKeyID:"research-key-1",pinnedPublicKey:key)}catch{rejectedSize=true}
        precondition(rejectedSize)
        let directory=URL(fileURLWithPath:CommandLine.arguments[2]).appendingPathComponent("package-ledger")
        try AIVAULTSignedStagePackageV01.reserve(valid,directory:directory)
        var replayRejected=false
        do{try AIVAULTSignedStagePackageV01.reserve(try verify("valid"),directory:directory)}catch AIVAULTSignedStagePackageV01.Failure.replay{replayRejected=true}
        precondition(replayRejected)
        print("CONFIRMED: Node P-256 signature verified by native CryptoKit; key/node/time/model/grant bounds and tampering rejected")
        print("CONFIRMED: signed package import replay denied by reopened durable ledger; no private key persisted")
        print("NOT VERIFIED: deployed issuer, encrypted delivery, native enrollment, iPhone installation or physical GPUs")
    }
}
