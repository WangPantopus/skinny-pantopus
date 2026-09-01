//
//  MailboxStampsEndpoints.swift
//  Pantopus
//
//  Stamp-collection + seasonal-theme routes from
//  `backend/routes/mailboxV2Phase3.js`, mounted at `/api/mailbox/v2/p3`
//  (`backend/app.js:317`).
//
//  Mirrors the Android surface in `data/api/services/MailboxStampsApi.kt`.
//

import Foundation

public enum MailboxStampsEndpoints {
    /// `GET /api/mailbox/v2/p3/stamps` — route
    /// `backend/routes/mailboxV2Phase3.js:1204`. The caller's stamp
    /// gallery: `earned` rows newest-first plus the `locked` catalogue
    /// entries they haven't unlocked, with the collected / available
    /// totals.
    public static func stamps() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/stamps")
    }

    /// `GET /api/mailbox/v2/p3/themes` — route
    /// `backend/routes/mailboxV2Phase3.js:1249`. Every seasonal theme with
    /// a server-computed `unlocked` flag, plus the caller's `active` theme
    /// id (from `MailDaySettings.current_theme`).
    public static func themes() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/themes")
    }

    /// `POST /api/mailbox/v2/p3/themes/apply` — route
    /// `backend/routes/mailboxV2Phase3.js:1285`. Upserts
    /// `MailDaySettings.current_theme`. The validator
    /// (`mailboxV2Phase3.js:107`) requires a UUID `themeId`.
    public static func applyTheme(themeId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/themes/apply",
            body: ApplyMailboxThemeRequest(themeId: themeId)
        )
    }
}

/// Body for `POST /api/mailbox/v2/p3/themes/apply`.
public struct ApplyMailboxThemeRequest: Encodable, Sendable {
    public let themeId: String

    public init(themeId: String) {
        self.themeId = themeId
    }
}
