//
//  MapFilterSheet.swift
//  Pantopus
//
//  P5.3 — Nearby map filter bottom sheet. Same gig dimensions as
//  `GigFilterSheet` (category / budget / schedule / open-to-bids /
//  posted-within) plus an entity-type selector at the top and a
//  distance-radius slider. Filtering runs client-side over the already
//  fetched map entities so Apply re-projects the pins + sheet rail
//  immediately.
//

import Foundation
import SwiftUI

// MARK: - Entity type

/// Which entity kinds the map shows. `both` is the default / cleared
/// position.
public enum MapEntityType: String, CaseIterable, Sendable, Hashable, Identifiable {
    case both
    case gigs
    case listings

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .both: "Both"
        case .gigs: "Gigs"
        case .listings: "Listings"
        }
    }

    var allowsGigs: Bool {
        self != .listings
    }

    var allowsListings: Bool {
        self != .gigs
    }
}

// MARK: - Criteria

/// The applied Nearby-map filter selection. Wraps a `GigFilterCriteria`
/// for the gig dimensions and layers entity-type + distance on top.
public struct MapFilterCriteria: Sendable, Hashable {
    public var entityType: MapEntityType
    /// Lower distance handle (miles). `distanceMin` == no lower bound.
    public var distanceLower: Double
    /// Upper distance handle (miles). `distanceMax` == "no radius cap".
    public var distanceUpper: Double
    /// Shared gig dimensions (category / budget / schedule / bids / age).
    public var gig: GigFilterCriteria

    /// Distance slider domain (miles).
    public static let distanceMin: Double = 0
    public static let distanceMax: Double = 5
    public static let distanceStep: Double = 1

    public init(
        entityType: MapEntityType = .both,
        distanceLower: Double = MapFilterCriteria.distanceMin,
        distanceUpper: Double = MapFilterCriteria.distanceMax,
        gig: GigFilterCriteria = GigFilterCriteria()
    ) {
        self.entityType = entityType
        self.distanceLower = distanceLower
        self.distanceUpper = distanceUpper
        self.gig = gig
    }

    var isDistanceActive: Bool {
        distanceLower > Self.distanceMin || distanceUpper < Self.distanceMax
    }

    public var activeCount: Int {
        var count = gig.activeCount
        if entityType != .both { count += 1 }
        if isDistanceActive { count += 1 }
        return count
    }

    // MARK: Sections (criteria → shell)

    public func sections() -> [FilterSection] {
        var sections: [FilterSection] = [
            FilterSection(
                id: "entityType",
                title: "Show",
                control: .radio(
                    options: MapEntityType.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedId: entityType.rawValue
                )
            ),
            FilterSection(
                id: "distance",
                title: "Distance (mi)",
                control: .rangeSlider(
                    FilterRange(
                        min: Self.distanceMin,
                        max: Self.distanceMax,
                        lower: distanceLower,
                        upper: distanceUpper,
                        step: Self.distanceStep
                    )
                )
            )
        ]
        // The map contributes its own radius *range* and the gig criteria
        // contribute radius *presets*; both are kept deliberately, and they
        // intersect when filtering. Two headers reading "Distance" would be
        // unreadable, so the gig-supplied one is retitled here only. The ids
        // stay as they are — both parse sides discriminate on control type,
        // and the shell iterates by index, so the repeat is harmless.
        sections.append(contentsOf: gig.sections().map { section in
            guard section.id == "distance" else { return section }
            return FilterSection(id: section.id, title: "Gig radius", control: section.control)
        })
        return sections
    }

    // MARK: Parse (shell → criteria)

    public init(sections: [FilterSection]) {
        self.init()
        for section in sections {
            switch (section.id, section.control) {
            case let ("entityType", .radio(_, selectedId)):
                entityType = selectedId.flatMap(MapEntityType.init(rawValue:)) ?? .both
            case let ("distance", .rangeSlider(range)):
                distanceLower = range.lower
                distanceUpper = range.upper
            default:
                break
            }
        }
        // Gig dimensions parse themselves out of the same section list by id.
        gig = GigFilterCriteria(sections: sections)
    }

    // MARK: Predicates

    func matchesDistance(_ miles: Double?) -> Bool {
        guard isDistanceActive else { return true }
        guard let miles else { return false }
        if miles < distanceLower { return false }
        if distanceUpper < Self.distanceMax, miles > distanceUpper { return false }
        return true
    }

    public func matchesGig(_ gigDTO: GigDTO, distanceMiles: Double?, now: Date = Date()) -> Bool {
        guard entityType.allowsGigs else { return false }
        guard matchesDistance(distanceMiles) else { return false }
        return gig.matches(gigDTO, now: now)
    }

    public func matchesListing(_ listing: ListingDTO, distanceMiles: Double?) -> Bool {
        guard entityType.allowsListings else { return false }
        guard matchesDistance(distanceMiles) else { return false }
        // Schedule / open-to-bids / posted-within are gig-only concepts —
        // listings only honour the category + budget dimensions.
        guard gig.matchesCategory(GigsCategory.from(backendKey: listing.category)) else { return false }
        return gig.matchesBudget(listing.price)
    }
}

// MARK: - Sheet

/// Nearby map filter bottom sheet. Host presents it via `.sheet`.
@MainActor
public struct MapFilterSheet: View {
    private let criteria: MapFilterCriteria
    private let onApply: @MainActor (MapFilterCriteria) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        criteria: MapFilterCriteria,
        onApply: @escaping @MainActor (MapFilterCriteria) -> Void,
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
            onApply: { sections in onApply(MapFilterCriteria(sections: sections)) },
            onClose: onClose
        )
        .accessibilityIdentifier("mapFilterSheet")
    }
}

#Preview("Default") {
    MapFilterSheet(criteria: MapFilterCriteria(), onApply: { _ in }, onClose: {})
}

#Preview("Active") {
    MapFilterSheet(
        criteria: MapFilterCriteria(
            entityType: .gigs,
            distanceLower: 0,
            distanceUpper: 2,
            gig: GigFilterCriteria(categories: [.handyman], openToBids: true)
        ),
        onApply: { _ in },
        onClose: {}
    )
}
