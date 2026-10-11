import Foundation

@MainActor
private final class ControlledTransport: AIVAULTForegroundTransportV01 {
    var starts = 0, stops = 0
    var failOnStart = false
    var ready: (@MainActor (UInt16) -> Void)?
    var failure: (@MainActor () -> Void)?
    func start(onReady: @escaping @MainActor (UInt16) -> Void,
               onFailure: @escaping @MainActor () -> Void) throws {
        starts += 1; ready = onReady; failure = onFailure
        if failOnStart { throw NSError(domain:"controlled",code:1) }
    }
    func stop() { stops += 1 }
}
@main
struct ForegroundSessionTests {
    @MainActor static func main() async throws {
        let s = AIVAULTForegroundSessionV01()
        precondition(s.status == .blocked && !s.canJoin)
        s.setForeground(true); s.join(consentGranted:true)
        precondition(s.status == .blocked)
        let a = ControlledTransport()
        s.prepare(a,expiresAt:Date().addingTimeInterval(60))
        precondition(a.starts == 0 && s.canJoin)
        s.join(consentGranted:false); precondition(a.starts == 0)
        s.join(consentGranted:true); s.join(consentGranted:true)
        precondition(a.starts == 1 && s.status == .starting)
        s.setForeground(false)
        precondition(a.stops == 1 && s.status == .stopped && !s.canJoin && s.port == nil)
        a.ready?(1234); a.failure?()
        precondition(s.status == .stopped && s.port == nil)
        s.setForeground(true); s.join(consentGranted:true)
        precondition(a.starts == 1) // No resume and no reuse of consumed grant.
        let b = ControlledTransport()
        s.prepare(b,expiresAt:Date().addingTimeInterval(60)); s.join(consentGranted:true)
        a.failure?(); precondition(s.status == .starting && b.stops == 0)
        b.ready?(4321); precondition(s.status == .listening && s.port == 4321)
        s.stop(); s.stop(); precondition(b.stops == 1 && s.port == nil)
        let invalid = ControlledTransport()
        s.prepare(invalid,expiresAt:Date().addingTimeInterval(601))
        precondition(invalid.stops == 1 && s.status == .blocked)
        let thrown = ControlledTransport(); thrown.failOnStart = true
        s.prepare(thrown,expiresAt:Date().addingTimeInterval(60)); s.join(consentGranted:true)
        precondition(s.status == .failed && thrown.stops == 1)
        let failed = ControlledTransport()
        s.prepare(failed,expiresAt:Date().addingTimeInterval(60)); s.join(consentGranted:true); failed.failure?()
        precondition(s.status == .failed && failed.stops == 1)
        let expired = ControlledTransport(), expiry = Date().addingTimeInterval(60)
        s.prepare(expired,expiresAt:expiry); s.join(consentGranted:true,now:expiry)
        precondition(expired.starts == 0 && expired.stops == 1 && s.status == .expired)
        let replaced = ControlledTransport(), replacement = ControlledTransport()
        s.prepare(replaced,expiresAt:expiry); s.prepare(replacement,expiresAt:expiry)
        precondition(replaced.stops == 1 && replacement.starts == 0)
        s.join(consentGranted:true); replacement.ready?(5000); s.expire(now:expiry)
        precondition(s.status == .expired && replacement.stops == 1)
        let reentrant = ControlledTransport()
        s.prepare(reentrant,expiresAt:Date().addingTimeInterval(60))
        s.onChange = { if s.status == .starting { s.stop() } }
        s.join(consentGranted:true)
        precondition(reentrant.starts == 0 && reentrant.stops == 1)
        s.onChange = nil
        let timed = ControlledTransport()
        s.prepare(timed,expiresAt:Date().addingTimeInterval(0.02))
        try await Task.sleep(nanoseconds:100_000_000)
        precondition(s.status == .expired && timed.stops == 1)
        print("CONFIRMED: foreground lifecycle, explicit consent, no auto-resume, stale callbacks, failures, replacement and expiry")
        print("NOT VERIFIED: UIKit gestures, physical iPhone or GPU; controlled transport only")
    }
}
