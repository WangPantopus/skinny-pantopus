//
//  DiscoveryFilterSheet.swift
//  Pantopus
//
//  P5.2 — Discovery filters. The bottom-sheet shown from the Discover
//  hub's `sliders-horizontal` top-bar action. Built on the shared
//  `FilterSheetShell`; this file owns the typed ⇆ `FilterSection`
//  mapping so the surface's view-model can persist a small typed model
//  rather than parsing render rows.
//
//  Dimensions (per P5.2):
//    - Content type (multi-chip: People · Businesses · Gigs · Listings).
//    - Verified-only toggle.
//    - Newest-first toggle.
//
//  Distance radius is intentionally absent: `/api/hub/discovery` exposes
//  no radius parameter and its items carry no per-item distance, so a
//  distance control here couldn't affect results. (Discover *businesses*
//  has a working distance slider — that endpoint supports `radius_miles`.)
//

import SwiftUI

/// Typed, persisted filter model for the Discover hub surface. The
/// view-model holds one of these; the sheet maps it to/from
/// `FilterSection`s.
public struct DiscoverHubFilters: Sendable, Hashable {
    /// Selected content-type ids (`DiscoverHubSection.*`). Empty means
    /// "all types" — no filtering.
    public var contentTypes: Set<String>
    /// Show only verified people/businesses.
    public var verifiedOnly: Bool
    /// Sort each section newest-first (by `createdAt`, client-side).
    public var newestFirst: Bool

    public init(
        contentTypes: Set<String> = [],
        verifiedOnly: Bool = false,
        newestFirst: Bool = false
    ) {
        self.contentTypes = contentTypes
        self.verifiedOnly = verifiedOnly
        self.newestFirst = newestFirst
    }

    /// The "no filters" baseline (what Reset returns to).
    public static let `default` = DiscoverHubFilters()

    public var isDefault: Bool {
        self == .default
    }

    /// Number of active filter dimensions — drives the surface's
    /// filter-count badge. A non-empty content-type selection counts as
    /// one dimension regardless of how many chips are picked.
    public var activeCount: Int {
        var count = 0
        if !contentTypes.isEmpty { count += 1 }
        if verifiedOnly { count += 1 }
        if newestFirst { count += 1 }
        return count
    }
}

/// Discovery filter bottom sheet. Host wraps this in `.sheet`.
public struct DiscoveryFilterSheet: View {
    private let initialFilters: DiscoverHubFilters
    private let onApply: @MainActor (DiscoverHubFilters) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        initialFilters: DiscoverHubFilters,
        onApply: @escaping @MainActor (DiscoverHubFilters) -> Void,
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
        .accessibilityIdentifier("discoveryFilterSheet")
    }

    // MARK: - Stable ids

    enum SectionID {
        static let contentType = "contentType"
        static let options = "options"
    }

    enum OptionID {
        static let verifiedOnly = "verified-only"
        static let newestFirst = "newest-first"
    }

    // MARK: - Typed ⇆ sections

    /// Build the render sections from a typed model.
    static func sections(from filters: DiscoverHubFilters) -> [FilterSection] {
        var optionIds: Set<String> = []
        if filters.verifiedOnly { optionIds.insert(OptionID.verifiedOnly) }
        if filters.newestFirst { optionIds.insert(OptionID.newestFirst) }

        return [
            FilterSection(
                id: SectionID.contentType,
                title: "Content type",
                control: .chipGroup(
                    options: [
                        FilterOption(id: DiscoverHubSection.people, label: "People"),
                        FilterOption(id: DiscoverHubSection.businesses, label: "Businesses"),
                        FilterOption(id: DiscoverHubSection.gigs, label: "Gigs"),
                        FilterOption(id: DiscoverHubSection.listings, label: "Listings")
                    ],
                    selectedIds: filters.contentTypes
                )
            ),
            FilterSection(
                id: SectionID.options,
                title: "Options",
                control: .toggle(
                    options: [
                        FilterOption(id: OptionID.verifiedOnly, label: "Verified only"),
                        FilterOption(id: OptionID.newestFirst, label: "Newest first")
                    ],
                    selectedIds: optionIds
                )
            )
        ]
    }

    /// Parse the applied sections back into a typed model.
    static func filters(from sections: [FilterSection]) -> DiscoverHubFilters {
        var result = DiscoverHubFilters.default
        for section in sections {
            switch section.id {
            case SectionID.contentType:
                if case let .chipGroup(_, selectedIds) = section.control {
                    result.contentTypes = selectedIds
                }
            case SectionID.options:
                if case let .toggle(_, selectedIds) = section.control {
                    result.verifiedOnly = selectedIds.contains(OptionID.verifiedOnly)
                    result.newestFirst = selectedIds.contains(OptionID.newestFirst)
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
            DiscoveryFilterSheet(
                initialFilters: DiscoverHubFilters(
                    contentTypes: [DiscoverHubSection.people, DiscoverHubSection.gigs],
                    verifiedOnly: true,
                    newestFirst: false
                ),
                onApply: { _ in },
                onClose: {}
            )
        }
}
