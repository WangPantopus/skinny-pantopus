//
//  MailboxCheckEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/mailboxCheck.js` (mounted
//  under `/api/homes`) — the Mailbox Reality Check: the claim-time
//  postal validation surfaced as a diagnostic, plus the caller's
//  postcard state as the physical leg.
//

import Foundation

public enum MailboxCheckEndpoints {
    /// `GET /api/homes/:id/mailbox-check` — route
    /// `backend/routes/mailboxCheck.js:24`. Read-only, zero vendor
    /// calls; any home member. The physical-leg copy is per-caller.
    public static func check(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/mailbox-check")
    }
}
