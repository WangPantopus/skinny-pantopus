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
    private var dataStorage: [String: Data] = [:]

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
        dataStorage.removeValue(forKey: key)
    }

    func setData(_ value: Data, for key: String) throws {
        lock.lock()
        defer { lock.unlock() }
        dataStorage[key] = value
    }

    func getData(_ key: String) -> Data? {
        lock.lock()
        defer { lock.unlock() }
        return dataStorage[key]
    }
}
