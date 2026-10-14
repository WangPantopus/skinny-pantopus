//
//  PulseConversationEndpoints.swift
//  Pantopus
//
//  Planned backend/routes/pulse.js routes from the frozen Pulse contract
//  §§2.4, 2.7–2.9 and the S9 read-scope addition. H4 blocks the client
//  merge until those routes are on master.
//

import Foundation

public extension PulseEndpoints {
    /// `GET /api/pulse/posts/:id` — contract §2.4.
    static func conversation(postId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/pulse/posts/\(postId)")
    }

    /// `GET /api/pulse/posts/:id/replies?after=…` — contract §2.4.
    static func conversationReplies(postId: String, after: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/pulse/posts/\(postId)/replies", query: ["after": after])
    }

    /// `POST /api/pulse/posts/:postId/replies/:replyId/helpful` — §2.7.
    static func markHelpful(postId: String, replyId: String, helpful: Bool) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/pulse/posts/\(postId)/replies/\(replyId)/helpful",
            body: HelpfulRequest(helpful: helpful)
        )
    }

    /// `POST /api/pulse/posts/:postId/replies/:replyId/thanks` — §2.7.
    static func thankReply(postId: String, replyId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/replies/\(replyId)/thanks")
    }

    /// `POST /api/pulse/posts/:postId/replies/:replyId/report` — §2.7.
    static func reportReply(postId: String, replyId: String, reason: String, details: String? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/pulse/posts/\(postId)/replies/\(replyId)/report",
            body: ReplyReportRequest(reason: reason, details: details)
        )
    }

    /// `POST /api/pulse/posts/:postId/claims` — §2.8.
    static func requestOffer(postId: String, note: String? = nil) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/claims", body: ClaimRequest(note: note))
    }

    /// `GET /api/pulse/posts/:postId/claims` — planned backend/routes/pulse.js, contract §2.8 / PR 2313.
    static func offerRequests(postId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/pulse/posts/\(postId)/claims")
    }

    /// `POST /api/pulse/posts/:postId/claims/:claimId/choose` — planned backend/routes/pulse.js, contract §2.8 / PR 2313.
    static func chooseOfferRequest(postId: String, claimId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/claims/\(claimId)/choose")
    }

    /// Planned `backend/routes/pulse.js`: `PUT /api/pulse/posts/:id/read-scope`, contract §2.13 / PR 2321.
    static func narrowReadScope(postId: String, readScope: String, areaId: String? = nil) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/pulse/posts/\(postId)/read-scope",
            body: ReadScopeRequest(readScope: readScope, areaId: areaId)
        )
    }

    /// `backend/routes/pulse.js` in PR 2322: `GET /api/pulse/follows`, contract §2.9.
    static func follows() -> Endpoint {
        Endpoint(method: .get, path: "/api/pulse/follows")
    }

    /// `backend/routes/pulse.js` in PR 2322: `PUT /api/pulse/follows`, contract §2.9.
    static func followPost(postId: String, notify: String = "off", ends: String = "on_resolve") -> Endpoint {
        Endpoint(method: .put, path: "/api/pulse/follows", body: FollowPostRequest(targetId: postId, notify: notify, ends: ends))
    }

    /// `DELETE /api/pulse/follows?targetType=post&targetId=…` — §2.9.
    static func unfollowPost(postId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/pulse/follows", query: ["targetType": "post", "targetId": postId])
    }
}

private struct HelpfulRequest: Encodable {
    let helpful: Bool
}

private struct ReplyReportRequest: Encodable {
    let reason: String
    let details: String?
}

private struct ClaimRequest: Encodable {
    let note: String?
}

private struct ReadScopeRequest: Encodable {
    let readScope: String
    let areaId: String?
}

private struct FollowPostRequest: Encodable {
    let targetType = "post"
    let targetId: String
    let notify: String
    let ends: String
}
