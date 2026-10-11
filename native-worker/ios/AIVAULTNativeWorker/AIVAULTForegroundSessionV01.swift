import Foundation

/// Trusted native transport only. No web page may configure or start it.
@MainActor
protocol AIVAULTForegroundTransportV01: AnyObject {
    func start(onReady: @escaping @MainActor (UInt16) -> Void,
               onFailure: @escaping @MainActor () -> Void) throws
    /// Must revoke receiver admission synchronously, then close sockets.
    func stop()
}

/// One opt-in foreground session, one fresh grant/listener. No automatic resume.
@MainActor
final class AIVAULTForegroundSessionV01 {
    enum Status: String { case blocked, prepared, starting, listening, stopped, expired, failed }
    private(set) var status: Status = .blocked
    private(set) var port: UInt16?
    private(set) var foreground = false
    var onChange: (() -> Void)?
    private var transport: AIVAULTForegroundTransportV01?
    private var expiresAt: Date?
    private var generation: UInt64 = 0
    private var expiryTask: Task<Void, Never>?
    var canJoin: Bool { foreground && status == .prepared }
    var canStop: Bool { transport != nil }

    /// Provisioning is a trusted native action, separate from consent.
    func prepare(_ candidate: AIVAULTForegroundTransportV01, expiresAt expiry: Date, now: Date = Date()) {
        stop()
        let duration = expiry.timeIntervalSince(now)
        guard duration.isFinite, duration > 0, duration <= 600 else {
            candidate.stop(); status = .blocked; notify(); return
        }
        transport = candidate; expiresAt = expiry; status = .prepared
        let epoch = generation
        expiryTask = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000)) }
            catch { return }
            guard let self, self.generation == epoch else { return }
            self.stop(reason: .expired)
        }
        notify()
    }
    func setForeground(_ active: Bool) {
        foreground = active
        if !active { stop() } else { notify() }
    }
    /// Consent must be supplied for each new grant/session by the native UI.
    func join(consentGranted: Bool, now: Date = Date()) {
        guard consentGranted, canJoin, let transport, let expiresAt else { return }
        guard expiresAt > now else { stop(reason: .expired); return }
        status = .starting; notify()
        let epoch = generation
        do {
            try transport.start(onReady: { [weak self] port in
                guard let self, self.generation == epoch, self.foreground, self.status == .starting else { return }
                guard self.expiresAt.map({ $0 > Date() }) == true else { self.stop(reason: .expired); return }
                self.port = port; self.status = .listening; self.notify()
            }, onFailure: { [weak self] in
                guard let self, self.generation == epoch else { return }
                self.stop(reason: .failed)
            })
        } catch { if generation == epoch { stop(reason: .failed) } }
    }
    func expire(now: Date = Date()) {
        if let expiry = expiresAt, now >= expiry { stop(reason: .expired) }
    }
    func stop(reason: Status = .stopped) {
        generation &+= 1 // Invalidates late ready/failure callbacks before revocation.
        expiryTask?.cancel(); expiryTask = nil
        let old = transport
        transport = nil; expiresAt = nil; port = nil
        if old != nil { status = reason }
        old?.stop()
        notify()
    }
    private func notify() { onChange?() }
}
