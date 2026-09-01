//
//  TasksMapContent.swift
//  Pantopus
//
//  A11.1 Tasks map — the Gigs-only mode of the map+list hybrid archetype
//  (`Features/Shared/MapListHybrid`). Reached from the Gigs feed's
//  list/map toggle. Same canvas as the generic Nearby map, filtered to
//  tasks with a "Post task" button below the locate / layers controls.
//
//  Content the view consumes: one `TaskMapItem` per pin / rail card /
//  list row, the four render states, the detent → sheet-body projection,
//  the empty-state CTA ladder, and the pure map-geometry helpers
//  (search-this-area trigger, client-side clustering, fit-to-pins) that
//  keep the view-model free of MapKit.
//

import SwiftUI

/// One task — a pin on the map, a card in the sheet rail, and a row in
/// the expanded full list, rolled up. Coordinates are raw lat/lon
/// doubles so the model stays free of MapKit.
public struct TaskMapItem: Identifiable, Sendable, Hashable {
    public let id: String
    public let category: GigsCategory
    public let state: MapPinState
    public let latitude: Double
    public let longitude: Double
    public let title: String
    /// Short description shown by the expanded-detent `GigRow`.
    public let body: String
    /// Free-form price string ("$60", "$22/walk", "$180").
    public let price: String
    public let distanceLabel: String
    public let bidCount: Int
    // P2 follow-up — raw fields the structured filter sheet matches on
    // (`GigFilterCriteria.matches`). Defaults keep seed/preview items
    // passing every dimension.
    public let priceValue: Double?
    public let scheduleType: String?
    public let acceptedBy: String?
    public let createdAt: String?

    public init(
        id: String,
        category: GigsCategory,
        state: MapPinState = .confirmed,
        latitude: Double,
        longitude: Double,
        title: String,
        body: String = "",
        price: String,
        distanceLabel: String,
        bidCount: Int,
        priceValue: Double? = nil,
        scheduleType: String? = nil,
        acceptedBy: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.category = category
        self.state = state
        self.latitude = latitude
        self.longitude = longitude
        self.title = title
        self.body = body
        self.price = price
        self.distanceLabel = distanceLabel
        self.bidCount = bidCount
        self.priceValue = priceValue
        self.scheduleType = scheduleType
        self.acceptedBy = acceptedBy
        self.createdAt = createdAt
    }

    /// Projection into the shell's pin model — the colour comes from the
    /// gig category swatch, the white-ring / dashed-outline treatment from
    /// the task's `state`.
    public var pin: MapPin {
        MapPin(
            id: id,
            latitude: latitude,
            longitude: longitude,
            color: category.color,
            state: state
        )
    }

    /// Expanded-detent projection — the full vertical list reuses the
    /// feed's `GigRow`, so each map item re-materialises as a feed card.
    public var cardContent: GigCardContent {
        GigCardContent(
            id: id,
            category: category,
            metaLine: "",
            title: title,
            body: body,
            price: price,
            bidCount: bidCount,
            distanceLabel: distanceLabel
        )
    }
}

/// Render state for the Tasks map. Mirrors the four-state contract every
/// fetchable Pantopus surface ships.
public enum TasksMapState: Sendable {
    case loading
    case populated([TaskMapItem])
    case empty
    case error(message: String)
}

/// What the populated sheet body renders at each detent (A11.1):
/// header-only when collapsed, the horizontal card rail at the standard
/// stop, the full vertical `GigRow` list when expanded.
public enum TasksMapSheetMode: Sendable, Equatable {
    case headerOnly
    case rail
    case fullList

    public static func mode(for detent: MapListHybridDetent) -> TasksMapSheetMode {
        switch detent {
        case .collapsed: .headerOnly
        case .standard: .rail
        case .expanded: .fullList
        }
    }
}

/// Secondary CTA in the empty sheet. Ladder: "Widen search" zooms the
/// camera out ×2.5 and refetches; once a widened refetch comes back
/// empty AND the backend supplied a `nearest_activity_center`, the
/// button becomes "Jump to activity".
public enum TasksMapEmptyAction: Sendable, Equatable {
    case widen
    case jumpToActivity(latitude: Double, longitude: Double)
}

// MARK: - Pure map geometry

/// MapKit-free geometry helpers for the Tasks map. Pure functions so
/// unit tests drive them directly; the view-model is their only
/// production caller.
public enum TasksMapGeometry {
    /// "Search this area" trigger — true when the settled camera's
    /// center moved by more than ~25% of the previously fetched span,
    /// or its span changed by more than ~50% (zoomed in/out).
    public static func regionChangedSignificantly(
        from: MapListHybridRegion,
        to: MapListHybridRegion
    ) -> Bool {
        if abs(to.centerLatitude - from.centerLatitude) > from.latitudeSpan * 0.25 { return true }
        if abs(to.centerLongitude - from.centerLongitude) > from.longitudeSpan * 0.25 { return true }
        let latRatio = to.latitudeSpan / max(from.latitudeSpan, .ulpOfOne)
        let lonRatio = to.longitudeSpan / max(from.longitudeSpan, .ulpOfOne)
        return latRatio > 1.5 || latRatio < 1 / 1.5 || lonRatio > 1.5 || lonRatio < 1 / 1.5
    }

    /// Result of the client-side clustering pass — pins that stay
    /// individual plus the cluster markers replacing dense groups.
    public struct ClusteredPins: Sendable, Equatable {
        public let singles: [MapPin]
        public let clusters: [MapClusterPin]

        public init(singles: [MapPin], clusters: [MapClusterPin]) {
            self.singles = singles
            self.clusters = clusters
        }
    }

    /// Client-side clustering — grid-bucket keyed off the viewport span.
    /// Pins whose on-screen separation would be under `thresholdPt`
    /// (~44 pt ≈ one pin tap target) share a bucket; buckets with two or
    /// more pins collapse into a `MapClusterPin` at their centroid. At
    /// high zoom the cell shrinks below typical pin spacing, so
    /// everything stays a single — no explicit zoom gate needed.
    ///
    /// Output is stable for a given input: singles keep the input pin
    /// order, clusters surface in first-seen bucket order with
    /// deterministic `cluster_<x>_<y>` ids.
    public static func buildClusteredPins(
        pins: [MapPin],
        span: Double,
        mapWidthPt: Double = 390,
        thresholdPt: Double = 44
    ) -> ClusteredPins {
        guard span > 0, pins.count > 1 else {
            return ClusteredPins(singles: pins, clusters: [])
        }
        let cellDegrees = span * thresholdPt / mapWidthPt
        struct Cell: Hashable {
            let x: Int
            let y: Int
        }
        var buckets: [Cell: [MapPin]] = [:]
        var order: [Cell] = []
        for pin in pins {
            let cell = Cell(
                x: Int((pin.longitude / cellDegrees).rounded(.down)),
                y: Int((pin.latitude / cellDegrees).rounded(.down))
            )
            if buckets[cell] == nil { order.append(cell) }
            buckets[cell, default: []].append(pin)
        }
        var singles: [MapPin] = []
        var clusters: [MapClusterPin] = []
        for cell in order {
            guard let members = buckets[cell] else { continue }
            if members.count == 1 {
                singles.append(contentsOf: members)
            } else {
                clusters.append(MapClusterPin(
                    id: "cluster_\(cell.x)_\(cell.y)",
                    latitude: members.map(\.latitude).reduce(0, +) / Double(members.count),
                    longitude: members.map(\.longitude).reduce(0, +) / Double(members.count),
                    count: members.count
                ))
            }
        }
        return ClusteredPins(singles: singles, clusters: clusters)
    }

    /// Camera region fitting every pin with padding — backs the
    /// focus-on-pins map control. `nil` when there are no pins.
    public static func fittingRegion(
        pins: [MapPin],
        paddingFactor: Double = 1.4,
        minimumSpan: Double = 0.005
    ) -> MapListHybridRegion? {
        guard let first = pins.first else { return nil }
        var minLat = first.latitude
        var maxLat = first.latitude
        var minLon = first.longitude
        var maxLon = first.longitude
        for pin in pins.dropFirst() {
            minLat = min(minLat, pin.latitude)
            maxLat = max(maxLat, pin.latitude)
            minLon = min(minLon, pin.longitude)
            maxLon = max(maxLon, pin.longitude)
        }
        return MapListHybridRegion(
            centerLatitude: (minLat + maxLat) / 2,
            centerLongitude: (minLon + maxLon) / 2,
            latitudeSpan: max((maxLat - minLat) * paddingFactor, minimumSpan),
            longitudeSpan: max((maxLon - minLon) * paddingFactor, minimumSpan)
        )
    }
}

/// Rail-card tile glyph for a task category. Best-fit from the typed icon
/// set for the design's per-category Lucide glyphs — `spray-can`,
/// `truck`, and `book-open` aren't in `PantopusIcon`, so `sparkles`,
/// `package`, and `graduation-cap` stand in.
func taskCategoryGlyph(_ category: GigsCategory) -> PantopusIcon {
    switch category {
    case .all: .circle
    case .handyman: .hammer
    case .cleaning: .sparkles
    case .moving: .package
    case .petcare: .pawPrint
    case .childcare: .baby
    case .tutoring: .graduationCap
    case .tech: .laptop
    case .delivery: .send
    }
}
