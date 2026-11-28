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
    /// A part of a video longer than one Moment (contract v3.11); left out for any other Moment.
    public var series: MomentSeriesDTO?
    /// The Sky (v4.0): `"place"` pins the Moment at a public place (the `venue_id`, else the one that names the spot).
    public var pin: String?
    /// The Sky (v4.0): hold the Moment until then, `1h`, `3h` or `tonight`; left out to post now.
    public var shareLater: String?
    /// The app's own camera made this photo or video just now, here (v4.1, the Live mark); left out otherwise.
    public var takenHere: Bool?
    /// "Show the weather" was on (v4.1): the server reads the weather at the pin itself; left out otherwise.
    public var showWeather: Bool?
    /// `"pen_name"`: posted under the person's made-up name (`docs/product/made-up-names/README.md`, "Moments"); left
    /// out for the person's own name.
    public var postAs: String?
    /// The Studio's stamps ("Pulse, reinvented", CONTRACT 2b): where each sits; the server fills their values. Left out
    /// when none were placed.
    public var stamps: [MomentStampPlacement]?
    /// The phone's height for an elevation stamp (CONTRACT 2b), apart from `altitude` ("Show elevation").
    public var elevation: MomentAltitudeBody?
    /// The Studio's "Guess the spot" (CONTRACT 5a); left out otherwise.
    public var guess: Bool?
    /// The Studio's "Also show in Explore" (CONTRACT 6f); left out otherwise.
    public var explore: Bool?
    /// The Studio's playable items (CONTRACT 7b, 7g: a before and after, ...); left out when there are none.
    public var play: [MomentPlayItem]?
    /// The Studio's mentions in the caption (CONTRACT 7h): up to five connections' ids; left out when none.
    public var mentions: [String]?
    /// The Studio's dots on things in the photo (CONTRACT 7c); left out when there are none.
    public var dots: [MomentDotDTO]?
    /// The Studio's step deck (CONTRACT 7g): this step, the deck's id and how many; left out otherwise.
    public var deck: MomentDeckBody?
    /// The Studio's loop (CONTRACT 7j): the whole file is the loop, `bounce` says it plays back too; left out otherwise.
    public var loop: MomentLoopBody?
    /// The camera's heading at the shot (CONTRACT 9h, `MomentsStudioCompass`); left out otherwise.
    public var heading: MomentHeadingBody?
    /// The Studio's whole picture (CONTRACT 10c): shown as composed, never cut; left out otherwise.
    public var whole: Bool?
    /// A whole video's place on the 9:16 canvas (CONTRACT 10c); left out otherwise.
    public var placement: MomentWholePlacementDTO?
    /// The two backdrop colours around a whole picture (CONTRACT 10c); left out otherwise.
    public var backdrop: MomentBackdropDTO?

    private enum CodingKeys: String, CodingKey {
        case kind, hours, audience, caption, text, background, location, altitude, series, pin
        case shareLater = "share_later"
        case takenHere = "taken_here"
        case showWeather = "show_weather"
        case postAs = "post_as"
        case stamps, elevation, guess, explore, play, mentions, dots, deck, loop, heading, whole, placement, backdrop
        case showArea = "show_area"
        case clientRequestId = "client_request_id"
        case placeKey = "place_key"
        case takenAt = "taken_at"
        case venueId = "venue_id"
    }
}
