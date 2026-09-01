//
//  MailboxP3Endpoints.swift
//  Pantopus
//
//  Endpoint builders for the Phase-3 mailbox routes mounted at
//  `/api/mailbox/v2/p3` (`backend/app.js:317` →
//  `backend/routes/mailboxV2Phase3.js`). Kept in its own file so the
//  A11.4 map + A14.8 vacation-hold wiring doesn't contend with the
//  heavily-shared `MailboxV2Endpoints.swift`.
//
//  Mirrors the Android surface in `data/api/services/MailboxV2Api.kt`
//  (`mapPins` / `vacationStatus` / `startVacation` / `cancelVacation`).
//

import Foundation

public enum MailboxP3Endpoints {
    // MARK: - Map pins (A11.4)

    /// `GET /api/mailbox/v2/p3/map/pins` — route
    /// `backend/routes/mailboxV2Phase3.js:431`. With no `homeId` the
    /// backend resolves every home the caller can access; `type` filters
    /// on `pin_type`. Expired pins are excluded server-side.
    public static func mapPins(homeId: String? = nil, type: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let homeId { query["homeId"] = homeId }
        if let type { query["type"] = type }
        return Endpoint(method: .get, path: "/api/mailbox/v2/p3/map/pins", query: query)
    }

    // MARK: - Vacation hold (A14.8)

    /// `GET /api/mailbox/v2/p3/vacation/status` — route
    /// `backend/routes/mailboxV2Phase3.js:1523`. Returns
    /// `{ active, upcoming }`; both null when nothing is scheduled.
    public static func vacationStatus() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/vacation/status")
    }

    /// `POST /api/mailbox/v2/p3/vacation/start` — route
    /// `backend/routes/mailboxV2Phase3.js:1546`. Inserts a `VacationHold`
    /// row (status `active` when `startDate <= now`, else `scheduled`) and
    /// flips the caller's `User.vacation_mode`.
    public static func startVacation(_ request: StartVacationRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/p3/vacation/start", body: request)
    }

    /// `POST /api/mailbox/v2/p3/vacation/cancel` — route
    /// `backend/routes/mailboxV2Phase3.js:1601`. Marks the hold
    /// `cancelled` and clears `User.vacation_mode`.
    public static func cancelVacation(holdId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/vacation/cancel",
            body: CancelVacationRequest(holdId: holdId)
        )
    }
}
