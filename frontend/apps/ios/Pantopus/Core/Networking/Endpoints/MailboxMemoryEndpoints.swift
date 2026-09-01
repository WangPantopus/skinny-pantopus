//
//  MailboxMemoryEndpoints.swift
//  Pantopus
//
//  Mail Memory routes ("On This Day" + "Year In Mail") from
//  `backend/routes/mailboxV2Phase3.js`, mounted at `/api/mailbox/v2/p3`
//  (`backend/app.js:317`).
//
//  Mirrors the Android surface in `data/api/services/MailboxMemoryApi.kt`.
//

import Foundation

public enum MailboxMemoryEndpoints {
    /// `GET /api/mailbox/v2/p3/memory/on-this-day` — route
    /// `backend/routes/mailboxV2Phase3.js:1321`. Keepsake-category mail
    /// received on this calendar day in each of the last five years, with
    /// a per-memory `dismissed` flag folded in from `MailMemory`.
    public static func onThisDay() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/memory/on-this-day")
    }

    /// `GET /api/mailbox/v2/p3/memory/year/:year` — route
    /// `backend/routes/mailboxV2Phase3.js:1376`. Year roll-up: totals,
    /// per-drawer + per-category breakdowns, top senders, package count
    /// and the first-mail date.
    public static func yearInMail(year: Int) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/memory/year/\(year)")
    }

    /// `POST /api/mailbox/v2/p3/memory/dismiss` — route
    /// `backend/routes/mailboxV2Phase3.js:1480`. Upserts a dismissed
    /// `MailMemory` row for the supplied memory id.
    public static func dismissMemory(memoryId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/memory/dismiss",
            body: DismissMailMemoryRequest(memoryId: memoryId)
        )
    }

    /// `POST /api/mailbox/v2/p3/memory/year/:year/share` — route
    /// `backend/routes/mailboxV2Phase3.js:1502`. Returns the share-card
    /// URL for the year summary.
    public static func shareYearInMail(year: Int) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/p3/memory/year/\(year)/share")
    }
}

/// Body for `POST /api/mailbox/v2/p3/memory/dismiss` — validator
/// `backend/routes/mailboxV2Phase3.js:112`.
public struct DismissMailMemoryRequest: Encodable, Sendable {
    public let memoryId: String

    public init(memoryId: String) {
        self.memoryId = memoryId
    }
}
