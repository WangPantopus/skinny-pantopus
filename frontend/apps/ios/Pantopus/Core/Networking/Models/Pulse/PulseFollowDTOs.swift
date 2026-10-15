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
