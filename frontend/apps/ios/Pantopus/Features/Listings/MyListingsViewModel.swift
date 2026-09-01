//
//  MyListingsViewModel.swift
//  Pantopus
//
//  T6.3f / P14 — the seller's index of every marketplace listing they
//  posted. Backed by `GET /api/listings/me`. Three tabs (Active · Sold
//  · Drafts) filter the same payload client-side so tab counts stay
//  honest without a per-tab refetch.
//
//  Row shape:
//    leading  → 64pt thumbnail (mediaUrls[0] → URL fallback to gradient icon)
//    title    → listing title
//    subtitle → `$price · postedAgo`
//    chips    → [eye/N views] [hand-coins/N offers] [status chip]
//    trailing → chevron (tap → listing detail)
//
//  FAB: 60pt canonicalCreate, sky tint — "List something" (compose flow
//  isn't wired on iOS yet; the handler pushes a placeholder).
//

import Foundation
import Observation
import SwiftUI

/// Filter id rendered as a tab chip.
public enum MyListingsTab: String, Hashable, CaseIterable, Sendable {
    case active
    case sold
    case drafts

    var label: String {
        switch self {
        case .active: "Active"
        case .sold: "Sold"
        case .drafts: "Drafts"
        }
    }

    /// Which backend `Listing.status` values land in this tab. `active`
    /// also picks up `pending_pickup` so a held-but-not-sold listing
    /// still surfaces under the seller's active funnel.
    var statuses: Set<String> {
        switch self {
        case .active: ["active", "pending_pickup"]
        case .sold: ["sold"]
        case .drafts: ["draft"]
        }
    }
}

@Observable
@MainActor
final class MyListingsViewModel: ListOfRowsDataSource {
    let title = "My listings"
    var topBarAction: TopBarAction? {
        nil
    }

    var tabs: [ListOfRowsTab] {
        MyListingsTab.allCases.map { tab in
            ListOfRowsTab(id: tab.rawValue, label: tab.label, count: counts[tab] ?? 0)
        }
    }

    var selectedTab: String {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plusCircle,
            accessibilityLabel: "List something",
            variant: .canonicalCreate,
            handler: onCompose
        )
    }

    private(set) var state: ListOfRowsState = .loading

    private let api: APIClient
    private let onOpenListing: (String) -> Void
    private let onCompose: @Sendable () -> Void

    private var allListings: [ListingDTO] = []
    private var counts: [MyListingsTab: Int] = [:]

    init(
        api: APIClient = .shared,
        initialTab: MyListingsTab = .active,
        onOpenListing: @escaping (String) -> Void = { _ in },
        onCompose: @escaping @Sendable () -> Void = {}
    ) {
        self.api = api
        selectedTab = initialTab.rawValue
        self.onOpenListing = onOpenListing
        self.onCompose = onCompose
    }

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {} // single page covers typical seller inventories.

    private func fetch() async {
        do {
            let response: MyListingsResponse = try await api.request(
                ListingsEndpoints.myListings(limit: 100)
            )
            allListings = response.listings
            recomputeCounts()
            rebuildState()
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Something went wrong.")
        }
    }

    private func recomputeCounts() {
        var c: [MyListingsTab: Int] = [:]
        for tab in MyListingsTab.allCases {
            c[tab] = allListings.filter { listing in
                tab.statuses.contains(listing.status ?? "")
            }.count
        }
        counts = c
    }

    private func rebuildState() {
        let active = MyListingsTab(rawValue: selectedTab) ?? .active
        let filtered = allListings.filter { listing in
            active.statuses.contains(listing.status ?? "")
        }
        if filtered.isEmpty {
            state = .empty(emptyContent(for: active))
            return
        }
        let rows = filtered.map { row(for: $0) }
        state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
    }

    private func emptyContent(for tab: MyListingsTab) -> ListOfRowsState.EmptyContent {
        switch tab {
        case .active:
            ListOfRowsState.EmptyContent(
                icon: .camera,
                headline: "No active listings",
                subcopy: "Post your first item to start hearing from neighbors.",
                ctaTitle: "List something",
                onCTA: onCompose
            )
        case .sold:
            ListOfRowsState.EmptyContent(
                icon: .checkCircle,
                headline: "Nothing sold yet",
                subcopy: "Items move here automatically once you mark them sold.",
                ctaTitle: nil,
                onCTA: nil
            )
        case .drafts:
            ListOfRowsState.EmptyContent(
                icon: .file,
                headline: "No drafts",
                subcopy: "Saved drafts will appear here so you can finish them later.",
                ctaTitle: nil,
                onCTA: nil
            )
        }
    }

    private func row(for listing: ListingDTO) -> RowModel {
        let displayTitle = listing.title?.nilIfEmpty ?? "Untitled listing"
        let askPrice = Self.formatPrice(listing.price, isFree: listing.isFree)
        let posted = Self.formatRelative(listing.createdAt)
        let subtitle = [askPrice, posted].compactMap { $0?.nilIfEmpty }.joined(separator: " · ")

        let chips: [RowChip] = chipMeta(for: listing)

        return RowModel(
            id: listing.id,
            title: displayTitle,
            subtitle: subtitle.nilIfEmpty,
            template: .fileChevron,
            leading: .thumbnail(
                image: thumbnailImage(for: listing),
                size: .large
            ),
            trailing: .chevron,
            onTap: { @Sendable in
                Task { @MainActor in self.onOpenListing(listing.id) }
            },
            chips: chips
        )
    }

    private func thumbnailImage(for listing: ListingDTO) -> ThumbnailImage {
        let gradient = GradientPair(start: Theme.Color.primary50, end: Theme.Color.primary100)
        if let first = listing.mediaUrls?.first, let url = URL(string: first) {
            return .url(url, fallback: .camera, gradient: gradient)
        }
        if let first = listing.firstImage, let url = URL(string: first) {
            return .url(url, fallback: .camera, gradient: gradient)
        }
        return .icon(.camera, gradient: gradient)
    }

    private func chipMeta(for listing: ListingDTO) -> [RowChip] {
        var chips: [RowChip] = []
        let views = listing.viewCount ?? 0
        chips.append(
            RowChip(
                text: "\(views) \(views == 1 ? "view" : "views")",
                icon: .eye,
                tint: .custom(
                    background: Theme.Color.appSurfaceSunken,
                    foreground: Theme.Color.appTextSecondary
                )
            )
        )
        let offers = listing.activeOfferCount ?? 0
        if offers > 0 {
            chips.append(
                RowChip(
                    text: "\(offers) \(offers == 1 ? "offer" : "offers")",
                    icon: .handCoins,
                    tint: .custom(
                        background: Theme.Color.primary50,
                        foreground: Theme.Color.primary700
                    )
                )
            )
        } else {
            chips.append(
                RowChip(
                    text: "0 offers",
                    icon: .handCoins,
                    tint: .custom(
                        background: Theme.Color.appSurfaceSunken,
                        foreground: Theme.Color.appTextSecondary
                    )
                )
            )
        }
        chips.append(statusChip(for: listing.status ?? "active"))
        return chips
    }

    private func statusChip(for status: String) -> RowChip {
        switch status {
        case "active":
            RowChip(
                text: "Active",
                icon: .circle,
                tint: .custom(background: Theme.Color.successBg, foreground: Theme.Color.success)
            )
        case "pending_pickup":
            RowChip(
                text: "Pickup pending",
                icon: .clock,
                tint: .custom(background: Theme.Color.warningBg, foreground: Theme.Color.warning)
            )
        case "sold":
            RowChip(
                text: "Sold",
                icon: .checkCircle,
                tint: .custom(background: Theme.Color.successBg, foreground: Theme.Color.success)
            )
        case "archived":
            RowChip(
                text: "Archived",
                icon: .file,
                tint: .custom(background: Theme.Color.appSurfaceSunken, foreground: Theme.Color.appTextSecondary)
            )
        case "draft":
            RowChip(
                text: "Draft",
                icon: .pencil,
                tint: .custom(background: Theme.Color.infoBg, foreground: Theme.Color.info)
            )
        default:
            RowChip(
                text: status.capitalized,
                icon: nil,
                tint: .custom(background: Theme.Color.appSurfaceSunken, foreground: Theme.Color.appTextSecondary)
            )
        }
    }

    private static func formatPrice(_ price: Double?, isFree: Bool?) -> String? {
        if isFree == true { return "Free" }
        guard let price else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = price.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        return formatter.string(from: NSNumber(value: price))
    }

    /// Renders the createdAt ISO string as a coarse "Nh / Nd / Nw / Nmo"
    /// relative-time label. Designed for the listing rows where exact
    /// precision matters less than reading speed.
    static func formatRelative(_ iso: String?) -> String? {
        guard let iso, let created = ISO8601DateFormatter().date(from: iso) else { return nil }
        let seconds = Int(Date().timeIntervalSince(created))
        if seconds < 60 { return "now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        if days < 7 { return "\(days)d" }
        let weeks = days / 7
        if weeks < 5 { return "\(weeks)w" }
        let months = days / 30
        return "\(max(1, months))mo"
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
