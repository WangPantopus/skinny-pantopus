//
//  GigExtrasEndpoints.swift
//  Pantopus
//
//  RN→native parity endpoints under `/api/gigs/*` that the app was
//  missing: the Q&A engagement actions (upvote / pin / delete), the
//  poster's "Remind worker" nudge, and the "Rebook a favorite helper"
//  rail. Kept in their own file so the heavily-shared
//  `GigsEndpoints.swift` stays merge-quiet.
//

import Foundation

/// Secondary `/api/gigs/*` routes (Q&A actions, worker reminder,
/// rebookable helpers).
public enum GigExtrasEndpoints {
    // MARK: - Structured Q&A actions

    /// `POST /api/gigs/:gigId/questions/:questionId/upvote` — toggle the
    /// viewer's upvote on a question. Responds `{ upvoted: Bool }`.
    /// Route `backend/routes/gigs.js:7535`.
    public static func upvoteQuestion(gigId: String, questionId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/\(gigId)/questions/\(questionId)/upvote"
        )
    }

    /// `POST /api/gigs/:gigId/questions/:questionId/pin` — poster toggles
    /// the pinned flag on an answered question. Responds
    /// `{ question: … }`. Route `backend/routes/gigs.js:7482`.
    public static func pinQuestion(gigId: String, questionId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/\(gigId)/questions/\(questionId)/pin"
        )
    }

    /// `DELETE /api/gigs/:gigId/questions/:questionId` — the asker or the
    /// gig poster removes a question. Responds `{ deleted: Bool }`.
    /// Route `backend/routes/gigs.js:7600`.
    public static func deleteQuestion(gigId: String, questionId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/gigs/\(gigId)/questions/\(questionId)"
        )
    }

    // MARK: - Worker reminder

    /// `POST /api/gigs/:gigId/remind-worker` — poster nudges the assigned
    /// worker who hasn't started. Server-side 15-minute cooldown: a 429
    /// carries `next_allowed_at`. Route `backend/routes/gigs.js:5734`.
    public static func remindWorker(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/remind-worker")
    }

    // MARK: - Rebook

    /// `GET /api/gigs/rebookable` — the viewer's completed tasks from the
    /// last 6 months, deduped by worker+category, newest first (max 10).
    /// Route `backend/routes/gigs.js:2885`.
    public static func rebookable() -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/rebookable")
    }
}
