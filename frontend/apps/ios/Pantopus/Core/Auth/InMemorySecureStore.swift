//
//  InMemorySecureStore.swift
//  Pantopus
//
//  Preview-only in-memory secure store.
//

import Foundation

/// Preview-only in-memory secure store. Marked `@unchecked Sendable` since
/// the underlying dictionary mutation is gated by an `NSLock`.
final class InMemoryStore: SecureStore, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: String] = [:]

    func set(_ value: String, for key: String) throws {
        lock.lock()
        defer { lock.unlock() }
        storage[key] = value
    }

    func get(_ key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }

    func delete(_ key: String) throws {
        lock.lock()
        defer { lock.unlock() }
        storage.removeValue(forKey: key)
    }
}
