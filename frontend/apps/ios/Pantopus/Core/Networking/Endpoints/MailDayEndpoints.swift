//
//  MailDayEndpoints.swift
//  Pantopus
//
//  P3F / A13.16 — My Mail Day physical-mail triage.
//

import Foundation

/// Endpoint builders for the My Mail Day triage routes in
/// `backend/routes/mailDay.js` (mounted at /api/mailbox/v2/mailday).
public enum MailDayEndpoints {
    /// `GET /api/mailbox/v2/mailday/today` — route `backend/routes/mailDay.js:376`.
    public static func today() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/mailday/today")
    }

    /// `POST /api/mailbox/v2/mailday/items/:itemId/route` — route
    /// `backend/routes/mailDay.js:520`. The server derives the recipient +
    /// tint from the stored piece's suggestion, so no body is needed.
    public static func route(itemId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/mailday/items/\(itemId)/route")
    }

    /// "Other…" → "Keep for the household": the same route with `{ drawer: "home" }`,
    /// so the letter stays in the shared drawer and the chip reads "Household".
    public static func keepForHousehold(itemId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/mailday/items/\(itemId)/route",
            body: MailDayRouteBody(drawer: "home")
        )
    }

    /// "Other…" → "Junk it": `POST /api/mailbox/v2/mailday/items/:itemId/junk`.
    /// The letter is shredded for the household; the mailbox keeps Restore.
    public static func junk(itemId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/mailday/items/\(itemId)/junk")
    }

    /// `POST /api/mailbox/v2/mailday/items/:itemId/undo`: the piece returns to
    /// "Needs a call" and its letter to the routing queue.
    public static func undo(itemId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/mailday/items/\(itemId)/undo")
    }

    /// `POST /api/mailbox/v2/mailday/finish` — route `backend/routes/mailDay.js:557`.
    public static func finish() -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/mailday/finish")
    }
}
