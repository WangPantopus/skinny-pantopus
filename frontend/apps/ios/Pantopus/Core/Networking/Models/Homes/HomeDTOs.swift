//
//  HomeDTOs.swift
//  Pantopus
//
//  DTOs for the home endpoints in `backend/routes/home.js`. Because many
//  Home-column fields are untyped in the route response, we capture the
//  stable core (id, address, geography) and expose everything else via
//  `extras: [String: JSONValue]` to avoid inventing field types.
//

// swiftlint:disable file_length

import Foundation

/// Stable fields from a Home row, the ones every downstream consumer needs.
/// Route citations per endpoint live on the wrapping response types.
public struct HomeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let homeType: String?
    public let visibility: String?
    public let description: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, address, city, state, zipcode
        case homeType = "home_type"
        case visibility, description
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Occupancy badge emitted per-home in `my-homes`. Route:
/// `backend/routes/home.js:1464`.
public struct HomeOccupancy: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let role: String
    public let roleBase: String
    public let isActive: Bool
    public let startAt: String?
    public let endAt: String?
    public let verificationStatus: String

    private enum CodingKeys: String, CodingKey {
        case id, role
        case roleBase = "role_base"
        case isActive = "is_active"
        case startAt = "start_at"
        case endAt = "end_at"
        case verificationStatus = "verification_status"
    }
}

/// Entry in the `my-homes` response, composed of the core home +
/// occupancy/ownership flags. Route: `backend/routes/home.js:1464`.
public struct MyHome: Decodable, Sendable, Hashable, Identifiable {
    public let home: HomeDTO
    public let occupancy: HomeOccupancy?
    public let ownershipStatus: String?
    public let verificationTier: String?
    public let isPrimaryOwner: Bool?
    public let pendingClaimId: String?
    /// Parsed PostGIS point from `GET /api/homes/my-homes`.
    public let location: HomeLocation?
    /// Server-computed predicate — true when the viewer owns the Home row
    /// outright or is a verified *primary* owner. Gates the destructive
    /// "Delete home" affordance; everyone else must leave instead.
    /// Computed at `backend/routes/home.js:1653`.
    public let canDeleteHome: Bool?

    public var id: String {
        home.id
    }

    /// Human-readable area label for the target picker.
    public var areaLabel: String {
        let parts = [home.city, home.state].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if !parts.isEmpty { return parts.joined(separator: ", ") }
        return home.address ?? home.name ?? "Home"
    }

    /// Backend returns these as siblings on the home row, not a nested
    /// object; we decode the Home fields via a custom init so the outer
    /// response shape stays flat.
    public init(from decoder: any Decoder) throws {
        home = try HomeDTO(from: decoder)
        let container = try decoder.container(keyedBy: FlatKeys.self)
        occupancy = try container.decodeIfPresent(HomeOccupancy.self, forKey: .occupancy)
        ownershipStatus = try container.decodeIfPresent(String.self, forKey: .ownershipStatus)
        verificationTier = try container.decodeIfPresent(String.self, forKey: .verificationTier)
        isPrimaryOwner = try container.decodeIfPresent(Bool.self, forKey: .isPrimaryOwner)
        pendingClaimId = try container.decodeIfPresent(String.self, forKey: .pendingClaimId)
        location = try container.decodeIfPresent(HomeLocation.self, forKey: .location)
        canDeleteHome = try container.decodeIfPresent(Bool.self, forKey: .canDeleteHome)
    }

    private enum FlatKeys: String, CodingKey {
        case occupancy
        case ownershipStatus = "ownership_status"
        case verificationTier = "verification_tier"
        case isPrimaryOwner = "is_primary_owner"
        case pendingClaimId = "pending_claim_id"
        case location
        case canDeleteHome = "can_delete_home"
    }
}

/// `GET /api/homes/my-homes` envelope — route `backend/routes/home.js:1464`.
public struct MyHomesResponse: Decodable, Sendable, Hashable {
    public let homes: [MyHome]
    public let message: String?
}

/// `GET /api/homes/:id` envelope — route `backend/routes/home.js:2891`.
public struct HomeDetailResponse: Decodable, Sendable, Hashable {
    public let home: HomeDetail
}

/// Detailed home + owner/occupant graph.
public struct HomeDetail: Decodable, Sendable, Hashable {
    public let base: HomeDTO
    public let owner: HomeUserRef?
    public let occupants: [HomeOccupant]
    public let location: HomeLocation?
    public let isOwner: Bool
    public let isPendingOwner: Bool
    public let pendingClaimId: String?
    public let isOccupant: Bool
    public let owners: [HomeOwnershipRef]
    public let canDeleteHome: Bool
    /// `Home.security_state` — the lifecycle guard rail. The handler
    /// `select('*')`s the Home row (`backend/routes/home.js:2902`), so
    /// this and `claim_window_ends_at` ride along on every detail read.
    /// Drives the dashboard status banner.
    public let securityState: HomeSecurityState
    public let claimWindowEndsAt: String?

    public init(from decoder: any Decoder) throws {
        base = try HomeDTO(from: decoder)
        let c = try decoder.container(keyedBy: FlatKeys.self)
        owner = try c.decodeIfPresent(HomeUserRef.self, forKey: .owner)
        occupants = try c.decodeIfPresent([HomeOccupant].self, forKey: .occupants) ?? []
        location = try c.decodeIfPresent(HomeLocation.self, forKey: .location)
        isOwner = try c.decodeIfPresent(Bool.self, forKey: .isOwner) ?? false
        isPendingOwner = try c.decodeIfPresent(Bool.self, forKey: .isPendingOwner) ?? false
        pendingClaimId = try c.decodeIfPresent(String.self, forKey: .pendingClaimId)
        isOccupant = try c.decodeIfPresent(Bool.self, forKey: .isOccupant) ?? false
        owners = try c.decodeIfPresent([HomeOwnershipRef].self, forKey: .owners) ?? []
        canDeleteHome = try c.decodeIfPresent(Bool.self, forKey: .canDeleteHome) ?? false
        // Decoded through its raw string so a future backend enum value
        // degrades to `.normal` instead of failing the whole home read.
        let rawSecurityState = try c.decodeIfPresent(String.self, forKey: .securityState)
        securityState = rawSecurityState.flatMap(HomeSecurityState.init(rawValue:)) ?? .normal
        claimWindowEndsAt = try c.decodeIfPresent(String.self, forKey: .claimWindowEndsAt)
    }

    private enum FlatKeys: String, CodingKey {
        case owner, occupants, location
        case isOwner, isPendingOwner, pendingClaimId, isOccupant, owners
        case canDeleteHome = "can_delete_home"
        case securityState = "security_state"
        case claimWindowEndsAt = "claim_window_ends_at"
    }
}

/// Basic user reference on owner/occupant lists.
public struct HomeUserRef: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String
    public let name: String
}

/// Single occupant row.
public struct HomeOccupant: Decodable, Sendable, Hashable {
    public let userId: String
    public let createdAt: String
    public let user: HomeUserRef

    private enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case createdAt = "created_at"
        case user
    }
}

/// Geographical location (lon, lat).
public struct HomeLocation: Decodable, Sendable, Hashable {
    public let longitude: Double
    public let latitude: Double
}

/// Ownership reference with tier + flags.
public struct HomeOwnershipRef: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let subjectType: String
    public let subjectId: String
    public let ownerStatus: String
    public let isPrimaryOwner: Bool
    public let verificationTier: String

    private enum CodingKeys: String, CodingKey {
        case id
        case subjectType = "subject_type"
        case subjectId = "subject_id"
        case ownerStatus = "owner_status"
        case isPrimaryOwner = "is_primary_owner"
        case verificationTier = "verification_tier"
    }
}

/// `GET /api/homes/:id/public-profile` envelope — route `backend/routes/home.js:2439`.
public struct HomePublicProfileResponse: Decodable, Sendable, Hashable {
    public let home: HomePublicProfile

    public struct HomePublicProfile: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let name: String?
        public let address: String
        public let city: String
        public let state: String
        public let zipcode: String
        public let homeType: String?
        public let visibility: String
        public let description: String?
        public let createdAt: String
        public let hasVerifiedOwner: Bool
        public let verifiedOwner: VerifiedOwner?
        public let userMembershipStatus: String
        public let userResidencyClaim: ResidencyClaim?
        public let memberCount: Int
        public let nearbyGigs: Int

        private enum CodingKeys: String, CodingKey {
            case id, name, address, city, state, zipcode
            case homeType = "home_type"
            case visibility, description
            case createdAt = "created_at"
            case hasVerifiedOwner
            case verifiedOwner
            case userMembershipStatus, userResidencyClaim, memberCount, nearbyGigs
        }

        public struct VerifiedOwner: Decodable, Sendable, Hashable, Identifiable {
            public let id: String
            public let username: String
            public let name: String
            public let firstName: String
            public let lastName: String
            public let profilePictureURL: String?

            private enum CodingKeys: String, CodingKey {
                case id, username, name
                case firstName = "first_name"
                case lastName = "last_name"
                case profilePictureURL = "profile_picture_url"
            }
        }

        public struct ResidencyClaim: Decodable, Sendable, Hashable, Identifiable {
            public let id: String
            public let status: String
            public let createdAt: String

            private enum CodingKeys: String, CodingKey {
                case id, status
                case createdAt = "created_at"
            }
        }
    }
}

/// `POST /api/homes` request. Shape validated by `createHomeSchema` on the
/// server; we expose the commonly-used fields and let callers pass
/// additional ATTOM hints via `attomPropertyDetail` as a pre-built payload.
/// Route: `backend/routes/home.js:677`.
public struct CreateHomeRequest: Encodable, Sendable {
    public let address: String
    public let unitNumber: String?
    public let city: String
    public let state: String
    public let zipCode: String
    public let latitude: Double?
    public let longitude: Double?
    public let homeType: String?
    public let visibility: String?
    public let name: String?
    public let description: String?
    /// `bedrooms` — `createHomeSchema` (`backend/routes/home.js:94`).
    public let bedrooms: Int?
    /// `bathrooms` — accepts halves (`backend/routes/home.js:95`).
    public let bathrooms: Double?
    /// `sq_ft` — `backend/routes/home.js:96`.
    public let sqFt: Int?
    /// `lot_sq_ft` — `backend/routes/home.js:98`.
    public let lotSqFt: Int?
    /// `year_built` — `backend/routes/home.js:99`.
    public let yearBuilt: Int?
    /// `is_owner` — `backend/routes/home.js:101`.
    public let isOwner: Bool?
    /// `role` — one of `owner | renter | household | property_manager |
    /// guest` (`backend/routes/home.js:102`).
    public let role: String?
    public let attomPropertyDetail: JSONEncodable?

    public init(
        address: String,
        unitNumber: String? = nil,
        city: String,
        state: String,
        zipCode: String,
        latitude: Double? = nil,
        longitude: Double? = nil,
        homeType: String? = nil,
        visibility: String? = nil,
        name: String? = nil,
        description: String? = nil,
        bedrooms: Int? = nil,
        bathrooms: Double? = nil,
        sqFt: Int? = nil,
        lotSqFt: Int? = nil,
        yearBuilt: Int? = nil,
        isOwner: Bool? = nil,
        role: String? = nil,
        attomPropertyDetail: JSONEncodable? = nil
    ) {
        self.address = address
        self.unitNumber = unitNumber
        self.city = city
        self.state = state
        self.zipCode = zipCode
        self.latitude = latitude
        self.longitude = longitude
        self.homeType = homeType
        self.visibility = visibility
        self.name = name
        self.description = description
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.sqFt = sqFt
        self.lotSqFt = lotSqFt
        self.yearBuilt = yearBuilt
        self.isOwner = isOwner
        self.role = role
        self.attomPropertyDetail = attomPropertyDetail
    }

    private enum CodingKeys: String, CodingKey {
        case address
        case unitNumber = "unit_number"
        case city, state
        case zipCode = "zip_code"
        case latitude, longitude
        case homeType = "home_type"
        case visibility, name, description
        case bedrooms, bathrooms
        case sqFt = "sq_ft"
        case lotSqFt = "lot_sq_ft"
        case yearBuilt = "year_built"
        case isOwner = "is_owner"
        case role
        case attomPropertyDetail = "attom_property_detail"
    }
}

/// `POST /api/homes` response envelope — route `backend/routes/home.js:677`.
public struct CreateHomeResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let home: HomeDTO
    public let requiresVerification: Bool
    public let verificationType: String?
    public let role: String

    private enum CodingKeys: String, CodingKey {
        case message, home
        case requiresVerification = "requires_verification"
        case verificationType = "verification_type"
        case role
    }
}

/// `POST /api/homes/property-suggestions` request. Route:
/// `backend/routes/home.js:540`.
public struct PropertySuggestionsRequest: Encodable, Sendable {
    public let address: String
    public let unitNumber: String?
    public let city: String
    public let state: String
    public let zipCode: String
    public let addressId: String?
    /// Optional Places/parcel hints forwarded from address validation —
    /// `propertySuggestionsSchema` (`backend/routes/home.js:528-532`).
    public let classification: PropertySuggestionsClassification?

    public init(
        address: String,
        unitNumber: String? = nil,
        city: String,
        state: String,
        zipCode: String,
        addressId: String? = nil,
        classification: PropertySuggestionsClassification? = nil
    ) {
        self.address = address
        self.unitNumber = unitNumber
        self.city = city
        self.state = state
        self.zipCode = zipCode
        self.addressId = addressId
        self.classification = classification
    }

    private enum CodingKeys: String, CodingKey {
        case address
        case unitNumber = "unit_number"
        case city, state
        case zipCode = "zip_code"
        case addressId = "address_id"
        case classification
    }
}

/// Places / parcel classification hints on the property-suggestions
/// request — `backend/routes/home.js:528-532`.
public struct PropertySuggestionsClassification: Encodable, Sendable, Hashable {
    public let googlePlaceTypes: [String]?
    public let parcelType: String?
    public let buildingType: String?

    public init(
        googlePlaceTypes: [String]? = nil,
        parcelType: String? = nil,
        buildingType: String? = nil
    ) {
        self.googlePlaceTypes = googlePlaceTypes
        self.parcelType = parcelType
        self.buildingType = buildingType
    }

    private enum CodingKeys: String, CodingKey {
        case googlePlaceTypes = "google_place_types"
        case parcelType = "parcel_type"
        case buildingType = "building_type"
    }
}

/// The merged property fields the tiered lookup resolved. Every field is
/// optional — the service returns explicit `null`s for anything ATTOM /
/// heuristics / the LLM couldn't fill
/// (`backend/services/ai/propertySuggestionsService.js:144-152`).
public struct PropertySuggestionsFields: Decodable, Sendable, Hashable {
    public let homeType: String?
    public let bedrooms: Int?
    public let bathrooms: Double?
    public let sqFt: Int?
    public let lotSqFt: Int?
    public let yearBuilt: Int?
    public let description: String?

    public init(
        homeType: String? = nil,
        bedrooms: Int? = nil,
        bathrooms: Double? = nil,
        sqFt: Int? = nil,
        lotSqFt: Int? = nil,
        yearBuilt: Int? = nil,
        description: String? = nil
    ) {
        self.homeType = homeType
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.sqFt = sqFt
        self.lotSqFt = lotSqFt
        self.yearBuilt = yearBuilt
        self.description = description
    }

    private enum CodingKeys: String, CodingKey {
        case homeType = "home_type"
        case bedrooms, bathrooms
        case sqFt = "sq_ft"
        case lotSqFt = "lot_sq_ft"
        case yearBuilt = "year_built"
        case description
    }
}

/// `POST /api/homes/property-suggestions` response envelope —
/// `backend/services/ai/propertySuggestionsService.js:261-267`. The
/// `attom_property_detail` bundle is provider-defined, so it stays a raw
/// `JSONValue` that we hand straight back to `POST /api/homes`.
public struct PropertySuggestionsResponse: Decodable, Sendable, Hashable {
    public let suggestions: PropertySuggestionsFields?
    /// Per-field provenance (`attom` / `heuristic` / `llm`).
    public let fieldSources: [String: String]?
    public let tiersUsed: [String]?
    public let llmEnabled: Bool?
    public let attomPropertyDetail: JSONValue?

    public init(
        suggestions: PropertySuggestionsFields? = nil,
        fieldSources: [String: String]? = nil,
        tiersUsed: [String]? = nil,
        llmEnabled: Bool? = nil,
        attomPropertyDetail: JSONValue? = nil
    ) {
        self.suggestions = suggestions
        self.fieldSources = fieldSources
        self.tiersUsed = tiersUsed
        self.llmEnabled = llmEnabled
        self.attomPropertyDetail = attomPropertyDetail
    }

    private enum CodingKeys: String, CodingKey {
        case suggestions
        case fieldSources = "field_sources"
        case tiersUsed = "tiers_used"
        case llmEnabled = "llm_enabled"
        case attomPropertyDetail = "attom_property_detail"
    }

    /// True when ATTOM actually returned a public record for the address —
    /// drives the "Public records (ATTOM)" card. RN keys off the same
    /// field (`DetailsStep.tsx:53`).
    public var hasAttomRecord: Bool {
        guard let attomPropertyDetail else { return false }
        if case .null = attomPropertyDetail { return false }
        return true
    }
}

/// `POST /api/homes/check-address` request. Route:
/// `backend/routes/home.js:555`.
public struct CheckAddressRequest: Encodable, Sendable {
    public let addressId: String?
    public let address: String
    public let unitNumber: String?
    public let city: String
    public let state: String
    public let zipCode: String
    public let country: String?

    public init(
        addressId: String? = nil,
        address: String,
        unitNumber: String? = nil,
        city: String,
        state: String,
        zipCode: String,
        country: String? = nil
    ) {
        self.addressId = addressId
        self.address = address
        self.unitNumber = unitNumber
        self.city = city
        self.state = state
        self.zipCode = zipCode
        self.country = country
    }

    private enum CodingKeys: String, CodingKey {
        case addressId = "address_id"
        case address
        case unitNumber = "unit_number"
        case city, state
        case zipCode = "zip_code"
        case country
    }
}

/// `POST /api/homes/check-address` response.
///
/// The handler (`backend/routes/home.js:635` / `:661`) returns
/// `{ status, home_id?, is_multi_unit, formatted_address? }` where
/// `status` is one of `HOME_NOT_FOUND | HOME_FOUND_UNCLAIMED |
/// HOME_FOUND_CLAIMED`. The older `exists / homeCount /
/// hasVerifiedMembers` triple is kept as a derived (and still
/// decodable) convenience so existing call sites keep compiling.
public struct CheckAddressResponse: Decodable, Sendable, Hashable {
    /// Backend status string. `nil` only when the server omits it.
    public let status: String?
    /// Id of the matched home — present for both FOUND statuses.
    public let homeId: String?
    /// True when the matched address is a multi-unit building.
    public let isMultiUnit: Bool
    /// Server-formatted "address, unit, city, state, zip" label.
    public let formattedAddress: String?

    public let exists: Bool
    public let homeCount: Int
    public let hasVerifiedMembers: Bool
    public let verdictStatus: String?
    public let normalizedAddress: NormalizedAddressDTO?

    /// `status === 'HOME_FOUND_CLAIMED'` — an existing home at this
    /// address already has active occupants, so creating another Home
    /// row would duplicate it. RN shows `AddressClaimedModal` here.
    public var isAlreadyClaimed: Bool {
        status == Self.statusFoundClaimed
    }

    /// `status === 'HOME_FOUND_UNCLAIMED'` — a home row exists but has
    /// no active occupants.
    public var isFoundUnclaimed: Bool {
        status == Self.statusFoundUnclaimed
    }

    public static let statusNotFound = "HOME_NOT_FOUND"
    public static let statusFoundUnclaimed = "HOME_FOUND_UNCLAIMED"
    public static let statusFoundClaimed = "HOME_FOUND_CLAIMED"

    public init(
        status: String? = nil,
        homeId: String? = nil,
        isMultiUnit: Bool = false,
        formattedAddress: String? = nil,
        exists: Bool = false,
        homeCount: Int = 0,
        hasVerifiedMembers: Bool = false,
        verdictStatus: String? = nil,
        normalizedAddress: NormalizedAddressDTO? = nil
    ) {
        self.status = status
        self.homeId = homeId
        self.isMultiUnit = isMultiUnit
        self.formattedAddress = formattedAddress
        self.exists = exists
        self.homeCount = homeCount
        self.hasVerifiedMembers = hasVerifiedMembers
        self.verdictStatus = verdictStatus
        self.normalizedAddress = normalizedAddress
    }

    private enum CodingKeys: String, CodingKey {
        case status
        case homeId = "home_id"
        case isMultiUnit = "is_multi_unit"
        case formattedAddress = "formatted_address"
        case exists, homeCount, hasVerifiedMembers
        case verdictStatus = "verdict_status"
        case normalizedAddress = "normalized_address"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        homeId = try container.decodeIfPresent(String.self, forKey: .homeId)
        isMultiUnit = try container.decodeIfPresent(Bool.self, forKey: .isMultiUnit) ?? false
        formattedAddress = try container.decodeIfPresent(String.self, forKey: .formattedAddress)
        verdictStatus = try container.decodeIfPresent(String.self, forKey: .verdictStatus)
        normalizedAddress = try container.decodeIfPresent(
            NormalizedAddressDTO.self,
            forKey: .normalizedAddress
        )
        let foundStatuses = [Self.statusFoundClaimed, Self.statusFoundUnclaimed]
        exists = try container.decodeIfPresent(Bool.self, forKey: .exists)
            ?? (status.map(foundStatuses.contains) ?? false)
        homeCount = try container.decodeIfPresent(Int.self, forKey: .homeCount)
            ?? (homeId == nil ? 0 : 1)
        hasVerifiedMembers = try container.decodeIfPresent(Bool.self, forKey: .hasVerifiedMembers)
            ?? (status == Self.statusFoundClaimed)
    }
}

/// Type-erased `Encodable` wrapper for request bodies whose schema is
/// defined server-side (e.g. ATTOM property details).
public struct JSONEncodable: Encodable, Sendable {
    private let encodeClosure: @Sendable (any Encoder) throws -> Void
    public init(_ wrapped: some Encodable & Sendable) {
        encodeClosure = { encoder in
            try wrapped.encode(to: encoder)
        }
    }

    public func encode(to encoder: any Encoder) throws {
        try encodeClosure(encoder)
    }
}
