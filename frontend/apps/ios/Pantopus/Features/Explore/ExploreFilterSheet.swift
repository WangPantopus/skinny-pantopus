//
//  ExploreFilterSheet.swift
//  Pantopus
//
//  A11.2 Explore — filter bottom sheet. Reuses the shared `FilterSheet`
//  archetype with the dimensions the design calls out: content type
//  (multi-chip), distance radius (single-thumb step slider), and two
//  boolean toggles (verified-only / open-now). Filtering runs client-side
//  over the already-loaded entities so Apply re-projects the pins + sheet
//  rail immediately.
//

import Foundation
import SwiftUI

// MARK: - Criteria

/// The applied Explore-map filter selection. An empty `kinds` set means
/// "all kinds" (the cleared / no-filter position), matching the Discover
/// hub content-type convention.
public struct ExploreFilterCriteria: Sendable, Hashable {
    /// Selected content kinds. Empty == all kinds (no filter).
    public var kinds: Set<ExploreKind>
    /// Distance-radius cap (miles). One of `distanceStops`. The widest
    /// stop is the "no radius cap" position.
    public var distanceUpper: Double
    public var verifiedOnly: Bool
    public var openNow: Bool

    /// Radius slider stops. The last (widest) is the cleared position.
    public static let distanceStops: [Double] = [0.5, 1, 3, 5, 10]
    public static let distanceDefaultIndex = distanceStops.count - 1

    public init(
        kinds: Set<ExploreKind> = [],
        distanceUpper: Double = ExploreFilterCriteria.distanceStops[distanceDefaultIndex],
        verifiedOnly: Bool = false,
        openNow: Bool = false
    ) {
        self.kinds = kinds
        self.distanceUpper = distanceUpper
        self.verifiedOnly = verifiedOnly
        self.openNow = openNow
    }

    /// Index of the active distance stop (falls back to the default stop).
    public var distanceIndex: Int {
        Self.distanceStops.firstIndex(of: distanceUpper)
            ?? Self.distanceStops.indices.min {
                abs(Self.distanceStops[$0] - distanceUpper) < abs(Self.distanceStops[$1] - distanceUpper)
            }
            ?? Self.distanceDefaultIndex
    }

    public var isDistanceActive: Bool {
        distanceUpper < Self.distanceStops[Self.distanceDefaultIndex]
    }

    public var isKindActive: Bool {
        !kinds.isEmpty && kinds.count < ExploreKind.allCases.count
    }

    /// Number of active filter dimensions — drives the top-pill count
    /// badge + the "<n> filters on" sheet-header suffix.
    public var activeCount: Int {
        var count = 0
        if isKindActive { count += 1 }
        if isDistanceActive { count += 1 }
        if verifiedOnly { count += 1 }
        if openNow { count += 1 }
        return count
    }

    // MARK: Predicate

    public func matches(_ entity: ExploreEntity) -> Bool {
        if isKindActive, !kinds.contains(entity.kind) { return false }
        if isDistanceActive, entity.distanceMiles > distanceUpper { return false }
        if verifiedOnly, !entity.verified { return false }
        if openNow, !entity.openNow { return false }
        return true
    }

    // MARK: Sections (criteria → shell)

    public func sections() -> [FilterSection] {
        [
            FilterSection(
                id: "contentType",
                title: "Content type",
                control: .chipGroup(
                    options: ExploreKind.allCases.map { FilterOption(id: $0.rawValue, label: $0.pluralLabel) },
                    selectedIds: Set(kinds.map(\.rawValue))
                )
            ),
            FilterSection(
                id: "distance",
                title: "Distance",
                control: .stepSlider(
                    stops: Self.distanceStops.map { FilterOption(id: Self.stopId($0), label: Self.stopLabel($0)) },
                    selectedIndex: distanceIndex,
                    defaultIndex: Self.distanceDefaultIndex
                )
            ),
            FilterSection(
                id: "refine",
                title: "Refine",
                control: .toggle(
                    options: [
                        FilterOption(id: "verified", label: "Verified only"),
                        FilterOption(id: "openNow", label: "Open now")
                    ],
                    selectedIds: refineIds
                )
            )
        ]
    }

    private var refineIds: Set<String> {
        var ids: Set<String> = []
        if verifiedOnly { ids.insert("verified") }
        if openNow { ids.insert("openNow") }
        return ids
    }

    // MARK: Parse (shell → criteria)

    public init(sections: [FilterSection]) {
        self.init()
        for section in sections {
            switch (section.id, section.control) {
            case let ("contentType", .chipGroup(_, selectedIds)):
                kinds = Set(selectedIds.compactMap(ExploreKind.init(rawValue:)))
            case let ("distance", .stepSlider(_, selectedIndex, _)):
                if Self.distanceStops.indices.contains(selectedIndex) {
                    distanceUpper = Self.distanceStops[selectedIndex]
                }
            case let ("refine", .toggle(_, selectedIds)):
                verifiedOnly = selectedIds.contains("verified")
                openNow = selectedIds.contains("openNow")
            default:
                break
            }
        }
    }

    // MARK: Stop formatting

    private static func stopId(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }

    private static func stopLabel(_ value: Double) -> String {
        "\(stopId(value)) mi"
    }
}

// MARK: - Sheet

/// Explore-map filter bottom sheet. Host presents it via `.sheet`.
@MainActor
public struct ExploreFilterSheet: View {
    private let criteria: ExploreFilterCriteria
    private let onApply: @MainActor (ExploreFilterCriteria) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        criteria: ExploreFilterCriteria,
        onApply: @escaping @MainActor (ExploreFilterCriteria) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.criteria = criteria
        self.onApply = onApply
        self.onClose = onClose
    }

    public var body: some View {
        FilterSheetShell(
            title: "Filters",
            sections: criteria.sections(),
            onApply: { sections in onApply(ExploreFilterCriteria(sections: sections)) },
            onClose: onClose
        )
        .accessibilityIdentifier("exploreFilterSheet")
    }
}

#Preview("Default") {
    ExploreFilterSheet(criteria: ExploreFilterCriteria(), onApply: { _ in }, onClose: {})
}

#Preview("Active") {
    ExploreFilterSheet(
        criteria: ExploreFilterCriteria(
            kinds: [.task, .spot],
            distanceUpper: 1,
            verifiedOnly: true,
            openNow: true
        ),
        onApply: { _ in },
        onClose: {}
    )
}
