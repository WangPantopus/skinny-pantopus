//
//  SocketClient.swift
//  Pantopus
//
//  Wraps Socket.IO-Client-Swift. Handles connect/disconnect, auth, and
//  exposes typed event streams via AsyncStream.
//

import Foundation
import Logging
import SocketIO

@Observable
@MainActor
final class SocketClient {
    enum ConnectionState {
        case disconnected
        case connecting
        case connected
    }

    static let shared = SocketClient()

    private(set) var connectionState: ConnectionState = .disconnected

    private var manager: SocketManager?
    private var socket: SocketIOClient?
    /// Token of the current connection (readable so tests can assert the
    /// auth-error path reconnected with the rotated token).
    private(set) var authToken: String?
    private var connectionContinuations: [UUID: AsyncStream<ConnectionState>.Continuation] = [:]
    private let logger = Logger(label: "app.pantopus.ios.SocketClient")
    private let environment: AppEnvironment

    /// Hook the auth-error path uses to renew the token: single-flight
    /// `AuthManager.refreshIfPossible()` in the app; injectable in tests.
    /// Returns the new access token, or nil when the refresh did not rotate.
    var tokenRefresher: @MainActor () async -> String? = {
        guard await AuthManager.shared.refreshIfPossible() == .rotated else { return nil }
        return AuthManager.shared.accessToken
    }

    /// Hook run after a revocation signal: asks `AuthManager` to confirm
    /// over HTTP (a DPoP refresh) and end the session with the server's
    /// reason if it is really gone. Injectable in tests.
    var revocationConfirmer: @MainActor () async -> Void = {
        await AuthManager.shared.confirmSessionAfterRevocationSignal()
    }

    /// In-flight auth-error recovery, so a burst of `error` frames from one
    /// stale token triggers one refresh + reconnect, not a storm.
    private var authRecoveryTask: Task<Void, Never>?
    /// Set once the server said the device / session is revoked: reconnecting
    /// with any token from this session is pointless, so we stop until the
    /// HTTP path confirms (401 `SESSION_REVOKED`) and a fresh sign-in
    /// connects again. Push / socket frames are never the authority — the
    /// session is only ended by `AuthManager` after a rejected refresh.
    private(set) var stoppedForRevocation = false

    /// Server-side auth failures that mean "renew the token and try again"
    /// (`backend/socket/chatSocketio.js` `io.use` middleware:
    /// `Authentication required` / `Invalid token` / `Authentication failed`,
    /// plus the contract's 401 codes once the socket layer emits them).
    static let refreshableAuthErrorMarkers = [
        "authentication required", "invalid token", "authentication failed",
        "unauthorized", "jwt expired", "token expired", "token_reuse", "dpop_"
    ]
    /// Terminal codes: stop reconnecting (design §7.7 / task item 6).
    static let terminalAuthErrorMarkers = ["device_revoked", "session_revoked"]

    init(environment: AppEnvironment = .current) {
        self.environment = environment
    }

    // MARK: - Lifecycle

    func connect(token: String) {
        if authToken == token, socket != nil {
            // The server declared this session revoked; only a *new* token
            // may reconnect.
            if stoppedForRevocation { return }
            if connectionState == .disconnected {
                socket?.connect()
                setConnectionState(.connecting)
            }
            return
        }
        if socket != nil {
            disconnect()
        }
        authToken = token
        // A fresh token (post-login / post-refresh) lifts a revocation stop.
        stoppedForRevocation = false
        setConnectionState(.connecting)

        let manager = SocketManager(
            socketURL: environment.socketURL,
            config: [
                .log(false),
                .compress,
                .reconnects(true),
                .reconnectAttempts(-1),
                .reconnectWait(2),
                .extraHeaders(["Authorization": "Bearer \(token)"]),
                .connectParams(["token": token])
            ]
        )
        self.manager = manager
        let socket = manager.defaultSocket
        self.socket = socket

        socket.on(clientEvent: .connect) { [weak self] _, _ in
            Task { @MainActor in
                self?.setConnectionState(.connected)
                self?.logger.info("Socket connected")
            }
        }
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            Task { @MainActor in
                self?.setConnectionState(.disconnected)
                self?.logger.info("Socket disconnected")
            }
        }
        socket.on(clientEvent: .error) { [weak self] data, _ in
            Task { @MainActor in
                guard let self else { return }
                self.logger.error("Socket error: \(data)")
                self.handleSocketError(Self.errorMessage(from: data))
            }
        }
        // Server-initiated revocation of *this* session (`auth:session_revoked`,
        // emitted by `services/authSessionService.js` → socket layer): stop
        // reconnecting; the next HTTP call confirms with 401 SESSION_REVOKED
        // and `AuthManager` ends the session with the right reason.
        socket.on("auth:session_revoked") { [weak self] _, _ in
            Task { @MainActor in
                self?.stopForRevocation(reason: "auth:session_revoked")
            }
        }

        socket.connect()
    }

    func disconnect() {
        authRecoveryTask?.cancel()
        authRecoveryTask = nil
        socket?.disconnect()
        socket = nil
        manager = nil
        authToken = nil
        setConnectionState(.disconnected)
    }

    // MARK: - Auth-error recovery

    /// Best-effort human message from a Socket.IO error payload
    /// (`[String]`, `[[String: Any]]` with `message`, or an `Error`).
    static func errorMessage(from data: [Any]) -> String {
        guard let first = data.first else { return "" }
        if let string = first as? String { return string }
        if let dict = first as? [String: Any] {
            if let message = dict["message"] as? String { return message }
            if let code = dict["code"] as? String { return code }
        }
        if let error = first as? any Error { return error.localizedDescription }
        return String(describing: first)
    }

    /// Classify a socket error and react (design §7.2: "socket auth error
    /// → refreshIfPossible() then reconnect"; §7.7: stop on revocation).
    /// Non-auth errors are left to Socket.IO's own reconnect loop.
    func handleSocketError(_ message: String) {
        let lower = message.lowercased()
        if Self.terminalAuthErrorMarkers.contains(where: { lower.contains($0) }) {
            stopForRevocation(reason: message)
            return
        }
        guard Self.refreshableAuthErrorMarkers.contains(where: { lower.contains($0) }) else { return }
        guard authRecoveryTask == nil, !stoppedForRevocation, socket != nil else { return }
        authRecoveryTask = Task { [weak self] in
            guard let self else { return }
            defer { self.authRecoveryTask = nil }
            let staleToken = authToken
            guard let fresh = await tokenRefresher(), !Task.isCancelled else {
                // Refresh did not rotate: either transient (Socket.IO keeps
                // retrying with the current token, which is fine) or the
                // session is dead — `AuthManager` disconnects us in that case.
                logger.info("Socket auth error — refresh did not rotate; leaving reconnect to Socket.IO")
                return
            }
            guard fresh != staleToken else { return }
            logger.info("Socket auth error — token refreshed, reconnecting")
            connect(token: fresh)
        }
    }

    /// Stop the reconnect loop for a revoked device / session. Only a
    /// `connect(token:)` with a new token (after `AuthManager` re-signs in
    /// or refreshes) starts it again.
    func stopForRevocation(reason: String) {
        guard !stoppedForRevocation else { return }
        stoppedForRevocation = true
        logger.warning("Socket stopped — session/device revoked", metadata: ["reason": .string(reason)])
        authRecoveryTask?.cancel()
        authRecoveryTask = nil
        socket?.disconnect()
        setConnectionState(.disconnected)
        // The socket frame is a hint, not the authority: confirm over HTTP
        // so a genuinely revoked session ends now (with the security
        // message) instead of on the user's next tap.
        let confirm = revocationConfirmer
        Task { await confirm() }
    }

    // MARK: - Events

    func connectionStates() -> AsyncStream<ConnectionState> {
        AsyncStream { continuation in
            let id = UUID()
            connectionContinuations[id] = continuation
            continuation.yield(connectionState)
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in
                    self?.connectionContinuations[id] = nil
                }
            }
        }
    }

    /// Listen to an event as an AsyncStream of decoded payloads.
    ///
    /// Usage:
    /// ```
    /// for await message in socketClient.events(named: "message:new", as: Message.self) {
    ///     // ...
    /// }
    /// ```
    func events<T: Decodable & Sendable>(
        named event: String,
        as _: T.Type = T.self
    ) -> AsyncStream<T> {
        AsyncStream { continuation in
            guard let socket else {
                continuation.finish()
                return
            }
            let uuid = socket.on(event) { data, _ in
                guard let first = data.first else { return }
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: first, options: [])
                    let decoder = JSONDecoder()
                    decoder.keyDecodingStrategy = .convertFromSnakeCase
                    decoder.dateDecodingStrategy = .iso8601
                    let decoded = try decoder.decode(T.self, from: jsonData)
                    continuation.yield(decoded)
                } catch {
                    // Silently drop malformed events — callers can add logging
                    // if they care about this.
                }
            }
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in
                    self?.socket?.off(id: uuid)
                }
            }
        }
    }

    func emit(_ event: String, payload: [String: Any]) {
        socket?.emit(event, payload)
    }

    func emitWithAck<T: Decodable & Sendable>(
        _ event: String,
        payload: [String: Any],
        as _: T.Type = T.self,
        timeout: Double = 5
    ) async -> T? {
        guard let socket else { return nil }
        return await withCheckedContinuation { continuation in
            socket.emitWithAck(event, payload).timingOut(after: timeout) { data in
                guard let first = data.first else {
                    continuation.resume(returning: nil)
                    return
                }
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: first, options: [])
                    let decoder = JSONDecoder()
                    decoder.dateDecodingStrategy = .iso8601
                    let decoded = try decoder.decode(T.self, from: jsonData)
                    continuation.resume(returning: decoded)
                } catch {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    private func setConnectionState(_ state: ConnectionState) {
        connectionState = state
        for continuation in connectionContinuations.values {
            continuation.yield(state)
        }
    }
}
