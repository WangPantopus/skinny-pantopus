import Foundation
import KeychainAccess

/// Deferred links may contain invitation capabilities. Keep the complete
/// handoff device-only, including its original lifetime and account binding.
/// Legacy preferences migrate only after a protected write succeeds.
@MainActor
enum PendingDeepLinkStore {
    private static let pathKey = "pantopus.pendingDeepLink.path"
    private static let timestampKey = "pantopus.pendingDeepLink.timestampMs"
    private static let userIDKey = "pantopus.pendingDeepLink.expectedUserID"
    private static let reauthenticationKey = "pantopus.pendingDeepLink.awaitingReauthentication"
    private static let ttlMs: Int64 = 24 * 60 * 60 * 1000
    private static let keychain = Keychain(service: "app.pantopus.ios.pending-deep-link")
        .accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    private static let recordKey = "arrival-v1"
    private static var defaults: UserDefaults {
        .standard
    }

    private struct Arrival: Codable {
        let version: Int
        let path: String
        let timestampMs: Int64
        let expectedUserID: String?
        var awaitingReauthentication: Bool
    }

    /// A false result keeps the existing handoff. No new capability is written
    /// to preferences when protected storage is unavailable.
    @discardableResult
    static func stash(_ path: String, expectedUserID: String? = nil) -> Bool {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let arrival = Arrival(
            version: 1,
            path: trimmed,
            timestampMs: milliseconds(Date()),
            expectedUserID: expectedUserID,
            awaitingReauthentication: false
        )
        do {
            try save(arrival)
            clearLegacy()
            return true
        } catch { return false }
    }

    static func peek(at date: Date = Date()) -> String? {
        readValidArrival(at: date)?.path
    }

    /// Clearing must succeed before the link is delivered as consumed.
    static func take(userID: String? = nil, at date: Date = Date()) -> String? {
        guard let arrival = readValidArrival(at: date), clear() else { return nil }
        return arrival.expectedUserID == nil || arrival.expectedUserID == userID ? arrival.path : nil
    }

    static func retainForReauthentication(userID: String?) {
        guard var arrival = readValidArrival(), let userID, arrival.expectedUserID == userID else {
            clear()
            return
        }
        arrival.awaitingReauthentication = true
        // Failure leaves the exact original encrypted record and its old TTL.
        try? save(arrival)
    }

    static func completeArrival(userID: String, matches: (String) -> Bool) {
        guard let arrival = readValidArrival(), arrival.expectedUserID == userID,
              !arrival.awaitingReauthentication, matches(arrival.path) else { return }
        clear()
    }

    @discardableResult
    static func clear() -> Bool {
        do {
            try keychain.remove(recordKey)
            clearLegacy()
            return true
        } catch { return false }
    }

    private static func readValidArrival(at date: Date = Date()) -> Arrival? {
        do {
            let arrival: Arrival
            if let bytes = try keychain.getData(recordKey) {
                arrival = try JSONDecoder().decode(Arrival.self, from: bytes)
                guard arrival.version == 1, !arrival.path.isEmpty else { return nil }
            } else if let path = defaults.string(forKey: pathKey), !path.isEmpty {
                let legacy = Arrival(
                    version: 1,
                    path: path,
                    timestampMs: defaults.object(forKey: timestampKey) as? Int64 ?? 0,
                    expectedUserID: defaults.string(forKey: userIDKey),
                    awaitingReauthentication: defaults.bool(forKey: reauthenticationKey)
                )
                guard isFresh(legacy, at: date) else { clearLegacy()
                    return nil
                }
                try save(legacy)
                clearLegacy()
                arrival = legacy
            } else {
                clearLegacy()
                return nil
            }
            guard isFresh(arrival, at: date) else { clear()
                return nil
            }
            return arrival
        } catch {
            // A corrupt or temporarily unavailable protected record is kept.
            // Do not replace it from an older plaintext fallback.
            return nil
        }
    }

    private static func save(_ arrival: Arrival) throws {
        try keychain.set(JSONEncoder().encode(arrival), key: recordKey)
    }

    private static func isFresh(_ arrival: Arrival, at date: Date) -> Bool {
        arrival.timestampMs > 0 && milliseconds(date) - arrival.timestampMs <= ttlMs
    }

    private static func milliseconds(_ date: Date) -> Int64 {
        Int64(date.timeIntervalSince1970 * 1000)
    }

    private static func clearLegacy() {
        for key in [pathKey, timestampKey, userIDKey, reauthenticationKey] {
            defaults.removeObject(forKey: key)
        }
    }
}
