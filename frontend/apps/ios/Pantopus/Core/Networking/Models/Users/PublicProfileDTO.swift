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
    /// The review's text, as the server sends it (the Review row's `comment`).
    public let comment: String?
    /// An older name for the text; read when `comment` is missing.
    public let content: String?
    public let createdAt: String?
    public let reviewerName: String?
    public let reviewerAvatar: String?
    public let reviewerUsername: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case reviewerId = "reviewer_id"
        case revieweeId = "reviewee_id"
        case rating, comment, content
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
    /// True when the server made the username up (user_…, or the pre-October-7 kind built from the email address).
    public let usernameIsGenerated: Bool
    /// What they did around the neighborhood (PRF SRV-1); nil from an older
    /// server or when the counts couldn't be read.
    public let contributions: ProfileContributions?
    /// "Get to know <name>" answers in saved order (PRF SRV-2); nil from an
    /// older server.
    public let prompts: [ProfilePrompt]?

    private enum CodingKeys: String, CodingKey {
        case id, username, usernameIsGenerated
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
        case contributions, prompts
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
        // A malformed part hides "Around the neighborhood", never the profile.
        contributions = try? c.decodeIfPresent(ProfileContributions.self, forKey: .contributions)
        prompts = try? c.decodeIfPresent([ProfilePrompt].self, forKey: .prompts)
        usernameIsGenerated = try c.decodeIfPresent(Bool.self, forKey: .usernameIsGenerated) ?? false
    }

    /// The username when the person chose it; nil for a made-up one.
    public var chosenUsername: String? {
        usernameIsGenerated ? nil : MadeUpUsername.chosen(username)
    }

    /// False when the profile has neither a name nor a chosen username.
    public var hasName: Bool {
        if let name, !name.isEmpty { return true }
        if [firstName, lastName].contains(where: { $0?.isEmpty == false }) { return true }
        return chosenUsername != nil
    }

    /// Best-effort display name.
    public var displayName: String {
        if let name, !name.isEmpty { return name }
        let combined = [firstName, lastName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        if !combined.isEmpty { return combined }
        // A made-up username is never shown as the name.
        return chosenUsername.map { "@\($0)" } ?? "Pantopus member"
    }

    /// "City, ST" if both present.
    public var locality: String? {
        guard let city, let state, !city.isEmpty, !state.isEmpty else {
            return city ?? state
        }
        return "\(city), \(state)"
    }

    /// Verified residency (`residency.verified`), the fact behind "Verified
    /// neighbor". `verified` is the account flag, which sign-in sets.
    public var hasVerifiedResidency: Bool {
        guard case let .object(map) = residency ?? .null,
              case let .bool(value) = map["verified"] ?? .null else { return false }
        return value
    }
}

/// `contributions` on the profile reads (PRF SRV-1): the same numbers for
/// every viewer. Route `backend/routes/users.js:3700`.
public struct ProfileContributions: Decodable, Sendable, Hashable {
    /// Support Trains they signed up to help (each train once).
    public let supportTrainsHelped: Int
    /// Plans they hosted that took place.
    public let plansHosted: Int
    /// Helpful marks other people gave their posts.
    public let helpfulMarks: Int

    private enum CodingKeys: String, CodingKey {
        case supportTrainsHelped = "support_trains_helped"
        case plansHosted = "plans_hosted"
        case helpfulMarks = "helpful_marks"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        supportTrainsHelped = try c.decodeIfPresent(Int.self, forKey: .supportTrainsHelped) ?? 0
        plansHosted = try c.decodeIfPresent(Int.self, forKey: .plansHosted) ?? 0
        helpfulMarks = try c.decodeIfPresent(Int.self, forKey: .helpfulMarks) ?? 0
    }
}

/// `GET /api/users/:id/in-common` — what you and this person share, only as
/// far as you may already see it (PRF SRV-1). Route `backend/routes/users.js:3846`.
public struct ProfileInCommon: Decodable, Sendable, Hashable {
    /// Someone connected to both of you, by the name neighbors see.
    public struct Person: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let name: String
        public let avatarURL: String?

        private enum CodingKeys: String, CodingKey {
            case id, name
            case avatarURL = "avatar_url"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
            avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        }
    }

    /// An upcoming plan you're both in.
    public struct Plan: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let title: String
        public let kind: PlanKind?
        public let startsAt: String?
        public let endsAt: String?
        /// Who hosts it: you, them or someone else.
        public let hostId: String?

        private enum CodingKeys: String, CodingKey {
            case id, title, kind
            case startsAt = "starts_at"
            case endsAt = "ends_at"
            case hostId = "host_id"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
            // A kind this app doesn't know yet still shows the plan.
            kind = try? c.decodeIfPresent(PlanKind.self, forKey: .kind)
            startsAt = try c.decodeIfPresent(String.self, forKey: .startsAt)
            endsAt = try c.decodeIfPresent(String.self, forKey: .endsAt)
            hostId = try c.decodeIfPresent(String.self, forKey: .hostId)
        }
    }

    /// A Support Train you both signed up to help.
    public struct Train: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let title: String

        private enum CodingKeys: String, CodingKey {
            case id, title
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        }
    }

    private struct Connections: Decodable {
        let count: Int?
        let people: [Person]?
    }

    /// How many people you both know; `people` names at most two of them.
    public let connectionCount: Int
    public let people: [Person]
    public let plans: [Plan]
    public let supportTrains: [Train]
    public let skills: [String]

    private enum CodingKeys: String, CodingKey {
        case connections, plans, skills
        case supportTrains = "support_trains"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let connections = try c.decodeIfPresent(Connections.self, forKey: .connections)
        people = connections?.people ?? []
        connectionCount = max(connections?.count ?? 0, people.count)
        plans = try c.decodeIfPresent([Plan].self, forKey: .plans) ?? []
        supportTrains = try c.decodeIfPresent([Train].self, forKey: .supportTrains) ?? []
        skills = try c.decodeIfPresent([String].self, forKey: .skills) ?? []
    }

    /// Nothing in common that you may see.
    public var isEmpty: Bool {
        connectionCount == 0 && plans.isEmpty && supportTrains.isEmpty && skills.isEmpty
    }
}

/// One "Get to know" answer (`profile_prompts`, PRF SRV-2): a key from the
/// catalog (`ProfilePromptCatalog`; the apps own the words) and the answer,
/// 1–120 characters.
public struct ProfilePrompt: Codable, Sendable, Hashable, Identifiable {
    public let key: String
    public let answer: String

    public var id: String {
        key
    }

    public init(key: String, answer: String) {
        self.key = key
        self.answer = answer
    }

    private enum CodingKeys: String, CodingKey {
        case key, answer
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = try c.decodeIfPresent(String.self, forKey: .key) ?? ""
        answer = try c.decodeIfPresent(String.self, forKey: .answer) ?? ""
    }
}
