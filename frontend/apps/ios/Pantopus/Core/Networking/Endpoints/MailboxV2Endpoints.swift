//
//  MailboxV2Endpoints.swift
//  Pantopus
//

import Foundation

/// Endpoint builders for the V2 mailbox routes in `backend/routes/mailboxV2.js`.
public enum MailboxV2Endpoints {
    /// `GET /api/mailbox/v2/drawers` — route `backend/routes/mailboxV2.js:214`.
    public static func drawers() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/drawers")
    }

    /// `GET /api/mailbox/v2/drawer/:drawer` — route `backend/routes/mailboxV2.js:280`.
    public static func drawer(
        _ drawer: String,
        tab: String? = nil,
        limit: Int = 50,
        offset: Int = 0,
        homeId: String? = nil
    ) -> Endpoint {
        var query: [String: String] = ["limit": String(limit), "offset": String(offset)]
        if let tab { query["tab"] = tab }
        if let homeId { query["homeId"] = homeId }
        return Endpoint(method: .get, path: "/api/mailbox/v2/drawer/\(drawer)", query: query)
    }

    /// `GET /api/mailbox/v2/item/:id` — route `backend/routes/mailboxV2.js:366`.
    public static func item(mailId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/item/\(mailId)")
    }

    /// `POST /api/mailbox/v2/item/:id/action` — route `backend/routes/mailboxV2.js:459`.
    public static func itemAction(
        mailId: String,
        action: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/item/\(mailId)/action",
            body: MailboxItemActionRequest(action: action)
        )
    }

    /// `GET /api/mailbox/v2/package/:mailId` — route `backend/routes/mailboxV2.js:634`.
    public static func package(mailId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/package/\(mailId)")
    }

    /// `PATCH /api/mailbox/v2/package/:mailId/status` — route `backend/routes/mailboxV2.js:670`.
    public static func packageStatusUpdate(
        mailId: String,
        request: PackageStatusUpdateRequest
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/mailbox/v2/package/\(mailId)/status",
            body: request
        )
    }

    /// `POST /api/mailbox/v2/resolve` — route
    /// `backend/routes/mailboxV2.js:555`. Records the user's chosen
    /// drawer for an item the auto-router couldn't classify.
    public static func resolve(_ request: ResolveRoutingRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/resolve",
            body: request
        )
    }

    /// `POST /api/mailbox/v2/p3/community/rsvp` — route
    /// `backend/routes/mailboxV2Phase3.js:746`. Adds a `will_attend`
    /// reaction to the `CommunityMailItem` and returns the updated
    /// RSVP count. The backend treats RSVP as idempotent.
    ///
    /// The Phase-3 router is mounted at `/api/mailbox/v2/p3`
    /// (`backend/app.js:317`); the previously-shipped `/api/mailbox/v2/
    /// community/rsvp` spelling had no matching route and 404'd.
    public static func communityRsvp(communityItemId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/community/rsvp",
            body: CommunityRsvpRequest(communityItemId: communityItemId)
        )
    }

    /// `POST /api/mailbox/v2/p3/translate` — route
    /// `backend/routes/mailboxV2Phase3.js:1643`. Translates a mail item
    /// (A17.13) and caches both versions. `targetLang` defaults to `en`.
    /// The Translation screen also uses this as the "confirm/trust" write
    /// until a dedicated confirm route ships.
    public static func translate(mailId: String, targetLang: String = "en") -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/translate",
            body: TranslateMailRequest(mailId: mailId, targetLang: targetLang)
        )
    }

    /// `GET /api/mailbox/v2/p3/tasks` — route
    /// `backend/routes/mailboxV2Phase3.js:831`. Mail-linked tasks split
    /// into `{ active, completed }`. No detail-by-id route exists, so the
    /// Mail-task screen fetches this list and selects by id.
    public static func p3Tasks(homeId: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let homeId { query["homeId"] = homeId }
        return Endpoint(method: .get, path: "/api/mailbox/v2/p3/tasks", query: query)
    }

    /// `PATCH /api/mailbox/v2/p3/tasks/:id` — route
    /// `backend/routes/mailboxV2Phase3.js:935`. Partial task update
    /// (status / title / priority / dueAt).
    public static func updateP3Task(taskId: String, request: P3TaskUpdateRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/mailbox/v2/p3/tasks/\(taskId)", body: request)
    }
}

/// Wire body for `POST /api/mailbox/v2/p3/translate`. The backend
/// validator (`backend/routes/mailboxV2Phase3.js:1643`) requires
/// `mailId` as a UUID string and an optional `targetLang`.
public struct TranslateMailRequest: Encodable, Sendable {
    public let mailId: String
    public let targetLang: String

    public init(mailId: String, targetLang: String = "en") {
        self.mailId = mailId
        self.targetLang = targetLang
    }
}

/// Wire body for `POST /api/mailbox/v2/community/rsvp`. The backend
/// validator (`backend/routes/mailboxV2Phase3.js:56`) requires
/// `communityItemId` as a UUID string.
public struct CommunityRsvpRequest: Encodable, Sendable {
    public let communityItemId: String

    public init(communityItemId: String) {
        self.communityItemId = communityItemId
    }
}

/// Wire response for `POST /api/mailbox/v2/community/rsvp` —
/// `{ message, rsvpCount }`.
public struct CommunityRsvpResponse: Decodable, Sendable {
    public let message: String?
    public let rsvpCount: Int?
}
