//
//  AudienceProfileContent.swift
//  Pantopus
//
//  Render-only models for the T3.3 Public Profile management screen
//  (creator-facing audience dashboard). UI labels follow
//  docs/identity-firewall-ui-ux-redesign-2026-05-06.md — "Public
//  Profile" / "Updates" / "Followers" / "Post update". Backend
//  keeps the legacy persona / fan / broadcast names internally.
//

import Foundation

/// Three tabs on the management surface.
public enum AudienceProfileTab: String, Sendable, Hashable, CaseIterable {
    case updates
    case followers
    case threads

    public var title: String {
        switch self {
        case .updates: "Updates"
        case .followers: "Followers"
        case .threads: "Threads"
        }
    }
}

/// Single-select sort order for the Followers list. Default is
/// `.newestActive` — the natural API order, which the backend serves
/// most-recently-active-first.
public enum FollowerSort: String, Sendable, Hashable, CaseIterable {
    case newestActive
    case highestTier
    case recentlyJoined
    case mostEngaged

    public var title: String {
        switch self {
        case .newestActive: "Newest active"
        case .highestTier: "Highest tier"
        case .recentlyJoined: "Recently joined"
        case .mostEngaged: "Most engaged"
        }
    }
}

/// Tier visibility for the Updates composer. Mirrors the backend's
/// `visibility` enum exactly.
public enum UpdateVisibility: String, Sendable, Hashable, CaseIterable {
    case publicVisible = "public"
    case followers
    case tierOrAbove = "tier_or_above"

    public var title: String {
        switch self {
        case .publicVisible: "Public"
        case .followers: "Followers"
        case .tierOrAbove: "Tier and above"
        }
    }
}

/// Composer state. `targetTierRank` is required only when
/// `visibility == .tierOrAbove` (Joi: rank 1-4).
public struct UpdateComposerState: Sendable, Hashable {
    public var text: String
    public var visibility: UpdateVisibility
    public var targetTierRank: Int?
    public var isSubmitting: Bool
    public var error: String?

    public init(
        text: String = "",
        visibility: UpdateVisibility = .followers,
        targetTierRank: Int? = nil,
        isSubmitting: Bool = false,
        error: String? = nil
    ) {
        self.text = text
        self.visibility = visibility
        self.targetTierRank = targetTierRank
        self.isSubmitting = isSubmitting
        self.error = error
    }

    /// Composer can submit if non-empty body OR media (media not yet
    /// supported here) and tier rank is valid for tierOrAbove.
    public var canSubmit: Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        if visibility == .tierOrAbove, targetTierRank == nil { return false }
        return !isSubmitting
    }
}

// MARK: - Header

public struct AudienceHeaderContent: Sendable, Hashable {
    public let displayName: String
    public let handle: String?
    public let followerCount: Int
    public let newThisWeek: Int
    public let postCount: Int

    public init(
        displayName: String,
        handle: String?,
        followerCount: Int,
        newThisWeek: Int,
        postCount: Int
    ) {
        self.displayName = displayName
        self.handle = handle
        self.followerCount = followerCount
        self.newThisWeek = newThisWeek
        self.postCount = postCount
    }
}

// MARK: - Updates tab

public struct UpdateCardContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let body: String
    public let timeAgo: String
    public let visibility: UpdateVisibility
    public let targetTierRank: Int?
    public let deliveredCount: Int
    public let readCount: Int

    public init(
        id: String,
        body: String,
        timeAgo: String,
        visibility: UpdateVisibility,
        targetTierRank: Int?,
        deliveredCount: Int,
        readCount: Int
    ) {
        self.id = id
        self.body = body
        self.timeAgo = timeAgo
        self.visibility = visibility
        self.targetTierRank = targetTierRank
        self.deliveredCount = deliveredCount
        self.readCount = readCount
    }

    public var visibilityLabel: String {
        switch visibility {
        case .publicVisible: return "Public"
        case .followers: return "Followers"
        case .tierOrAbove:
            if let rank = targetTierRank { return "Tier \(rank)+" }
            return "Tier"
        }
    }
}

// MARK: - Followers tab

public struct AnalyticsCellContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let value: String
    public let trend: String?

    public init(id: String, label: String, value: String, trend: String? = nil) {
        self.id = id
        self.label = label
        self.value = value
        self.trend = trend
    }
}

public struct TierBreakdownContent: Sendable, Hashable {
    public let total: Int
    public let segments: [TierSegment]

    public init(total: Int, segments: [TierSegment]) {
        self.total = total
        self.segments = segments
    }

    public struct TierSegment: Sendable, Hashable, Identifiable {
        public let id: String
        public let rank: Int
        public let name: String
        public let count: Int

        public init(id: String, rank: Int, name: String, count: Int) {
            self.id = id
            self.rank = rank
            self.name = name
            self.count = count
        }
    }
}

public struct FollowerRowContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let handle: String
    public let avatarUrl: String?
    public let tierName: String
    public let tierRank: Int
    public let tenureLabel: String?
    public let tenureMonths: Int?
    public let joinedMonth: String?
    public let verifiedLocal: Bool

    public init(
        id: String,
        displayName: String,
        handle: String,
        avatarUrl: String?,
        tierName: String,
        tierRank: Int,
        tenureLabel: String?,
        tenureMonths: Int?,
        joinedMonth: String?,
        verifiedLocal: Bool
    ) {
        self.id = id
        self.displayName = displayName
        self.handle = handle
        self.avatarUrl = avatarUrl
        self.tierName = tierName
        self.tierRank = tierRank
        self.tenureLabel = tenureLabel
        self.tenureMonths = tenureMonths
        self.joinedMonth = joinedMonth
        self.verifiedLocal = verifiedLocal
    }
}

public struct TierChipContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let rank: Int?
    public let label: String
    public let count: Int

    public init(id: String, rank: Int?, label: String, count: Int) {
        self.id = id
        self.rank = rank
        self.label = label
        self.count = count
    }
}

// MARK: - Threads tab

public struct ThreadRowContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let handle: String
    public let avatarUrl: String?
    public let tierName: String?
    /// Tier rank (1=Free / Follower, 2=Bronze, 3=Silver, 4=Gold). Drives
    /// the "Bronze+" filter chip (matches when `tierRank >= 2`).
    public let tierRank: Int
    public let preview: String
    public let timeAgo: String
    public let unreadCount: Int
    /// Creator-flagged thread — drives the Flagged filter chip.
    public let flagged: Bool

    public init(
        id: String,
        displayName: String,
        handle: String,
        avatarUrl: String?,
        tierName: String?,
        tierRank: Int,
        preview: String,
        timeAgo: String,
        unreadCount: Int,
        flagged: Bool
    ) {
        self.id = id
        self.displayName = displayName
        self.handle = handle
        self.avatarUrl = avatarUrl
        self.tierName = tierName
        self.tierRank = tierRank
        self.preview = preview
        self.timeAgo = timeAgo
        self.unreadCount = unreadCount
        self.flagged = flagged
    }
}

/// Filter chip selection on the Threads tab. Mirrors the design's four
/// chips (All threads · Unread · Bronze+ · Flagged) and the matching set
/// already used by the standalone Creator Inbox.
public enum ThreadsFilter: String, Sendable, Hashable, CaseIterable {
    case all
    case unread
    /// Bronze tier and above. Projection treats this as `tierRank >= 2`
    /// (rank 1 is Free / Follower).
    case bronzePlus
    case flagged

    public var title: String {
        switch self {
        case .all: "All threads"
        case .unread: "Unread"
        case .bronzePlus: "Bronze+"
        case .flagged: "Flagged"
        }
    }
}

/// Render model for a single threads-filter chip.
/// `count` is `nil` for the Flagged chip — the design omits a count there.
public struct ThreadsFilterChipContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let filter: ThreadsFilter
    public let label: String
    public let count: Int?

    public init(filter: ThreadsFilter, count: Int?) {
        id = filter.rawValue
        self.filter = filter
        label = filter.title
        self.count = count
    }
}

// MARK: - Loaded composition + top-level state

public struct AudienceProfileLoaded: Sendable, Hashable {
    public let header: AudienceHeaderContent
    public let updates: [UpdateCardContent]
    public let analyticsCells: [AnalyticsCellContent]
    public let tierBreakdown: TierBreakdownContent
    public let tierChips: [TierChipContent]
    public let followers: [FollowerRowContent]
    public let threads: [ThreadRowContent]
    public let threadsFilterChips: [ThreadsFilterChipContent]
    public let channelId: String?

    public init(
        header: AudienceHeaderContent,
        updates: [UpdateCardContent],
        analyticsCells: [AnalyticsCellContent],
        tierBreakdown: TierBreakdownContent,
        tierChips: [TierChipContent],
        followers: [FollowerRowContent],
        threads: [ThreadRowContent],
        threadsFilterChips: [ThreadsFilterChipContent],
        channelId: String?
    ) {
        self.header = header
        self.updates = updates
        self.analyticsCells = analyticsCells
        self.tierBreakdown = tierBreakdown
        self.tierChips = tierChips
        self.followers = followers
        self.threads = threads
        self.threadsFilterChips = threadsFilterChips
        self.channelId = channelId
    }
}

public enum AudienceProfileState: Sendable {
    case loading
    case loaded(AudienceProfileLoaded)
    case empty(message: String)
    case error(message: String)
}
