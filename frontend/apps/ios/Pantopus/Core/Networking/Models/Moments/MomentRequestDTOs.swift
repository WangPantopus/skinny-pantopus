//
//  MomentRequestDTOs.swift
//  Pantopus
//
//  What the phone sends to post a Moment (`POST /api/moments`, contract in
//  `~/pantopus-moments/coord/CONTRACT.md`): where the pin goes, and the post
//  itself. Beside `MomentsDTOs.swift`, which has no room.
//

import Foundation

// MARK: - Requests

/// Where the pin goes: a GPS fix at most five minutes old, or where a library
/// photo or video was taken (in the last 24 hours).
public struct MomentLocationBody: Encodable, Sendable, Hashable {
    public enum Source: String, Encodable, Sendable {
        /// `none`: no location (contract v3.4): connections only, no point.
        case gps, capture, none
    }

    /// A Moment with no location.
    public static let noLocation = MomentLocationBody(source: .none, latitude: 0, longitude: 0, at: Date())

    public let source: Source
    public let latitude: Double
    public let longitude: Double
    /// When the fix was taken (`gps`) or the photo or video was (`capture`).
    public let at: Date

    public init(source: Source, latitude: Double, longitude: Double, at: Date) {
        self.source = source
        self.latitude = latitude
        self.longitude = longitude
        self.at = at
    }

    private enum CodingKeys: String, CodingKey {
        case source, latitude, longitude
        case fixAt = "fix_at"
        case takenAt = "taken_at"
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(source, forKey: .source)
        guard source != .none else { return }
        try c.encode(latitude, forKey: .latitude)
        try c.encode(longitude, forKey: .longitude)
        try c.encode(MomentTime.string(at), forKey: source == .gps ? .fixAt : .takenAt)
    }
}

/// `POST /api/moments`.
public struct MomentCreateBody: Encodable, Sendable, Hashable {
    public let kind: MomentKind
    public let hours: Int
    public let audience: MomentAudience
    public let showArea: Bool
    public let caption: String?
    public let text: String?
    public let background: String?
    public let location: MomentLocationBody
    /// One id per Post tap (a uuid): sending it again answers with the Moment
    /// that tap made, so a retry after a lost answer never posts twice.
    public var clientRequestId: String?
    /// The place name the person picked (a key from place-preview's `places`); left out for the automatic one.
    public var placeKey: String?
    /// When an album photo or video pinned where you are (its file doesn't say where) was taken (contract v3.3).
    public var takenAt: String?
    /// A venue picked in the place picker around the pin (its `osm:` id, contract v3.3): the Moment pins there.
    public var venueId: String?
    /// "Show elevation" was on (contract v3.8, `MomentHeightDTOs.swift`); left out otherwise.
    public var altitude: MomentAltitudeBody?

    private enum CodingKeys: String, CodingKey {
        case kind, hours, audience, caption, text, background, location, altitude
        case showArea = "show_area"
        case clientRequestId = "client_request_id"
        case placeKey = "place_key"
        case takenAt = "taken_at"
        case venueId = "venue_id"
    }
}
