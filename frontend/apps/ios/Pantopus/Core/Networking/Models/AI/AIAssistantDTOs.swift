//
//  AIAssistantDTOs.swift
//  Pantopus
//
//  DTOs for what the assistant keeps for one person
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md`): the items
//  they asked it to remember (`/api/ai/memory`, §5.4).
//

import Foundation

// MARK: - What Pantopus remembers (§5.4)

/// `GET /api/ai/memory`: the person's own items, newest first.
public struct AIMemoryListResponse: Decodable, Sendable, Hashable {
    public let items: [AIMemoryItemDTO]
    public let count: Int?
    /// 100: saving more answers `409 MEMORY_FULL`.
    public let limit: Int?
    /// A year after the oldest item was last saved, edited or confirmed. From
    /// then on the list asks "Still right?" (§5.5). Nil with no items.
    public let reviewDueAt: String?

    private enum CodingKeys: String, CodingKey {
        case items, count, limit
        case reviewDueAt = "review_due_at"
    }
}

/// One thing the person asked Pantopus to remember. Only they ever see it.
public struct AIMemoryItemDTO: Decodable, Sendable, Hashable, Identifiable {
    /// The home an item is about: its name, else its city.
    public struct Home: Decodable, Sendable, Hashable {
        public let id: String
        public let label: String?
    }

    /// The chat the item was saved from; nil once that conversation is deleted.
    public struct Source: Decodable, Sendable, Hashable {
        public let conversationId: String?
        public let at: String?

        private enum CodingKeys: String, CodingKey {
            case at
            case conversationId = "conversation_id"
        }
    }

    public let id: String
    /// "Our furnace filter is 16x25x1."
    public let fact: String
    /// `you`, `household`, `home`, `plans`, `nearby` or `other`.
    public let topic: String
    /// `fact`, or `plan_alert` ("Plans you'd like", which can't be edited).
    public let kind: String
    /// Used only when a question is about it.
    public let sensitive: Bool
    public let home: Home?
    /// False when the item's home is one the person can no longer see.
    public let inUse: Bool
    public let from: Source?
    public let createdAt: String?
    public let updatedAt: String?

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        fact = try container.decode(String.self, forKey: .fact)
        topic = try container.decodeIfPresent(String.self, forKey: .topic) ?? "other"
        kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? "fact"
        sensitive = try container.decodeIfPresent(Bool.self, forKey: .sensitive) ?? false
        home = try container.decodeIfPresent(Home.self, forKey: .home)
        inUse = try container.decodeIfPresent(Bool.self, forKey: .inUse) ?? true
        from = try container.decodeIfPresent(Source.self, forKey: .from)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    private enum CodingKeys: String, CodingKey {
        case id, fact, topic, kind, sensitive, home, from
        case inUse = "in_use"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `PATCH /api/ai/memory/:id` body: the item's new words.
public struct AIMemoryEditRequest: Encodable, Sendable {
    public let fact: String

    public init(fact: String) {
        self.fact = fact
    }
}

/// `PATCH /api/ai/memory/:id`: the item as saved.
public struct AIMemoryItemResponse: Decodable, Sendable, Hashable {
    public let item: AIMemoryItemDTO
}

/// `POST /api/ai/memory/reviewed` ("Looks right"): when the next review is due.
public struct AIMemoryReviewedResponse: Decodable, Sendable, Hashable {
    public let reviewDueAt: String?

    private enum CodingKeys: String, CodingKey {
        case reviewDueAt = "review_due_at"
    }
}
