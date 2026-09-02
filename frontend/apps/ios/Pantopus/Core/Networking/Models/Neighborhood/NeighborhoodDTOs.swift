//
//  NeighborhoodDTOs.swift
//  Pantopus
//
//  Wedge Phase 1 — the density-gated Neighborhood door's meter payload.
//

import Foundation

/// `GET /api/neighborhood/meter` response. Mirrors the web contract in
/// `frontend/packages/api/src/endpoints/neighborhood.ts`: below the k-anon
/// floor the exact count is withheld (`verifiedCount == nil`, state
/// `forming`) so the first few residents of a cell can't be singled out.
public struct NeighborhoodMeterDTO: Decodable, Sendable, Hashable {
    public enum State: String, Decodable, Sendable {
        case noPlace = "no_place"
        case forming
        case growing
        case unlocked
    }

    public struct Area: Decodable, Sendable, Hashable {
        public let city: String?
        public let state: String?

        public init(city: String?, state: String?) {
            self.city = city
            self.state = state
        }
    }

    public let state: State
    public let verifiedCount: Int?
    public let kAnonMin: Int
    public let threshold: Int
    public let unlocked: Bool
    public let area: Area?

    enum CodingKeys: String, CodingKey {
        case state
        case verifiedCount = "verified_count"
        case kAnonMin = "k_anon_min"
        case threshold
        case unlocked
        case area
    }

    public init(
        state: State,
        verifiedCount: Int?,
        kAnonMin: Int,
        threshold: Int,
        unlocked: Bool,
        area: Area?
    ) {
        self.state = state
        self.verifiedCount = verifiedCount
        self.kAnonMin = kAnonMin
        self.threshold = threshold
        self.unlocked = unlocked
        self.area = area
    }
}

// MARK: - The window: density by block cell (Wedge v2 §4)

/// `GET /api/neighborhood/cells`. Each cell carries a box and a floored
/// bucket — never a count below the privacy floor, never a point. The
/// viewer's own cell is flagged; `center` is that CELL's centre, not the
/// home's. Mirrors `NeighborhoodCells` in the web API package.
public struct NeighborhoodCellsDTO: Decodable, Sendable, Hashable {
    public struct Cell: Decodable, Sendable, Hashable, Identifiable {
        public let geohash: String
        /// [[minLat, minLng], [maxLat, maxLng]].
        public let bounds: [[Double]]
        /// none | forming | few | growing (open set: unknown reads as none).
        public let bucket: String
        public let isHome: Bool

        public var id: String { geohash }

        enum CodingKeys: String, CodingKey {
            case geohash, bounds, bucket
            case isHome = "is_home"
        }
    }

    public struct Center: Decodable, Sendable, Hashable {
        public let lat: Double
        public let lng: Double
    }

    /// no_place | ready.
    public let state: String
    public let homeCell: String?
    public let center: Center?
    public let cells: [Cell]
    /// bucket → legend label, written by the server from the same thresholds.
    public let buckets: [String: String]
    public let kAnonMin: Int

    enum CodingKeys: String, CodingKey {
        case state, center, cells, buckets
        case homeCell = "home_cell"
        case kAnonMin = "k_anon_min"
    }

    public var isReady: Bool { state == "ready" && center != nil }
}

/// Fill alpha by bucket — none is transparent, growing the strongest.
/// Same values as the web and Android windows.
public func neighborhoodCellFillAlpha(_ bucket: String) -> Double {
    switch bucket {
    case "forming": 0.14
    case "few": 0.32
    case "growing": 0.55
    default: 0
    }
}

/// Legend order, lightest to strongest.
public let neighborhoodCellLegendOrder: [String] = ["none", "forming", "few", "growing"]
