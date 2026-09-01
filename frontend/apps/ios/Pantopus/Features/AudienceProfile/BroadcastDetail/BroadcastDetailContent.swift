//
//  BroadcastDetailContent.swift
//  Pantopus
//
//  P1.3 Broadcast detail sub-route — full-screen takeover pushed from
//  an update-card tap on the Audience Profile. Render models for the
//  hero card, 4-cell analytics grid, per-tier read breakdown, and
//  reply rows. Backend keeps the legacy broadcast / fan / tier names
//  on the wire; the surface labels follow
//  docs/identity-firewall-ui-ux-redesign-2026-05-06.md.
//

import Foundation

/// Hero card payload — the broadcast body itself plus visibility chip
/// and timestamp. `mediaUrl` is the URL string of the first attached
/// media item; renderers paint a tinted placeholder when present.
public struct BroadcastDetailHero: Sendable, Hashable {
    public let body: String
    public let visibility: UpdateVisibility
    public let targetTierRank: Int?
    public let timestamp: String
    public let mediaUrl: String?

    public init(
        body: String,
        visibility: UpdateVisibility,
        targetTierRank: Int?,
        timestamp: String,
        mediaUrl: String?
    ) {
        self.body = body
        self.visibility = visibility
        self.targetTierRank = targetTierRank
        self.timestamp = timestamp
        self.mediaUrl = mediaUrl
    }

    /// Renderable chip label — mirrors the audience-frames TierChip map
    /// ("All beacons" for public, "Bronze+" style for tier-or-above).
    public var visibilityLabel: String {
        switch visibility {
        case .publicVisible: return "All beacons"
        case .followers: return "Followers"
        case .tierOrAbove:
            if let rank = targetTierRank { return "Tier \(rank)+" }
            return "Tier"
        }
    }
}

/// One cell of the 4-cell analytics grid (Delivered · Read · Reactions
/// · Replies). `sub` is the optional secondary label like the design's
/// "72%" read-rate annotation.
public struct BroadcastAnalyticsCell: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let value: String
    public let sub: String?

    public init(id: String, label: String, value: String, sub: String? = nil) {
        self.id = id
        self.label = label
        self.value = value
        self.sub = sub
    }
}

/// Tier breakdown bar — segments are read counts per tier. Each
/// segment's width is rendered proportional to `count / total`. The
/// tier color mirrors `AudienceProfileView.tierColor(rank:)` so a
/// broadcast's per-tier read share stays color-consistent with the
/// audience overview.
public struct BroadcastTierBreakdown: Sendable, Hashable {
    public let total: Int
    public let segments: [Segment]

    public init(total: Int, segments: [Segment]) {
        self.total = total
        self.segments = segments
    }

    public struct Segment: Sendable, Hashable, Identifiable {
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

        /// Percentage of the parent breakdown, rounded to the nearest
        /// integer. Returns `0` when `total` is zero.
        public func percent(of total: Int) -> Int {
            guard total > 0 else { return 0 }
            return Int((Double(count) / Double(total) * 100.0).rounded())
        }
    }
}

/// One reply row beneath the broadcast. Mirrors the audience-frames
/// ReplyRow — avatar initial, handle, tier chip, body, time. The
/// `tierRank` drives the tier chip color via `tierColor(rank:)`.
public struct BroadcastReplyRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let handle: String
    public let avatarUrl: String?
    public let tierName: String
    public let tierRank: Int
    public let body: String
    public let timeAgo: String

    public init(
        id: String,
        displayName: String,
        handle: String,
        avatarUrl: String?,
        tierName: String,
        tierRank: Int,
        body: String,
        timeAgo: String
    ) {
        self.id = id
        self.displayName = displayName
        self.handle = handle
        self.avatarUrl = avatarUrl
        self.tierName = tierName
        self.tierRank = tierRank
        self.body = body
        self.timeAgo = timeAgo
    }
}

/// Composed loaded state for the broadcast detail surface.
public struct BroadcastDetailLoaded: Sendable, Hashable {
    public let broadcastId: String
    public let hero: BroadcastDetailHero
    public let analyticsCells: [BroadcastAnalyticsCell]
    public let tierBreakdown: BroadcastTierBreakdown
    public let replies: [BroadcastReplyRow]
    public let totalReplies: Int

    public init(
        broadcastId: String,
        hero: BroadcastDetailHero,
        analyticsCells: [BroadcastAnalyticsCell],
        tierBreakdown: BroadcastTierBreakdown,
        replies: [BroadcastReplyRow],
        totalReplies: Int
    ) {
        self.broadcastId = broadcastId
        self.hero = hero
        self.analyticsCells = analyticsCells
        self.tierBreakdown = tierBreakdown
        self.replies = replies
        self.totalReplies = totalReplies
    }
}

/// Top-level state for the broadcast detail VM. No `.empty` case — the
/// hero card always renders when the broadcast loads; the "no replies
/// yet" condition is a sub-state inside `.loaded` (an empty `replies`
/// array on the loaded payload).
public enum BroadcastDetailState: Sendable {
    case loading
    case loaded(BroadcastDetailLoaded)
    case error(message: String)
}
