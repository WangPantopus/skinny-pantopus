//
//  AIDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/ai/conversations` (`backend/routes/ai.js:358`).
//  The serializer selects `id, title, message_count, last_message_at,
//  created_at, updated_at` from `AIConversation`
//  (`backend/services/ai/agentService.js:1003`).
//

import Foundation

/// One Ask-Pantopus conversation summary. There is no messages payload —
/// the backend keeps no per-message rows for AI threads.
public struct AIConversationSummaryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let messageCount: Int?
    public let lastMessageAt: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, title
        case messageCount = "message_count"
        case lastMessageAt = "last_message_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/ai/conversations` envelope — ordered newest-updated first.
public struct AIConversationsResponse: Decodable, Sendable, Hashable {
    public let conversations: [AIConversationSummaryDTO]
}

/// `GET /api/ai/conversations/:id/messages` (`backend/routes/ai.js:445`) — a
/// conversation as the thread shows it after a relaunch: the person's
/// messages, the replies, and the drafts as cards.
public struct AIConversationMessagesResponse: Decodable, Sendable, Hashable {
    public let conversationId: String
    public let title: String?
    public let messages: [AIConversationMessageDTO]
}

public struct AIConversationMessageDTO: Decodable, Sendable, Hashable {
    /// `user` or `assistant`.
    public let role: String
    public let text: String?
    /// How many photos a person's message carried (they aren't kept).
    public let photos: Int?
    /// How many PDFs a person's message carried (phase 2; not kept either).
    public let documents: Int?
    public let draft: AIConversationDraftDTO?
    /// The link buttons under an assistant reply, for apps that ask for them.
    public let links: [AIChatLinkDTO]?
    /// On the first item of a brief or nudge Pantopus sent
    /// (`docs/product/ai-assistant-phase2-contract-2026-10-20.md` §3.3).
    public let nudge: AIConversationNudgeDTO?
    /// When it was said (ISO 8601). Older servers leave it out.
    public let at: String?
}

/// A brief or nudge in the assistant's history: its Notification row's id,
/// which `pantopus://assistant?nudge=<id>` opens the thread at, and its kind.
public struct AIConversationNudgeDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let kind: String?
}

public struct AIConversationDraftDTO: Decodable, Sendable, Hashable {
    /// `post`, `support_train`, `pickup_schedule`, `action`, `gig`, `listing`.
    public let type: String
    public let draft: [String: JSONValue]
}

/// `POST /api/ai/chat` `context`: what the person was looking at when they
/// tapped Ask (`docs/product/ai-assistant-phase1-contract-2026-10-20.md`
/// section 6). The server checks access as that screen does, so a plan or
/// post the person can't see counts as no context.
public struct AIChatContext: Encodable, Sendable, Hashable {
    /// `today`, `place`, `nearby`, `post`, `plans` or `plan`.
    public let surface: String
    /// The post or plan id.
    public let id: String?
    public let homeId: String?
    /// A Place section's slug: `today`, `your-home`, `risk`, `block`, `money`, `civic`.
    public let section: String?

    public init(surface: String, id: String? = nil, homeId: String? = nil, section: String? = nil) {
        self.surface = surface
        self.id = id
        self.homeId = homeId
        self.section = section
    }

    private enum CodingKeys: String, CodingKey {
        case surface, id, section
        case homeId = "home_id"
    }
}

/// A link button under a reply: the `link` event and history `links`. URLs
/// come from the server's fixed catalog of app screens, never the model.
public struct AIChatLinkDTO: Decodable, Sendable, Hashable {
    public let label: String
    public let url: String
}

/// An action card: a `draft` event of type `action` (contract section 4.2).
/// One tap sends `request` through an endpoint the app already uses; the
/// server built it from validated fields, and the app sends only requests on
/// its allowlist (`AIActionAllowlist`). A malformed request still decodes, so
/// the card can say it can't be used rather than vanish.
public struct AIActionCardDTO: Decodable, Sendable, Hashable {
    public struct Line: Decodable, Sendable, Hashable {
        public let label: String
        public let value: String
    }

    public struct Request: Decodable, Sendable, Hashable {
        public let method: String?
        public let path: String?
        /// A JSON object, sent as is.
        public let body: JSONValue?
        /// Only `x-pantopus-session-scope` is ever sent.
        public let headers: [String: JSONValue]?
    }

    /// A request sent only after the action's own request succeeds.
    public struct FollowUp: Decodable, Sendable, Hashable {
        public let request: Request
    }

    public struct Done: Decodable, Sendable, Hashable {
        public let label: String?
        /// An app link, opened through the deep-link router.
        public let link: String?
    }

    public struct Action: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let label: String
        /// `primary`, `secondary` or `destructive`.
        public let style: String?
        public let request: Request
        public let then: FollowUp?
        public let done: Done?
    }

    /// One row with its own buttons, such as a request to join a plan.
    public struct Item: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let title: String
        public let lines: [Line]
        public let actions: [Action]

        public init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
            lines = try container.decodeIfPresent([Line].self, forKey: .lines) ?? []
            actions = try container.decodeIfPresent([Action].self, forKey: .actions) ?? []
        }

        private enum CodingKeys: String, CodingKey {
            case id, title, lines, actions
        }
    }

    /// Also the idempotency key where an endpoint takes one.
    public let id: String
    /// `plan_create`, `plan_edit`, `plan_cancel`, `plan_requests`, `plan_ask`,
    /// `plan_message`, `post_reply`, `post_solve`, `home_task`, `notification_settings`.
    public let card: String
    public let title: String
    public let lines: [Line]
    public let warnings: [String]
    /// The assistant's one line (also streamed as text).
    public let note: String?
    /// After this, the card shows as expired and its actions are off.
    public let expiresAt: String?
    public let actions: [Action]
    public let items: [Item]

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        card = try container.decodeIfPresent(String.self, forKey: .card) ?? ""
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        lines = try container.decodeIfPresent([Line].self, forKey: .lines) ?? []
        warnings = try container.decodeIfPresent([String].self, forKey: .warnings) ?? []
        note = try container.decodeIfPresent(String.self, forKey: .note)
        expiresAt = try container.decodeIfPresent(String.self, forKey: .expiresAt)
        actions = try container.decodeIfPresent([Action].self, forKey: .actions) ?? []
        items = try container.decodeIfPresent([Item].self, forKey: .items) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case id, card, title, lines, warnings, note, actions, items
        case expiresAt = "expires_at"
    }
}

/// Body for `POST /api/ai/draft/listing-vision` (Snap & Sell). Images
/// are base64 data URLs or hosted URLs; the route caps the array at 5
/// (`backend/routes/ai.js:74`).
public struct AIDraftListingVisionRequest: Encodable, Sendable {
    public let images: [String]
    public let text: String?
    public let latitude: Double?
    public let longitude: Double?

    public init(images: [String], text: String? = nil, latitude: Double? = nil, longitude: Double? = nil) {
        self.images = images
        self.text = text
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// One AI-drafted listing. Mirrors `listingDraftJsonSchema`
/// (`backend/services/ai/schemas.js:210`) — the model emits camelCase
/// keys natively, so no CodingKeys mapping is needed.
public struct AIListingDraftDTO: Decodable, Sendable, Hashable {
    public let title: String?
    public let description: String?
    public let price: Double?
    public let isFree: Bool?
    /// AI product-category enum (`electronics`, `furniture`, `sports`,
    /// …) — note this is the *draft* enum, not the backend listing
    /// category enum; map before submitting.
    public let category: String?
    public let condition: String?
    public let tags: [String]?
    public let listingType: String?
    public let deliveryAvailable: Bool?
    public let meetupPreference: String?
}

/// Comp-range price suggestion attached to a vision draft
/// (`backend/services/marketplace/priceIntelligenceService.js:42`).
public struct AIPriceSuggestionDTO: Decodable, Sendable, Hashable {
    public let low: Double
    public let median: Double
    public let high: Double
    public let basis: String?
    public let comparableCount: Int?

    private enum CodingKeys: String, CodingKey {
        case low, median, high, basis
        case comparableCount = "comparable_count"
    }
}

/// Envelope from `POST /api/ai/draft/listing-vision`
/// (`backend/routes/ai.js:199`).
public struct AIListingVisionResponse: Decodable, Sendable {
    public let draft: AIListingDraftDTO
    public let confidence: Double?
    public let priceSuggestion: AIPriceSuggestionDTO?
}

/// Body for `POST /api/ai/draft/post`. `text` is the free-text prompt
/// (Joi `draftPostSchema` caps it at 2000 chars,
/// `backend/routes/ai.js:81`); `surface` is `"place"` or `"connections"`
/// when set and is omitted for prompts that aren't feed-bound.
public struct AIDraftPostRequest: Encodable, Sendable {
    public let text: String
    public let surface: String?

    public init(text: String, surface: String? = nil) {
        self.text = text
        self.surface = surface
    }
}

/// One AI-drafted post. Mirrors `postDraftJsonSchema`
/// (`backend/services/ai/schemas.js:99`) — `content` is the only key the
/// schema marks required; the model emits camelCase natively.
public struct AIPostDraftDTO: Decodable, Sendable, Hashable {
    public let content: String
    public let title: String?
    public let postType: String?
    public let purpose: String?
    public let visibility: String?
    public let tags: [String]?
}

/// Envelope from `POST /api/ai/draft/post` (`backend/routes/ai.js:218`).
public struct AIPostDraftResponse: Decodable, Sendable, Hashable {
    public let draft: AIPostDraftDTO
}

/// Body for `POST /api/ai/draft/pickup-schedule` (`backend/routes/ai.js:249`):
/// photos of a hauler's flyer, as the person's own `/api/upload/ai-media`
/// URLs (1–3), or what they wrote.
public struct AIDraftPickupScheduleRequest: Encodable, Sendable {
    public let images: [String]?
    public let text: String?

    public init(images: [String]? = nil, text: String? = nil) {
        self.images = images
        self.text = text
    }
}

/// The pickup days read from a flyer, for the pickup editor to fill in. A nil
/// field keeps the editor's own value; nothing is saved until the person taps
/// the editor's Save.
public struct AIDraftPickupScheduleResponse: Decodable, Sendable, Hashable {
    public struct Schedule: Decodable, Sendable, Hashable {
        /// `MO`…`SU`.
        public let garbageWeekday: String?
        /// `weekly`, `biweekly`, or `not_set` (the flyer says there is no recycling).
        public let recyclingFrequency: String?
        /// `YYYY-MM-DD`, already inside the window the save route accepts.
        public let recyclingNextDate: String?
        /// "Garbage every Tuesday. Recycling every other Tuesday, next on Tuesday, October 20."
        public let summary: String?

        private enum CodingKeys: String, CodingKey {
            case summary
            case garbageWeekday = "garbage_weekday"
            case recyclingFrequency = "recycling_frequency"
            case recyclingNextDate = "recycling_next_date"
        }
    }

    public let schedule: Schedule
    /// One sentence about what the flyer shows that the editor doesn't keep (yard waste, holidays).
    public let note: String?
}

/// `POST /api/ai/draft/radon-result`: a radon test result read from a photo or
/// PDF of the lab's report, for the Today radon sheet to fill in. The report
/// isn't kept, and nothing is saved until the person taps the sheet's Save.
public struct AIRadonReportResponse: Decodable, Sendable, Hashable {
    public struct Result: Decodable, Sendable, Hashable {
        /// The result in pCi/L (converted when the report gave Bq/m³).
        public let valuePci: Double?
        /// The report gave the result as below this limit ("<0.4").
        public let belowLimit: Bool?
        /// `YYYY-MM-DD`: the day the test ended.
        public let testedOn: String?
        /// `short_term`, `long_term`, or nil when the report doesn't say.
        public let testKind: String?
        /// "Short-term test, October 1 to October 3, 2026: 5.2 pCi/L. From …"
        public let summary: String?

        private enum CodingKeys: String, CodingKey {
            case summary
            case valuePci = "value_pci"
            case belowLimit = "below_limit"
            case testedOn = "tested_on"
            case testKind = "test_kind"
        }
    }

    public let result: Result
    /// One sentence on how the report was read (which of several results, a missing date).
    public let note: String?
}

/// `POST /api/ai/draft/post-suggestion`: the whole post, suggested from the
/// person's photos, the place they picked and what they've written so far, for
/// the composer to fill in. The photos aren't kept, and nothing is posted until
/// the person taps Post.
public struct AIPostSuggestionResponse: Decodable, Sendable, Hashable {
    /// Every field the composer's forms take. A field the kind of post doesn't use is nil.
    public struct Suggestion: Decodable, Sendable, Hashable {
        public let title: String?
        public let body: String
        /// Local wall-clock time, `YYYY-MM-DDTHH:MM`.
        public let eventDate: String?
        public let eventEndDate: String?
        public let eventVenue: String?
        /// `YYYY-MM-DD`: the deal's last day.
        public let dealExpiresAt: String?
        /// The business recommended, or the one offering a deal.
        public let businessName: String?
        /// `lost` or `found`.
        public let lostFoundType: String?
        public let lastSeenLocation: String?
        /// `YYYY-MM-DD`.
        public let lastSeenDate: String?
        /// A heads-up's kind (`road_hazard`, `power_outage`, `weather_damage`, `missing_pet`, `hazard`, `other`).
        public let safetyAlertKind: String?
        /// The Ask form's category (`handyman`, `cleaning`, `advice`, `other`).
        public let askCategory: String?
        public let tags: [String]?
    }

    public let suggestion: Suggestion
    /// One sentence for the person: what to add, or a kind of post that fits the photo better.
    public let note: String?
}
