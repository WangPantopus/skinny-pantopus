//
//  HomeDiscoveryDTOs.swift
//  Pantopus
//
//  Decodables for the home-discovery routes. Field names are taken
//  verbatim from the handlers in `backend/routes/home.js` — the
//  APIClient does NOT apply `convertFromSnakeCase`, so every
//  snake_case key is mapped explicitly.
//

import Foundation

// MARK: - GET /api/homes/discover

/// `{ homes: [...] }` — route `backend/routes/home.js:2433`.
public struct HomeDiscoverResponse: Decodable, Sendable, Hashable {
    public let homes: [DiscoveredHomeDTO]

    public init(homes: [DiscoveredHomeDTO]) {
        self.homes = homes
    }
}

/// One row of the discover result. Projection built at
/// `backend/routes/home.js:2400-2421`.
public struct DiscoveredHomeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let homeType: String?
    public let visibility: String?
    public let owner: DiscoveredHomeOwnerDTO?
    public let isMember: Bool
    public let claimStatus: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, address, city, state, zipcode
        case homeType = "home_type"
        case visibility, owner
        case isMember = "is_member"
        case claimStatus = "claim_status"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        city = try container.decodeIfPresent(String.self, forKey: .city)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        zipcode = try container.decodeIfPresent(String.self, forKey: .zipcode)
        homeType = try container.decodeIfPresent(String.self, forKey: .homeType)
        visibility = try container.decodeIfPresent(String.self, forKey: .visibility)
        owner = try container.decodeIfPresent(DiscoveredHomeOwnerDTO.self, forKey: .owner)
        isMember = try container.decodeIfPresent(Bool.self, forKey: .isMember) ?? false
        claimStatus = try container.decodeIfPresent(String.self, forKey: .claimStatus)
    }

    public init(
        id: String,
        name: String? = nil,
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipcode: String? = nil,
        homeType: String? = nil,
        visibility: String? = nil,
        owner: DiscoveredHomeOwnerDTO? = nil,
        isMember: Bool = false,
        claimStatus: String? = nil
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
        self.homeType = homeType
        self.visibility = visibility
        self.owner = owner
        self.isMember = isMember
        self.claimStatus = claimStatus
    }
}

public struct DiscoveredHomeOwnerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePictureURL: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name
        case profilePictureURL = "profile_picture_url"
    }

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        profilePictureURL: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePictureURL = profilePictureURL
    }
}

// MARK: - GET /api/homes/:id/public-profile

/// The real `public-profile` envelope — route
/// `backend/routes/home.js:2533`. The legacy `HomePublicProfileResponse`
/// in `HomeDTOs.swift` models a different (older) shape; this one is
/// decoded straight from the handler's `res.json({ … })`.
public struct HomePublicPreviewResponse: Decodable, Sendable, Hashable {
    public let home: HomePublicPreviewDTO
    public let owner: DiscoveredHomeOwnerDTO?
    public let hasVerifiedOwner: Bool
    public let isMember: Bool

    private enum CodingKeys: String, CodingKey {
        case home, owner
        case hasVerifiedOwner = "has_verified_owner"
        case isMember = "is_member"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        home = try container.decode(HomePublicPreviewDTO.self, forKey: .home)
        owner = try container.decodeIfPresent(DiscoveredHomeOwnerDTO.self, forKey: .owner)
        hasVerifiedOwner = try container.decodeIfPresent(Bool.self, forKey: .hasVerifiedOwner) ?? false
        isMember = try container.decodeIfPresent(Bool.self, forKey: .isMember) ?? false
    }

    public init(
        home: HomePublicPreviewDTO,
        owner: DiscoveredHomeOwnerDTO? = nil,
        hasVerifiedOwner: Bool = false,
        isMember: Bool = false
    ) {
        self.home = home
        self.owner = owner
        self.hasVerifiedOwner = hasVerifiedOwner
        self.isMember = isMember
    }
}

public struct HomePublicPreviewDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let homeType: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, address, city, state, zipcode
        case homeType = "home_type"
    }

    public init(
        id: String,
        name: String? = nil,
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipcode: String? = nil,
        homeType: String? = nil
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
        self.homeType = homeType
    }

    /// "412 Elm St · Brooklyn, NY 11211" style label.
    public var displayAddress: String {
        let locality = [city, state, zipcode]
            .compactMap { $0?.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        let street = address?.trimmingCharacters(in: .whitespaces) ?? name ?? ""
        if street.isEmpty { return locality }
        if locality.isEmpty { return street }
        return "\(street) · \(locality)"
    }
}

// MARK: - POST /api/homes/:id/request-household-from-owner

/// Body for `requestHouseholdFromOwner`. Joi schema at
/// `backend/routes/home.js:163` — `owner | resident | household_member | guest`,
/// defaulting to `owner`.
public struct RequestHouseholdFromOwnerRequest: Encodable, Sendable {
    public let requestedIdentity: String

    private enum CodingKeys: String, CodingKey {
        case requestedIdentity = "requested_identity"
    }

    public init(requestedIdentity: String = "owner") {
        self.requestedIdentity = requestedIdentity
    }
}

/// `{ ok, notified_owners }` — route `backend/routes/home.js:2657`.
public struct RequestHouseholdFromOwnerResponse: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let notifiedOwners: Int

    private enum CodingKeys: String, CodingKey {
        case ok
        case notifiedOwners = "notified_owners"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ok = try container.decodeIfPresent(Bool.self, forKey: .ok) ?? true
        notifiedOwners = try container.decodeIfPresent(Int.self, forKey: .notifiedOwners) ?? 0
    }

    public init(ok: Bool = true, notifiedOwners: Int = 0) {
        self.ok = ok
        self.notifiedOwners = notifiedOwners
    }
}

// MARK: - POST /api/homes/:id/claim

/// Body for the provisional residency claim. Handler destructure at
/// `backend/routes/home.js:6482`.
public struct SubmitResidencyClaimRequest: Encodable, Sendable {
    public let claimedAddress: String?
    public let claimedRole: String?

    private enum CodingKeys: String, CodingKey {
        case claimedAddress = "claimed_address"
        case claimedRole = "claimed_role"
    }

    public init(claimedAddress: String? = nil, claimedRole: String? = nil) {
        self.claimedAddress = claimedAddress
        self.claimedRole = claimedRole
    }
}

/// `{ message, claim }` — route `backend/routes/home.js:6479`.
public struct SubmitResidencyClaimResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let claim: ResidencyClaimRowDTO?

    public init(message: String? = nil, claim: ResidencyClaimRowDTO? = nil) {
        self.message = message
        self.claim = claim
    }
}

public struct ResidencyClaimRowDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let status: String?
    public let homeId: String?

    private enum CodingKeys: String, CodingKey {
        case id, status
        case homeId = "home_id"
    }

    public init(id: String, status: String? = nil, homeId: String? = nil) {
        self.id = id
        self.status = status
        self.homeId = homeId
    }
}
