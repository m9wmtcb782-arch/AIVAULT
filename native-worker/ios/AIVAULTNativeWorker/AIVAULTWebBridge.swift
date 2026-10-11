import Foundation
import Metal
import WebKit

/// Narrow WebKit bridge for locally consented, allowlisted Metal smoke operations.
/// This does not register a worker, accept remote jobs, or transfer tensors.
public final class AIVAULTWebBridge: NSObject, WKScriptMessageHandlerWithReply {
    public static let messageHandlerName = "aivaultNativeWorker"
    private static let trustedHost = "m9wmtcb782-arch.github.io"
    private static let maxElements = 4096

    private let hardwareJSON: String
    private let metalCompute: AIVAULTMetalCompute?

    public init(hardware: AIVAULTNativeHardware = AIVAULTNativeHardwareCollector.collect()) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        hardwareJSON = (try? encoder.encode(hardware))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        metalCompute = try? AIVAULTMetalCompute()
        super.init()
    }

    public func install(on configuration: WKWebViewConfiguration) {
        let controller = configuration.userContentController
        let script = WKUserScript(
            source: "window.aivaultNativeHardware = " + hardwareJSON + ";",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        controller.addUserScript(script)
        controller.addScriptMessageHandler(self, contentWorld: .page, name: Self.messageHandlerName)
    }

    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == Self.trustedHost else {
            replyHandler(nil, "untrusted_origin")
            return
        }
        guard let body = message.body as? [String: Any],
              body["type"] as? String == "gpuFabric.execute" else {
            replyHandler(nil, "invalid_message")
            return
        }
        guard let metalCompute else {
            replyHandler(nil, "metal_unavailable")
            return
        }
        guard let operation = body["operation"] as? String,
              operation == "mul_scalar" || operation == "add_scalar",
              let rawInput = body["input"] as? [NSNumber],
              !rawInput.isEmpty,
              rawInput.count <= Self.maxElements,
              let rawScalar = body["scalar"] as? NSNumber else {
            replyHandler(nil, "invalid_operation_or_input")
            return
        }

        let input = rawInput.map { $0.floatValue }
        let scalar = rawScalar.floatValue
        guard input.allSatisfy({ $0.isFinite }),
              scalar.isFinite else {
            replyHandler(nil, "non_finite_input")
            return
        }

        do {
            let result = try metalCompute.execute(operation: operation, input: input, scalar: scalar)
            replyHandler([
                "status": "LOCAL_METAL_EXECUTED",
                "operation": result.operation,
                "device_name": result.deviceName,
                "element_count": result.elementCount,
                "output": result.output
            ], nil)
        } catch {
            replyHandler(nil, "metal_execution_failed: \(error.localizedDescription)")
        }
    }
}
