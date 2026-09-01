//
//  BusinessFilterSheet.swift
//  Pantopus
//
//  P5.2 — Business filters. The bottom-sheet shown from the Discover
//  businesses' `sliders-horizontal` top-bar action. Built on the shared
//  `FilterSheetShell`; this file owns the typed ⇆ `FilterSection`
//  mapping.
//
//  Dimensions (per P5.2):
//    - Category (multi-chip, coarse taxonomy).
//    - Distance radius (slider: 0.5 / 1 / 3 / 5 / 10 mi).
//    - Open-now toggle.
//    - Rating floor (radio: any / 3+ / 4+ / 4.5+).
//
//  All four map to `GET /api/businesses/search` query params
//  (`categories`, `radius_miles`, `open_now`, `rating_min`) —
//  `backend/routes/businessDiscovery.js:436`. The default radius (5 mi)
//  mirrors the backend's `SEARCH_DEFAULT_RADIUS_MILES`, so leaving the
//  slider at 5 is treated as "no distance filter".
//

import SwiftUI

/// One discrete distance stop on the radius slider.
public struct BusinessRadiusStop: Sendable, Hashable {
    public let value: Double
    public let id: String
    public let label: String
}

/// One rating-floor option on the rating radio.
public struct BusinessRatingStop: Sendable, Hashable {
    public let value: Double?
    public let id: String
    public let label: String
}

/// Typed, persisted filter model for the Discover businesses surface.
public struct DiscoverBusinessFilters: Sendable, Hashable {
    /// Selected coarse category ids. Empty means "all categories".
    public var categories: Set<String>
    /// Search radius in miles — one of `radiusStops`.
    public var radiusMiles: Double
    /// Show only businesses open right now.
    public var openNow: Bool
    /// Minimum average rating, or `nil` for "any".
    public var ratingFloor: Double?

    /// Backend default radius (`SEARCH_DEFAULT_RADIUS_MILES`). Leaving
    /// the slider here is "no distance filter".
    public static let defaultRadiusMiles: Double = 5

    public init(
        categories: Set<String> = [],
        radiusMiles: Double = DiscoverBusinessFilters.defaultRadiusMiles,
        openNow: Bool = false,
        ratingFloor: Double? = nil
    ) {
        self.categories = categories
        self.radiusMiles = radiusMiles
        self.openNow = openNow
        self.ratingFloor = ratingFloor
    }

    public static let `default` = DiscoverBusinessFilters()

    public var isDefault: Bool {
        self == .default
    }

    /// Number of active filter dimensions — drives the surface's
    /// filter-count badge.
    public var activeCount: Int {
        var count = 0
        if !categories.isEmpty { count += 1 }
        if radiusMiles != Self.defaultRadiusMiles { count += 1 }
        if openNow { count += 1 }
        if ratingFloor != nil { count += 1 }
        return count
    }
}

/// Business filter bottom sheet. Host wraps this in `.sheet`.
public struct BusinessFilterSheet: View {
    private let initialFilters: DiscoverBusinessFilters
    private let onApply: @MainActor (DiscoverBusinessFilters) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        initialFilters: DiscoverBusinessFilters,
        onApply: @escaping @MainActor (DiscoverBusinessFilters) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.initialFilters = initialFilters
        self.onApply = onApply
        self.onClose = onClose
    }

    public var body: some View {
        FilterSheetShell(
            title: "Filters",
            sections: Self.sections(from: initialFilters),
            onApply: { sections in onApply(Self.filters(from: sections)) },
            onClose: onClose
        )
        .accessibilityIdentifier("businessFilterSheet")
    }

    // MARK: - Stable ids + option tables

    enum SectionID {
        static let category = "category"
        static let distance = "distance"
        static let rating = "rating"
        static let options = "options"
    }

    enum OptionID {
        static let openNow = "open-now"
    }

    /// Coarse business categories (the P5.2 taxonomy). Combined with the
    /// surface's fine-grained chip-strip selection at fetch time.
    static let categoryOptions: [FilterOption] = [
        FilterOption(id: "home-services", label: "Home services"),
        FilterOption(id: "food", label: "Food"),
        FilterOption(id: "retail", label: "Retail"),
        FilterOption(id: "wellness", label: "Wellness"),
        FilterOption(id: "auto", label: "Auto"),
        FilterOption(id: "pets", label: "Pets"),
        FilterOption(id: "other", label: "Other")
    ]

    static let radiusStops: [BusinessRadiusStop] = [
        BusinessRadiusStop(value: 0.5, id: "0.5", label: "0.5 mi"),
        BusinessRadiusStop(value: 1, id: "1", label: "1 mi"),
        BusinessRadiusStop(value: 3, id: "3", label: "3 mi"),
        BusinessRadiusStop(value: 5, id: "5", label: "5 mi"),
        BusinessRadiusStop(value: 10, id: "10", label: "10 mi")
    ]

    static let ratingStops: [BusinessRatingStop] = [
        BusinessRatingStop(value: nil, id: "any", label: "Any"),
        BusinessRatingStop(value: 3, id: "3", label: "3+ stars"),
        BusinessRatingStop(value: 4, id: "4", label: "4+ stars"),
        BusinessRatingStop(value: 4.5, id: "4.5", label: "4.5+ stars")
    ]

    /// Index into `radiusStops` for the default radius. Falls back to the
    /// last stop if the default isn't in the table.
    static var defaultRadiusIndex: Int {
        radiusStops.firstIndex { $0.value == DiscoverBusinessFilters.defaultRadiusMiles }
            ?? max(radiusStops.count - 1, 0)
    }

    static func radiusIndex(for miles: Double) -> Int {
        radiusStops.firstIndex { $0.value == miles } ?? defaultRadiusIndex
    }

    // MARK: - Typed ⇆ sections

    static func sections(from filters: DiscoverBusinessFilters) -> [FilterSection] {
        let ratingId = ratingStops.first { $0.value == filters.ratingFloor }?.id ?? "any"
        var optionIds: Set<String> = []
        if filters.openNow { optionIds.insert(OptionID.openNow) }

        return [
            FilterSection(
                id: SectionID.category,
                title: "Category",
                control: .chipGroup(options: categoryOptions, selectedIds: filters.categories)
            ),
            FilterSection(
                id: SectionID.distance,
                title: "Distance",
                control: .stepSlider(
                    stops: radiusStops.map { FilterOption(id: $0.id, label: $0.label) },
                    selectedIndex: radiusIndex(for: filters.radiusMiles),
                    defaultIndex: defaultRadiusIndex
                )
            ),
            FilterSection(
                id: SectionID.rating,
                title: "Rating",
                control: .radio(
                    options: ratingStops.map { FilterOption(id: $0.id, label: $0.label) },
                    selectedId: ratingId
                )
            ),
            FilterSection(
                id: SectionID.options,
                title: "Availability",
                control: .toggle(
                    options: [FilterOption(id: OptionID.openNow, label: "Open now")],
                    selectedIds: optionIds
                )
            )
        ]
    }

    static func filters(from sections: [FilterSection]) -> DiscoverBusinessFilters {
        var result = DiscoverBusinessFilters.default
        for section in sections {
            switch section.id {
            case SectionID.category:
                if case let .chipGroup(_, selectedIds) = section.control {
                    result.categories = selectedIds
                }
            case SectionID.distance:
                if case let .stepSlider(_, selectedIndex, _) = section.control,
                   radiusStops.indices.contains(selectedIndex) {
                    result.radiusMiles = radiusStops[selectedIndex].value
                }
            case SectionID.rating:
                if case let .radio(_, selectedId) = section.control {
                    result.ratingFloor = ratingStops.first { $0.id == selectedId }?.value
                }
            case SectionID.options:
                if case let .toggle(_, selectedIds) = section.control {
                    result.openNow = selectedIds.contains(OptionID.openNow)
                }
            default:
                continue
            }
        }
        return result
    }
}

#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            BusinessFilterSheet(
                initialFilters: DiscoverBusinessFilters(
                    categories: ["home-services", "pets"],
                    radiusMiles: 3,
                    openNow: true,
                    ratingFloor: 4
                ),
                onApply: { _ in },
                onClose: {}
            )
        }
}
