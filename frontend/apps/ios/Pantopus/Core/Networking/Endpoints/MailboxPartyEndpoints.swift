//
//  MailboxPartyEndpoints.swift
//  Pantopus
//
//  Family Mail Party (co-opening) routes from
//  `backend/routes/mailboxV2Phase2.js`, mounted at `/api/mailbox/v2/p2`
//  (`backend/app.js:316`).
//
//  Kept in its own file so the party wiring doesn't contend with the
//  heavily-shared `MailboxV2Endpoints.swift`. Mirrors the Android surface
//  in `data/api/services/MailboxPartyApi.kt`.
//

import Foundation

public enum MailboxPartyEndpoints {
    /// `GET /api/mailbox/v2/p2/party/active` — route
    /// `backend/routes/mailboxV2Phase2.js:926`. Pending / active sessions
    /// across every home the caller can access, newest first. Pending
    /// sessions older than 90s are filtered out server-side.
    public static func activeSessions() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p2/party/active")
    }

    /// `POST /api/mailbox/v2/p2/party/create` — route
    /// `backend/routes/mailboxV2Phase2.js:741`. Opens a `MailPartySession`
    /// for a Home-drawer mail item and enrols the caller as the first
    /// participant. 400s when the item isn't in the Home drawer or when
    /// either the user or the household has Mail Party disabled.
    public static func createSession(mailId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p2/party/create",
            body: CreateMailPartyRequest(mailId: mailId)
        )
    }

    /// `POST /api/mailbox/v2/p2/party/join` — route
    /// `backend/routes/mailboxV2Phase2.js:816`. Adds the caller as a
    /// present participant and flips the session to `active`. 400s once
    /// the 90-second pending window has elapsed.
    public static func joinSession(sessionId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p2/party/join",
            body: MailPartySessionRequest(sessionId: sessionId)
        )
    }

    /// `POST /api/mailbox/v2/p2/party/decline` — route
    /// `backend/routes/mailboxV2Phase2.js:866`. Records the decline; the
    /// caller can still open the item solo.
    public static func declineSession(sessionId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p2/party/decline",
            body: MailPartySessionRequest(sessionId: sessionId)
        )
    }

    /// `POST /api/mailbox/v2/p2/party/reaction` — route
    /// `backend/routes/mailboxV2Phase2.js:875`. Ephemeral reaction
    /// (max 10 chars); the response carries the `ttl` in seconds.
    public static func sendReaction(sessionId: String, reaction: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p2/party/reaction",
            body: MailPartyReactionRequest(sessionId: sessionId, reaction: reaction)
        )
    }

    /// `POST /api/mailbox/v2/p2/party/assign` — route
    /// `backend/routes/mailboxV2Phase2.js:887`. Moves the mail onto the
    /// chosen member's Counter and completes the session.
    public static func assignItem(
        sessionId: String,
        mailId: String,
        assignToUserId: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p2/party/assign",
            body: MailPartyAssignRequest(
                sessionId: sessionId,
                mailId: mailId,
                assignToUserId: assignToUserId
            )
        )
    }
}

// MARK: - Wire bodies

/// Body for `POST /party/create` — validator
/// `backend/routes/mailboxV2Phase2.js:15` requires a UUID `mailId`.
public struct CreateMailPartyRequest: Encodable, Sendable {
    public let mailId: String

    public init(mailId: String) {
        self.mailId = mailId
    }
}

/// Shared body for `POST /party/join` and `POST /party/decline` —
/// validator `backend/routes/mailboxV2Phase2.js:19`.
public struct MailPartySessionRequest: Encodable, Sendable {
    public let sessionId: String

    public init(sessionId: String) {
        self.sessionId = sessionId
    }
}

/// Body for `POST /party/reaction` — validator
/// `backend/routes/mailboxV2Phase2.js:23`.
public struct MailPartyReactionRequest: Encodable, Sendable {
    public let sessionId: String
    public let reaction: String

    public init(sessionId: String, reaction: String) {
        self.sessionId = sessionId
        self.reaction = reaction
    }
}

/// Body for `POST /party/assign` — validator
/// `backend/routes/mailboxV2Phase2.js:28`.
public struct MailPartyAssignRequest: Encodable, Sendable {
    public let sessionId: String
    public let mailId: String
    public let assignToUserId: String

    public init(sessionId: String, mailId: String, assignToUserId: String) {
        self.sessionId = sessionId
        self.mailId = mailId
        self.assignToUserId = assignToUserId
    }
}
