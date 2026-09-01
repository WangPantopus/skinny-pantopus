//
//  RecentActivityViewModel.swift
//  Pantopus
//
//  P1.5 — drives the standalone Recent Activity log reached from the
//  Hub's `HubRecentActivity` "See all" CTA. Fetches the same
//  `/api/hub` overview the Hub does and projects the full
//  `activity[]` window (up to 10 items the backend returns) into the
//  shared `ListOfRows` archetype. Routes each row to the matching
//  domain detail via a typed `Destination` callback so the host can
//  push into the Hub `NavigationStack` without leaking the
//  `HubActivityItem` DTO upstream.
//

import Foundation
import Observation
import SwiftUI

/// Typed destination raised when a Recent Activity row is tapped. The
/// host (`HubTabRoot`) maps each case onto the matching `HubRoute`.
public enum RecentActivityDestination: Sendable, Hashable {
    case gigDetail(id: String)
    case listingDetail(id: String)
    case mailItemDetail(id: String)
    case pulsePost(id: String)
    case homeDashboard(id: String)
    /// Fallback for routes that don't pattern-match a known domain — the
    /// host renders the generic placeholder with the activity title.
    case placeholder(label: String)
}

@Observable
@MainActor
public final class RecentActivityViewModel: ListOfRowsDataSource {
    // MARK: - ListOfRowsDataSource

    public let title = "Recent activity"

    public var topBarAction: TopBarAction? {
        nil
    }

    public let tabs: [ListOfRowsTab] = []

    public var selectedTab: String = ""

    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    // MARK: - Dependencies

    private let api: APIClient
    private let onOpen: @MainActor (RecentActivityDestination) -> Void
    private let now: @Sendable () -> Date

    init(
        api: APIClient = .shared,
        onOpen: @escaping @MainActor (RecentActivityDestination) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.now = now
        self.onOpen = onOpen
    }

    // MARK: - Load / refresh

    public func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {
        // Backend caps the activity feed at 10 items per `/api/hub`
        // response. No pagination cursor is exposed, so the screen
        // shows what the hub delivers.
    }

    private func fetch() async {
        do {
            let hub: HubResponse = try await api.request(HubEndpoints.overview())
            apply(hub.activity)
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load activity.")
        }
    }

    private func apply(_ items: [HubResponse.HubActivityItem]) {
        if items.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .bell,
                    headline: "No activity yet",
                    subcopy: "Check back later — replies, claims, gigs, and mail events will show up here."
                )
            )
            return
        }
        let rows = items.map { item in
            Self.row(
                for: item,
                now: now()
            ) { [weak self] destination in
                Task { @MainActor in self?.onOpen(destination) }
            }
        }
        state = .loaded(sections: [RowSection(id: "all", rows: rows)], hasMore: false)
    }

    // MARK: - Projection (pure)

    /// Project a `HubActivityItem` into a `RowModel`. Public so the
    /// snapshot + unit tests can drive the projection directly.
    public static func row(
        for item: HubResponse.HubActivityItem,
        now: Date,
        onSelect: @escaping @Sendable (RecentActivityDestination) -> Void
    ) -> RowModel {
        let category = ActivityCategory(route: item.route)
        let destination = destination(for: item)
        return RowModel(
            id: item.id,
            title: item.title,
            template: .statusChip,
            leading: .typeIcon(
                category.icon,
                background: category.tint.backgroundColor,
                foreground: category.tint.color
            ),
            trailing: .none,
            onTap: { onSelect(destination) },
            // A single category chip carries the row's tint + label and
            // lets the shared chip-row renderer place `timeMeta` at the
            // right edge (the shell only emits the chip row when at
            // least one of chips / bidderStack / splitWith is set).
            chips: [
                RowChip(
                    text: category.label,
                    icon: category.icon,
                    tint: .custom(
                        background: category.tint.backgroundColor,
                        foreground: category.tint.color
                    )
                )
            ],
            timeMeta: relative(timestamp: item.at, now: now),
            highlight: item.read ? nil : .unread
        )
    }

    /// Map an activity item's `route` field to the typed destination
    /// case. Public so tests can pin the mapping without a VM.
    public static func destination(for item: HubResponse.HubActivityItem) -> RecentActivityDestination {
        let path = item.route
        if let id = idAfter(prefixCandidates: ["/gigs/", "/app/gigs/", "/gig/"], in: path) {
            return .gigDetail(id: id)
        }
        if let id = idAfter(
            prefixCandidates: ["/listings/", "/app/listings/", "/listing/", "/marketplace/"],
            in: path
        ) {
            return .listingDetail(id: id)
        }
        if let id = idAfter(
            prefixCandidates: ["/mail/", "/mailbox/item/", "/app/mailbox/item/", "/app/mail/"],
            in: path
        ) {
            return .mailItemDetail(id: id)
        }
        if let id = idAfter(prefixCandidates: ["/posts/", "/post/", "/app/posts/", "/app/post/"], in: path) {
            return .pulsePost(id: id)
        }
        if let id = idAfter(prefixCandidates: ["/app/homes/", "/homes/"], in: path) {
            return .homeDashboard(id: id)
        }
        return .placeholder(label: item.title)
    }

    /// Extract the first path segment after any of `prefixCandidates`.
    /// Returns nil when the path doesn't start with any of them or the
    /// trailing segment is empty.
    private static func idAfter(prefixCandidates: [String], in path: String) -> String? {
        for prefix in prefixCandidates where path.hasPrefix(prefix) {
            let after = path.dropFirst(prefix.count)
            let id = after.split(separator: "/").first.map(String.init) ?? ""
            return id.isEmpty ? nil : id
        }
        return nil
    }

    /// Compact relative time used by the trailing timestamp.
    public static func relative(timestamp: String, now: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let parsed = formatter.date(from: timestamp) ?? ISO8601DateFormatter().date(from: timestamp)
        guard let date = parsed else { return timestamp }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .short
        return relative.localizedString(for: date, relativeTo: now)
    }
}

/// Visual category for a Recent Activity row. Drives icon + tile tint
/// per the design's row template (leading 40pt tile + title + chevron).
public enum ActivityCategory: Sendable, Hashable {
    case gig
    case listing
    case mail
    case post
    case home
    case other

    init(route: String) {
        switch true {
        case route.contains("/gigs"), route.contains("/gig/"):
            self = .gig
        case route.contains("/listings"), route.contains("/listing/"), route.contains("/marketplace"):
            self = .listing
        case route.contains("/mail"), route.contains("/mailbox"):
            self = .mail
        case route.contains("/posts"), route.contains("/post/"):
            self = .post
        case route.contains("/homes"), route.contains("/home/"):
            self = .home
        default:
            self = .other
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .gig: .briefcase
        case .listing: .tag
        case .mail: .mailbox
        case .post: .megaphone
        case .home: .home
        case .other: .bell
        }
    }

    public var label: String {
        switch self {
        case .gig: "Gig"
        case .listing: "Listing"
        case .mail: "Mail"
        case .post: "Post"
        case .home: "Home"
        case .other: "Update"
        }
    }

    public var tint: IdentityPillar {
        switch self {
        case .gig: .personal
        case .listing: .business
        case .mail, .home: .home
        case .post: .personal
        case .other: .personal
        }
    }
}
