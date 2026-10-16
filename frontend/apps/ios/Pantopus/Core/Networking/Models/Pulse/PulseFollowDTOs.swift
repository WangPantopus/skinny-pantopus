import Foundation

public struct PulseFollowDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let targetType: String?
    public let targetId: String?
    public let areaId: String?
    public let notify: String?
    public let ends: String?
    public let untilAt: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, notify, ends
        case targetType = "target_type"
        case targetId = "target_id"
        case areaId = "area_id"
        case untilAt = "until_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        targetType = container.lenient(String.self, forKey: .targetType)
        targetId = container.lenient(String.self, forKey: .targetId)
        areaId = container.lenient(String.self, forKey: .areaId)
        notify = container.lenient(String.self, forKey: .notify)
        ends = container.lenient(String.self, forKey: .ends)
        untilAt = container.lenient(String.self, forKey: .untilAt)
        createdAt = container.lenient(String.self, forKey: .createdAt)
        updatedAt = container.lenient(String.self, forKey: .updatedAt)
    }
}

public struct PulseFollowsResponse: Decodable, Sendable, Hashable {
    public let follows: [PulseFollowDTO]

    private enum CodingKeys: String, CodingKey { case follows }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        follows = container.lossyList(PulseFollowDTO.self, forKey: .follows)
    }
}

public struct PulseFollowResponse: Decodable, Sendable, Hashable {
    public let follow: PulseFollowDTO?

    private enum CodingKeys: String, CodingKey { case follow }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        follow = container.lenient(PulseFollowDTO.self, forKey: .follow)
    }
}

public struct PulseFollowDeleteResponse: Decodable, Sendable, Hashable {
    public let ok: Bool?
}

/// The request that undoes one item on the preferences page (contract §2.9):
/// the follow's `DELETE`, `DELETE /api/posts/mute` with its body, or an
/// alert's `PUT` with `notify: off`.
public struct PulseUndoDTO: Decodable, Sendable, Hashable {
    public let method: String
    public let path: String
    public let body: JSONValue?

    private enum CodingKeys: String, CodingKey { case method, path, body }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        method = try container.decode(String.self, forKey: .method)
        path = try container.decode(String.self, forKey: .path)
        body = container.lenient(JSONValue.self, forKey: .body)
    }
}

/// A follow, or an alert (a follow whose notifications are on), with the
/// request that undoes it.
public struct PulsePreferencesFollow: Decodable, Sendable, Hashable, Identifiable {
    public let follow: PulseFollowDTO
    public let undo: PulseUndoDTO?

    public var id: String {
        follow.id
    }

    private enum CodingKeys: String, CodingKey { case undo }

    public init(from decoder: any Decoder) throws {
        follow = try PulseFollowDTO(from: decoder)
        undo = try decoder.container(keyedBy: CodingKeys.self).lenient(PulseUndoDTO.self, forKey: .undo)
    }
}

/// One mute: a person or a business, a Pulse topic (everywhere or in one
/// area), or a post type muted by an older app; with its undo.
public struct PulsePreferencesMute: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// `user`, `business` or `topic` (a Pulse topic or an older post type).
    public let entityType: String?
    public let entityId: String?
    public let areaId: String?
    public let undo: PulseUndoDTO?

    private enum CodingKeys: String, CodingKey {
        case id, undo
        case entityType = "entity_type"
        case entityId = "entity_id"
        case areaId = "area_id"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        entityType = container.lenient(String.self, forKey: .entityType)
        entityId = container.lenient(String.self, forKey: .entityId)
        areaId = container.lenient(String.self, forKey: .areaId)
        undo = container.lenient(PulseUndoDTO.self, forKey: .undo)
    }
}

/// `GET /api/pulse/preferences/summary` (contract §2.9): every follow, mute
/// and alert the reader has. A row this build can't read is dropped.
public struct PulsePreferencesSummaryResponse: Decodable, Sendable, Hashable {
    public let follows: [PulsePreferencesFollow]
    public let mutes: [PulsePreferencesMute]
    public let alerts: [PulsePreferencesFollow]

    private enum CodingKeys: String, CodingKey { case follows, mutes, alerts }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        follows = container.lossyList(PulsePreferencesFollow.self, forKey: .follows)
        mutes = container.lossyList(PulsePreferencesMute.self, forKey: .mutes)
        alerts = container.lossyList(PulsePreferencesFollow.self, forKey: .alerts)
    }
}

/// `GET /api/pulse/posts/:id/why` (contract §2.9): the reader's own choices,
/// each a plain sentence. An unknown kind still shows its sentence.
public struct PulseWhyResponse: Decodable, Sendable, Hashable {
    public let reasons: [PulseWhyReason]

    private enum CodingKeys: String, CodingKey { case reasons }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        reasons = container.lossyList(PulseWhyReason.self, forKey: .reasons)
    }
}

public struct PulseWhyReason: Decodable, Sendable, Hashable {
    /// `area`, `topic`, `follow` or `time`.
    public let kind: String?
    public let text: String

    private enum CodingKeys: String, CodingKey { case kind, text }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = container.lenient(String.self, forKey: .kind)
        text = try container.decode(String.self, forKey: .text)
    }
}
