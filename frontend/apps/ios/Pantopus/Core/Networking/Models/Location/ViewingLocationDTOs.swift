//
//  ViewingLocationDTOs.swift
//  Pantopus
//
//  Wire types for `/api/location` (`backend/routes/location.js`). The
//  serializers hand-map every column to camelCase
//  (`formatVL` at `backend/routes/location.js:49`, `formatRecent` at
//  `backend/routes/location.js:67`), so no snake_case keys appear here.
//

import Foundation

/// `GET /api/location` (`backend/routes/location.js:116-135`).
public struct ViewingLocationPayload: Decodable, Sendable, Hashable {
    public let viewingLocation: ViewingLocationDTO?
    public let recentLocations: [RecentLocationDTO]
    public let homes: [HomeLocationDTO]
    public let businessLocations: [ViewingBusinessLocationDTO]

    public init(
        viewingLocation: ViewingLocationDTO? = nil,
        recentLocations: [RecentLocationDTO] = [],
        homes: [HomeLocationDTO] = [],
        businessLocations: [ViewingBusinessLocationDTO] = []
    ) {
        self.viewingLocation = viewingLocation
        self.recentLocations = recentLocations
        self.homes = homes
        self.businessLocations = businessLocations
    }
}

/// The active viewing location (`backend/routes/location.js:49`).
public struct ViewingLocationDTO: Decodable, Sendable, Hashable {
    public let label: String
    /// `gps | home | business | searched | recent`.
    public let type: String
    public let latitude: Double
    public let longitude: Double
    public let radiusMiles: Double?
    public let isPinned: Bool?
    public let sourceId: String?
    public let city: String?
    public let state: String?
    public let updatedAt: String?
}

/// One row of the recents list (`backend/routes/location.js:67`).
public struct RecentLocationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let type: String
    public let latitude: Double
    public let longitude: Double
    public let radiusMiles: Double?
    public let sourceId: String?
    public let city: String?
    public let state: String?
    public let usedAt: String?
}

/// One of the viewer's homes with coordinates
/// (`backend/routes/location.js:120-127`).
public struct HomeLocationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    public let city: String?
    public let state: String?
    public let latitude: Double?
    public let longitude: Double?
}

/// One of the viewer's business locations
/// (`backend/routes/location.js:128-136`).
public struct ViewingBusinessLocationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let businessName: String?
    public let label: String?
    public let city: String?
    public let state: String?
    public let latitude: Double?
    public let longitude: Double?
}

/// `PUT /api/location` echo (`backend/routes/location.js:224`).
public struct SetViewingLocationResponse: Decodable, Sendable, Hashable {
    public let viewingLocation: ViewingLocationDTO?
}

/// `PUT /api/location/radius` echo (`backend/routes/location.js:288`).
public struct SetViewingRadiusResponse: Decodable, Sendable, Hashable {
    public let radiusMiles: Double?
}
