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
    private var authToken: String?
    private var connectionContinuations: [UUID: AsyncStream<ConnectionState>.Continuation] = [:]
    private let logger = Logger(label: "app.pantopus.ios.SocketClient")
    private let environment: AppEnvironment

    init(environment: AppEnvironment = .current) {
        self.environment = environment
    }

    // MARK: - Lifecycle

    func connect(token: String) {
        if authToken == token, socket != nil {
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
            self?.logger.error("Socket error: \(data)")
        }

        socket.connect()
    }

    func disconnect() {
        socket?.disconnect()
        socket = nil
        manager = nil
        authToken = nil
        setConnectionState(.disconnected)
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
