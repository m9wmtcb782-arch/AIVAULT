import Foundation
import Network
import Security

/// Deliberately narrow HTTP/1.1 parser: one POST /tensor, Content-Length only.
/// No chunking, compression, duplicate headers, pipelining or persistent sockets.
public struct AIVAULTTensorHTTPRequestV01 {
    public struct Request { public let headers: [String: String]; public let body: Data }
    public struct Failure: Error { public let statusCode: Int }
    private var bytes = Data()
    private let maxBodyBytes: Int
    public init(maxTensorBytes: Int = 1024 * 1024) throws {
        guard maxTensorBytes > 0, maxTensorBytes <= 64 * 1024 * 1024 else { throw Failure(statusCode: 400) }
        maxBodyBytes = ((maxTensorBytes + 2) / 3) * 4 + 8192
    }
    public mutating func append(_ data: Data) throws -> Request? {
        guard data.count <= maxBodyBytes + 8192 - bytes.count else { throw Failure(statusCode: 413) }
        bytes.append(data)
        guard let delimiter = bytes.range(of: Data([13, 10, 13, 10])) else {
            if bytes.count > 8192 { throw Failure(statusCode: 431) }
            return nil
        }
        guard delimiter.upperBound <= 8192,
              let header = String(data: bytes.prefix(delimiter.lowerBound), encoding: .ascii) else {
            throw Failure(statusCode: 431)
        }
        let lines = header.components(separatedBy: "\r\n")
        guard lines.first == "POST /tensor HTTP/1.1" else { throw Failure(statusCode: 404) }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { throw Failure(statusCode: 400) }
            let name = String(line[..<colon]).lowercased()
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty,
                  name.range(of: "^[a-z0-9-]+$", options: .regularExpression) != nil,
                  !value.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }),
                  headers[name] == nil else { throw Failure(statusCode: 400) }
            headers[name] = value
        }
        guard headers["transfer-encoding"] == nil, headers["content-encoding"] == nil,
              headers["expect"] == nil, headers["host"]?.isEmpty == false,
              let declared = headers["content-length"], !declared.isEmpty,
              declared.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }),
              let length = Int(declared), length > 0 else { throw Failure(statusCode: 400) }
        guard length <= maxBodyBytes else { throw Failure(statusCode: 413) }
        let total = delimiter.upperBound + length
        guard bytes.count <= total else { throw Failure(statusCode: 400) }
        guard bytes.count == total else { return nil }
        return Request(headers: headers, body: bytes.subdata(in: delimiter.upperBound..<total))
    }
}

/// Research HTTPS listener. Explicit start + caller-provisioned identity only.
/// Default bind is loopback; app foreground consent/lifecycle wiring is pending.
/// It never installs certificates or relaxes the sender's TLS trust checks.
public final class AIVAULTTensorTLSListenerV01 {
    public enum ListenerError: Error { case invalidIdentity, consentRequired }
    private let listener: NWListener
    private let receiver: AIVAULTTensorReceiverV01
    private let queue = DispatchQueue(label: "aivault.tensor-tls.v01")
    private let maxTensorBytes: Int
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    private var started = false
    private var stopped = false
    public init(identity: SecIdentity, receiver: AIVAULTTensorReceiverV01,
                bindHost: String = "127.0.0.1", port: UInt16 = 0,
                maxTensorBytes: Int = 1024 * 1024) throws {
        _ = try AIVAULTTensorHTTPRequestV01(maxTensorBytes: maxTensorBytes)
        guard let localIdentity = sec_identity_create(identity) else { throw ListenerError.invalidIdentity }
        let tls = NWProtocolTLS.Options()
        sec_protocol_options_set_min_tls_protocol_version(tls.securityProtocolOptions, .TLSv12)
        sec_protocol_options_set_local_identity(tls.securityProtocolOptions, localIdentity)
        let parameters = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
        let requestedPort = port == 0 ? NWEndpoint.Port.any : NWEndpoint.Port(rawValue: port)!
        parameters.requiredLocalEndpoint = .hostPort(host: NWEndpoint.Host(bindHost), port: requestedPort)
        listener = try NWListener(using: parameters, on: requestedPort)
        self.receiver = receiver; self.maxTensorBytes = maxTensorBytes
    }
    /// Ready callback reports the actual bound port; no GPU work starts here.
    public func start(consentGranted: Bool, onReady: @escaping (UInt16) -> Void,
                      onFailure: @escaping (Error) -> Void) throws {
        guard consentGranted else { throw ListenerError.consentRequired }
        queue.async {
            guard !self.started, !self.stopped else { return }
            self.started = true
            self.listener.stateUpdateHandler = { state in
                switch state {
                case .ready: if let port = self.listener.port { onReady(port.rawValue) }
                case .failed(let error): onFailure(error); self.stop()
                default: break
                }
            }
            self.listener.newConnectionHandler = { connection in
                guard !self.stopped, self.connections.count < 8 else { connection.cancel(); return }
                self.accept(connection)
            }
            self.listener.start(queue: self.queue)
        }
    }
    /// Closes admission/sockets. An already-reserved callback may finish; never
    /// reuse this instance or assume cancellation rolled back a computation.
    public func stop() {
        receiver.revoke()
        queue.async {
            self.stopped = true
            self.listener.cancel()
            self.connections.values.forEach { $0.cancel() }
            self.connections.removeAll()
        }
    }
    private final class Incoming {
        var parser: AIVAULTTensorHTTPRequestV01
        var done = false
        init(maxBytes: Int) throws { parser = try AIVAULTTensorHTTPRequestV01(maxTensorBytes: maxBytes) }
    }
    private func accept(_ connection: NWConnection) {
        let id = ObjectIdentifier(connection)
        guard let incoming = try? Incoming(maxBytes: maxTensorBytes) else { connection.cancel(); return }
        connections[id] = connection
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .failed, .cancelled: self?.connections.removeValue(forKey: id)
            default: break
            }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 15) { [weak self] in
            if self?.connections[id] != nil { incoming.done = true; connection.cancel() }
        }
        read(connection, incoming)
    }
    private func read(_ connection: NWConnection, _ incoming: Incoming) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] data, _, complete, error in
            guard let self = self, !incoming.done, !self.stopped else { connection.cancel(); return }
            if error != nil { connection.cancel(); return }
            do {
                if let data = data, let request = try incoming.parser.append(data) {
                    incoming.done = true
                    Task {
                        // Receiver reservation is at-most-once even if the socket
                        // disappears or stop() is called during backend execution.
                        let response = await self.receiver.receive(body: request.body, headers: request.headers)
                        self.queue.async {
                            guard !self.stopped, self.connections[ObjectIdentifier(connection)] != nil else { connection.cancel(); return }
                            self.reply(connection, response)
                        }
                    }
                    return
                }
                if complete { self.reply(connection, .error(400, "INCOMPLETE_REQUEST")); incoming.done = true }
                else { self.read(connection, incoming) }
            } catch let failure as AIVAULTTensorHTTPRequestV01.Failure {
                incoming.done = true; self.reply(connection, .error(failure.statusCode, "INVALID_HTTP_REQUEST"))
            } catch { incoming.done = true; self.reply(connection, .error(400, "INVALID_HTTP_REQUEST")) }
        }
    }
    private func reply(_ connection: NWConnection, _ response: AIVAULTTensorReceiverV01.Response) {
        let header = "HTTP/1.1 \(response.statusCode) Result\r\nContent-Type: application/json\r\nContent-Length: \(response.body.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
        var data = Data(header.utf8); data.append(response.body)
        connection.send(content: data, completion: .contentProcessed { _ in connection.cancel() })
    }
}
