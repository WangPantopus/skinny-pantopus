//
//  PersonaDmEndpoints.swift
//  Pantopus
//
//  C5 — Persona DM threads. The persona DM surface is *distinct* from
//  generic chat: threads are addressed by `threadId` and the wire shape
//  deliberately carries no `user_id` on either side (fan identity is the
//  `membership_id` + pseudonymous handle, sender identity is a
//  `sender_role`). Router mounted at `/api/personas/:id/dms`
//  (`backend/app.js:370`), UUID-gated on `:id`.
//

import Foundation

public enum PersonaDmEndpoints {
    /// `GET /api/personas/:id/dms/threads` — thread list. Owner sees every
    /// thread on the persona, a fan sees only their own (and an empty list
    /// when they hold no active membership). Route
    /// `backend/routes/personaDms.js:185`.
    public static func threads(personaId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(personaId)/dms/threads")
    }

    /// `GET /api/personas/:id/dms/threads/:threadId` — thread detail. The
    /// read also marks the *other* side's messages read and zeroes the
    /// caller's unread counter, so this is the canonical "open thread"
    /// call. `replyPolicyStatus` is fan-side only. Route
    /// `backend/routes/personaDms.js:235`.
    public static func thread(personaId: String, threadId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(personaId)/dms/threads/\(threadId)")
    }

    /// `POST /api/personas/:id/dms/threads` — a fan opens a brand-new
    /// thread. **Burns one message-thread quota.** Failure codes are
    /// first-class states, not generic errors: `402 quota_exhausted`,
    /// `403 blocked`, `403 no_membership`, `403 tier_does_not_allow`.
    /// Route `backend/routes/personaDms.js:135`.
    public static func openThread(personaId: String, body: PersonaDmMessageBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/personas/\(personaId)/dms/threads", body: body)
    }

    /// `POST /api/personas/:id/dms/threads/:threadId/messages` — append to
    /// an existing thread. Consumes no quota (either side may keep
    /// replying); a blocked fan still gets `403 blocked`. Route
    /// `backend/routes/personaDms.js:314`.
    public static func sendMessage(
        personaId: String,
        threadId: String,
        body: PersonaDmMessageBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/personas/\(personaId)/dms/threads/\(threadId)/messages",
            body: body
        )
    }
}

/// Request body shared by open-thread and send-message. Validated by
/// `openThreadSchema` / `sendMessageSchema` — 1…2000 characters, trimmed.
public struct PersonaDmMessageBody: Encodable, Sendable {
    public let body: String

    public init(body: String) {
        self.body = body
    }
}
