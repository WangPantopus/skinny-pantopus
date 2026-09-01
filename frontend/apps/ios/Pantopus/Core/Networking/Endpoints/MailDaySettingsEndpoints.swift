//
//  MailDaySettingsEndpoints.swift
//  Pantopus
//
//  Mail Day *preferences* (`MailDaySettings`) — the delivery-time /
//  drawer-inclusion / interrupt / sound switches behind the Mail Day
//  header gear. These live on the Phase-3 router
//  (`backend/routes/mailboxV2Phase3.js`, mounted at `/api/mailbox/v2/p3`,
//  `backend/app.js:317`) and are distinct from the triage-day routes in
//  `MailDayEndpoints.swift` (`/api/mailbox/v2/mailday/…`,
//  `backend/routes/mailDay.js`, `backend/app.js:314`).
//
//  Mirrors the Android surface in `data/api/services/MailDaySettingsApi.kt`.
//

import Foundation

public enum MailDaySettingsEndpoints {
    /// `GET /api/mailbox/v2/p3/mailday/settings` — route
    /// `backend/routes/mailboxV2Phase3.js:1121`. Returns the caller's row
    /// or, when they have none, the server's default settings object.
    public static func settings() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/mailday/settings")
    }

    /// `PATCH /api/mailbox/v2/p3/mailday/settings` — route
    /// `backend/routes/mailboxV2Phase3.js:1160`. Partial upsert; every
    /// field on the validator (`mailboxV2Phase3.js:88`) is optional, so
    /// only the toggled key is sent. Responds `{ settings }`.
    public static func updateSettings(_ patch: MailDaySettingsPatch) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/mailbox/v2/p3/mailday/settings",
            body: patch
        )
    }
}
