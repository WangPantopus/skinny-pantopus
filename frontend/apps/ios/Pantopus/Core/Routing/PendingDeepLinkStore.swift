//
//  PendingDeepLinkStore.swift
//  Pantopus
//
//  Persists a pre-auth deep link across process death so it can be replayed
//  once after sign-in (Workstream 1.4 / RN `pendingDeepLink.ts` parity).
//

import Foundation

/// UserDefaults-backed one-shot stash for a content deep link that arrived
/// while signed out. Survives process death with a 24h TTL.
///
/// Cleared on consume, sign-out, expired read, or when the router rejects
/// the destination as non-deferrable (OAuth callback, auth-owned reset/
/// verify, `.unknown`).
enum PendingDeepLinkStore {
    private static let pathKey = "pantopus.pendingDeepLink.path"
    private static let timestampKey = "pantopus.pendingDeepLink.timestampMs"
    /// 24 hours — matches the product TTL for deferred post-login replay.
    private static let ttlMs: Int64 = 24 * 60 * 60 * 1000

    private static var defaults: UserDefaults {
        .standard
    }

    /// Persist a normalized `pantopus://…` / `https://…` path for later replay.
    static func stash(_ path: String) {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        defaults.set(trimmed, forKey: pathKey)
        defaults.set(Int64(Date().timeIntervalSince1970 * 1000), forKey: timestampKey)
    }

    /// Non-consuming read. Returns `nil` (and clears) when missing or expired.
    static func peek() -> String? {
        guard let path = readValidPath() else { return nil }
        return path
    }

    /// Read and clear (one-shot). Returns `nil` when missing or expired.
    static func take() -> String? {
        guard let path = readValidPath() else { return nil }
        clear()
        return path
    }

    static func clear() {
        defaults.removeObject(forKey: pathKey)
        defaults.removeObject(forKey: timestampKey)
    }

    private static func readValidPath() -> String? {
        guard let path = defaults.string(forKey: pathKey), !path.isEmpty else {
            clear()
            return nil
        }
        let stamped = defaults.object(forKey: timestampKey) as? Int64 ?? 0
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        if stamped <= 0 || now - stamped > ttlMs {
            clear()
            return nil
        }
        return path
    }
}
