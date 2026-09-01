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
