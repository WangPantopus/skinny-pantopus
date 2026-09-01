//
//  AccountHint.swift
//  Pantopus
//
//  Non-secret "remembered account" hint that survives an explicit sign-out
//  so the login card can offer "Continue as Ying" (L2/L3). Nothing in here
//  can authenticate; the email is masked. Stored as a JSON array under
//  `SecureStoreKey.accountHints`, most-recent-first, capped at 3 so an
//  account switcher is a UI increment later (WORKLOG decision 4).
//
//  Contract: docs/persistent-login/CONTRACT.md ("Client storage keys").
//

import Foundation

/// How the account was last authenticated — picks the L3 affordance
/// (`password` ⇒ prefilled field + AutoFill, `apple`/`google` ⇒ the OAuth
/// button).
public enum AccountHintMethod: String, Codable, Sendable, Hashable {
    case password
    case google
    case apple
    case passkey
    case resume
}

public struct AccountHint: Codable, Sendable, Hashable, Identifiable {
    public let userId: String
    public let displayName: String?
    public let avatarUrl: URL?
    /// `y•••@gmail.com` — see `mask(email:)`.
    public let maskedEmail: String?
    public let lastMethod: AccountHintMethod?
    /// Last successful sign-in / restore / refresh on this device. Drives
    /// the "dormant > 30 d ⇒ L2" rule.
    public let lastSeenAt: Date

    public var id: String {
        userId
    }

    public init(
        userId: String,
        displayName: String?,
        avatarUrl: URL?,
        maskedEmail: String?,
        lastMethod: AccountHintMethod?,
        lastSeenAt: Date
    ) {
        self.userId = userId
        self.displayName = displayName
        self.avatarUrl = avatarUrl
        self.maskedEmail = maskedEmail
        self.lastMethod = lastMethod
        self.lastSeenAt = lastSeenAt
    }

    /// Build a hint from the session user. `email` is masked here — the
    /// stored hint never carries the full address.
    public init(user: UserDTO, lastMethod: AccountHintMethod?, lastSeenAt: Date = Date()) {
        self.init(
            userId: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarURL,
            maskedEmail: Self.mask(email: user.email),
            lastMethod: lastMethod,
            lastSeenAt: lastSeenAt
        )
    }

    /// Same hint, stamped with a new `lastSeenAt` and (optionally) method.
    public func touched(at date: Date, method: AccountHintMethod? = nil) -> AccountHint {
        AccountHint(
            userId: userId,
            displayName: displayName,
            avatarUrl: avatarUrl,
            maskedEmail: maskedEmail,
            lastMethod: method ?? lastMethod,
            lastSeenAt: date
        )
    }

    /// `alice@example.com` → `a•••@example.com`. Keeps the first character
    /// of the local part and the full domain — enough to recognise the
    /// account, not enough to enumerate it.
    public static func mask(email: String) -> String? {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let at = trimmed.firstIndex(of: "@"), at != trimmed.startIndex else {
            return trimmed.isEmpty ? nil : "•••"
        }
        let first = trimmed[trimmed.startIndex]
        return "\(first)•••\(trimmed[at...])"
    }
}

/// Persistence for the remembered-accounts list.
enum AccountHintStore {
    static let maxHints = 3

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    /// Most-recent-first. Malformed storage reads as empty (never throws
    /// on the launch path).
    static func load(from store: any SecureStore) -> [AccountHint] {
        guard let json = store.get(SecureStoreKey.accountHints),
              let data = json.data(using: .utf8),
              let hints = try? decoder.decode([AccountHint].self, from: data) else {
            return []
        }
        return hints
    }

    static func save(_ hints: [AccountHint], to store: any SecureStore) {
        let capped = Array(hints.prefix(maxHints))
        guard !capped.isEmpty else {
            try? store.delete(SecureStoreKey.accountHints)
            return
        }
        guard let data = try? encoder.encode(capped),
              let json = String(data: data, encoding: .utf8) else { return }
        try? store.set(json, for: SecureStoreKey.accountHints)
    }

    /// Move `hint` to the front (replacing any entry for the same user) and
    /// cap the list.
    static func remember(_ hint: AccountHint, in store: any SecureStore) {
        var hints = load(from: store).filter { $0.userId != hint.userId }
        hints.insert(hint, at: 0)
        save(hints, to: store)
    }

    static func remove(userId: String, from store: any SecureStore) {
        save(load(from: store).filter { $0.userId != userId }, to: store)
    }

    static func clear(_ store: any SecureStore) {
        try? store.delete(SecureStoreKey.accountHints)
    }

    /// The account most recently seen on this device.
    static func mostRecent(in store: any SecureStore) -> AccountHint? {
        load(from: store).first
    }
}
