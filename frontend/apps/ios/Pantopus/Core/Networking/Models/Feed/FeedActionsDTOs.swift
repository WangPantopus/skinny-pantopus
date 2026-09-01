//
//  FeedActionsDTOs.swift
//  Pantopus
//
//  Request / response shapes for the Pulse card overflow actions and the
//  Pulse preferences sheet — `backend/routes/posts.js` hide / mute /
//  not-helpful / solve / seeded-dismiss / feed-preferences.
//

import Foundation

/// Entity kinds accepted by `POST /api/posts/mute`
/// (`backend/routes/posts.js:2126`).
public enum FeedMuteEntityType: String, Sendable, Hashable {
    case user
    case business
}

/// Body for `POST` + `DELETE /api/posts/mute`.
public struct FeedMuteRequest: Encodable, Sendable, Hashable {
    public let entityType: String
    public let entityId: String

    public init(entityType: String, entityId: String) {
        self.entityType = entityType
        self.entityId = entityId
    }
}

/// Body for `POST /api/posts/mute/topic`.
public struct FeedMuteTopicRequest: Encodable, Sendable, Hashable {
    public let postType: String
    public let surface: String?

    public init(postType: String, surface: String?) {
        self.postType = postType
        self.surface = surface
    }
}

/// Body for `POST /api/posts/:id/not-helpful`.
public struct FeedNotHelpfulRequest: Encodable, Sendable, Hashable {
    public let surface: String

    public init(surface: String) {
        self.surface = surface
    }
}

/// `POST /api/posts/:id/not-helpful` response.
public struct FeedNotHelpfulResponse: Decodable, Sendable, Hashable {
    public let flagged: Bool
}

/// `PATCH /api/posts/:id/solve` response — the backend returns the
/// trimmed post (`id, state, solved_at`).
public struct FeedSolveResponse: Decodable, Sendable, Hashable {
    public struct SolvedPost: Decodable, Sendable, Hashable {
        public let id: String
        public let state: String?
        public let solvedAt: String?

        private enum CodingKeys: String, CodingKey {
            case id, state
            case solvedAt = "solved_at"
        }
    }

    public let message: String?
    public let post: SolvedPost?
}

/// `POST /api/posts/seeded/:factId/dismiss` response.
public struct FeedSeededDismissResponse: Decodable, Sendable, Hashable {
    public let dismissed: Bool
    public let factId: String?
}

/// One row of `UserFeedPreference` — `backend/routes/posts.js:2257`.
public struct FeedPreferencesDTO: Decodable, Sendable, Hashable {
    public let hideDealsPlace: Bool
    public let hideAlertsPlace: Bool
    public let showPoliticsConnections: Bool
    public let showPoliticsPlace: Bool

    private enum CodingKeys: String, CodingKey {
        case hideDealsPlace = "hide_deals_place"
        case hideAlertsPlace = "hide_alerts_place"
        case showPoliticsConnections = "show_politics_connections"
        case showPoliticsPlace = "show_politics_place"
    }

    public init(
        hideDealsPlace: Bool,
        hideAlertsPlace: Bool,
        showPoliticsConnections: Bool,
        showPoliticsPlace: Bool
    ) {
        self.hideDealsPlace = hideDealsPlace
        self.hideAlertsPlace = hideAlertsPlace
        self.showPoliticsConnections = showPoliticsConnections
        self.showPoliticsPlace = showPoliticsPlace
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        hideDealsPlace = try c.decodeIfPresent(Bool.self, forKey: .hideDealsPlace) ?? false
        hideAlertsPlace = try c.decodeIfPresent(Bool.self, forKey: .hideAlertsPlace) ?? false
        showPoliticsConnections = try c.decodeIfPresent(Bool.self, forKey: .showPoliticsConnections) ?? false
        showPoliticsPlace = try c.decodeIfPresent(Bool.self, forKey: .showPoliticsPlace) ?? false
    }
}

/// `GET` + `PUT /api/posts/feed-preferences` response envelope.
public struct FeedPreferencesResponse: Decodable, Sendable, Hashable {
    public let preferences: FeedPreferencesDTO
}

/// Body for `PUT /api/posts/feed-preferences`. Every field is optional —
/// the handler only writes the keys that are present.
public struct FeedPreferencesUpdateRequest: Encodable, Sendable, Hashable {
    public let hideDealsPlace: Bool?
    public let hideAlertsPlace: Bool?
    public let showPoliticsConnections: Bool?
    public let showPoliticsPlace: Bool?

    public init(
        hideDealsPlace: Bool? = nil,
        hideAlertsPlace: Bool? = nil,
        showPoliticsConnections: Bool? = nil,
        showPoliticsPlace: Bool? = nil
    ) {
        self.hideDealsPlace = hideDealsPlace
        self.hideAlertsPlace = hideAlertsPlace
        self.showPoliticsConnections = showPoliticsConnections
        self.showPoliticsPlace = showPoliticsPlace
    }
}
