//
//  PostsMapDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/posts/map` — route `backend/routes/posts.js:1646`.
//  The handler emits one heterogeneous `markers[]` array whose rows carry
//  a `layer_type` discriminator; the field set differs per layer, so
//  every layer-specific field is optional here and the consumer switches
//  on `layerType`.
//

import Foundation

/// Envelope returned by `/api/posts/map`
/// (`backend/routes/posts.js:1877`).
public struct PostsMapResponse: Decodable, Sendable, Hashable {
    public let markers: [PostsMapMarkerDTO]
    /// Non-nil only when the viewport came back empty — the backend runs
    /// `find_nearest_activity_center` and hands back a coordinate the
    /// client can offer to jump to (`backend/routes/posts.js:1854`).
    public let nearestActivityCenter: PostsMapCenterDTO?

    private enum CodingKeys: String, CodingKey {
        case markers
        case nearestActivityCenter = "nearest_activity_center"
    }

    public init(markers: [PostsMapMarkerDTO], nearestActivityCenter: PostsMapCenterDTO? = nil) {
        self.markers = markers
        self.nearestActivityCenter = nearestActivityCenter
    }
}

/// Fallback coordinate for an empty viewport.
public struct PostsMapCenterDTO: Decodable, Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// Marker author, present on the `post` / `task` / `offer` layers.
public struct PostsMapCreatorDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
    public let profilePictureURL: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name
        case profilePictureURL = "profile_picture_url"
    }

    public init(id: String?, username: String?, name: String?, profilePictureURL: String? = nil) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePictureURL = profilePictureURL
    }
}

/// One marker row. `layerType` is the discriminator (`post` / `task` /
/// `offer` / `business` / `home`); everything past `longitude` is
/// layer-specific.
public struct PostsMapMarkerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let layerType: String
    public let id: String
    public let latitude: Double?
    public let longitude: Double?

    // ── post layer (backend/routes/posts.js:1690) ──
    public let title: String?
    public let postType: String?
    public let postAs: String?
    public let audience: String?
    public let content: String?
    public let locationName: String?
    public let homeAddress: String?
    public let likeCount: Int?
    public let commentCount: Int?
    public let userHasLiked: Bool?
    public let userHasSaved: Bool?
    public let createdAt: String?
    public let creator: PostsMapCreatorDTO?

    // ── task / offer layers (backend/routes/posts.js:1730 / :1765) ──
    public let description: String?
    public let status: String?
    public let category: String?
    /// Gig privacy flag — false means the coordinate is a fuzzed centroid.
    public let locationUnlocked: Bool?

    // ── business layer (backend/routes/posts.js:1793) ──
    public let businessName: String?
    public let address: String?
    public let logoURL: String?
    public let isVerified: Bool?

    // ── home layer (backend/routes/posts.js:1833) ──
    public let city: String?
    public let state: String?
    public let homeType: String?

    private enum CodingKeys: String, CodingKey {
        case layerType = "layer_type"
        case id, latitude, longitude, title
        case postType = "post_type"
        case postAs = "post_as"
        case audience, content
        case locationName = "location_name"
        case homeAddress = "home_address"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case userHasLiked, userHasSaved
        case createdAt = "created_at"
        case creator, description, status, category, locationUnlocked
        case businessName = "business_name"
        case address
        case logoURL = "logo_url"
        case isVerified = "is_verified"
        case city, state
        case homeType = "home_type"
    }

    public init(
        layerType: String,
        id: String,
        latitude: Double?,
        longitude: Double?,
        title: String? = nil,
        postType: String? = nil,
        postAs: String? = nil,
        audience: String? = nil,
        content: String? = nil,
        locationName: String? = nil,
        homeAddress: String? = nil,
        likeCount: Int? = nil,
        commentCount: Int? = nil,
        userHasLiked: Bool? = nil,
        userHasSaved: Bool? = nil,
        createdAt: String? = nil,
        creator: PostsMapCreatorDTO? = nil,
        description: String? = nil,
        status: String? = nil,
        category: String? = nil,
        locationUnlocked: Bool? = nil,
        businessName: String? = nil,
        address: String? = nil,
        logoURL: String? = nil,
        isVerified: Bool? = nil,
        city: String? = nil,
        state: String? = nil,
        homeType: String? = nil
    ) {
        self.layerType = layerType
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.title = title
        self.postType = postType
        self.postAs = postAs
        self.audience = audience
        self.content = content
        self.locationName = locationName
        self.homeAddress = homeAddress
        self.likeCount = likeCount
        self.commentCount = commentCount
        self.userHasLiked = userHasLiked
        self.userHasSaved = userHasSaved
        self.createdAt = createdAt
        self.creator = creator
        self.description = description
        self.status = status
        self.category = category
        self.locationUnlocked = locationUnlocked
        self.businessName = businessName
        self.address = address
        self.logoURL = logoURL
        self.isVerified = isVerified
        self.city = city
        self.state = state
        self.homeType = homeType
    }

    /// The `id` column is a UUID string on every layer, but Supabase can
    /// hand back a numeric id for a couple of them — decode defensively.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        layerType = try container.decodeIfPresent(String.self, forKey: .layerType) ?? "post"
        if let stringID = try? container.decode(String.self, forKey: .id) {
            id = stringID
        } else if let intID = try? container.decode(Int.self, forKey: .id) {
            id = String(intID)
        } else {
            id = UUID().uuidString
        }
        latitude = Self.double(container, .latitude)
        longitude = Self.double(container, .longitude)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        postType = try container.decodeIfPresent(String.self, forKey: .postType)
        postAs = try container.decodeIfPresent(String.self, forKey: .postAs)
        audience = try container.decodeIfPresent(String.self, forKey: .audience)
        content = try container.decodeIfPresent(String.self, forKey: .content)
        locationName = try container.decodeIfPresent(String.self, forKey: .locationName)
        homeAddress = try container.decodeIfPresent(String.self, forKey: .homeAddress)
        likeCount = try container.decodeIfPresent(Int.self, forKey: .likeCount)
        commentCount = try container.decodeIfPresent(Int.self, forKey: .commentCount)
        userHasLiked = try container.decodeIfPresent(Bool.self, forKey: .userHasLiked)
        userHasSaved = try container.decodeIfPresent(Bool.self, forKey: .userHasSaved)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        creator = try container.decodeIfPresent(PostsMapCreatorDTO.self, forKey: .creator)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        locationUnlocked = try container.decodeIfPresent(Bool.self, forKey: .locationUnlocked)
        businessName = try container.decodeIfPresent(String.self, forKey: .businessName)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        logoURL = try container.decodeIfPresent(String.self, forKey: .logoURL)
        isVerified = try container.decodeIfPresent(Bool.self, forKey: .isVerified)
        city = try container.decodeIfPresent(String.self, forKey: .city)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        homeType = try container.decodeIfPresent(String.self, forKey: .homeType)
    }

    /// Postgres numerics can arrive as either a JSON number or a string.
    private static func double(
        _ container: KeyedDecodingContainer<CodingKeys>,
        _ key: CodingKeys
    ) -> Double? {
        if let value = try? container.decodeIfPresent(Double.self, forKey: key) { return value }
        if let text = try? container.decodeIfPresent(String.self, forKey: key) { return Double(text) }
        return nil
    }
}
