//
//  DiscoverHubViewModel.swift
//  Pantopus
//
//  T5.4.1 — Discover hub. Drives the typed discovery list (People ·
//  Businesses · Gigs · Listings) on the shared `ListOfRows` archetype:
//
//    - Top bar trailing `sliders-horizontal` icon presents the
//      `DiscoveryFilterSheet` (P5.2) and shows an active-filter count
//      badge. Filters (content type / verified-only / newest-first) are
//      persisted in `filters` and applied via `applyFilters`.
//    - Chip-strip filter row (Nearby / New today / Verified / Free /
//      wanted). Selection re-fetches all four types with the matching
//      query params; `Trending` is omitted (no engagement signal in
//      the current `/api/hub/discovery` response).
//    - Body: four typed `RowSection`s rendered as cards with hairline
//      separators (P1's `SectionStyle.card`). Section header carries
//      a `count` and a `See all` CTA (`RowSection.onSeeAll`).
//    - Per-section row shape:
//        - People    → `avatarWithBadge(.small)` + chevron
//        - Businesses → `categoryGradientIcon` + chevron
//        - Gigs      → `categoryGradientIcon` + `priceStack`
//        - Listings  → `thumbnail(.medium 56pt)` + `priceStack`
//    - Empty section: hidden entirely (per the design's empty frame
//      flow). When all four return zero items the screen renders the
//      whole-screen empty state (`compass` + "Nothing to discover yet").
//
//  Backend (existing — `backend/routes/hub.js:757`, additive T5.4.1
//  fields):
//    - `GET /api/hub/discovery?filter=people|businesses|gigs|listings`
//      with optional `since=today` / `verified=true` /
//      `freeOrWanted=true` for the chip filters. The fan-out is four
//      parallel `URLSession` calls per chip selection — no composite
//      `/api/discover/hub` endpoint exists today; consider one as a
//      follow-up if list latency becomes a concern.
//

// swiftlint:disable type_body_length file_length

import Foundation
import Observation
import SwiftUI

/// Stable chip ids — public so the screen + tests can address them
/// without sprinkling string literals.
public enum DiscoverHubChip {
    public static let nearby = "nearby"
    public static let newToday = "new-today"
    public static let verified = "verified"
    public static let freeOrWanted = "free-or-wanted"
}

/// Stable section ids used as the typed-section keys. Matching string
/// values keep the chip-strip telemetry + tests legible.
public enum DiscoverHubSection {
    public static let people = "people"
    public static let businesses = "businesses"
    public static let gigs = "gigs"
    public static let listings = "listings"
}

/// Routing payload emitted when the user taps a row or a "See all" CTA.
/// The host (`HubTabRoot`) maps these onto the appropriate
/// `HubRoute.*` push.
public enum DiscoverHubTarget: Sendable, Hashable {
    case person(userId: String, displayName: String)
    case business(businessId: String, name: String)
    case gig(gigId: String)
    case listing(listingId: String)
    case post(postId: String)
    case seeAllPeople
    case seeAllBusinesses
    case seeAllGigs
    case seeAllListings
    case seeAllPosts
}

/// Tone palette for category-icon backgrounds + thumbnail gradients.
/// Stable per-id so the same item always renders the same colour.
public enum DiscoverHubTone: Sendable, Hashable, CaseIterable {
    case sky, teal, amber, rose, violet, slate

    public static func tone(for id: String) -> DiscoverHubTone {
        let palette = DiscoverHubTone.allCases
        let hash = id.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }
        let index = abs(hash) % palette.count
        return palette[index]
    }

    public var gradient: GradientPair {
        switch self {
        case .sky: GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
        case .teal: GradientPair(start: Theme.Color.success, end: Theme.Color.home)
        case .amber: GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman)
        case .rose: GradientPair(start: Theme.Color.error, end: Theme.Color.vehicles)
        case .violet: GradientPair(start: Theme.Color.business, end: Theme.Color.goods)
        case .slate: GradientPair(start: Theme.Color.appTextSecondary, end: Theme.Color.appTextStrong)
        }
    }
}

@Observable
@MainActor
public final class DiscoverHubViewModel: ListOfRowsDataSource {
    // MARK: - Public state

    public let title = "Discover hub"

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .slidersHorizontal,
            accessibilityLabel: filters.activeCount > 0
                ? "Filter discovery, \(filters.activeCount) active"
                : "Filter discovery",
            badgeCount: filters.activeCount > 0 ? filters.activeCount : nil
        ) { [weak self] in
            MainActor.assumeIsolated { self?.presentFilters() }
        }
    }

    public var tabs: [ListOfRowsTab] {
        []
    }

    public var selectedTab: String = "" {
        didSet { /* unused — chip-strip drives filter selection */ }
    }

    public var fab: FABAction? {
        // A11.2 — "Open map" entry point into the Explore map. Uses the
        // navigation FAB variant ("go elsewhere", not "create").
        FABAction(
            icon: .map,
            accessibilityLabel: "Open map",
            variant: .extendedNav(label: "Open map"),
            tint: .sky
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onOpenMap() }
        }
    }

    public private(set) var state: ListOfRowsState = .loading
    public private(set) var magazineState: DiscoverHubMagazineState = .loading
    public private(set) var selectedMagazineFilter: DiscoverHubMapKind?

    public var chipStrip: ChipStripConfig? {
        ChipStripConfig(
            chips: [
                ChipStripConfig.Chip(id: DiscoverHubChip.nearby, label: "Nearby", icon: .mapPin),
                ChipStripConfig.Chip(id: DiscoverHubChip.newToday, label: "New today"),
                ChipStripConfig.Chip(
                    id: DiscoverHubChip.verified,
                    label: "Verified",
                    icon: .badgeCheck
                ),
                ChipStripConfig.Chip(id: DiscoverHubChip.freeOrWanted, label: "Free / wanted")
            ],
            selectedId: selectedChip
        ) { [weak self] id in
            MainActor.assumeIsolated { self?.selectChip(id) }
        }
    }

    /// Currently-selected chip (drives backend query params).
    public private(set) var selectedChip: String = DiscoverHubChip.nearby

    /// Persisted filter-sheet selection (content type / verified-only /
    /// newest-first). Default = no filters.
    public private(set) var filters: DiscoverHubFilters = .default

    /// Whether the filter sheet is presented. The view binds `.sheet` to
    /// this via `setFilterSheetPresented`.
    public private(set) var isFilterSheetPresented = false

    // MARK: - Dependencies

    private let api: APIClient
    private let onSelect: @MainActor (DiscoverHubTarget) -> Void
    /// A11.2 — invoked by the "Open map" FAB to push the Explore map.
    private let onOpenMap: @MainActor () -> Void
    private let perTypeLimit: Int
    private let magazineScenario: DiscoverHubMagazineScenario
    private let magazineSeed: DiscoverHubMagazineContent

    private var people: [HubDiscoveryResponse.Item] = []
    private var businesses: [HubDiscoveryResponse.Item] = []
    private var gigs: [HubDiscoveryResponse.Item] = []
    private var listings: [HubDiscoveryResponse.Item] = []
    private var loadedOnce = false

    init(
        api: APIClient = .shared,
        perTypeLimit: Int = 5,
        magazineScenario: DiscoverHubMagazineScenario = .populated,
        magazineSeed: DiscoverHubMagazineContent = DiscoverHubSampleData.populated,
        onSelect: @escaping @MainActor (DiscoverHubTarget) -> Void = { _ in },
        onOpenMap: @escaping @MainActor () -> Void = {}
    ) {
        self.api = api
        self.perTypeLimit = perTypeLimit
        self.magazineScenario = magazineScenario
        self.magazineSeed = magazineSeed
        self.onSelect = onSelect
        self.onOpenMap = onOpenMap
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetchAll()
    }

    public func refresh() async {
        await fetchAll()
    }

    public func loadMoreIfNeeded() async {
        // Discover hub caps each section at `perTypeLimit` — see-all
        // pushes the user into the type-specific full list instead of
        // paginating in-place.
    }

    // MARK: - A11.3 Magazine state

    public func loadMagazine() async {
        magazineState = .loading
        switch magazineScenario {
        case .loading:
            break
        case .empty:
            magazineState = .empty
        case .populated:
            magazineState = .populated(magazineSeed)
        case .error:
            magazineState = .error(message: "Couldn't load discovery. Try again.")
        }
    }

    public func refreshMagazine() async {
        await loadMagazine()
    }

    public func selectMagazineFilter(_ filter: DiscoverHubMapKind?) {
        selectedMagazineFilter = filter
    }

    public func openMap() {
        onOpenMap()
    }

    public func selectTask(_ id: String) {
        onSelect(.gig(gigId: id))
    }

    public func selectMarketplaceItem(_ id: String) {
        onSelect(.listing(listingId: id))
    }

    public func selectPost(_ id: String) {
        onSelect(.post(postId: id))
    }

    public func seeAllTasks() {
        onSelect(.seeAllGigs)
    }

    public func seeAllMarketplace() {
        onSelect(.seeAllListings)
    }

    public func seeAllPosts() {
        onSelect(.seeAllPosts)
    }

    public func notifyWhenActive() {
        // A11.3 empty-frame escape hatch. Notification persistence lands
        // with the eventual alerts service; no network call is made here.
    }

    // MARK: - Chip selection

    /// Update the live chip selection. Re-fetches all four types with
    /// the matching backend query params, then rebuilds the sections.
    public func selectChip(_ id: String) {
        guard selectedChip != id else { return }
        selectedChip = id
        Task { @MainActor in await fetchAll() }
    }

    // MARK: - Filters

    /// Open the filter sheet (top-bar action handler).
    public func presentFilters() {
        isFilterSheetPresented = true
    }

    /// Sheet-presentation binding setter (called on dismiss).
    public func setFilterSheetPresented(_ presented: Bool) {
        isFilterSheetPresented = presented
    }

    /// Apply a new filter selection: re-fetch (the verified-only
    /// dimension is a server param) then re-project (content-type +
    /// newest-first are client-side).
    public func applyFilters(_ newFilters: DiscoverHubFilters) {
        filters = newFilters
        Task { @MainActor in await fetchAll() }
    }

    // MARK: - Fetching

    private func fetchAll() async {
        async let peopleTask = fetch(filter: "people")
        async let businessesTask = fetch(filter: "businesses")
        async let gigsTask = fetch(filter: "gigs")
        async let listingsTask = fetch(filter: "listings")
        let (peopleResult, businessesResult, gigsResult, listingsResult) =
            await (peopleTask, businessesTask, gigsTask, listingsTask)

        let allFailed =
            peopleResult == nil && businessesResult == nil
                && gigsResult == nil && listingsResult == nil
        if allFailed {
            state = .error(message: "Couldn't load discovery. Try again.")
            return
        }
        people = peopleResult ?? []
        businesses = businessesResult ?? []
        gigs = gigsResult ?? []
        listings = listingsResult ?? []
        loadedOnce = true
        rebuild()
    }

    /// Fetch one type. Returns `nil` on failure so the caller can tell
    /// "empty section" (returned `[]`) from "transport error" (`nil`).
    private func fetch(filter: String) async -> [HubDiscoveryResponse.Item]? {
        let verifiedParam =
            selectedChip == DiscoverHubChip.verified || filters.verifiedOnly ? true : nil
        let endpoint = HubEndpoints.discovery(
            filter: filter,
            limit: perTypeLimit,
            since: selectedChip == DiscoverHubChip.newToday ? "today" : nil,
            verified: verifiedParam,
            freeOrWanted: selectedChip == DiscoverHubChip.freeOrWanted ? true : nil
        )
        do {
            let response: HubDiscoveryResponse = try await api.request(endpoint)
            return response.items
        } catch {
            return nil
        }
    }

    // MARK: - State projection

    /// Build the section list. Hides empty sections per the design's
    /// "section disappears if zero" rule; falls back to the whole-screen
    /// empty state when all four are empty.
    func rebuild() {
        var sections: [RowSection] = []
        let peopleItems = recencySorted(people)
        let businessItems = recencySorted(businesses)
        let gigItems = recencySorted(gigs)
        let listingItems = recencySorted(listings)

        if includes(DiscoverHubSection.people), !peopleItems.isEmpty {
            sections.append(RowSection(
                id: DiscoverHubSection.people,
                header: "People",
                rows: peopleItems.map { rowForPerson($0) },
                count: peopleItems.count,
                onSeeAll: { [weak self] in
                    MainActor.assumeIsolated { self?.onSelect(.seeAllPeople) }
                },
                style: .card
            ))
        }
        if includes(DiscoverHubSection.businesses), !businessItems.isEmpty {
            sections.append(RowSection(
                id: DiscoverHubSection.businesses,
                header: "Businesses",
                rows: businessItems.map { rowForBusiness($0) },
                count: businessItems.count,
                onSeeAll: { [weak self] in
                    MainActor.assumeIsolated { self?.onSelect(.seeAllBusinesses) }
                },
                style: .card
            ))
        }
        if includes(DiscoverHubSection.gigs), !gigItems.isEmpty {
            sections.append(RowSection(
                id: DiscoverHubSection.gigs,
                header: "Gigs",
                rows: gigItems.map { rowForGig($0) },
                count: gigItems.count,
                onSeeAll: { [weak self] in
                    MainActor.assumeIsolated { self?.onSelect(.seeAllGigs) }
                },
                style: .card
            ))
        }
        if includes(DiscoverHubSection.listings), !listingItems.isEmpty {
            sections.append(RowSection(
                id: DiscoverHubSection.listings,
                header: "Listings",
                rows: listingItems.map { rowForListing($0) },
                count: listingItems.count,
                onSeeAll: { [weak self] in
                    MainActor.assumeIsolated { self?.onSelect(.seeAllListings) }
                },
                style: .card
            ))
        }
        if sections.isEmpty {
            state = .empty(emptyContent())
            return
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    /// Whether a content type passes the active content-type filter. An
    /// empty selection means "all types".
    private func includes(_ type: String) -> Bool {
        filters.contentTypes.isEmpty || filters.contentTypes.contains(type)
    }

    /// Sort items newest-first when the filter is on. ISO-8601
    /// `createdAt` strings sort lexicographically by recency; items with
    /// no timestamp sink to the end.
    private func recencySorted(
        _ items: [HubDiscoveryResponse.Item]
    ) -> [HubDiscoveryResponse.Item] {
        guard filters.newestFirst else { return items }
        return items.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    }

    private func emptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .compass,
            headline: "Nothing to discover yet",
            subcopy:
            "You're early to this block. People, businesses, gigs, and listings " +
                "will appear here as neighbors verify and join. Check back soon."
        )
    }

    // MARK: - Row mapping (pure projections, public for tests)

    public func rowForPerson(_ item: HubDiscoveryResponse.Item) -> RowModel {
        let displayName = item.title
        let userId = item.id
        return RowModel(
            id: "person-\(item.id)",
            title: displayName,
            subtitle: item.subtitle ?? (item.meta.isEmpty ? nil : item.meta),
            template: .fileChevron,
            leading: .avatarWithBadge(
                name: displayName,
                imageURL: Self.imageURL(item.avatarUrl),
                background: .gradient(DiscoverHubTone.tone(for: item.id).gradient),
                size: .small,
                verified: item.verified ?? false
            ),
            trailing: .chevron
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSelect(.person(userId: userId, displayName: displayName)) }
        }
    }

    public func rowForBusiness(_ item: HubDiscoveryResponse.Item) -> RowModel {
        let businessId = item.id
        let name = item.title
        return RowModel(
            id: "business-\(item.id)",
            title: name,
            subtitle: item.subtitle ?? (item.meta.isEmpty ? nil : item.meta),
            template: .fileChevron,
            leading: .categoryGradientIcon(
                Self.icon(forBusinessCategory: item.category),
                gradient: DiscoverHubTone.tone(for: item.id).gradient
            ),
            trailing: .chevron
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSelect(.business(businessId: businessId, name: name)) }
        }
    }

    public func rowForGig(_ item: HubDiscoveryResponse.Item) -> RowModel {
        let gigId = item.id
        return RowModel(
            id: "gig-\(item.id)",
            title: item.title,
            subtitle: item.subtitle ?? (item.meta.isEmpty ? nil : item.meta),
            template: .fileChevron,
            leading: .categoryGradientIcon(
                Self.icon(forGigCategory: item.category),
                gradient: DiscoverHubTone.tone(for: item.id).gradient
            ),
            trailing: item.price.map { RowTrailing.priceStack(amount: $0) } ?? .chevron
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSelect(.gig(gigId: gigId)) }
        }
    }

    public func rowForListing(_ item: HubDiscoveryResponse.Item) -> RowModel {
        let listingId = item.id
        let icon = Self.icon(forListingCategory: item.category)
        let gradient = DiscoverHubTone.tone(for: item.id).gradient
        let image: ThumbnailImage = if let urlString = item.avatarUrl, let url = URL(string: urlString) {
            .url(url, fallback: icon, gradient: gradient)
        } else {
            .icon(icon, gradient: gradient)
        }
        return RowModel(
            id: "listing-\(item.id)",
            title: item.title,
            subtitle: item.subtitle ?? (item.meta.isEmpty ? nil : item.meta),
            template: .fileChevron,
            leading: .thumbnail(image: image, size: .medium),
            trailing: item.price.map { RowTrailing.priceStack(amount: $0) } ?? .chevron
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSelect(.listing(listingId: listingId)) }
        }
    }

    // MARK: - Helpers (pure)

    static func imageURL(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    /// Map a backend business category → category-icon glyph. The
    /// design's per-row glyphs sit on a gradient tile (rendered by
    /// `categoryGradientIcon`); the matching falls back to a generic
    /// `briefcase` icon for unknown categories so the leading stays
    /// non-empty.
    static func icon(forBusinessCategory category: String?) -> PantopusIcon {
        let key = (category ?? "").lowercased()
        if key.contains("handy") || key.contains("repair") || key.contains("contract") {
            return .hammer
        }
        if key.contains("pet") {
            return .pawPrint
        }
        if key.contains("clean") {
            return .sparkles
        }
        if key.contains("home") {
            return .home
        }
        return .briefcase
    }

    static func icon(forGigCategory category: String?) -> PantopusIcon {
        let key = (category ?? "").lowercased()
        if key.contains("clean") { return .sparkles }
        if key.contains("handy") || key.contains("assemble") || key.contains("repair") {
            return .hammer
        }
        if key.contains("pet") { return .pawPrint }
        if key.contains("delivery") || key.contains("pickup") { return .package }
        return .briefcase
    }

    static func icon(forListingCategory category: String?) -> PantopusIcon {
        let key = (category ?? "").lowercased()
        if key.contains("furniture") || key.contains("home") { return .home }
        if key.contains("toy") || key.contains("kid") || key.contains("baby") { return .package }
        if key.contains("clothes") || key.contains("apparel") { return .package }
        return .package
    }
}
