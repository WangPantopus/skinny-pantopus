//
//  BusinessInboxEndpoints.swift
//  Pantopus
//
//  The business-side inbox (RN `components/business/tabs/InboxTab.tsx`).
//  Two sections, two routes:
//    · Messages — chat rooms addressed to the *business* identity;
//    · Mentions — neighborhood posts matched to the business.
//
//  Both are owner/team-scoped: the chat route runs `canActAsBusiness`, the
//  matched-posts route runs `checkBusinessPermission`, so a viewer without a
//  seat gets a 403 rather than an empty list.
//

import Foundation

public enum BusinessInboxEndpoints {
    /// `GET /api/chat/business/:businessUserId/rooms` — every chat room the
    /// business identity participates in (shared team inbox), newest
    /// last-message first. Route `backend/routes/chats.js:662`; mounted at
    /// `/api/chat` (`backend/app.js:330`).
    public static func rooms(businessId: String, limit: Int = 200, type: String? = nil) -> Endpoint {
        var query: [String: String] = ["limit": String(limit)]
        if let type, !type.isEmpty { query["type"] = type }
        return Endpoint(
            method: .get,
            path: "/api/chat/business/\(businessId)/rooms",
            query: query
        )
    }

    /// `GET /api/businesses/:businessId/matched-posts` — neighborhood posts
    /// whose `matched_business_ids` contains this business. Paged with
    /// `page` / `page_size` (server caps `page_size` at 50). Route
    /// `backend/routes/businesses.js:4367`; mounted at `/api/businesses`
    /// (`backend/app.js:348`).
    public static func matchedPosts(
        businessId: String,
        page: Int = 1,
        pageSize: Int = 30
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/matched-posts",
            query: ["page": String(page), "page_size": String(pageSize)]
        )
    }
}
