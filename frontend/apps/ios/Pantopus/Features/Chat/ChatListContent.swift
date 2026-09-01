//
//  ChatListContent.swift
//  Pantopus
//
//  VM-prepared row + filter-tab models for the chat list. The view
//  consumes only these — DTO mapping lives in `ChatListViewModel`.
//

import Foundation

/// Filter-tab key.
public enum ChatFilter: String, CaseIterable, Sendable, Hashable {
    case all, unread, gigs, market

    public var label: String {
        switch self {
        case .all: "All"
        case .unread: "Unread"
        case .gigs: "Gigs"
        case .market: "Market"
        }
    }
}

/// Variant for the per-row avatar treatment.
public enum ConversationRowVariant: Sendable, Hashable {
    case dm
    case group(extraAvatars: [String], extraCount: Int)
    case aiAssistant
}

/// Identity disclosure chip rendered next to the name (business / home).
public enum ConversationIdentityChip: String, Sendable, Hashable {
    case business, home

    public var label: String {
        switch self {
        case .business: "Business"
        case .home: "Home"
        }
    }
}

/// One topic pill rendered under a row's preview line. `topicType`
/// drives the pill icon (`task`/`gig` → briefcase, `listing`/
/// `marketplace` → tag).
public struct ConversationRowTopic: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let topicType: String

    public init(id: String, title: String, topicType: String) {
        self.id = id
        self.title = title
        self.topicType = topicType
    }
}

/// One row in the chat list. Pure render — no DTOs.
public struct ConversationRowContent: Identifiable, Sendable, Hashable {
    public let id: String
    public let variant: ConversationRowVariant
    public let displayName: String
    /// Pre-resolved initials for the avatar placeholder.
    public let initials: String
    public let avatarURL: String?
    public let identityChip: ConversationIdentityChip?
    public let verified: Bool
    public let preview: String
    public let timeLabel: String
    public let unread: Int
    public let pinned: Bool
    /// Topic kinds — drives filtering (gigs / market).
    public let topicKinds: Set<String>
    /// Topic pills rendered under the preview (first 2 + "+N" overflow).
    public let topics: [ConversationRowTopic]
    /// For `.room` rows backed by a gig: the gig id, so the conversation
    /// screen can render the pinned gig context strip. `nil` otherwise.
    public let gigId: String?
    /// Stable key for mute/hide persistence — `person:<id>` or `room:<id>`.
    public let storageKey: String
    /// Whether the user muted notifications for this conversation.
    public let isMuted: Bool

    public init(
        id: String,
        variant: ConversationRowVariant,
        displayName: String,
        initials: String,
        avatarURL: String?,
        identityChip: ConversationIdentityChip?,
        verified: Bool,
        preview: String,
        timeLabel: String,
        unread: Int,
        pinned: Bool,
        topicKinds: Set<String>,
        topics: [ConversationRowTopic] = [],
        gigId: String? = nil,
        storageKey: String,
        isMuted: Bool = false
    ) {
        self.id = id
        self.variant = variant
        self.displayName = displayName
        self.initials = initials
        self.avatarURL = avatarURL
        self.identityChip = identityChip
        self.verified = verified
        self.preview = preview
        self.timeLabel = timeLabel
        self.unread = unread
        self.pinned = pinned
        self.topicKinds = topicKinds
        self.topics = topics
        self.gigId = gigId
        self.storageKey = storageKey
        self.isMuted = isMuted
    }
}

// MARK: - Local mute / hide preferences

/// Device-local mute/hide state for the chat list. Keys match Expo mobile
/// (`@chat_hidden_conversations`, `@chat_muted_conversations`) so prefs
/// survive cross-app parity and use `person:` / `room:` ids.
@MainActor
public final class ChatConversationPreferences {
    public static let shared = ChatConversationPreferences()

    public static let hiddenStorageKey = "@chat_hidden_conversations"
    public static let mutedStorageKey = "@chat_muted_conversations"
    private static let hiddenUnreadBaselineKey = "@chat_hidden_unread_baselines"

    public static func personKey(_ participantId: String) -> String {
        "person:\(participantId)"
    }

    public static func roomKey(_ roomId: String) -> String {
        "room:\(roomId)"
    }

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func hiddenKeys() -> Set<String> {
        decodeSet(defaults.string(forKey: Self.hiddenStorageKey))
    }

    public func mutedKeys() -> Set<String> {
        decodeSet(defaults.string(forKey: Self.mutedStorageKey))
    }

    public func hide(
        _ key: String,
        unreadBaseline: Int
    ) {
        var next = hiddenKeys()
        next.insert(key)
        persist(next, key: Self.hiddenStorageKey)
        var baselines = hiddenUnreadBaselines()
        baselines[key] = unreadBaseline
        persistHiddenBaselines(baselines)
    }

    public func unhide(_ keys: some Sequence<String>) {
        var next = hiddenKeys()
        keys.forEach { next.remove($0) }
        persist(next, key: Self.hiddenStorageKey)
        var baselines = hiddenUnreadBaselines()
        keys.forEach { baselines.removeValue(forKey: $0) }
        persistHiddenBaselines(baselines)
    }

    public func shouldAutoUnhide(
        key: String,
        currentUnread: Int
    ) -> Bool {
        guard hiddenKeys().contains(key) else { return false }
        return currentUnread > (hiddenUnreadBaselines()[key] ?? 0)
    }

    @discardableResult
    public func toggleMute(_ key: String) -> Bool {
        var next = mutedKeys()
        let nowMuted: Bool
        if next.contains(key) {
            next.remove(key)
            nowMuted = false
        } else {
            next.insert(key)
            nowMuted = true
        }
        persist(next, key: Self.mutedStorageKey)
        return nowMuted
    }

    private func persist(_ values: Set<String>, key: String) {
        let encoded = (try? JSONEncoder().encode(Array(values).sorted())) ?? Data("[]".utf8)
        defaults.set(String(data: encoded, encoding: .utf8), forKey: key)
    }

    private func decodeSet(_ raw: String?) -> Set<String> {
        guard let raw,
              let data = raw.data(using: .utf8),
              let array = try? JSONDecoder().decode([String].self, from: data)
        else {
            return []
        }
        return Set(array)
    }

    private func hiddenUnreadBaselines() -> [String: Int] {
        guard let raw = defaults.string(forKey: Self.hiddenUnreadBaselineKey),
              let data = raw.data(using: .utf8),
              let map = try? JSONDecoder().decode([String: Int].self, from: data)
        else {
            return [:]
        }
        return map
    }

    private func persistHiddenBaselines(_ map: [String: Int]) {
        let encoded = (try? JSONEncoder().encode(map)) ?? Data("{}".utf8)
        defaults.set(String(data: encoded, encoding: .utf8), forKey: Self.hiddenUnreadBaselineKey)
    }
}

public enum ChatUnreadBadgeMath {
    public static func adjustedTotal(
        serverTotal: Int,
        rows: [ConversationRowContent],
        mutedKeys: Set<String>
    ) -> Int {
        let mutedUnread = rows
            .filter { mutedKeys.contains($0.storageKey) }
            .reduce(0) { $0 + $1.unread }
        return max(0, serverTotal - mutedUnread)
    }
}

/// Filter-tab entry the view renders.
public struct ChatFilterTab: Identifiable, Sendable, Hashable {
    public let id: String
    public let filter: ChatFilter
    public let badgeCount: Int?

    public init(filter: ChatFilter, badgeCount: Int? = nil) {
        id = filter.rawValue
        self.filter = filter
        self.badgeCount = badgeCount
    }
}

/// Top-level render state for the chat list.
public enum ChatListState: Sendable {
    case loading
    case empty
    case loaded(rows: [ConversationRowContent])
    case error(message: String)
}
