//
//  AIAssistantDTOs.swift
//  Pantopus
//
//  DTOs for what the assistant keeps for one person
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md`): the items
//  they asked it to remember (`/api/ai/memory`, §5.4), what waits on them
//  (`/api/ai/needs-you`, §6.2) and the standing rules they turned on
//  (`/api/ai/rules`, §18.5).
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

// MARK: - Needs you (§6.2)

/// `GET /api/ai/needs-you`: what waits on the person, most urgent first.
public struct AINeedsYouResponse: Decodable, Sendable, Hashable {
    /// At most 20.
    public let items: [AINeedsYouItemDTO]
    /// Every item found, past the 20 shown.
    public let total: Int?
    /// A source failed or ran late and was left out.
    public let partial: Bool?

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent([AINeedsYouItemDTO].self, forKey: .items) ?? []
        total = try container.decodeIfPresent(Int.self, forKey: .total)
        partial = try container.decodeIfPresent(Bool.self, forKey: .partial)
    }

    private enum CodingKeys: String, CodingKey {
        case items, total, partial
    }
}

/// One thing waiting: "Still coming?", "2 people want to join", "Overdue: Clean the gutters"….
public struct AINeedsYouItemDTO: Decodable, Sendable, Hashable, Identifiable {
    /// What it's about: a plan, a task (with its home), a home, a person or a post.
    public struct Subject: Decodable, Sendable, Hashable {
        public let type: String?
        public let id: String?
        public let homeId: String?

        private enum CodingKeys: String, CodingKey {
            case type, id
            case homeId = "home_id"
        }
    }

    public let id: String
    /// `still_coming`, `plan_requests`, `task_overdue`, `task_assigned`, `home_invite`,
    /// `household_request`, `connection_request`, `nudge_card` or `question_answered`.
    public let type: String
    public let title: String
    public let subtitle: String?
    public let dueAt: String?
    /// The screen it opens (`pantopus://plans/<id>`, `pantopus://homes/<id>/tasks/<id>`…).
    public let link: String?
    public let subject: Subject?

    private enum CodingKeys: String, CodingKey {
        case id, type, title, subtitle, link, subject
        case dueAt = "due_at"
    }
}

// MARK: - What Pantopus does for you (§18.5)

/// `GET /api/ai/rules`: the person's standing rules, newest first.
public struct AIRulesResponse: Decodable, Sendable, Hashable {
    public let rules: [AIRuleDTO]
    /// 5 a person.
    public let limit: Int?
}

/// One standing rule: a weekly plan Pantopus posts, or a household member's pickup reminder.
public struct AIRuleDTO: Decodable, Sendable, Hashable, Identifiable {
    /// One time it ran: "Posted Sat Oct 31 · 4 going", with the plan's link.
    public struct Run: Decodable, Sendable, Hashable {
        public let at: String?
        /// `done` or `error`.
        public let status: String
        public let label: String
        public let link: String?
    }

    public let id: String
    /// `plan_repeat` or `pickup_reminder`.
    public let kind: String
    /// The sentence the card showed: "Post 'Pickup game' every Saturday, 9:00–10:30 AM, at Crown Park".
    public let summary: String
    /// The switch.
    public let enabled: Bool
    /// Why it stopped on its own: `nobody_came`, `cannot_post`, `ended` or `member_left`.
    public let pausedReason: String?
    /// A weekly plan's last day (at most 12 weeks after it was turned on or extended).
    public let endsAt: String?
    public let nextRunAt: String?
    /// The last 5, newest first.
    public let runs: [Run]

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        kind = try container.decode(String.self, forKey: .kind)
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
        pausedReason = try container.decodeIfPresent(String.self, forKey: .pausedReason)
        endsAt = try container.decodeIfPresent(String.self, forKey: .endsAt)
        nextRunAt = try container.decodeIfPresent(String.self, forKey: .nextRunAt)
        runs = try container.decodeIfPresent([Run].self, forKey: .runs) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case id, kind, summary, enabled, runs
        case pausedReason = "paused_reason"
        case endsAt = "ends_at"
        case nextRunAt = "next_run_at"
    }
}

/// `PATCH /api/ai/rules/:id`: the switch, or Extend (12 more weeks for a weekly plan).
public struct AIRuleChangeRequest: Encodable, Sendable {
    public let enabled: Bool?
    public let extend: Bool?

    public init(enabled: Bool?, extend: Bool?) {
        self.enabled = enabled
        self.extend = extend
    }
}

/// `PATCH /api/ai/rules/:id`: the rule as it is now.
public struct AIRuleResponse: Decodable, Sendable, Hashable {
    public let rule: AIRuleDTO
}
