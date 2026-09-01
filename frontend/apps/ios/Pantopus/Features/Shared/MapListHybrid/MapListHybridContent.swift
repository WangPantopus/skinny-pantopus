//
//  MapListHybridContent.swift
//  Pantopus
//
//  T6.6a (P24) — Shared archetype shell types for the map+list hybrid
//  surface. Three detent stops, pin model, and the pure detent-snap
//  resolver. The shell itself (`MapListHybridShell`) lives alongside.
//
//  Decision context: docs/t6-open-questions-decisions.md Q9. The three
//  detents are screen-relative fractions (20% / 40% / 90%) so the same
//  gesture lands at the same visual proportion on every device. (A11.1
//  Tasks map raised the expanded stop from 70% → 90%; the move to
//  fractions also retired the device-fragile absolute 160/296/518 pt.)
//

import CoreGraphics
import Foundation
import SwiftUI

/// Three snap stops for the map+list hybrid sheet.
///
/// Heights are screen-relative fractions per the T6.6a Q9 contract
/// (revised by A11.1):
/// - `.collapsed` (20%) shows header + drag-to-expand prompt
/// - `.standard` (40%) shows header + carousel of rail cards
/// - `.expanded` (90%) shows header + full vertical list
public enum MapListHybridDetent: CaseIterable, Sendable, Hashable {
    case collapsed
    case standard
    case expanded

    /// Fraction of the available screen height the sheet occupies at this
    /// stop. Screen-relative (not absolute pt) so the same gesture lands
    /// at the same visual proportion on every device size.
    public var heightFraction: CGFloat {
        switch self {
        case .collapsed: 0.20
        case .standard: 0.40
        case .expanded: 0.90
        }
    }

    /// Absolute sheet height for a given container height.
    public func height(in containerHeight: CGFloat) -> CGFloat {
        containerHeight * heightFraction
    }
}

/// One pin on the map. Coordinates are raw lat/lon doubles so the model
/// stays free of MapKit imports for consumers that only need the data
/// shape (view-models, tests).
public struct MapPin: Identifiable, Sendable, Hashable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let color: Color
    public let state: MapPinState

    public init(
        id: String,
        latitude: Double,
        longitude: Double,
        color: Color,
        state: MapPinState = .confirmed
    ) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.color = color
        self.state = state
    }
}

/// Per-pin lifecycle state. Drives the visual treatment per design:
/// confirmed gets a white ring, pending dashes its color outline.
public enum MapPinState: Sendable, Hashable {
    case confirmed
    case pending
}

/// Several pins collapsed into one marker at low zoom (A11.1). Built by
/// consumers via a pure clustering function — the shell only renders
/// the 28 pt primary disc with the white count + ring.
public struct MapClusterPin: Identifiable, Sendable, Hashable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let count: Int

    public init(id: String, latitude: Double, longitude: Double, count: Int) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.count = count
    }
}

/// MapKit-free viewport descriptor — the shell reports the settled
/// camera through it (`onCameraChange`) and consumers request camera
/// moves with it (`MapListHybridCameraRequest`), so view-models stay
/// unit-testable without the map SDK.
public struct MapListHybridRegion: Sendable, Equatable {
    public let centerLatitude: Double
    public let centerLongitude: Double
    public let latitudeSpan: Double
    public let longitudeSpan: Double

    public init(
        centerLatitude: Double,
        centerLongitude: Double,
        latitudeSpan: Double,
        longitudeSpan: Double
    ) {
        self.centerLatitude = centerLatitude
        self.centerLongitude = centerLongitude
        self.latitudeSpan = latitudeSpan
        self.longitudeSpan = longitudeSpan
    }

    public var minLatitude: Double {
        centerLatitude - latitudeSpan / 2
    }

    public var maxLatitude: Double {
        centerLatitude + latitudeSpan / 2
    }

    public var minLongitude: Double {
        centerLongitude - longitudeSpan / 2
    }

    public var maxLongitude: Double {
        centerLongitude + longitudeSpan / 2
    }

    /// Same center, span multiplied — the "Widen search" ×2.5 zoom-out
    /// and the cluster-tap ÷2 zoom-in both go through here.
    public func scaled(by factor: Double) -> MapListHybridRegion {
        MapListHybridRegion(
            centerLatitude: centerLatitude,
            centerLongitude: centerLongitude,
            latitudeSpan: latitudeSpan * factor,
            longitudeSpan: longitudeSpan * factor
        )
    }

    /// Same span, new center — rail-page → pan-to-pin sync.
    public func recentered(latitude: Double, longitude: Double) -> MapListHybridRegion {
        MapListHybridRegion(
            centerLatitude: latitude,
            centerLongitude: longitude,
            latitudeSpan: latitudeSpan,
            longitudeSpan: longitudeSpan
        )
    }
}

/// Token-identified camera move. The shell applies `region` (animated)
/// whenever the value changes — bump `token` to re-request the same
/// region twice.
public struct MapListHybridCameraRequest: Sendable, Equatable {
    public let token: Int
    public let region: MapListHybridRegion

    public init(token: Int, region: MapListHybridRegion) {
        self.token = token
        self.region = region
    }
}

/// User-coordinate anchor for the "you are here" overlay disc. The
/// shell defaults to `nil` (no overlay) — callers pass in their
/// `LocationProviding` snapshot when available.
public struct MapAnchor: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// Pure resolver for the next detent after a drag release. Extracted so
/// unit tests can verify the snap-to-nearest + velocity-nudge math
/// without spinning up the SwiftUI hierarchy.
///
/// Sign convention is shared with the Android + web resolvers so the
/// same gesture lands at the same stop on every platform:
///
/// - **Positive velocity = downward flick** → sheet shrinks
///   (`expanded` → `standard` → `collapsed`)
/// - **Negative velocity = upward flick** → sheet grows
///   (`collapsed` → `standard` → `expanded`)
///
/// This matches Compose's `draggable` and the browser's pointer
/// `clientY` delta conventions. iOS shells should pass the raw
/// `gesture.predictedEndTranslation.height` (which UIKit makes positive
/// when the finger moves down) without flipping the sign.
///
/// - Parameters:
///   - current: detent at drag start
///   - velocity: predicted vertical velocity in points / second
///     (positive = downward)
///   - displacedFraction: live sheet height as a fraction of the screen
///     height the moment the gesture released
/// - Returns: the detent the sheet should snap to.
public enum MapListHybridDetentResolver {
    /// Points-per-second threshold for a flick gesture to nudge one
    /// detent past the snap-to-nearest target.
    public static let velocityThreshold: CGFloat = 600

    public static func resolve(
        from current: MapListHybridDetent,
        velocity: CGFloat,
        displacedFraction: CGFloat
    ) -> MapListHybridDetent {
        let sorted = MapListHybridDetent.allCases.sorted { a, b in
            abs(a.heightFraction - displacedFraction) < abs(b.heightFraction - displacedFraction)
        }
        var target = sorted.first ?? current

        if velocity > velocityThreshold {
            // Flick down → shrink one detent.
            switch current {
            case .expanded: target = .standard
            case .standard: target = .collapsed
            case .collapsed: target = .collapsed
            }
        } else if velocity < -velocityThreshold {
            // Flick up → grow one detent.
            switch current {
            case .collapsed: target = .standard
            case .standard: target = .expanded
            case .expanded: target = .expanded
            }
        }
        return target
    }
}
