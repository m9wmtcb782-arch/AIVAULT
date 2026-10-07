import Foundation
import WebKit

public final class AIVAULTWebBridge: NSObject, WKScriptMessageHandler {
    public static let messageHandlerName = "aivaultNativeWorker"

    private let hardwareJSON: String

    public init(hardware: AIVAULTNativeHardware = AIVAULTNativeHardwareCollector.collect()) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        hardwareJSON = (try? encoder.encode(hardware))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
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
        controller.add(self, name: Self.messageHandlerName)
    }

    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        // Reserved for native registration/heartbeat/task execution.
        // v1 does not execute remote work from JavaScript messages.
    }
}
