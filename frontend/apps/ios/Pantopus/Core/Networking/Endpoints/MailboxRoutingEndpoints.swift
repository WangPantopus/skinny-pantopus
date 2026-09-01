//
//  MailboxRoutingEndpoints.swift
//  Pantopus
//
//  The mail *routing* lane of the V2 mailbox API: mail that the
//  auto-router could not classify lands in `MailRoutingQueue` and needs a
//  human to say which drawer it belongs in.
//
//  Kept in its own file (rather than piled into `MailboxV2Endpoints`) so
//  the routing-queue surface owns its own networking seam.
//

import Foundation

/// Endpoint builders for the disambiguation queue in
/// `backend/routes/mailboxV2.js`.
public enum MailboxRoutingEndpoints {
    /// `GET /api/mailbox/v2/pending` — route `backend/routes/mailboxV2.js:612`.
    ///
    /// Returns `{ pending: [...] }` — the unresolved `MailRoutingQueue`
    /// rows for every home the caller can access, each with its `Mail` row
    /// embedded under the `Mail` key (`select('*, Mail!inner(*)')`,
    /// `mailboxV2.js:621`). Newest first.
    public static func pending() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/pending")
    }
}
