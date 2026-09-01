//
//  YourAudienceModels.swift
//  Pantopus
//
//  A22.2 "Your audience" — creator-side member management. UI-facing
//  models for the List-of-Rows-with-pending-section archetype. Wire DTOs
//  (`AudienceListResponse` / `FanDTO`) are decoded by the shared
//  AudienceProfile networking layer; these are the projections the view
//  renders. Sibling of A22.1 Audience (the broadcast hub).
//

import SwiftUI

// MARK: - Filter

/// The scope chip selected at the top of the screen. Selecting a chip
/// re-fetches `/me/audience` with the matching `status` / `tier_rank`
/// query params; counts are computed by the backend *before* filtering so
/// the chips always show full totals.
public enum AudienceFilter: Hashable, Sendable {
    case all
    case pending
    case tier(rank: Int)

    /// `status` query value (nil = all visible statuses).
    var statusParam: String? {
        switch self {
        case .all, .tier: nil
        case .pending: "pending"
        }
    }

    /// `tier_rank` query value (nil = every tier).
    var tierRankParam: Int? {
        if case let .tier(rank) = self { return rank }
        return nil
    }

    var showsPendingSection: Bool {
        switch self {
        case .all, .pending: true
        case .tier: false
        }
    }

    var showsTierGroups: Bool {
        switch self {
        case .all, .tier: true
        case .pending: false
        }
    }
}

// MARK: - Sort

/// Order the audience list is fetched in. Raw values match the backend's
/// `audienceSortValues` (`backend/routes/personas.js:101`); the header
/// control cycles them in this declaration order, exactly like RN's
/// `src/app/audience/members.tsx:216-219`.
public enum AudienceSort: String, CaseIterable, Sendable {
    case recent
    case tenure
    case tier
    case alpha

    /// Toast copy shown after the header control cycles — mirrors RN's
    /// `src/app/audience/members.tsx:221-224`.
    public var label: String {
        switch self {
        case .recent: "Newest first"
        case .tenure: "Longest-tenured first"
        case .tier: "Highest tier first"
        case .alpha: "Alphabetical"
        }
    }

    /// Next entry in the cycle (wraps back to `.recent`).
    public var next: AudienceSort {
        let all = AudienceSort.allCases
        let index = all.firstIndex(of: self) ?? 0
        return all[(index + 1) % all.count]
    }
}

// MARK: - Member action

/// Owner-side actions on one member. Raw values match the backend
/// `audienceMemberActionSchema` (`backend/routes/personas.js:104`).
public enum AudienceMemberAction: String, Sendable {
    case approve
    case decline
    case remove
    case mute
    case unmute
}

// MARK: - Tier styling (rank → semantic token)

/// Maps a tier `rank` (1–4) to the design-system tokens. Mirrors
/// `AudienceProfileView.tierColor(rank:)` so A22.2 reads identically to
/// its A22.1 sibling. Tokens only — the design's "VIP gold / Insiders
/// silver" render through the existing semantic palette, never a literal
/// gold/silver hex (CI hex-grep guard).
public enum AudienceTierStyle {
    public static func color(rank: Int) -> Color {
        switch rank {
        case 4: Theme.Color.business
        case 3: Theme.Color.warning
        case 2: Theme.Color.success
        case 1: Theme.Color.primary600
        default: Theme.Color.appTextSecondary
        }
    }

    public static func background(rank: Int) -> Color {
        switch rank {
        case 4: Theme.Color.businessBg
        case 3: Theme.Color.warningBg
        case 2: Theme.Color.successBg
        case 1: Theme.Color.primary50
        default: Theme.Color.appSurfaceSunken
        }
    }

    public static func icon(rank: Int) -> PantopusIcon {
        switch rank {
        case 4: .crown
        case 3: .star
        case 2: .heart
        default: .users
        }
    }

    /// Fallback label when the creator-named tier hasn't been seen yet.
    public static func defaultName(rank: Int) -> String {
        switch rank {
        case 4: "Tier 4"
        case 3: "Tier 3"
        case 2: "Tier 2"
        case 1: "Tier 1"
        default: "Members"
        }
    }
}

// MARK: - UI models

/// One audience member (pending request or active member).
public struct AudienceMember: Identifiable, Hashable, Sendable {
    public let membershipId: String
    public let displayName: String
    /// Handle, always rendered with a leading `@`.
    public let handle: String
    public let avatarURL: URL?
    public let tierRank: Int
    public let tierName: String
    public let verifiedLocal: Bool
    public let status: String
    /// "YYYY-MM" (month granularity only, per the privacy serializer).
    public let joinedMonth: String?
    public let tenureMonths: Int

    public var id: String {
        membershipId
    }

    public var isPending: Bool {
        status == "pending"
    }

    public var isMuted: Bool {
        status == "muted"
    }

    public init(
        membershipId: String,
        displayName: String,
        handle: String,
        avatarURL: URL?,
        tierRank: Int,
        tierName: String,
        verifiedLocal: Bool,
        status: String,
        joinedMonth: String?,
        tenureMonths: Int
    ) {
        self.membershipId = membershipId
        self.displayName = displayName
        self.handle = handle
        self.avatarURL = avatarURL
        self.tierRank = tierRank
        self.tierName = tierName
        self.verifiedLocal = verifiedLocal
        self.status = status
        self.joinedMonth = joinedMonth
        self.tenureMonths = tenureMonths
    }

    /// Maps the creator-side wire DTO into a UI member. Returns `nil` when
    /// the row lacks a membership id (can't be acted on).
    init?(dto: FanDTO) {
        let identifier = dto.membershipId ?? (dto.id.isEmpty ? nil : dto.id)
        guard let identifier else { return nil }
        let rawHandle = dto.fanHandle ?? ""
        let normalizedHandle = rawHandle.hasPrefix("@") ? rawHandle : "@\(rawHandle)"
        let rank = dto.tier?.rank ?? 1
        self.init(
            membershipId: identifier,
            displayName: dto.fanDisplayName ?? (rawHandle.isEmpty ? "Member" : rawHandle),
            handle: normalizedHandle,
            avatarURL: dto.fanAvatarUrl.flatMap(URL.init(string:)),
            tierRank: rank,
            tierName: dto.tier?.name ?? AudienceTierStyle.defaultName(rank: rank),
            verifiedLocal: dto.verifiedLocal ?? false,
            status: dto.status ?? "active",
            joinedMonth: dto.joinedMonth,
            tenureMonths: dto.tenureMonths ?? 0
        )
    }
}

/// Counts computed by the backend before filtering, so chips always show
/// full totals even when a filter is active.
public struct AudienceCounts: Equatable, Sendable {
    public var totalActive: Int
    public var pending: Int
    /// rank → count (ranks 1–4).
    public var byTier: [Int: Int]

    public init(totalActive: Int, pending: Int, byTier: [Int: Int]) {
        self.totalActive = totalActive
        self.pending = pending
        self.byTier = byTier
    }

    public static let zero = AudienceCounts(totalActive: 0, pending: 0, byTier: [:])
}

/// A scope chip in the filter strip.
public struct AudienceTierChip: Identifiable, Hashable, Sendable {
    public let rank: Int
    public let name: String
    public let count: Int
    public var id: Int {
        rank
    }
}

/// Active (non-pending) members grouped under one tier.
public struct AudienceTierGroup: Identifiable, Sendable {
    public let rank: Int
    public let name: String
    public var members: [AudienceMember]
    public var id: Int {
        rank
    }
}

/// A destructive action (decline / remove) held open in its undo window.
/// RN removes the row immediately, shows a 5-second "Tap to undo" toast,
/// and only fires the `PATCH` once the window closes
/// (`src/app/audience/members.tsx:95-121`).
public struct PendingAudienceUndo: Sendable, Equatable, Identifiable {
    public let membershipId: String
    /// "Removed @jane · Tap to undo".
    public let message: String

    public var id: String {
        membershipId
    }

    public init(membershipId: String, message: String) {
        self.membershipId = membershipId
        self.message = message
    }
}

/// Populated payload for the loaded state.
public struct AudienceLoaded: Sendable {
    public var counts: AudienceCounts
    public var pending: [AudienceMember]
    public var tierGroups: [AudienceTierGroup]
}

/// The screen's single source of truth.
public enum YourAudienceState: Sendable {
    case loading
    case loaded(AudienceLoaded)
    /// Full empty — no members and no pending requests at all.
    case empty
    case error(message: String)
}

// MARK: - Formatting

enum AudienceFormat {
    /// "2025-05" → "May 2025". Month granularity is all the privacy
    /// serializer exposes, so relative request/tenure copy is month-based.
    static func monthLabel(_ value: String?) -> String? {
        guard let value else { return nil }
        let parts = value.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              (1...12).contains(month) else { return nil }
        let names = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ]
        return "\(names[month - 1]) \(year)"
    }

    /// Relative "requested …" copy for a pending row.
    static func requestedLabel(month: String?, tenureMonths _: Int) -> String {
        if let label = monthLabel(month) {
            return "requested \(label)"
        }
        return "requested recently"
    }

    /// "Member since May 2025" caption for an active row.
    static func memberSinceLabel(month: String?) -> String? {
        guard let label = monthLabel(month) else { return nil }
        return "Member since \(label)"
    }
}
