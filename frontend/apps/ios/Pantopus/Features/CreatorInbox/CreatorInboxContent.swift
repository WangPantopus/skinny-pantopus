//
//  CreatorInboxContent.swift
//  Pantopus
//
//  Render-only models for the standalone Creator Inbox (P1.2). Lifts
//  the Audience Profile's Threads tab into its own focused surface —
//  list of DM threads from followers with filter chips for All /
//  Unread / Bronze+ / Flagged. Reuses the existing `ChatConversationView`
//  for the per-thread drill-in.
//

import Foundation

/// Filter chip selection in the top strip.
public enum CreatorInboxFilter: String, Sendable, Hashable, CaseIterable {
    case all
    case unread
    /// Bronze tier and above. Matches the design's "Bronze+" chip —
    /// projection treats this as `tierRank >= 2` (Bronze is rank 2 in
    /// the tier ladder, since rank 1 is Free / Follower).
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

/// A single thread in the Creator Inbox list.
public struct CreatorInboxRowContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let handle: String
    public let initials: String
    public let avatarUrl: String?
    /// Tier name shown on the right of the handle. `nil` hides the chip.
    public let tierName: String?
    /// Tier rank (1=Free, 2=Bronze, 3=Silver, 4=Gold). Drives the chip
    /// color via the existing rank → semantic-token mapping in the
    /// view and the Bronze+ filter check.
    public let tierRank: Int
    public let preview: String
    public let timeAgo: String
    public let unread: Bool
    public let flagged: Bool
    public let verifiedLocal: Bool
    /// Counterparty user id, when the serializer happens to emit one.
    /// **Never** used as a routing key for the DM thread — persona DMs
    /// carry no user id by design (`backend/routes/personaDms.js:12`), so
    /// the row routes on `id` (the `PersonaDmThread` id) instead.
    public let counterpartyUserId: String?
    /// Optional persona-chip label when the inbox spans multiple
    /// personas (e.g. `"@mariak"` / `"@bakery"`). `nil` hides the chip.
    public let personaChip: String?
    /// Persona that owns this thread — the `:id` path segment of every
    /// `/api/personas/:id/dms/...` call made from the thread surface.
    public let personaId: String
    /// `PersonaMembership` id the thread hangs off. Display/audit only.
    public let membershipId: String?

    public init(
        id: String,
        displayName: String,
        handle: String,
        initials: String,
        avatarUrl: String?,
        tierName: String?,
        tierRank: Int,
        preview: String,
        timeAgo: String,
        unread: Bool,
        flagged: Bool,
        verifiedLocal: Bool,
        counterpartyUserId: String?,
        personaChip: String?,
        personaId: String = "",
        membershipId: String? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.handle = handle
        self.initials = initials
        self.avatarUrl = avatarUrl
        self.tierName = tierName
        self.tierRank = tierRank
        self.preview = preview
        self.timeAgo = timeAgo
        self.unread = unread
        self.flagged = flagged
        self.verifiedLocal = verifiedLocal
        self.counterpartyUserId = counterpartyUserId
        self.personaChip = personaChip
        self.personaId = personaId
        self.membershipId = membershipId
    }
}

/// Filter chip render model — label + live count + matching filter case.
public struct CreatorInboxChipContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let filter: CreatorInboxFilter
    public let label: String
    public let count: Int

    public init(filter: CreatorInboxFilter, count: Int) {
        id = filter.rawValue
        self.filter = filter
        label = filter.title
        self.count = count
    }
}

/// Counts shown in the sunken status banner below the top bar (matches
/// the design's "N threads · N unread · N flagged" line).
public struct CreatorInboxCounts: Sendable, Hashable {
    public let total: Int
    public let unread: Int
    public let flagged: Int

    public init(total: Int, unread: Int, flagged: Int) {
        self.total = total
        self.unread = unread
        self.flagged = flagged
    }
}

/// Header subtitle — `@handle` of the persona whose inbox this is.
public struct CreatorInboxHeader: Sendable, Hashable {
    public let title: String
    public let handle: String?
    /// True when this inbox spans more than one persona — drives the
    /// per-row persona chip.
    public let isCrossPersona: Bool

    public init(title: String, handle: String?, isCrossPersona: Bool) {
        self.title = title
        self.handle = handle
        self.isCrossPersona = isCrossPersona
    }
}

/// Loaded composition.
public struct CreatorInboxLoaded: Sendable, Hashable {
    public let header: CreatorInboxHeader
    public let rows: [CreatorInboxRowContent]
    public let counts: CreatorInboxCounts
    public let chips: [CreatorInboxChipContent]

    public init(
        header: CreatorInboxHeader,
        rows: [CreatorInboxRowContent],
        counts: CreatorInboxCounts,
        chips: [CreatorInboxChipContent]
    ) {
        self.header = header
        self.rows = rows
        self.counts = counts
        self.chips = chips
    }
}

/// Routing payload for the Creator Inbox → persona-DM thread push.
///
/// Persona DMs are addressed by **thread id**, never by a user id: the DM
/// serializer deliberately omits both parties' `user_id`
/// (`backend/routes/personaDms.js:56`). The previous
/// `counterpartyUserId ?? row.id` fallback therefore pushed a membership
/// id into the generic chat surface as if it were a user id.
public struct CreatorInboxThreadDestination: Hashable, Sendable {
    public let personaId: String
    public let threadId: String
    public let displayName: String
    public let initials: String
    public let verified: Bool
    public let tierName: String
    public let tierRank: Int

    public init(
        personaId: String,
        threadId: String,
        displayName: String,
        initials: String,
        verified: Bool,
        tierName: String,
        tierRank: Int
    ) {
        self.personaId = personaId
        self.threadId = threadId
        self.displayName = displayName
        self.initials = initials
        self.verified = verified
        self.tierName = tierName
        self.tierRank = tierRank
    }
}

/// Top-level render state.
public enum CreatorInboxState: Sendable {
    case loading
    case loaded(CreatorInboxLoaded)
    case empty(header: CreatorInboxHeader)
    case error(message: String)
}
