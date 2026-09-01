//
//  ProfileInsightsEndpoints.swift
//  Pantopus
//
//  Profile-tab insight cards — Monthly Receipt and Invite / referral
//  progress. Both live on `backend/routes/users.js`, and both are registered
//  before the catch-all `/:username` route, so the `/me/…` paths are literal.
//

import Foundation

public enum ProfileInsightsEndpoints {
    /// `GET /api/users/me/monthly-receipt?year=&month=` — the stored monthly
    /// receipt, or one computed on demand when the roll-up job hasn't run.
    /// `month` is **1-based** and validated server-side (400 outside 1…12).
    /// Route `backend/routes/users.js:2921`.
    public static func monthlyReceipt(year: Int, month: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/users/me/monthly-receipt",
            query: ["year": String(year), "month": String(month)]
        )
    }

    /// `GET /api/users/me/invite-progress` — referral counts, unlocked
    /// features, and the next unlock tier.
    /// Route `backend/routes/users.js:2835`.
    public static func inviteProgress() -> Endpoint {
        Endpoint(method: .get, path: "/api/users/me/invite-progress")
    }

    /// `GET /api/users/me/invite-code` — the user's stable invite code plus
    /// its shareable URL. Creates one on first call.
    /// Route `backend/routes/users.js:2850`.
    public static func inviteCode() -> Endpoint {
        Endpoint(method: .get, path: "/api/users/me/invite-code")
    }
}
