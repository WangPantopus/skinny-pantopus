//
//  PendingDeepLinkStore.swift
//  Pantopus
//
//  Persists a pre-auth deep link across process death so it can be replayed
//  once after sign-in (Workstream 1.4 / RN `pendingDeepLink.ts` parity).
//

import Foundation

/// Deferred content links and account-bound posts whose content has not loaded.
/// Survives process death with a 24h TTL; replay requires the original account
/// when a link arrived during an existing session.
///
/// Successful arrival, explicit logout, expiry and an account mismatch clear
/// the stash. Server-ended sessions preserve only their own unfinished post.
@MainActor
enum PendingDeepLinkStore {
    private static let pathKey = "pantopus.pendingDeepLink.path"
    private static let timestampKey = "pantopus.pendingDeepLink.timestampMs"
    private static let userIDKey = "pantopus.pendingDeepLink.expectedUserID"
    private static let reauthenticationKey = "pantopus.pendingDeepLink.awaitingReauthentication"
    /// 24 hours — matches the product TTL for deferred post-login replay.
    private static let ttlMs: Int64 = 24 * 60 * 60 * 1000

    private static var defaults: UserDefaults {
        .standard
    }

    /// Persist a normalized `pantopus://…` / `https://…` path for later replay.
    static func stash(_ path: String, expectedUserID: String? = nil) {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        defaults.set(trimmed, forKey: pathKey)
        defaults.set(Int64(Date().timeIntervalSince1970 * 1000), forKey: timestampKey)
        defaults.set(expectedUserID, forKey: userIDKey)
        defaults.set(false, forKey: reauthenticationKey)
    }

    /// Non-consuming read. Returns `nil` (and clears) when missing or expired.
    static func peek() -> String? {
        guard let path = readValidPath() else { return nil }
        return path
    }

    /// Read and clear (one-shot). Returns `nil` when missing or expired.
    static func take(userID: String? = nil) -> String? {
        guard let path = readValidPath() else { return nil }
        let expectedUserID = defaults.string(forKey: userIDKey)
        clear()
        return expectedUserID == nil || expectedUserID == userID ? path : nil
    }

    /// Preserve only the original account's unfinished arrival, with its old TTL.
    static func retainForReauthentication(userID: String?) {
        guard readValidPath() != nil, let userID,
              defaults.string(forKey: userIDKey) == userID else {
            clear()
            return
        }
        defaults.set(true, forKey: reauthenticationKey)
    }

    /// A late screen callback must not clear a newer link or an auth handoff.
    static func completeArrival(userID: String, matches: (String) -> Bool) {
        guard let path = readValidPath(),
              defaults.string(forKey: userIDKey) == userID,
              !defaults.bool(forKey: reauthenticationKey), matches(path) else { return }
        clear()
    }

    static func clear() {
        defaults.removeObject(forKey: pathKey)
        defaults.removeObject(forKey: timestampKey)
        defaults.removeObject(forKey: userIDKey)
        defaults.removeObject(forKey: reauthenticationKey)
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
