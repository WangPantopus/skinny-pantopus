//
//  UserDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/users/profile` and `PATCH /api/users/profile`.
//  Route handlers: `backend/routes/users.js:1427` and `:1503`.
//

import Foundation

/// Compact user identity used in app session state. Derived from the
/// authenticated-user payload; kept small so AuthManager doesn't leak the
/// full profile surface into every screen that only needs id/email.
///
/// `isAdmin` is true when the backend `User.role` is `"admin"` — the same
/// role check `requireAdmin` enforces server-side at
/// `backend/middleware/verifyToken.js:128`. Used to gate admin-only entry
/// points (e.g. Review claims) in the Settings menu.
public struct UserDTO: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let email: String
    public let username: String
    public let displayName: String?
    public let avatarURL: URL?
    public let isAdmin: Bool

    private enum CodingKeys: String, CodingKey {
        case id, email, username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case isAdmin = "is_admin"
    }

    public init(
        id: String,
        email: String,
        username: String = "",
        displayName: String?,
        avatarURL: URL?,
        isAdmin: Bool = false
    ) {
        self.id = id
        self.email = email
        self.username = username
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.isAdmin = isAdmin
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        email = try container.decode(String.self, forKey: .email)
        username = try container.decodeIfPresent(String.self, forKey: .username) ?? ""
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        avatarURL = try container.decodeIfPresent(URL.self, forKey: .avatarURL)
        isAdmin = try container.decodeIfPresent(Bool.self, forKey: .isAdmin) ?? false
    }

    /// Project a rich [`AuthenticatedUser`](x-source-tag://AuthenticatedUser) down to the session shape.
    public init(from authUser: AuthenticatedUser) {
        id = authUser.id
        email = authUser.email
        username = authUser.username
        displayName = authUser.name.isEmpty ? nil : authUser.name
        avatarURL = nil
        isAdmin = authUser.role == "admin"
    }

    /// Project a full [`UserProfile`](x-source-tag://UserProfile) down to the session shape.
    public init(from profile: UserProfile) {
        id = profile.id
        email = profile.email
        username = profile.username
        displayName = profile.name
        if let raw = profile.avatarURL ?? profile.profilePictureURL, let url = URL(string: raw) {
            avatarURL = url
        } else {
            avatarURL = nil
        }
        isAdmin = profile.role == "admin"
    }
}

/// Social-link bundle emitted in the profile response.
/// Route: `backend/routes/users.js:1427`.
public struct SocialLinks: Decodable, Sendable, Hashable {
    public let website: String?
    public let linkedin: String?
    public let twitter: String?
    public let instagram: String?
    public let facebook: String?
}

/// `GET /api/users/profile` user envelope — see `backend/routes/users.js:1427`.
///
/// Fields whose upstream shape is provider-dependent (e.g. `residency`,
/// `inviteProgress`) are modelled as `JSONValue?` rather than invented.
public struct UserProfile: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let email: String
    public let username: String
    public let firstName: String
    public let middleName: String?
    public let lastName: String
    public let name: String
    public let phoneNumber: String?
    public let dateOfBirth: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let accountType: String
    public let role: String
    public let verified: Bool
    public let residency: JSONValue?
    public let avatarURL: String?
    public let profilePictureURL: String?
    public let profilePicture: String?
    public let bio: String?
    public let tagline: String?
    public let socialLinks: SocialLinks?
    public let skills: [String]?
    public let followersCount: Int?
    public let averageRating: Double?
    public let gigsPosted: Int?
    public let gigsCompleted: Int?
    public let profileVisibility: String?
    /// `User.show_email` — surface the account email on the public profile.
    /// The route echoes it both camelCase and snake_case
    /// (`backend/routes/users.js:2024`); we decode the camelCase key.
    public let showEmail: Bool?
    /// `User.show_phone` — same contract (`backend/routes/users.js:2026`).
    public let showPhone: Bool?
    public let createdAt: String
    public let updatedAt: String

    private enum CodingKeys: String, CodingKey {
        case id, email, username, firstName, middleName, lastName, name
        case phoneNumber, dateOfBirth, address, city, state, zipcode
        case accountType, role, verified, residency
        case avatarURL = "avatar_url"
        case profilePictureURL = "profile_picture_url"
        case profilePicture
        case bio, tagline, socialLinks, skills
        case followersCount = "followers_count"
        case averageRating = "average_rating"
        case gigsPosted = "gigs_posted"
        case gigsCompleted = "gigs_completed"
        case profileVisibility, showEmail, showPhone, createdAt, updatedAt
    }
}

/// Envelope for `GET /api/users/profile` — route `backend/routes/users.js:1427`.
public struct ProfileResponse: Decodable, Sendable, Hashable {
    public let user: UserProfile
    /// Shape varies by invite service; decode lazily.
    public let inviteProgress: JSONValue?

    private enum CodingKeys: String, CodingKey {
        case user
        case inviteProgress = "invite_progress"
    }
}

/// `PATCH /api/users/profile` — see `backend/routes/users.js:1503`. Every
/// field is optional; unspecified keys are left untouched server-side.
public struct ProfileUpdateRequest: Encodable, Sendable, Hashable {
    public var firstName: String?
    public var middleName: String?
    public var lastName: String?
    public var phoneNumber: String?
    public var address: String?
    public var city: String?
    public var state: String?
    public var zipcode: String?
    public var dateOfBirth: String?
    public var bio: String?
    public var tagline: String?
    public var profileVisibility: String?
    /// `showEmail` / `showPhone` — the two contact-visibility booleans the
    /// PATCH handler maps onto `show_email` / `show_phone`
    /// (`backend/routes/users.js:2076-2083`). The Joi schema accepts both
    /// camelCase and snake_case (`users.js:797-800`); we send camelCase.
    public var showEmail: Bool?
    public var showPhone: Bool?
    public var website: String?
    public var linkedin: String?
    public var twitter: String?
    public var instagram: String?
    public var facebook: String?

    public init(
        firstName: String? = nil,
        middleName: String? = nil,
        lastName: String? = nil,
        phoneNumber: String? = nil,
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipcode: String? = nil,
        dateOfBirth: String? = nil,
        bio: String? = nil,
        tagline: String? = nil,
        profileVisibility: String? = nil,
        showEmail: Bool? = nil,
        showPhone: Bool? = nil,
        website: String? = nil,
        linkedin: String? = nil,
        twitter: String? = nil,
        instagram: String? = nil,
        facebook: String? = nil
    ) {
        self.firstName = firstName
        self.middleName = middleName
        self.lastName = lastName
        self.phoneNumber = phoneNumber
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
        self.dateOfBirth = dateOfBirth
        self.bio = bio
        self.tagline = tagline
        self.profileVisibility = profileVisibility
        self.showEmail = showEmail
        self.showPhone = showPhone
        self.website = website
        self.linkedin = linkedin
        self.twitter = twitter
        self.instagram = instagram
        self.facebook = facebook
    }
}

/// Envelope for `PATCH /api/users/profile` — route `backend/routes/users.js:1503`.
public struct ProfileUpdateResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let user: UserProfile
}
