//
//  MomentsDTOs.swift
//  Pantopus
//
//  Moments API shapes (`~/pantopus-moments/coord/CONTRACT.md`, server
//  `backend/routes/moments.js`). A Moment is a photo, a video up to 30 s or a
//  text card, pinned where it was posted, that ends on time. Several Moments
//  by one person at one spot come as one ring. Media links are signed and
//  short-lived: they are used to load the file and never kept.
//

import Foundation

/// What a Moment holds.
public enum MomentKind: String, Codable, Sendable, Hashable {
    case photo, video, text

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = MomentKind(rawValue: raw) ?? .photo
    }
}

/// Who sees a Moment: anyone signed in looking at that spot, or the author's connections.
public enum MomentAudience: String, Codable, Sendable, Hashable, CaseIterable {
    case nearby, connections
}

/// Where a Moment is on its way to the map.
public enum MomentState: String, Sendable, Hashable {
    case uploading, checking, live, held, ended
}

/// Who posted: a person, a business, or the Pantopus curator.
public struct MomentAuthorDTO: Codable, Sendable, Hashable {
    public enum Kind: String, Codable, Sendable, Hashable {
        case person, business, pantopus
    }

    public let id: String
    public let name: String
    public let firstName: String?
    public let avatarURL: String?
    public let initialsValue: String?
    public let verified: Bool
    public let kind: Kind

    private enum CodingKeys: String, CodingKey {
        case id, name, verified, kind
        case firstName = "first_name"
        case avatarURL = "avatar_url"
        case initialsValue = "initials"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        firstName = try c.decodeIfPresent(String.self, forKey: .firstName)
        avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        initialsValue = try c.decodeIfPresent(String.self, forKey: .initialsValue)
        verified = try c.decodeIfPresent(Bool.self, forKey: .verified) ?? false
        kind = try (c.decodeIfPresent(String.self, forKey: .kind)).flatMap(Kind.init(rawValue:)) ?? .person
    }

    public init(id: String, name: String, firstName: String?, avatarURL: String?, initials: String?, verified: Bool, kind: Kind) {
        self.id = id
        self.name = name
        self.firstName = firstName
        self.avatarURL = avatarURL
        initialsValue = initials
        self.verified = verified
        self.kind = kind
    }

    public var photoURL: URL? {
        avatarURL.flatMap { $0.isEmpty ? nil : URL(string: $0) }
    }

    /// "Priya" for "Reply to Priya": the first name, else the name's first word.
    public var shortName: String {
        if let firstName, !firstName.isEmpty { return firstName }
        return name.split(separator: " ").first.map(String.init) ?? name
    }

    /// The initials the server sent, else the name's first two initials.
    public var initials: String {
        if let initialsValue, !initialsValue.isEmpty { return initialsValue }
        let letters = name.split(separator: " ").prefix(2).compactMap(\.first)
        return letters.isEmpty ? "?" : String(letters).uppercased()
    }
}

/// One Moment in a ring, in the order they play.
public struct MomentBriefDTO: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: MomentKind
    public let createdAt: String
    public let expiresAt: String
    public var seen: Bool

    private enum CodingKeys: String, CodingKey {
        case id, kind, seen
        case createdAt = "created_at"
        case expiresAt = "expires_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = try c.decodeIfPresent(MomentKind.self, forKey: .kind) ?? .photo
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        expiresAt = try c.decodeIfPresent(String.self, forKey: .expiresAt) ?? ""
        seen = try c.decodeIfPresent(Bool.self, forKey: .seen) ?? false
    }

    public var expiresAtDate: Date? {
        MomentTime.parse(expiresAt)
    }

    public init(id: String, kind: MomentKind, createdAt: String, expiresAt: String, seen: Bool) {
        self.id = id
        self.kind = kind
        self.createdAt = createdAt
        self.expiresAt = expiresAt
        self.seen = seen
    }
}

/// One person's Moments at one spot: the ring on the map.
public struct MomentRingDTO: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let author: MomentAuthorDTO
    public let latitude: Double
    public let longitude: Double
    /// A place or a town, never a street address.
    public let placeLabel: String
    public var moments: [MomentBriefDTO]
    public let newestAt: String?
    public let mine: Bool
    /// Moments posted with no location (contract v3.4, `GET /map` `unplaced`): in the strip, never on the map.
    public let noLocation: Bool
    /// A small look at the newest Moment, for the pin (contract v3.6, `MomentRingPreviewDTO.swift`); nil without one.
    public let preview: MomentRingPreviewDTO?
    /// How high its newest Moment was made, in feet above sea level, and whether in flight (contract v3.8,
    /// `MomentHeightDTOs.swift`); none unless heights are on for you and its author showed it.
    public let altitudeFt: Int?
    public let flying: Bool

    private enum CodingKeys: String, CodingKey {
        case id, author, latitude, longitude, moments, mine, preview, flying
        case altitudeFt = "altitude_ft"
        case placeLabel = "place_label"
        case newestAt = "newest_at"
        case noLocation = "no_location"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        author = try c.decode(MomentAuthorDTO.self, forKey: .author)
        noLocation = try c.decodeIfPresent(Bool.self, forKey: .noLocation) ?? false
        // A ring with no location has no point (the keys are left out).
        latitude = try noLocation ? 0 : c.decode(Double.self, forKey: .latitude)
        longitude = try noLocation ? 0 : c.decode(Double.self, forKey: .longitude)
        placeLabel = try c.decodeIfPresent(String.self, forKey: .placeLabel) ?? ""
        moments = try c.decodeIfPresent([MomentBriefDTO].self, forKey: .moments) ?? []
        newestAt = try c.decodeIfPresent(String.self, forKey: .newestAt)
        mine = try c.decodeIfPresent(Bool.self, forKey: .mine) ?? false
        // An older server sends none, and one this app can't read only costs the picture.
        preview = try? c.decodeIfPresent(MomentRingPreviewDTO.self, forKey: .preview)
        altitudeFt = c.momentFeet(forKey: .altitudeFt)
        flying = (try? c.decodeIfPresent(Bool.self, forKey: .flying)) ?? false
    }

    /// One Moment as a ring of its own: opened from a chat quote, with no map behind it.
    public init(moment: MomentDTO, mine: Bool) {
        id = "m_\(moment.id)"
        author = moment.author
        latitude = moment.latitude
        longitude = moment.longitude
        noLocation = moment.noLocation
        placeLabel = moment.placeLabel
        let brief = MomentBriefDTO(
            id: moment.id,
            kind: moment.kind,
            createdAt: moment.createdAt,
            expiresAt: moment.expiresAt,
            seen: moment.seen
        )
        moments = [brief]
        newestAt = moment.createdAt
        self.mine = mine
        preview = nil
        altitudeFt = moment.altitudeFt
        flying = moment.flying
    }
}

/// A Moment as the viewer and the Seen by sheet read it.
public struct MomentDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let author: MomentAuthorDTO
    public let kind: MomentKind
    public let state: MomentState
    public let caption: String?
    public let text: String?
    public let background: String?
    public let mediaURL: String?
    public let posterURL: String?
    public let width: Double?
    public let height: Double?
    public let durationMs: Double?
    public let placeLabel: String
    public let latitude: Double
    public let longitude: Double
    public let showArea: Bool
    public let audience: MomentAudience
    public let createdAt: String
    public let expiresAt: String
    public let hours: Int
    public let seen: Bool
    public let myReaction: String?
    /// Only for the author.
    public let viewerCount: Int?
    /// Only for the author: each emoji and how many chose it, most used first.
    public let reactionCounts: [MomentReactionCount]?
    /// When the photo or video was taken, only when that was more than a day before it was posted (contract v3.3):
    /// the viewer says "Taken Oct 3" so an old photo never reads as now. Nil otherwise and from an older server.
    public let takenAt: String?
    /// Posted with no location (contract v3.4): no point or place, connections only.
    public let noLocation: Bool
    /// How high it was made, in feet above sea level, and whether in flight (contract v3.8); `height` is the picture's.
    public let altitudeFt: Int?
    public let flying: Bool

    private enum CodingKeys: String, CodingKey {
        case id, author, kind, state, caption, text, background, width, height, latitude, longitude, audience, hours, seen, flying
        case altitudeFt = "altitude_ft"
        case mediaURL = "media_url"
        case posterURL = "poster_url"
        case durationMs = "duration_ms"
        case placeLabel = "place_label"
        case showArea = "show_area"
        case createdAt = "created_at"
        case expiresAt = "expires_at"
        case myReaction = "my_reaction"
        case viewerCount = "viewer_count"
        case reactionCounts = "reaction_counts"
        case takenAt = "taken_at"
        case noLocation = "no_location"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        author = try c.decode(MomentAuthorDTO.self, forKey: .author)
        kind = try c.decodeIfPresent(MomentKind.self, forKey: .kind) ?? .photo
        state = try (c.decodeIfPresent(String.self, forKey: .state)).flatMap(MomentState.init(rawValue:)) ?? .live
        caption = try c.decodeIfPresent(String.self, forKey: .caption)
        text = try c.decodeIfPresent(String.self, forKey: .text)
        background = try c.decodeIfPresent(String.self, forKey: .background)
        mediaURL = try c.decodeIfPresent(String.self, forKey: .mediaURL)
        posterURL = try c.decodeIfPresent(String.self, forKey: .posterURL)
        width = try c.decodeIfPresent(Double.self, forKey: .width)
        height = try c.decodeIfPresent(Double.self, forKey: .height)
        durationMs = try c.decodeIfPresent(Double.self, forKey: .durationMs)
        placeLabel = try c.decodeIfPresent(String.self, forKey: .placeLabel) ?? ""
        latitude = try c.decodeIfPresent(Double.self, forKey: .latitude) ?? 0
        longitude = try c.decodeIfPresent(Double.self, forKey: .longitude) ?? 0
        showArea = try c.decodeIfPresent(Bool.self, forKey: .showArea) ?? false
        audience = try (c.decodeIfPresent(String.self, forKey: .audience)).flatMap(MomentAudience.init(rawValue:)) ?? .nearby
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        expiresAt = try c.decodeIfPresent(String.self, forKey: .expiresAt) ?? ""
        hours = try c.decodeIfPresent(Int.self, forKey: .hours) ?? 24
        seen = try c.decodeIfPresent(Bool.self, forKey: .seen) ?? false
        myReaction = try c.decodeIfPresent(String.self, forKey: .myReaction)
        viewerCount = try c.decodeIfPresent(Int.self, forKey: .viewerCount)
        reactionCounts = try? c.decodeIfPresent([MomentReactionCount].self, forKey: .reactionCounts)
        takenAt = try? c.decodeIfPresent(String.self, forKey: .takenAt)
        noLocation = (try? c.decodeIfPresent(Bool.self, forKey: .noLocation)) ?? false
        altitudeFt = c.momentFeet(forKey: .altitudeFt)
        flying = (try? c.decodeIfPresent(Bool.self, forKey: .flying)) ?? false
    }

    public var media: URL? {
        mediaURL.flatMap(URL.init(string:))
    }

    public var poster: URL? {
        posterURL.flatMap(URL.init(string:))
    }

    public var createdAtDate: Date? {
        MomentTime.parse(createdAt)
    }

    public var expiresAtDate: Date? {
        MomentTime.parse(expiresAt)
    }
}

/// One emoji in the author's reaction counts.
public struct MomentReactionCount: Decodable, Sendable, Hashable {
    public let reaction: String
    public let count: Int
}

// MARK: - Answers

public struct MomentsMapResponse: Decodable, Sendable {
    public let rings: [MomentRingDTO]
    /// Connections' (and your own) Moments with no location, one ring per person, whatever the area (contract v3.4).
    public let unplaced: [MomentRingDTO]
    /// Heights are on for you (contract v3.9): the map offers "Elevation". False from a server before it.
    public let heightsOn: Bool
    /// Moments with an elevation float by day (contract v3.10, `moment_float`), and where the sun is; false and nil
    /// from a server before it.
    public let floatOn: Bool
    public let sun: MomentSunDTO?

    private enum CodingKeys: String, CodingKey {
        case rings, unplaced, sun
        case heightsOn = "heights_on"
        case floatOn = "float_on"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rings = try c.decode([MomentRingDTO].self, forKey: .rings)
        unplaced = (try? c.decodeIfPresent([MomentRingDTO].self, forKey: .unplaced)) ?? []
        heightsOn = (try? c.decodeIfPresent(Bool.self, forKey: .heightsOn)) ?? false
        floatOn = (try? c.decodeIfPresent(Bool.self, forKey: .floatOn)) ?? false
        sun = try? c.decodeIfPresent(MomentSunDTO.self, forKey: .sun)
    }
}

/// `GET /api/moments/unseen`: people with something new in the box.
public struct MomentsUnseenResponse: Decodable, Sendable {
    public let count: Int
}

/// `GET /api/moments/mine`, and `GET /api/moments/batch` (the same shape).
public struct MomentsMineResponse: Decodable, Sendable {
    public let moments: [MomentDTO]
}

public struct MomentEnvelope: Decodable, Sendable {
    public let moment: MomentDTO
}

/// `POST /api/moments/place-preview`: what the camera chip and the Post sheet say.
/// One name that fits an exact pin (contract v3 "Picking the place"): `key` goes back as `place_key`.
public struct MomentPlaceChoiceDTO: Decodable, Sendable, Hashable {
    public let key: String
    public let label: String
}

public struct MomentPlacePreviewDTO: Decodable, Sendable, Hashable {
    public let placeLabel: String
    /// The town shown when "Show the area instead" is on.
    public let areaLabel: String?
    public let atHome: Bool
    /// The one-time 18+ confirmation is on file (nil from a server before contract v2).
    public let adultConfirmed: Bool?
    /// The names that fit an exact pin here, the automatic one first; empty from a server before contract v3.
    public let places: [MomentPlaceChoiceDTO]
    /// How far from the pin the place picker's venues may be (contract v3.3, 1500 m); nil from an older server.
    public let pickWithinM: Double?
    /// Whether you have a connection (contract v3.4): a Moment with no location needs one. Nil from an older server.
    public let hasConnections: Bool?
    /// The sheet may offer "Show elevation" here (contract v3.8): heights are on for you and it isn't your home.
    public let canShowHeight: Bool

    private enum CodingKeys: String, CodingKey {
        case places
        case pickWithinM = "pick_within_m"
        case hasConnections = "has_connections"
        case canShowHeight = "can_show_height"
        case placeLabel = "place_label"
        case areaLabel = "area_label"
        case atHome = "at_home"
        case adultConfirmed = "adult_confirmed"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        placeLabel = try c.decodeIfPresent(String.self, forKey: .placeLabel) ?? ""
        areaLabel = try c.decodeIfPresent(String.self, forKey: .areaLabel)
        atHome = try c.decodeIfPresent(Bool.self, forKey: .atHome) ?? false
        adultConfirmed = try c.decodeIfPresent(Bool.self, forKey: .adultConfirmed)
        // One odd entry doesn't cost the whole preview: the list is then left out.
        places = (try? c.decodeIfPresent([MomentPlaceChoiceDTO].self, forKey: .places))?
            .filter { !$0.key.isEmpty && !$0.label.isEmpty } ?? []
        pickWithinM = try? c.decodeIfPresent(Double.self, forKey: .pickWithinM)
        hasConnections = try? c.decodeIfPresent(Bool.self, forKey: .hasConnections)
        canShowHeight = (try? c.decodeIfPresent(Bool.self, forKey: .canShowHeight)) ?? false
    }
}

/// One person in Seen by.
public struct MomentViewerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let user: MomentAuthorDTO
    public let viewedAt: String
    public let reaction: String?
    public let replied: Bool

    public var id: String {
        user.id
    }

    private enum CodingKeys: String, CodingKey {
        case user, reaction, replied
        case viewedAt = "viewed_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        user = try c.decode(MomentAuthorDTO.self, forKey: .user)
        viewedAt = try c.decodeIfPresent(String.self, forKey: .viewedAt) ?? ""
        reaction = try c.decodeIfPresent(String.self, forKey: .reaction)
        replied = try c.decodeIfPresent(Bool.self, forKey: .replied) ?? false
    }
}

public struct MomentViewersResponse: Decodable, Sendable {
    public let count: Int
    public let viewers: [MomentViewerDTO]
}

public struct MomentReactionResponse: Decodable, Sendable {
    public let myReaction: String?

    private enum CodingKeys: String, CodingKey {
        case myReaction = "my_reaction"
    }
}

public struct MomentReplyResponse: Decodable, Sendable {
    public let roomId: String?
    public let messageId: String?

    private enum CodingKeys: String, CodingKey {
        case roomId = "room_id"
        case messageId = "message_id"
    }
}
