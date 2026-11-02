//
//  AIEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/ai.js`. Mounted at `/api/ai`.
//  The chat stream itself (`POST /api/ai/chat`, SSE) is consumed by
//  `AIChatStreamClient` directly — only the JSON routes live here.
//

import Foundation

/// Endpoints under `/api/ai/*` consumed by the Ask-Pantopus thread.
public enum AIEndpoints {
    /// `GET /api/ai/conversations` — the caller's AI conversation list,
    /// newest-updated first (server caps at 50). Summaries only; a
    /// conversation's turns come from `conversationMessages(id:)`.
    /// Route `backend/routes/ai.js:359`.
    public static func conversations(oldestFirst: Bool = false) -> Endpoint {
        Endpoint(method: .get, path: "/api/ai/conversations", query: oldestFirst ? ["order": "oldest"] : [:])
    }

    /// `GET /api/ai/conversations/:id/messages?cards=` — one conversation's
    /// earlier turns, so a restored thread shows what the assistant
    /// remembers. `cards` is the list the chat stream sends
    /// (`AIChatStreamRequest.supportedCards`): the server leaves out the
    /// cards an app doesn't list, so builds without action cards never get
    /// one back from history (contract section 4.1).
    /// Route `backend/routes/ai.js:445`.
    public static func conversationMessages(id: String, cards: [String]) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/ai/conversations/\(id)/messages",
            query: ["cards": cards.joined(separator: ",")]
        )
    }

    /// `DELETE /api/ai/conversations/:id` — delete one AI conversation.
    /// Route `backend/routes/ai.js:363`.
    public static func deleteConversation(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/ai/conversations/\(id)")
    }

    /// `POST /api/ai/cards/:cardId/state` — what ran on one of the person's
    /// action cards, or "Not now", so the card shows the same on their other
    /// phones and after a reinstall
    /// (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §4.2). A card
    /// from before phase 3 answers `404 CARD_UNKNOWN`.
    /// Route `backend/routes/ai.js:577`.
    public static func cardState(cardId: String, report: AICardStateReport) -> Endpoint {
        Endpoint(method: .post, path: "/api/ai/cards/\(cardId)/state", body: report)
    }

    // MARK: - What Pantopus remembers (phase 3 contract §5.4)

    /// `GET /api/ai/memory` — the person's own items, newest first, with when
    /// the yearly review is due. An item is added only from a `memory_save`
    /// card they tapped (the card's own `POST /api/ai/memory`).
    /// Route `backend/routes/ai.js:598`.
    public static func memory() -> Endpoint {
        Endpoint(method: .get, path: "/api/ai/memory")
    }

    /// `PATCH /api/ai/memory/:id` — new words for a `fact` item, checked as a
    /// new one (`400 MEMORY_FACT_INVALID` with the reason). Counts as reviewing it.
    /// Route `backend/routes/ai.js:611`.
    public static func editMemory(id: String, fact: String) -> Endpoint {
        Endpoint(method: .patch, path: "/api/ai/memory/\(id)", body: AIMemoryEditRequest(fact: fact))
    }

    /// `DELETE /api/ai/memory/:id` — forget one item (`204`).
    /// Route `backend/routes/ai.js:615`.
    public static func forgetMemory(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/ai/memory/\(id)")
    }

    /// `DELETE /api/ai/memory` — Forget everything: `{ deleted: n }`.
    /// Route `backend/routes/ai.js:620`.
    public static func forgetAllMemory() -> Endpoint {
        Endpoint(method: .delete, path: "/api/ai/memory")
    }

    /// `POST /api/ai/memory/reviewed` — "Looks right" on the yearly review:
    /// every item counts as confirmed today.
    /// Route `backend/routes/ai.js:607`.
    public static func memoryReviewed() -> Endpoint {
        Endpoint(method: .post, path: "/api/ai/memory/reviewed")
    }

    /// `GET /api/ai/pulse?homeId=` — the Neighborhood Pulse for a home
    /// (the priority-ranked signal stream behind the Place "Today's
    /// Pulse" surface). NOTE: the query param is camelCase `homeId`
    /// (Joi `pulseSchema`, `backend/routes/ai.js:102`).
    /// Route `backend/routes/ai.js:332`.
    public static func pulse(homeId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/ai/pulse",
            query: ["homeId": homeId]
        )
    }

    /// `POST /api/ai/draft/listing-vision` — Snap & Sell: draft a
    /// listing (title, description, category, condition, price) from
    /// item photos, with an optional comp-range price suggestion.
    /// Route `backend/routes/ai.js:199`.
    public static func draftListingVision(_ body: AIDraftListingVisionRequest) -> Endpoint {
        // 45s: the backend gives the vision model 30s
        // (`DRAFT_TIMEOUT_MS`, `backend/services/ai/agentService.js:30`)
        // and the multi-image upload itself takes a few seconds.
        Endpoint(method: .post, path: "/api/ai/draft/listing-vision", body: body, timeout: 45)
    }

    /// `POST /api/ai/draft/post` — single-turn post draft from a
    /// free-text prompt. Edit Profile's "Generate with AI" bio action
    /// feeds it the name / skills / tagline / city the user already
    /// entered and writes `draft.content` back into the bio field.
    /// Route `backend/routes/ai.js:218`.
    public static func draftPost(_ body: AIDraftPostRequest) -> Endpoint {
        // 35s: the backend gives the draft model 30s
        // (`DRAFT_TIMEOUT_MS`, `backend/services/ai/agentService.js:30`),
        // which overruns the session's 20s inactivity default.
        Endpoint(method: .post, path: "/api/ai/draft/post", body: body, timeout: 35)
    }

    /// `POST /api/ai/draft/pickup-schedule` — the pickup days on a photo of
    /// the household's hauler's flyer, for the Today pickup editor to fill
    /// in. Nothing is saved: the editor's own Save writes the days.
    /// Route `backend/routes/ai.js:249`.
    public static func draftPickupSchedule(_ body: AIDraftPickupScheduleRequest) -> Endpoint {
        // 45s like the listing vision read: the backend gives the model 30s.
        Endpoint(method: .post, path: "/api/ai/draft/pickup-schedule", body: body, timeout: 45)
    }
}
