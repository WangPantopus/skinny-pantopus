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

    /// `POST /api/mailbox/v2/mailday/finish` — route `backend/routes/mailDay.js:557`.
    public static func finish() -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/mailday/finish")
    }
}
