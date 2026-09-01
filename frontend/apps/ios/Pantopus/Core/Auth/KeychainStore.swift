//
//  KeychainStore.swift
//  Pantopus
//
//  Thin wrapper around KeychainAccess. Used for access + refresh tokens.
//

import Foundation
import KeychainAccess

/// Protocol for testability — swap in an in-memory implementation in tests.
protocol SecureStore: Sendable {
    func set(_ value: String, for key: String) throws
    func get(_ key: String) -> String?
    func delete(_ key: String) throws
}

/// `@unchecked Sendable` because the underlying `KeychainAccess.Keychain`
/// type isn't `Sendable`-annotated upstream, but all of its mutating
/// operations are gated by the OS keychain (system-locked) — no
/// in-process shared mutable state.
struct KeychainStore: SecureStore, @unchecked Sendable {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios") {
        keychain = Keychain(service: service)
            .accessibility(.afterFirstUnlockThisDeviceOnly)
            .synchronizable(false)
    }

    func set(_ value: String, for key: String) throws {
        try keychain.set(value, key: key)
    }

    func get(_ key: String) -> String? {
        try? keychain.get(key)
    }

    func delete(_ key: String) throws {
        try keychain.remove(key)
    }
}

enum SecureStoreKey {
    static let accessToken = "accessToken"
    static let refreshToken = "refreshToken"
    static let userId = "userId"
    /// JSON snapshot of the last-known `UserDTO`. Lets the app render a
    /// signed-in shell on launch when the network is unreachable, instead
    /// of bouncing the user to the login screen (offline-first parity with
    /// YouTube / Gmail).
    static let cachedUser = "cachedUser"
}
