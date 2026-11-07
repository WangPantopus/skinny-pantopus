//
//  NeighborMessagesEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/neighborMessages.js` —
//  verified-only (T4), template-only neighbor heads-ups. Mounted at
//  `/api/neighbor-messages`.
//

import Foundation

public enum NeighborMessagesEndpoints {
    /// `GET /api/neighbor-messages/templates` — route
    /// `backend/routes/neighborMessages.js:89`. The pre-written note
    /// catalog + templated quick-replies (server source of truth).
    public static func templates() -> Endpoint {
        Endpoint(method: .get, path: "/api/neighbor-messages/templates")
    }

    /// `POST /api/neighbor-messages/address-check` — is this address on
    /// the sender's block? Says nothing about who lives there.
    public static func checkAddress(_ request: NeighborAddressCheckRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/neighbor-messages/address-check", body: request)
    }

    /// `POST /api/neighbor-messages` — route
    /// `backend/routes/neighborMessages.js:102`. Send a template-only
    /// note to an address on your block. Server enforces the T4 sender
    /// gate, same-block address, and the weekly cap. The answer is the
    /// same whether or not a verified household lives there.
    public static func send(_ request: SendNeighborMessageRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/neighbor-messages", body: request)
    }

    /// `GET /api/neighbor-messages/received` — route
    /// `backend/routes/neighborMessages.js:209`. The caller's received
    /// messages, most recent first. Sender is always anonymized.
    public static func received() -> Endpoint {
        Endpoint(method: .get, path: "/api/neighbor-messages/received")
    }

    /// `GET /api/neighbor-messages/:id` — route
    /// `backend/routes/neighborMessages.js:246`. A single received
    /// message (recipient only). Marks it read.
    public static func message(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/neighbor-messages/\(id)")
    }

    /// `POST /api/neighbor-messages/:id/reply` — route
    /// `backend/routes/neighborMessages.js:273`. Reply with a templated
    /// quick-reply (anonymous both ways).
    public static func reply(id: String, request: ReplyNeighborMessageRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/neighbor-messages/\(id)/reply", body: request)
    }

    /// `POST /api/neighbor-messages/:id/not-helpful` — route
    /// `backend/routes/neighborMessages.js:325`. Sender is never notified.
    public static func notHelpful(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/neighbor-messages/\(id)/not-helpful")
    }

    /// `POST /api/neighbor-messages/:id/report` — route
    /// `backend/routes/neighborMessages.js:348`. Sender is never notified.
    public static func report(id: String, request: ReportNeighborMessageRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/neighbor-messages/\(id)/report", body: request)
    }

    /// `POST /api/neighbor-messages/:id/block` — route
    /// `backend/routes/neighborMessages.js:370`. Blocks the (still
    /// anonymous) sender; they are never notified.
    public static func block(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/neighbor-messages/\(id)/block")
    }
}
