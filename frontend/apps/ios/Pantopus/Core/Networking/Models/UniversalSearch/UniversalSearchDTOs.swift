//
//  UniversalSearchDTOs.swift
//  Pantopus
//
//  S2 — Universal search decodables. Five independent backend handlers,
//  five envelopes. Field names are taken verbatim from the handlers; the
//  `APIClient` does NOT apply `convertFromSnakeCase`, so every
//  snake_case key is mapped explicitly. (The identity-search and
//  users-search handlers already emit camelCase — those DTOs carry no
//  `CodingKeys` for the matching fields on purpose.)
//
//  Deliberately narrow: each DTO decodes only the fields the universal
//  search row renders, so a projection change in an unrelated feature
//  can't break this screen.
//

import Foundation

// MARK: - GET /api/gigs/search

/// `{ gigs: [...], total }` — route `backend/routes/gigs.js:1822`.
public struct UniversalSearchGigsResponse: Decodable, Sendable, Hashable {
    public let gigs: [UniversalSearchGigDTO]

    public init(gigs: [UniversalSearchGigDTO]) {
        self.gigs = gigs
    }
}

/// One task row. Projection built at `backend/routes/gigs.js:1897`
/// (spatial branch) and `:2046` (non-spatial branch) — both emit
/// `poster_profile_picture_url`.
public struct UniversalSearchGigDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let category: String?
    /// `Gig.price` is a Postgres numeric — Supabase can hand it back as
    /// either a JSON number or a string depending on the driver path, so
    /// decode both.
    public let price: Double?
    public let posterProfilePictureURL: String?

    private enum CodingKeys: String, CodingKey {
        case id, title, category, price
        case posterProfilePictureURL = "poster_profile_picture_url"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        if let numeric = try? container.decodeIfPresent(Double.self, forKey: .price) {
            price = numeric
        } else if let text = try? container.decodeIfPresent(String.self, forKey: .price) {
            price = Double(text)
        } else {
            price = nil
        }
        posterProfilePictureURL = try container.decodeIfPresent(
            String.self,
            forKey: .posterProfilePictureURL
        )
    }

    public init(
        id: String,
        title: String? = nil,
        category: String? = nil,
        price: Double? = nil,
        posterProfilePictureURL: String? = nil
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.price = price
        self.posterProfilePictureURL = posterProfilePictureURL
    }
}

// MARK: - GET /api/users/search

/// `{ users: [...] }` — route `backend/routes/users.js:2367`, rows built
/// by `serializeCompatibilitySearchUser` (`backend/routes/users.js:293`).
/// That serializer emits camelCase (`profilePicture`, `accountType`), so
/// only `id` needs no remap.
public struct UniversalSearchPeopleResponse: Decodable, Sendable, Hashable {
    public let users: [UniversalSearchPersonDTO]

    public init(users: [UniversalSearchPersonDTO]) {
        self.users = users
    }
}

/// One person row. `city` / `state` are suppressed server-side when the
/// local profile's `show_neighborhood` flag is false.
public struct UniversalSearchPersonDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePicture: String?
    public let city: String?
    public let state: String?

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        profilePicture: String? = nil,
        city: String? = nil,
        state: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePicture = profilePicture
        self.city = city
        self.state = state
    }
}

// MARK: - GET /api/identity/search

/// `{ results: [...], counts: {...} }` — route
/// `backend/routes/identitySearch.js:370`. Rows are already camelCase
/// (`imageUrl`), built by `publicProfileResult` (`:328`) and
/// `localProfileResult` (`:310`).
public struct UniversalSearchProfilesResponse: Decodable, Sendable, Hashable {
    public let results: [UniversalSearchProfileDTO]

    public init(results: [UniversalSearchProfileDTO]) {
        self.results = results
    }
}

/// One profile-discovery row. `type` is `public_profile` (Beacon) or
/// `local_profile`; the Beacons tab renders only the former, matching
/// RN `src/app/discover.tsx:151`.
public struct UniversalSearchProfileDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let type: String?
    public let title: String?
    public let subtitle: String?
    public let meta: String?
    public let imageUrl: String?
    /// `/@handle` or `/persona/<handle>` — the handle the Beacon profile
    /// route needs is parsed out of this.
    public let href: String?

    public init(
        id: String,
        type: String? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        meta: String? = nil,
        imageUrl: String? = nil,
        href: String? = nil
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.subtitle = subtitle
        self.meta = meta
        self.imageUrl = imageUrl
        self.href = href
    }
}

// MARK: - GET /api/businesses/discover

/// `{ businesses: [...] }` — route `backend/routes/businesses.js:832`.
public struct UniversalSearchBusinessesResponse: Decodable, Sendable, Hashable {
    public let businesses: [UniversalSearchBusinessDTO]

    public init(businesses: [UniversalSearchBusinessDTO]) {
        self.businesses = businesses
    }
}

/// One business row. Projection built at
/// `backend/routes/businesses.js:933`.
public struct UniversalSearchBusinessDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePictureURL: String?
    public let city: String?
    public let state: String?
    public let businessType: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, city, state
        case profilePictureURL = "profile_picture_url"
        case businessType = "business_type"
    }

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        profilePictureURL: String? = nil,
        city: String? = nil,
        state: String? = nil,
        businessType: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePictureURL = profilePictureURL
        self.city = city
        self.state = state
        self.businessType = businessType
    }
}

// MARK: - GET /api/homes/discover

/// `{ homes: [...] }` — route `backend/routes/home.js:2297`.
///
/// Deliberately separate from `HomeDiscoverResponse`
/// (`Core/Networking/Models/HomeDiscovery/HomeDiscoveryDTOs.swift`),
/// which decodes the wider find-or-add-home shape; universal search
/// needs only the row fields it renders.
public struct UniversalSearchHomesResponse: Decodable, Sendable, Hashable {
    public let homes: [UniversalSearchHomeDTO]

    public init(homes: [UniversalSearchHomeDTO]) {
        self.homes = homes
    }
}

/// One home row. Projection built at `backend/routes/home.js:2400`.
public struct UniversalSearchHomeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let homeType: String?
    public let owner: UniversalSearchHomeOwnerDTO?

    private enum CodingKeys: String, CodingKey {
        case id, name, address, city, state, owner
        case homeType = "home_type"
    }

    public init(
        id: String,
        name: String? = nil,
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        homeType: String? = nil,
        owner: UniversalSearchHomeOwnerDTO? = nil
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.city = city
        self.state = state
        self.homeType = homeType
        self.owner = owner
    }
}

/// Nested owner projection on a home discover row.
public struct UniversalSearchHomeOwnerDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
    public let profilePictureURL: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name
        case profilePictureURL = "profile_picture_url"
    }

    public init(
        id: String? = nil,
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
