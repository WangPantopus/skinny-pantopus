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

/// `GET /api/posts/mute` — one muted person or business.
public struct MutedEntityDTO: Decodable, Sendable, Hashable {
    public let entityType: String
    public let entityId: String
    public let name: String
    public let username: String?
    public let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case entityType = "entity_type"
        case entityId = "entity_id"
        case name
        case username
        case avatarUrl = "avatar_url"
    }
}

/// `GET /api/posts/mute` reply: the people and businesses muted, and the
/// Pulse topics muted (Pulse S4; absent from older servers).
public struct MutedEntitiesResponse: Decodable, Sendable, Hashable {
    public let muted: [MutedEntityDTO]
    public let topicMutes: [TopicMuteDTO]

    private enum CodingKeys: String, CodingKey {
        case muted
        case topicMutes = "topic_mutes"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        muted = try c.decode([MutedEntityDTO].self, forKey: .muted)
        topicMutes = c.lossyList(TopicMuteDTO.self, forKey: .topicMutes)
    }
}

/// `GET /api/posts/mute` — one muted Pulse topic, everywhere (`areaId` nil)
/// or in one area (contract §2.9).
public struct TopicMuteDTO: Decodable, Sendable, Hashable, Identifiable {
    public let topic: String
    public let areaId: String?

    public var id: String {
        "\(topic)|\(areaId ?? "")"
    }

    private enum CodingKeys: String, CodingKey {
        case topic
        case areaId = "area_id"
    }

    public init(topic: String, areaId: String?) {
        self.topic = topic
        self.areaId = areaId
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        topic = try c.decode(String.self, forKey: .topic)
        areaId = c.lenient(String.self, forKey: .areaId)
    }
}

/// Body for `POST /api/posts/mute/topic`: a Pulse topic, everywhere or in
/// one area (`topic`, `areaId`), or, from the older card menu, a kind of
/// post on one surface (`postType`, `surface`).
public struct FeedMuteTopicRequest: Encodable, Sendable, Hashable {
    public let postType: String?
    public let surface: String?
    public let topic: String?
    public let areaId: String?

    public init(postType: String, surface: String?) {
        self.postType = postType
        self.surface = surface
        topic = nil
        areaId = nil
    }

    public init(topic: String, areaId: String?) {
        postType = nil
        surface = nil
        self.topic = topic
        self.areaId = areaId
    }
}

/// Body for `DELETE /api/posts/mute` undoing one topic mute: the one in
/// `areaId`, or the everywhere mute without it.
public struct FeedUnmuteTopicRequest: Encodable, Sendable, Hashable {
    public let entityType: String
    public let entityId: String
    public let areaId: String?

    public init(topic: String, areaId: String?) {
        entityType = "topic"
        entityId = topic
        self.areaId = areaId
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
