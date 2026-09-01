//
//  UserReportsEndpoints.swift
//  Pantopus
//
//  Endpoint builder for `backend/routes/users.js` user-report routes.
//  The router is mounted at `/api/users`, so the concrete path is
//  `/api/users/:userId/report` (singular — the backend's `users.js:4153`
//  handler validates a Joi schema with `reason` + optional `details`).
//

import Foundation

/// Endpoints under `/api/users/*/report`.
public enum UserReportsEndpoints {
    /// `POST /api/users/:userId/report` — submit a report against another
    /// user. Route `backend/routes/users.js:4153`. Body is validated by
    /// `reportUserSchema` (lines 4137–4142) and the backend enforces a
    /// reporter ≠ target check.
    public static func report(userId: String, body: UserReportBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/users/\(userId)/report", body: body)
    }
}

/// `POST /api/users/:userId/report` body. `reason` is one of the Joi-valid
/// keys (`spam · harassment · inappropriate · misinformation · safety ·
/// other`); `details` is capped server-side at 1 000 chars.
public struct UserReportBody: Encodable, Sendable {
    public let reason: String
    public let details: String?

    public init(reason: String, details: String?) {
        self.reason = reason
        self.details = details
    }
}
