//
//  CommunityMailViewModel.swift
//  Pantopus
//
//  A17.4 — Community mail feed. The neighborhood / civic stream a
//  household sees: type filter chips, pull-to-refresh, the four reaction
//  types, RSVP for neighborhood events, and flag-for-review.
//
//  Backed by `backend/routes/mailboxV2Phase3.js`:
//    · GET  /api/mailbox/v2/p3/community/feed   (line 565)
//    · POST /api/mailbox/v2/p3/community/react  (line 694)
//    · POST /api/mailbox/v2/p3/community/rsvp   (line 746)
//    · POST /api/mailbox/v2/p3/community/flag   (line 790)
//
//  Mirrors `ui/screens/mailbox/community/CommunityMailViewModel.kt`.
//

import Foundation
import Observation
import SwiftUI

// MARK: - Filter

/// Type filter chips above the feed. `all` sends no `type` query param;
/// every other case maps 1:1 onto the backend `community_type` column
/// (`categoryCommunityType`, `backend/routes/mailboxV2Phase3.js:812`).
public enum CommunityFeedFilter: String, CaseIterable, Hashable, Sendable, Identifiable {
    case all
    case civicNotice = "civic_notice"
    case neighborhoodEvent = "neighborhood_event"
    case localBusiness = "local_business"
    case buildingAnnouncement = "building_announcement"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .all: "All"
        case .civicNotice: "Civic"
        case .neighborhoodEvent: "Events"
        case .localBusiness: "Business"
        case .buildingAnnouncement: "Building"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .all: .megaphone
        case .civicNotice: .landmark
        case .neighborhoodEvent: .partyPopper
        case .localBusiness: .shoppingBag
        case .buildingAnnouncement: .building2
        }
    }

    /// `type` query param for `GET /community/feed`; nil for "All".
    public var backendType: String? {
        self == .all ? nil : rawValue
    }
}

/// The `community_type` of a published item, as rendered on a card.
public enum CommunityFeedType: String, Hashable, Sendable {
    case civicNotice = "civic_notice"
    case neighborhoodEvent = "neighborhood_event"
    case localBusiness = "local_business"
    case buildingAnnouncement = "building_announcement"

    public static func fromRaw(_ raw: String?) -> CommunityFeedType {
        CommunityFeedType(rawValue: raw ?? "") ?? .civicNotice
    }

    public var label: String {
        switch self {
        case .civicNotice: "Civic Notice"
        case .neighborhoodEvent: "Event"
        case .localBusiness: "Business"
        case .buildingAnnouncement: "Announcement"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .civicNotice: .landmark
        case .neighborhoodEvent: .partyPopper
        case .localBusiness: .shoppingBag
        case .buildingAnnouncement: .building2
        }
    }

    public var accent: Color {
        switch self {
        case .civicNotice: Theme.Color.info
        case .neighborhoodEvent: Theme.Color.magic
        case .localBusiness: Theme.Color.success
        case .buildingAnnouncement: Theme.Color.warmAmber
        }
    }

    public var accentBg: Color {
        switch self {
        case .civicNotice: Theme.Color.infoBg
        case .neighborhoodEvent: Theme.Color.magicBg
        case .localBusiness: Theme.Color.successBg
        case .buildingAnnouncement: Theme.Color.warmAmberBg
        }
    }
}

// MARK: - Reactions

/// The four reaction types the backend validator accepts
/// (`backend/routes/mailboxV2Phase3.js:51`).
public enum CommunityReactionType: String, CaseIterable, Hashable, Sendable, Identifiable {
    case acknowledged
    case willAttend = "will_attend"
    case concerned
    case thumbsUp = "thumbs_up"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .acknowledged: "Noted"
        case .willAttend: "Going"
        case .concerned: "Concerned"
        case .thumbsUp: "Thanks"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .acknowledged: .checkCheck
        case .willAttend: .calendarCheck
        case .concerned: .alertTriangle
        case .thumbsUp: .thumbsUp
        }
    }
}

// MARK: - Presentation model

/// One card in the feed, projected from `CommunityFeedItemDTO`.
public struct CommunityFeedItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let type: CommunityFeedType
    public let title: String
    public let body: String?
    public let senderDisplay: String
    public let timeAgo: String?
    public let verifiedSender: Bool
    public let views: Int
    public let neighborsReceived: Int
    public var rsvpCount: Int
    public let hasEventDate: Bool
    /// Reaction type raw value → count.
    public var reactionCounts: [String: Int]
    /// Reaction type raw values the caller has already sent.
    public var userReactions: Set<String>

    /// RSVP is offered only on neighborhood events that carry a date —
    /// matching RN `community.tsx:165` + `CommunityCard.tsx`.
    public var offersRsvp: Bool {
        type == .neighborhoodEvent && hasEventDate
    }

    public func count(for reaction: CommunityReactionType) -> Int {
        reactionCounts[reaction.rawValue] ?? 0
    }

    public func isReacted(_ reaction: CommunityReactionType) -> Bool {
        userReactions.contains(reaction.rawValue)
    }
}

// MARK: - State

public enum CommunityMailState: Sendable, Equatable {
    case loading
    case loaded(items: [CommunityFeedItem], total: Int)
    case empty
    case error(message: String)
}

// MARK: - View model

@Observable
@MainActor
public final class CommunityMailViewModel {
    public private(set) var state: CommunityMailState = .loading
    public private(set) var selectedFilter: CommunityFeedFilter = .all

    /// Transient banner copy shown after RSVP / flag succeeds or fails.
    public var toast: String?
    /// Non-nil while the flag confirmation dialog is up.
    public var pendingFlagItemId: String?

    private let api: APIClient
    private let onBack: @MainActor () -> Void
    private let pageSize = 30
    private var loadGeneration = 0

    /// Production initializer. `APIClient` is module-internal, so the
    /// public surface never mentions it (see `MembersListViewModel`).
    public convenience init(onBack: @escaping @MainActor () -> Void = {}) {
        self.init(api: .shared, onBack: onBack)
    }

    /// Designated initializer — `api` is injectable for tests. Not
    /// `public`: `APIClient` is internal.
    init(api: APIClient, onBack: @escaping @MainActor () -> Void = {}) {
        self.api = api
        self.onBack = onBack
    }

    public func tapBack() {
        onBack()
    }

    // MARK: - Lifecycle

    public func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetchFeed()
    }

    public func refresh() async {
        await fetchFeed()
    }

    public func selectFilter(_ filter: CommunityFeedFilter) {
        guard filter != selectedFilter else { return }
        selectedFilter = filter
        state = .loading
        Task { @MainActor in await fetchFeed() }
    }

    private func fetchFeed() async {
        loadGeneration &+= 1
        let generation = loadGeneration
        let filter = selectedFilter
        do {
            let response: CommunityFeedResponse = try await api.request(
                MailboxCommunityEndpoints.feed(
                    type: filter.backendType,
                    limit: pageSize,
                    offset: 0
                )
            )
            guard generation == loadGeneration else { return }
            let items = response.items.map(Self.project)
            if items.isEmpty {
                state = .empty
            } else {
                state = .loaded(items: items, total: response.total ?? items.count)
            }
        } catch {
            guard generation == loadGeneration else { return }
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load your neighborhood feed."
            )
        }
    }

    // MARK: - Reactions

    /// Toggles a reaction. The backend is the source of truth for the
    /// counts (it returns the recomputed roll-up); the caller's own
    /// membership is toggled locally, matching RN `community.tsx:60-70`.
    public func react(itemId: String, reaction: CommunityReactionType) async {
        do {
            let response: CommunityReactResponse = try await api.request(
                MailboxCommunityEndpoints.react(
                    communityItemId: itemId,
                    reactionType: reaction.rawValue
                )
            )
            applyReaction(
                itemId: itemId,
                reaction: reaction,
                counts: response.reactions ?? []
            )
        } catch {
            toast = "Couldn't save that reaction."
        }
    }

    private func applyReaction(
        itemId: String,
        reaction: CommunityReactionType,
        counts: [CommunityReactionCountDTO]
    ) {
        guard case let .loaded(items, total) = state else { return }
        let updated = items.map { item -> CommunityFeedItem in
            guard item.id == itemId else { return item }
            var next = item
            next.reactionCounts = counts.reduce(into: [String: Int]()) { map, row in
                map[row.reactionType] = row.count
            }
            if next.userReactions.contains(reaction.rawValue) {
                next.userReactions.remove(reaction.rawValue)
            } else {
                next.userReactions.insert(reaction.rawValue)
            }
            return next
        }
        state = .loaded(items: updated, total: total)
    }

    // MARK: - RSVP

    public func rsvp(itemId: String) async {
        do {
            let response: CommunityRsvpResponse = try await api.request(
                MailboxCommunityEndpoints.rsvp(communityItemId: itemId)
            )
            let count = response.rsvpCount ?? 0
            toast = "You're on the list! \(count) \(count == 1 ? "person" : "people") attending."
            applyRsvp(itemId: itemId, count: count)
        } catch {
            toast = "Could not RSVP."
        }
    }

    private func applyRsvp(itemId: String, count: Int) {
        guard case let .loaded(items, total) = state else { return }
        let updated = items.map { item -> CommunityFeedItem in
            guard item.id == itemId else { return item }
            var next = item
            next.userReactions.insert(CommunityReactionType.willAttend.rawValue)
            next.reactionCounts[CommunityReactionType.willAttend.rawValue] = count
            next.rsvpCount = count
            return next
        }
        state = .loaded(items: updated, total: total)
    }

    // MARK: - Flag

    /// Stage the destructive confirm — the view presents a
    /// `confirmationDialog` naming the item before anything is sent.
    public func requestFlag(itemId: String) {
        pendingFlagItemId = itemId
    }

    public func cancelFlag() {
        pendingFlagItemId = nil
    }

    /// Title of the item awaiting flag confirmation, so the dialog can
    /// name what is being reported.
    public var pendingFlagTitle: String? {
        guard let pendingFlagItemId, case let .loaded(items, _) = state else { return nil }
        return items.first { $0.id == pendingFlagItemId }?.title
    }

    public func confirmFlag() async {
        guard let itemId = pendingFlagItemId else { return }
        pendingFlagItemId = nil
        do {
            let response: CommunityFlagResponse = try await api.request(
                MailboxCommunityEndpoints.flag(communityItemId: itemId)
            )
            toast = response.message ?? "Item flagged for review"
        } catch {
            toast = "Couldn't flag that item."
        }
    }

    public func consumeToast() {
        toast = nil
    }

    // MARK: - Projection

    static func project(_ dto: CommunityFeedItemDTO) -> CommunityFeedItem {
        CommunityFeedItem(
            id: dto.id,
            type: CommunityFeedType.fromRaw(dto.communityType),
            title: nonEmpty(dto.title) ?? "Shared mail",
            body: nonEmpty(dto.body),
            senderDisplay: nonEmpty(dto.senderDisplay) ?? "Community Member",
            timeAgo: relativeTimestamp(dto.createdAt),
            verifiedSender: dto.verifiedSender ?? false,
            views: dto.views ?? 0,
            neighborsReceived: dto.neighborsReceived ?? 0,
            rsvpCount: dto.rsvpCount ?? 0,
            hasEventDate: nonEmpty(dto.eventDate) != nil,
            reactionCounts: (dto.reactions ?? []).reduce(into: [String: Int]()) { map, row in
                map[row.reactionType] = row.count
            },
            userReactions: Set(dto.userReactions ?? [])
        )
    }

    static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return value
    }

    static func relativeTimestamp(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return nil
        }
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default: return "\(Int(elapsed / 604_800))w ago"
        }
    }
}
