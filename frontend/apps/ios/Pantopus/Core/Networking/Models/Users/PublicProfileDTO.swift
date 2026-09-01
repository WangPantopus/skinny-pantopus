//
//  PublicProfileDTO.swift
//  Pantopus
//
//  DTO for `GET /api/users/id/:id` — route `backend/routes/users.js:2041`.
//  Shape diverges from `GET /api/users/profile`: aggregated stats live at
//  the top level (`gigs_posted`, `average_rating`, …), reviews are
//  inlined, and `email` / private fields are omitted.
//

import Foundation

/// Inline review row on the public profile.
public struct PublicProfileReview: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let reviewerId: String?
    public let revieweeId: String?
    public let rating: Int
    public let content: String?
    public let createdAt: String?
    public let reviewerName: String?
    public let reviewerAvatar: String?
    public let reviewerUsername: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case reviewerId = "reviewer_id"
        case revieweeId = "reviewee_id"
        case rating, content
        case createdAt = "created_at"
        case reviewerName = "reviewer_name"
        case reviewerAvatar = "reviewer_avatar"
        case reviewerUsername = "reviewer_username"
    }
}

/// `GET /api/users/id/:id` response — see `backend/routes/users.js:2108`.
public struct PublicProfile: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String
    public let firstName: String?
    public let lastName: String?
    public let name: String?
    public let bio: String?
    public let tagline: String?
    public let avatarURL: String?
    public let profilePictureURL: String?
    public let city: String?
    public let state: String?
    public let accountType: String?
    public let verified: Bool?
    public let residency: JSONValue?
    public let createdAt: String?
    public let gigsPosted: Int?
    public let gigsCompleted: Int?
    public let averageRating: Double?
    public let reviewCount: Int?
    public let followersCount: Int?
    public let reviews: [PublicProfileReview]
    public let socialLinks: JSONValue?
    public let skills: [String]

    private enum CodingKeys: String, CodingKey {
        case id, username
        case firstName, lastName, name
        case bio, tagline
        case avatarURL = "avatar_url"
        case profilePictureURL = "profile_picture_url"
        case city, state, accountType
        case verified, residency
        case createdAt = "created_at"
        case gigsPosted = "gigs_posted"
        case gigsCompleted = "gigs_completed"
        case averageRating = "average_rating"
        case reviewCount = "review_count"
        case followersCount = "followers_count"
        case reviews, socialLinks, skills
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        username = try c.decodeIfPresent(String.self, forKey: .username) ?? ""
        firstName = try c.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try c.decodeIfPresent(String.self, forKey: .lastName)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        bio = try c.decodeIfPresent(String.self, forKey: .bio)
        tagline = try c.decodeIfPresent(String.self, forKey: .tagline)
        avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        profilePictureURL = try c.decodeIfPresent(String.self, forKey: .profilePictureURL)
        city = try c.decodeIfPresent(String.self, forKey: .city)
        state = try c.decodeIfPresent(String.self, forKey: .state)
        accountType = try c.decodeIfPresent(String.self, forKey: .accountType)
        verified = try c.decodeIfPresent(Bool.self, forKey: .verified)
        residency = try c.decodeIfPresent(JSONValue.self, forKey: .residency)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        gigsPosted = try c.decodeIfPresent(Int.self, forKey: .gigsPosted)
        gigsCompleted = try c.decodeIfPresent(Int.self, forKey: .gigsCompleted)
        averageRating = try c.decodeIfPresent(Double.self, forKey: .averageRating)
        reviewCount = try c.decodeIfPresent(Int.self, forKey: .reviewCount)
        followersCount = try c.decodeIfPresent(Int.self, forKey: .followersCount)
        reviews = try (c.decodeIfPresent([PublicProfileReview].self, forKey: .reviews)) ?? []
        socialLinks = try c.decodeIfPresent(JSONValue.self, forKey: .socialLinks)
        skills = try (c.decodeIfPresent([String].self, forKey: .skills)) ?? []
    }

    /// Best-effort display name.
    public var displayName: String {
        if let name, !name.isEmpty { return name }
        let combined = [firstName, lastName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        if !combined.isEmpty { return combined }
        return "@\(username)"
    }

    /// "City, ST" if both present.
    public var locality: String? {
        guard let city, let state, !city.isEmpty, !state.isEmpty else {
            return city ?? state
        }
        return "\(city), \(state)"
    }
}
