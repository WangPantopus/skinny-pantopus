//
//  DiscoverBusinessesViewModel.swift
//  Pantopus
//
//  T5.4.2 — Discover businesses. Drives a businesses-only browse list
//  on the shared `ListOfRows` archetype:
//
//    - Top bar: back chevron + "Discover businesses" + trailing
//      `sliders-horizontal` filter action.
//    - Search bar above the chip strip (existing `searchBar` slot).
//    - Horizontal chip strip with category filters (the first consumer
//      of the shell's `chipStrip` slot for category filtering — Discover
//      hub uses it for cross-cutting filters; here it filters by primary
//      business category). Selected chip is `primary600`-filled;
//      others are neutral-outlined (rendered by the shell).
//    - Body: when chip = "All", results group into multiple
//      `RowSection`s by primary category (one per category). When a
//      specific chip is selected, the list collapses to that single
//      section.
//    - Each row uses shape A (category-tinted 40pt gradient icon
//      leading + name title + meta subtitle + chevron trailing).
//    - No FAB — matches the rendered design frame. (The buildout plan's
//      verification mentions an "Add my business / Suggest a business"
//      FAB, but the visual frame has no FAB on either populated or
//      empty state; per the §5 convention "the visual frame wins". The
//      "Invite a business" affordance lives in the empty-state CTA.)
//
//  Backend (existing): `GET /api/businesses/search` —
//  `backend/routes/businessDiscovery.js:436`. Filters by category +
//  text query; results are server-side ranked. Mobile passes the
//  selected chip-id as `categories=<id>` when filtering, omits it on
//  "All".
//

// swiftlint:disable file_length type_body_length

import Foundation
import Observation
import SwiftUI

/// Stable chip ids. The id doubles as the backend `categories` filter
/// value when the chip is selected (omitted when "all").
public enum DiscoverBusinessesChip {
    public static let all = "all"
    public static let handyman = "handyman"
    public static let cleaning = "cleaning"
    public static let petCare = "pet-care"
    public static let plumbing = "plumbing"
    public static let tutoring = "tutoring"
    public static let childcare = "childcare"
    public static let moving = "moving"
    public static let lawnCare = "lawn-care"

    /// Canonical chip order. "All" comes first; the rest mirror the
    /// design's `chips=` array in `discover-frames.jsx:252`.
    public static let order: [String] = [
        all, handyman, cleaning, petCare, plumbing,
        tutoring, childcare, moving, lawnCare
    ]
}

/// Stable section ids — match the chip ids (minus `all`).
public enum DiscoverBusinessesSection {
    /// Catch-all bucket for categories the chip strip doesn't surface.
    public static let other = "other"
}

/// Routing payload emitted when the user taps a row or top-bar action.
/// The host (`HubTabRoot`) maps these onto the appropriate push.
public enum DiscoverBusinessesTarget: Sendable, Hashable {
    case business(businessId: String, name: String)
    /// Emitted by the no-location empty state — the host pushes the Add
    /// Home wizard. (Radius-widening for the no-results state is handled
    /// in-screen by the top-bar filter sheet's radius stepper.)
    case setHomeAddress
    case inviteBusiness
}

/// One row's metadata used by the row mapper. Pure projection so tests
/// can compare against expected category id without hitting the
/// `categoryGradientIcon` payload directly.
public struct DiscoverBusinessesCategorySpec: Sendable, Hashable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon
    public let gradient: GradientPair

    public init(id: String, label: String, icon: PantopusIcon, gradient: GradientPair) {
        self.id = id
        self.label = label
        self.icon = icon
        self.gradient = gradient
    }
}

@Observable
@MainActor
public final class DiscoverBusinessesViewModel: ListOfRowsDataSource {
    // MARK: - Public state

    public let title = "Discover businesses"

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
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    public var searchBar: SearchBarConfig? {
        SearchBarConfig(
            placeholder: "Search businesses or services",
            text: searchText
        ) { [weak self] next in
            MainActor.assumeIsolated { self?.setSearchText(next) }
        } onSubmit: { [weak self] in
            MainActor.assumeIsolated { self?.submitSearch() }
        }
    }

    public var chipStrip: ChipStripConfig? {
        ChipStripConfig(
            chips: DiscoverBusinessesChip.order.map { id in
                ChipStripConfig.Chip(
                    id: id,
                    label: Self.categorySpec(for: id).label
                )
            },
            selectedId: selectedChip
        ) { [weak self] id in
            MainActor.assumeIsolated { self?.selectChip(id) }
        }
    }

    /// Currently-selected chip (drives backend `categories=` filter +
    /// section grouping).
    public private(set) var selectedChip: String = DiscoverBusinessesChip.all
    public private(set) var searchText: String = ""

    /// Persisted filter-sheet selection (category / distance / open-now /
    /// rating). Default = no filters.
    public private(set) var filters: DiscoverBusinessFilters = .default

    /// Whether the filter sheet is presented. The view binds `.sheet` to
    /// this via `setFilterSheetPresented`.
    public private(set) var isFilterSheetPresented = false

    // MARK: - Dependencies

    private let api: APIClient
    private let onSelect: @MainActor (DiscoverBusinessesTarget) -> Void
    private var results: [BusinessDiscoverySearchResponse.Item] = []
    private var loadedOnce = false
    private var pendingSearchTask: Task<Void, Never>?

    init(
        api: APIClient = .shared,
        onSelect: @escaping @MainActor (DiscoverBusinessesTarget) -> Void = { _ in }
    ) {
        self.api = api
        self.onSelect = onSelect
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {
        // V1: single page of 20 results. "See all"-style pagination is
        // a follow-up tied to the filter sheet redesign.
    }

    // MARK: - Chip + search selection

    public func selectChip(_ id: String) {
        guard selectedChip != id else { return }
        selectedChip = id
        Task { @MainActor in await fetch() }
    }

    public func setSearchText(_ next: String) {
        searchText = next
        // Debounce: cancel any in-flight pending task and schedule one
        // 300ms out. Submit (Enter) bypasses the debounce.
        pendingSearchTask?.cancel()
        pendingSearchTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await self?.fetch()
        }
    }

    public func submitSearch() {
        pendingSearchTask?.cancel()
        Task { @MainActor in await fetch() }
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

    /// Apply a new filter selection and re-fetch. Category / distance /
    /// open-now / rating all map to `GET /api/businesses/search` params.
    public func applyFilters(_ newFilters: DiscoverBusinessFilters) {
        filters = newFilters
        Task { @MainActor in await fetch() }
    }

    // MARK: - Fetching

    private func fetch() async {
        // Preserve "loading" only on first fetch; chip + search updates
        // keep the previous list visible while the new one arrives.
        if !loadedOnce { state = .loading }
        let radiusParam =
            filters.radiusMiles == DiscoverBusinessFilters.defaultRadiusMiles
                ? nil
                : filters.radiusMiles
        let endpoint = BusinessDiscoveryEndpoints.search(
            q: searchText.isEmpty ? nil : searchText,
            categories: combinedCategories(),
            page: 1,
            pageSize: 50,
            radiusMiles: radiusParam,
            openNow: filters.openNow ? true : nil,
            ratingMin: filters.ratingFloor
        )
        do {
            let response: BusinessDiscoverySearchResponse = try await api.request(endpoint)
            results = response.results
            loadedOnce = true
            rebuild()
        } catch let APIError.clientError(status, _) where status == 400 {
            // "Location required" — the viewer has no resolved home and
            // didn't pass explicit lat/lon. Show the no-location empty
            // state with a Widen-radius CTA.
            state = .empty(noLocationContent())
            loadedOnce = true
        } catch {
            state = .error(message: "Couldn't load businesses. Try again.")
        }
    }

    /// Union of the chip-strip category (when not "All") and the filter
    /// sheet's coarse category multi-select, sent as `categories=` (the
    /// backend matches via array overlap). `nil` when empty. Sorted for a
    /// stable request shape.
    private func combinedCategories() -> [String]? {
        var set = filters.categories
        if selectedChip != DiscoverBusinessesChip.all {
            set.insert(selectedChip)
        }
        return set.isEmpty ? nil : set.sorted()
    }

    // MARK: - State projection

    func rebuild() {
        if results.isEmpty {
            state = .empty(noResultsContent())
            return
        }

        if selectedChip != DiscoverBusinessesChip.all {
            // Single section — chip-filtered list.
            let spec = Self.categorySpec(for: selectedChip)
            let rows = results.map { rowForBusiness($0, categoryOverride: selectedChip) }
            state = .loaded(
                sections: [
                    RowSection(
                        id: selectedChip,
                        header: spec.label,
                        rows: rows,
                        count: rows.count,
                        style: .card
                    )
                ],
                hasMore: false
            )
            return
        }

        // "All" — group by primary category in chip-strip order, then
        // append "Other" for unrecognised categories.
        var grouped: [String: [BusinessDiscoverySearchResponse.Item]] = [:]
        var orderedKeys: [String] = []
        for item in results {
            let key = Self.primaryCategoryKey(item.categories)
            if grouped[key] == nil {
                grouped[key] = []
                orderedKeys.append(key)
            }
            grouped[key]?.append(item)
        }

        // Sort the section keys by the chip-strip order so the layout
        // is stable across renders. Unknown categories ("other") sit
        // at the end.
        let chipOrder = DiscoverBusinessesChip.order
        let sortedKeys = orderedKeys.sorted { lhs, rhs in
            let lhsIdx = chipOrder.firstIndex(of: lhs) ?? Int.max
            let rhsIdx = chipOrder.firstIndex(of: rhs) ?? Int.max
            return lhsIdx < rhsIdx
        }

        let sections: [RowSection] = sortedKeys.compactMap { key in
            guard let items = grouped[key], !items.isEmpty else { return nil }
            let spec = Self.categorySpec(for: key)
            let rows = items.map { rowForBusiness($0, categoryOverride: key) }
            return RowSection(
                id: key,
                header: spec.label,
                rows: rows,
                count: rows.count,
                style: .card
            )
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    private func noResultsContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .compass,
            headline: "No verified businesses nearby yet",
            subcopy:
            "Widen your search radius, or invite a business you trust on " +
                "the block. They'll show up here once they verify their address.",
            ctaTitle: "Invite a business"
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSelect(.inviteBusiness) }
        }
    }

    private func noLocationContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .mapPin,
            headline: "Set a home address",
            subcopy:
            "We need a verified home address to surface businesses near " +
                "you. Add one in your profile and they'll appear here.",
            ctaTitle: "Set a home address"
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSelect(.setHomeAddress) }
        }
    }

    // MARK: - Row mapping (pure projection, public for tests)

    /// Build a row from a business item. `categoryOverride` is the
    /// section key the row sits under (i.e. the chip id) — used when
    /// the item's `categories[0]` doesn't match any chip but we know
    /// the section it landed in. Defaults to the primary category.
    public func rowForBusiness(
        _ item: BusinessDiscoverySearchResponse.Item,
        categoryOverride: String? = nil
    ) -> RowModel {
        let key = categoryOverride ?? Self.primaryCategoryKey(item.categories)
        let spec = Self.categorySpec(for: key)
        let businessId = item.businessUserId
        let name = item.name
        return RowModel(
            id: "business-\(businessId)",
            title: name,
            subtitle: Self.subtitle(for: item),
            template: .fileChevron,
            leading: .categoryGradientIcon(
                spec.icon,
                gradient: spec.gradient
            ),
            trailing: .chevron
        ) { [weak self] in
            MainActor.assumeIsolated {
                self?.onSelect(.business(businessId: businessId, name: name))
            }
        }
    }

    // MARK: - Helpers (pure)

    /// Pick the row's primary category key. Returns the first category
    /// from the backend `categories[]` that maps to a known chip id;
    /// falls back to `"other"` otherwise.
    public static func primaryCategoryKey(_ categories: [String]) -> String {
        let known = Set(DiscoverBusinessesChip.order)
        for raw in categories {
            let normalized = normalize(raw)
            if known.contains(normalized) { return normalized }
        }
        return DiscoverBusinessesSection.other
    }

    /// Canonical normalisation: lowercase + replace whitespace/underscore
    /// with dashes. Keeps the chip-id alphabet consistent regardless of
    /// the backend's casing (`"Pet Care"` / `"pet_care"` / `"pet-care"`
    /// all collapse to `"pet-care"`).
    public static func normalize(_ raw: String) -> String {
        raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "_", with: "-")
            .replacingOccurrences(of: " ", with: "-")
    }

    /// Build the row's subtitle from the available DTO fields, in the
    /// design's preferred order: description (if any) · open-now (if
    /// any) · distance.
    public static func subtitle(for item: BusinessDiscoverySearchResponse.Item) -> String? {
        var parts: [String] = []
        if let desc = item.description?.trimmingCharacters(in: .whitespacesAndNewlines),
           !desc.isEmpty {
            parts.append(desc)
        }
        if item.isOpenNow == true {
            parts.append("Open now")
        }
        let distance = item.distanceMiles
        if distance > 0 {
            parts.append(Self.formatDistance(distance))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    static func formatDistance(_ miles: Double) -> String {
        if miles < 0.1 { return "Nearby" }
        let rounded = (miles * 10).rounded() / 10
        return "\(rounded) mi"
    }

    /// Per-category visual spec. Mirrors `discover-frames.jsx:26-35`'s
    /// `CAT` object with token-only colour pairs.
    public static func categorySpec(for id: String) -> DiscoverBusinessesCategorySpec {
        switch id {
        case DiscoverBusinessesChip.all:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "All",
                icon: .briefcase,
                gradient: GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
            )
        case DiscoverBusinessesChip.handyman:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Handyman",
                icon: .hammer,
                gradient: GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman)
            )
        case DiscoverBusinessesChip.cleaning:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Cleaning",
                icon: .sparkles,
                gradient: GradientPair(start: Theme.Color.success, end: Theme.Color.cleaning)
            )
        case DiscoverBusinessesChip.petCare:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Pet Care",
                icon: .pawPrint,
                gradient: GradientPair(start: Theme.Color.error, end: Theme.Color.petCare)
            )
        case DiscoverBusinessesChip.plumbing:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Plumbing",
                icon: .hammer,
                gradient: GradientPair(start: Theme.Color.primary500, end: Theme.Color.tech)
            )
        case DiscoverBusinessesChip.tutoring:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Tutoring",
                icon: .lightbulb,
                gradient: GradientPair(start: Theme.Color.info, end: Theme.Color.tutoring)
            )
        case DiscoverBusinessesChip.childcare:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Childcare",
                icon: .heart,
                gradient: GradientPair(start: Theme.Color.warning, end: Theme.Color.childCare)
            )
        case DiscoverBusinessesChip.moving:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Moving",
                icon: .package,
                gradient: GradientPair(start: Theme.Color.business, end: Theme.Color.moving)
            )
        case DiscoverBusinessesChip.lawnCare:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Lawn Care",
                icon: .sparkles,
                gradient: GradientPair(start: Theme.Color.success, end: Theme.Color.home)
            )
        default:
            DiscoverBusinessesCategorySpec(
                id: id,
                label: "Other",
                icon: .briefcase,
                gradient: GradientPair(start: Theme.Color.appTextSecondary, end: Theme.Color.appTextStrong)
            )
        }
    }
}
