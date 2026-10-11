import Foundation

/// Adapts the existing TLS listener; it never provisions certificates or grants.
@MainActor
final class AIVAULTForegroundTLSV01: AIVAULTForegroundTransportV01 {
    private let listener: AIVAULTTensorTLSListenerV01
    init(listener: AIVAULTTensorTLSListenerV01) { self.listener = listener }
    func start(onReady: @escaping @MainActor (UInt16) -> Void,
               onFailure: @escaping @MainActor () -> Void) throws {
        try listener.start(consentGranted: true, onReady: { port in
            Task { @MainActor in onReady(port) }
        }, onFailure: { _ in
            Task { @MainActor in onFailure() }
        })
    }
    func stop() { listener.stop() }
}
