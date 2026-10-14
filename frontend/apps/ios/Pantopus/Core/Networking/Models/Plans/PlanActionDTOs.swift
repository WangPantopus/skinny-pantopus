//
//  PlanActionDTOs.swift
//  Pantopus
//
//  Nearby Plans: the bodies the apps send and the replies to asking,
//  hosting and answering requests (brief section 5). The host's view of a
//  request never carries an address: a first name, a verified badge and a
//  distance band.
//

import Foundation

// MARK: - Asking

/// `POST /api/plans/:id/requests`. Kids' fields are for playdates only, and
/// `staysWithKids` must be true there.
public struct AskToJoinBody: Encodable, Sendable {
    public let partySize: Int
    public let note: String?
    public let kidsCount: Int?
    public let kidsAgeBands: [PlanKidsAgeBand]?
    public let staysWithKids: Bool?

    enum CodingKeys: String, CodingKey {
        case note
        case partySize = "party_size"
        case kidsCount = "kids_count"
        case kidsAgeBands = "kids_age_bands"
        case staysWithKids = "stays_with_kids"
    }

    public init(
        partySize: Int,
        note: String?,
        kidsCount: Int? = nil,
        kidsAgeBands: [PlanKidsAgeBand]? = nil,
        staysWithKids: Bool? = nil
    ) {
        self.partySize = partySize
        self.note = note
        self.kidsCount = kidsCount
        self.kidsAgeBands = kidsAgeBands
        self.staysWithKids = staysWithKids
    }
}

/// The request half of the ask reply.
public struct PlanAskResultDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let status: PlanRequestStatus
    public let waitlistPosition: Int?

    enum CodingKeys: String, CodingKey {
        case id, status
        case waitlistPosition = "waitlist_position"
    }
}

/// `POST /api/plans/:id/requests` reply: the request and the plan as the
/// viewer now sees it (a detail when a rule let them in at once).
public struct PlanAskResponse: Decodable, Sendable {
    public let request: PlanAskResultDTO
    public let plan: PlanDetailDTO
}

/// `POST /api/plans/:id/still-coming`. False leaves the plan.
public struct PlanStillComingBody: Encodable, Sendable {
    public let coming: Bool

    public init(coming: Bool) {
        self.coming = coming
    }
}

/// `POST /api/plans/:id/feedback`. `notRight` files a report on the post.
public struct PlanFeedbackBody: Encodable, Sendable {
    public enum Answer: String, Encodable, Sendable {
        case great
        case okay = "ok"
        case notRight = "not_right"
    }

    public let answer: Answer
    public let note: String?

    public init(answer: Answer, note: String? = nil) {
        self.answer = answer
        self.note = note
    }
}

// MARK: - Hosting

/// Where the plan is. `homeId` only for `home`; GPS never becomes the pin.
public struct PlanPlaceBody: Encodable, Sendable, Hashable {
    public let kind: PlanPlaceKind
    public let name: String?
    public let address: String?
    public let latitude: Double
    public let longitude: Double
    public let homeId: String?

    enum CodingKeys: String, CodingKey {
        case kind, name, address, latitude, longitude
        case homeId = "home_id"
    }

    public init(kind: PlanPlaceKind, name: String?, address: String?, latitude: Double, longitude: Double, homeId: String?) {
        self.kind = kind
        self.name = name
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.homeId = homeId
    }
}

/// A fresh device fix that proves the host is nearby (decision D2).
public struct PlanGPSBody: Encodable, Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    public let timestamp: String

    public init(latitude: Double, longitude: Double, timestamp: Date) {
        self.latitude = latitude
        self.longitude = longitude
        self.timestamp = PlanTime.string(timestamp)
    }
}

/// `POST /api/plans`.
public struct CreatePlanBody: Encodable, Sendable {
    public let kind: PlanKind
    public let title: String
    public let about: String?
    public let startsAt: String
    public let endsAt: String
    public let place: PlanPlaceBody
    public let spots: Int
    public let autoRules: [PlanAutoRule]
    public let joinRequirement: PlanJoinRequirement
    public let details: PlanDetailsDTO
    public let guestNote: String?
    public let gps: PlanGPSBody?
    /// A5 "Host again": the plan this one repeats.
    public var hostedAgainFrom: String?

    enum CodingKeys: String, CodingKey {
        case kind, title, about, place, spots, details, gps
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case autoRules = "auto_rules"
        case joinRequirement = "join_requirement"
        case guestNote = "guest_note"
        case hostedAgainFrom = "hosted_again_from"
    }

    public init(
        kind: PlanKind,
        title: String,
        about: String?,
        startsAt: Date,
        endsAt: Date,
        place: PlanPlaceBody,
        spots: Int,
        autoRules: [PlanAutoRule],
        joinRequirement: PlanJoinRequirement,
        details: PlanDetailsDTO,
        guestNote: String?,
        gps: PlanGPSBody?
    ) {
        self.kind = kind
        self.title = title
        self.about = about
        self.startsAt = PlanTime.string(startsAt)
        self.endsAt = PlanTime.string(endsAt)
        self.place = place
        self.spots = spots
        self.autoRules = autoRules
        self.joinRequirement = joinRequirement
        self.details = details
        self.guestNote = guestNote
        self.gps = gps
    }
}

/// `PATCH /api/plans/:id`: only the fields that change are sent. Moving the
/// start by more than 30 minutes or changing the place asks everyone who is
/// in "Still coming?" (H11).
public struct UpdatePlanBody: Encodable, Sendable {
    public var title: String?
    public var about: String?
    public var startsAt: String?
    public var endsAt: String?
    public var place: PlanPlaceBody?
    public var spots: Int?
    public var autoRules: [PlanAutoRule]?
    public var guestNote: String?

    enum CodingKeys: String, CodingKey {
        case title, about, place, spots
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case autoRules = "auto_rules"
        case guestNote = "guest_note"
    }

    public init() {}
}

/// `POST /api/plans/:id/cancel`.
public struct CancelPlanBody: Encodable, Sendable {
    public let note: String?

    public init(note: String?) {
        self.note = note
    }
}

/// `POST /api/plans/:id/requests/:requestId/accept`. At home the first
/// accept needs `confirmSharesAddress` (H10's sentence).
public struct AcceptPlanRequestBody: Encodable, Sendable {
    public let confirmSharesAddress: Bool?

    enum CodingKeys: String, CodingKey {
        case confirmSharesAddress = "confirm_shares_address"
    }

    public init(confirmSharesAddress: Bool?) {
        self.confirmSharesAddress = confirmSharesAddress
    }
}

// MARK: - The host's requests

/// Someone who asked, as the host sees them. Never an address.
public struct PlanRequesterDTO: Decodable, Sendable, Hashable {
    public let displayName: String
    public let avatarUrl: String?
    public let verifiedAddress: Bool
    public let distanceBand: PlanDistanceBand?
    public let plansJoined: Int?
    public let mutualConnections: Int?
    public let hostedBefore: Bool

    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case verifiedAddress = "verified_address"
        case distanceBand = "distance_band"
        case plansJoined = "plans_joined"
        case mutualConnections = "mutual_connections"
        case hostedBefore = "hosted_before"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        displayName = try container.decode(String.self, forKey: .displayName)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        verifiedAddress = try container.decodeIfPresent(Bool.self, forKey: .verifiedAddress) ?? false
        distanceBand = try? container.decodeIfPresent(PlanDistanceBand.self, forKey: .distanceBand)
        plansJoined = try container.decodeIfPresent(Int.self, forKey: .plansJoined)
        mutualConnections = try container.decodeIfPresent(Int.self, forKey: .mutualConnections)
        hostedBefore = try container.decodeIfPresent(Bool.self, forKey: .hostedBefore) ?? false
    }
}

/// One request in the host's list (`RequestView`).
public struct PlanRequestViewDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let user: PlanRequesterDTO
    public let partySize: Int
    public let note: String?
    public let kidsCount: Int?
    public let kidsAgeBands: [PlanKidsAgeBand]?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, user, note
        case partySize = "party_size"
        case kidsCount = "kids_count"
        case kidsAgeBands = "kids_age_bands"
        case createdAt = "created_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        user = try container.decode(PlanRequesterDTO.self, forKey: .user)
        partySize = try container.decodeIfPresent(Int.self, forKey: .partySize) ?? 1
        note = try container.decodeIfPresent(String.self, forKey: .note)
        kidsCount = try container.decodeIfPresent(Int.self, forKey: .kidsCount)
        let bands = try? container.decodeIfPresent([String].self, forKey: .kidsAgeBands)
        kidsAgeBands = bands?.compactMap(PlanKidsAgeBand.init(rawValue:))
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }
}

/// `GET /api/plans/:id/requests` (host only).
public struct PlanRequestsResponse: Decodable, Sendable, Hashable {
    public let pending: [PlanRequestViewDTO]
    public let waitlisted: [PlanRequestViewDTO]

    enum CodingKeys: String, CodingKey {
        case pending, waitlisted
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        pending = try container.decodeIfPresent(LossyList<PlanRequestViewDTO>.self, forKey: .pending)?.items ?? []
        waitlisted = try container.decodeIfPresent(LossyList<PlanRequestViewDTO>.self, forKey: .waitlisted)?.items ?? []
    }
}

// MARK: - Composer helpers

/// An upcoming game for a watch party (`GET /api/plans/games`).
public struct PlanGameOptionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let team: String?
    public let startsAt: String
    public let endsAt: String?
    public let source: String?

    enum CodingKeys: String, CodingKey {
        case id, label, team, source
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }

    public var startsAtDate: Date? {
        PlanTime.parse(startsAt)
    }

    public var endsAtDate: Date? {
        PlanTime.parse(endsAt)
    }
}

/// `GET /api/plans/games`. Empty is fine: the composer offers "Another game".
public struct PlanGamesResponse: Decodable, Sendable, Hashable {
    public let games: [PlanGameOptionDTO]

    enum CodingKeys: String, CodingKey {
        case games
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        games = try container.decodeIfPresent(LossyList<PlanGameOptionDTO>.self, forKey: .games)?.items ?? []
    }
}

/// A public place for H6 (parks, playgrounds, libraries, courts, trails,
/// cafés, bars and restaurants). Accepts the geo service's `center` shape or
/// flat coordinates.
public struct PlanPlaceOptionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let placeId: String?
    public let name: String
    public let category: String?
    public let address: String?
    public let latitude: Double
    public let longitude: Double
    public let distanceMeters: Double?

    public var id: String {
        placeId ?? "\(name)@\(latitude),\(longitude)"
    }

    enum CodingKeys: String, CodingKey {
        case name, category, address, latitude, longitude, center
        case placeId = "place_id"
        case distanceMeters = "distance_m"
    }

    private struct Center: Decodable {
        let lat: Double
        let lng: Double
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        placeId = try container.decodeIfPresent(String.self, forKey: .placeId)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        if let center = try container.decodeIfPresent(Center.self, forKey: .center) {
            latitude = center.lat
            longitude = center.lng
        } else {
            latitude = try container.decode(Double.self, forKey: .latitude)
            longitude = try container.decode(Double.self, forKey: .longitude)
        }
        distanceMeters = try container.decodeIfPresent(Double.self, forKey: .distanceMeters)
    }

    public init(placeId: String?, name: String, category: String?, address: String?, latitude: Double, longitude: Double) {
        self.placeId = placeId
        self.name = name
        self.category = category
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        distanceMeters = nil
    }
}

/// `GET /api/plans/places/nearby` (and the geo search used by H6's box).
public struct PlanPlacesResponse: Decodable, Sendable, Hashable {
    public let places: [PlanPlaceOptionDTO]
    /// The area is asked for the first time and still loading (202): ask again in a few seconds.
    public let loading: Bool
    /// "© OpenStreetMap contributors": shown small under the list.
    public let attribution: String?

    enum CodingKeys: String, CodingKey {
        case places, loading, attribution
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        places = try container.decodeIfPresent(LossyList<PlanPlaceOptionDTO>.self, forKey: .places)?.items ?? []
        loading = try container.decodeIfPresent(Bool.self, forKey: .loading) ?? false
        attribution = try container.decodeIfPresent(String.self, forKey: .attribution)
    }
}

// MARK: - Flags

/// `GET /api/feature-flags/:flagName` (`backend/routes/featureFlags.js:30`).
public struct FeatureFlagDTO: Decodable, Sendable, Hashable {
    public let flagName: String
    public let enabled: Bool
}
