//
//  MarketplaceViewModel.swift
//  Pantopus
//
//  Backs the Marketplace tab (Hub → Marketplace pillar). Fetches
//  `GET /api/listings/nearby` with the active layer + free filter and
//  projects each row into `MarketplaceCardContent`.
//

// swiftlint:disable cyclomatic_complexity

import Foundation
import Observation

@Observable
@MainActor
public final class MarketplaceViewModel {
    public private(set) var state: MarketplaceState = .loading
    public private(set) var activeCategory: MarketplaceCategory = .all
    public private(set) var radiusMiles: Double
    public var searchText: String = ""

    /// True until the first fetch resolves — drives the cold-load
    /// skeleton chrome (search bar + chips shimmer alongside the grid,
    /// per the A08 loading frame).
    public private(set) var hasLoadedOnce = false

    /// True while an incremental page fetch is appending to the grid.
    public private(set) var isLoadingMore = false

    /// True when the last page came back full — more rows may exist.
    public private(set) var hasMore = false

    private let api: APIClient
    private let location: any LocationProviding
    private let pageSize: Int
    private var loadedItems: [ListingDTO] = []
    /// Monotonic fetch token. Each (re)fetch bumps it; responses that
    /// come back under an older token are discarded so a chip tap or
    /// search submitted mid-flight can never be clobbered by a stale
    /// response — and is never silently dropped.
    private var fetchGeneration = 0

    /// Radius widening steps for the empty-state hint pill.
    private static let radiusSteps: [Double] = [2, 5, 10, 25]

    init(
        api: APIClient = .shared,
        location: any LocationProviding = DeviceLocationProvider.shared,
        radiusMiles: Double = 2,
        pageSize: Int = 30
    ) {
        self.api = api
        self.location = location
        self.radiusMiles = radiusMiles
        self.pageSize = pageSize
    }

    public func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    /// Pull-to-refresh — keeps the current grid visible while the
    /// fresh page loads.
    public func refresh() async {
        await fetch()
    }

    /// Called when the screen re-appears (e.g. popping back from the
    /// Snap & Sell wizard or a listing detail) so a just-posted listing
    /// shows up without a manual pull-to-refresh.
    public func refreshOnReturn() async {
        guard hasLoadedOnce else { return }
        await fetch()
    }

    public func selectCategory(_ category: MarketplaceCategory) async {
        guard category != activeCategory else { return }
        activeCategory = category
        // The data set changes entirely — show the skeleton instead of
        // the previous category's stale cards.
        state = .loading
        await fetch()
    }

    public func submitSearch() async {
        state = .loading
        await fetch()
    }

    /// True while a wider radius step remains (2 → 5 → 10 → 25 mi).
    public var canWidenRadius: Bool {
        Self.radiusSteps.contains { $0 > radiusMiles }
    }

    /// Empty-state hint pill: widen to the next radius step and refetch.
    public func widenRadius() async {
        guard let next = Self.radiusSteps.first(where: { $0 > radiusMiles }) else { return }
        radiusMiles = next
        state = .loading
        await fetch()
    }

    /// Incremental page fetch, triggered when the grid scrolls near
    /// its end.
    public func loadMoreIfNeeded(currentId: String) async {
        guard hasMore, !isLoadingMore,
              case .loaded = state,
              loadedItems.suffix(4).contains(where: { $0.id == currentId })
        else { return }
        await fetchNextPage()
    }

    // MARK: - Fetch

    private func fetch() async {
        fetchGeneration += 1
        let generation = fetchGeneration
        let center = location.cachedCoordinate()
            ?? UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
        if case .loaded = state {} else { state = .loading }

        do {
            let response: ListingsNearbyResponse = try await api.request(
                nearbyEndpoint(center: center, offset: 0)
            )
            guard generation == fetchGeneration else { return }
            hasLoadedOnce = true
            loadedItems = response.listings
            hasMore = response.pagination?.hasMore ?? false
            if response.listings.isEmpty {
                state = .empty(MarketplaceEmpty(radiusMiles: radiusMiles))
            } else {
                state = .loaded(response.listings.map { Self.project($0, activeCategory: activeCategory) })
            }
        } catch {
            guard generation == fetchGeneration else { return }
            hasLoadedOnce = true
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load marketplace."
            state = .error(message: message)
        }
    }

    private func fetchNextPage() async {
        let generation = fetchGeneration
        let center = location.cachedCoordinate()
            ?? UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let response: ListingsNearbyResponse = try await api.request(
                nearbyEndpoint(center: center, offset: loadedItems.count)
            )
            // A filter/search change mid-scroll invalidates this page.
            guard generation == fetchGeneration else { return }
            // Drop dupes — offset paging can overlap when new rows land
            // between pages.
            let knownIds = Set(loadedItems.map(\.id))
            let fresh = response.listings.filter { !knownIds.contains($0.id) }
            loadedItems.append(contentsOf: fresh)
            hasMore = (response.pagination?.hasMore ?? false) && !response.listings.isEmpty
            state = .loaded(loadedItems.map { Self.project($0, activeCategory: activeCategory) })
        } catch {
            // Non-blocking: keep the grid, allow a later retrigger.
            guard generation == fetchGeneration else { return }
            hasMore = false
        }
    }

    private func nearbyEndpoint(center: UserCoordinate, offset: Int) -> Endpoint {
        ListingsEndpoints.nearby(
            latitude: center.latitude,
            longitude: center.longitude,
            radiusMiles: radiusMiles,
            layer: activeCategory.layerParam,
            isFree: activeCategory == .free ? true : nil,
            search: searchText.isEmpty ? nil : searchText,
            sort: "newest",
            limit: pageSize,
            offset: offset
        )
    }

    // MARK: - Projection

    private static func project(_ row: ListingDTO, activeCategory: MarketplaceCategory) -> MarketplaceCardContent {
        let imageUrl = (row.firstImage ?? row.mediaUrls?.first).flatMap(URL.init(string:))
        let gradient = ListingGradient.from(id: row.id)
        let icon = placeholderIcon(category: row.category, layer: row.layer)
        let isFree = row.isFree ?? false
        let price = priceLabel(price: row.price, isFree: isFree, layer: row.layer, listingType: row.listingType)
        let distance = distanceLabel(meters: row.distanceMeters)
        let age = ageLabel(timestamp: row.createdAt)
        let meta = [distance, age].compactMap { $0 }.joined(separator: " · ")
        let badge = conditionBadge(condition: row.condition, layer: row.layer, isFree: isFree)
        return MarketplaceCardContent(
            id: row.id,
            title: row.title ?? "Listing",
            imageUrl: imageUrl,
            placeholderGradient: gradient,
            placeholderIcon: icon,
            price: price,
            isFree: isFree,
            metaLine: meta,
            conditionBadge: badge,
            category: activeCategory
        )
    }

    private static func priceLabel(price: Double?, isFree: Bool, layer: String?, listingType: String?) -> String {
        if isFree { return "Free" }
        guard let price else { return "—" }
        let base = if price.truncatingRemainder(dividingBy: 1) == 0 {
            "$\(Int(price))"
        } else {
            String(format: "$%.2f", price)
        }
        if layer == "rentals" || listingType == "rent_sublet" || listingType == "vehicle_rent" {
            return "\(base) / wk"
        }
        return base
    }

    private static func distanceLabel(meters: Double?) -> String? {
        guard let meters else { return nil }
        let miles = meters / 1609.344
        if miles < 0.1 { return "< 0.1mi" }
        if miles < 10 { return String(format: "%.1fmi", miles) }
        return "\(Int(miles))mi"
    }

    private static func ageLabel(timestamp: String?) -> String? {
        guard let timestamp else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: timestamp) ?? ISO8601DateFormatter().date(from: timestamp)
        guard let date else { return nil }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        if interval < 604_800 { return "\(Int(interval / 86400))d" }
        return "\(Int(interval / 604_800))w"
    }

    private static func conditionBadge(condition: String?, layer: String?, isFree: Bool) -> String? {
        if layer == "rentals" || isFree { return nil }
        guard let condition, !condition.isEmpty else { return nil }
        switch condition {
        case "new": return "New"
        case "like_new": return "Like new"
        case "good": return "Good"
        case "fair": return "Fair"
        case "for_parts": return "For parts"
        default: return condition.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private static func placeholderIcon(category: String?, layer: String?) -> PantopusIcon {
        if layer == "vehicles" { return .car }
        if layer == "rentals" { return .keyRound }
        switch category ?? "" {
        case "furniture": return .home
        case "electronics": return .smartphone
        case "clothing": return .shirt
        case "kids_baby": return .heart
        case "tools": return .wrench
        case "home_garden": return .sun
        case "sports_outdoors": return .star
        case "vehicles": return .car
        case "books_media": return .bookmark
        case "appliances": return .tv
        case "food_baked_goods": return .heart
        case "plants_garden": return .flower
        case "pet_supplies": return .pawPrint
        case "arts_crafts": return .palette
        case "tickets_events": return .calendar
        case "free_stuff": return .archive
        default: return .shoppingBag
        }
    }
}
