//
//  ProfileTabsEndpoints.swift
//  Pantopus
//
//  Routes behind the public-profile tab set and the Edit Profile skills
//  editor — the surfaces RN exposes on `src/app/user/[id].tsx` (about ·
//  posts · gigs · portfolio · reviews) and `src/app/profile/edit.tsx`.
//
//  Every helper below was verified against the live router, not the
//  parity doc's shorthand:
//
//    Route backend/routes/files.js:489    GET    /api/files/portfolio
//    Route backend/routes/files.js:526    GET    /api/files/portfolio/:userId
//    Route backend/routes/files.js:853    DELETE /api/files/:id
//    Route backend/routes/gigs.js:2089    GET    /api/gigs?user_id=…&limit=…
//    Route backend/routes/reviews.js:149  GET    /api/reviews/user/:userId
//    Route backend/routes/users.js:2244   PUT    /api/users/skills
//
//  Mount prefixes: `backend/app.js:329` (files), `:309` (gigs),
//  `:340` (reviews), `:306` (users).
//
//  The portfolio *upload* leg is multipart and therefore lives on
//  `MultipartUploader.uploadPortfolio(...)`, not here.
//

import Foundation

/// Endpoints for the public-profile tabs (portfolio · gigs · reviews)
/// and the profile skills editor.
public enum ProfileTabsEndpoints {
    // MARK: - Portfolio

    /// `GET /api/files/portfolio` — the signed-in user's own portfolio
    /// files. Route `backend/routes/files.js:489`. `category` maps onto
    /// the row's `file_context` column.
    public static func myPortfolio(category: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let category, !category.isEmpty { query["category"] = category }
        return Endpoint(method: .get, path: "/api/files/portfolio", query: query)
    }

    /// `GET /api/files/portfolio/:userId` — another user's *public*
    /// portfolio files. Route `backend/routes/files.js:526` (no
    /// `verifyToken`, and it filters `visibility = 'public'`).
    public static func portfolio(userId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/files/portfolio/\(userId)")
    }

    /// `DELETE /api/files/:id` — soft-delete one owned file. Route
    /// `backend/routes/files.js:853`; returns 403 when the caller
    /// doesn't own the row.
    public static func deleteFile(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/files/\(id)")
    }

    // MARK: - Gigs posted by a user

    /// `GET /api/gigs?user_id=…&limit=…` — the gigs a given user posted.
    /// Route `backend/routes/gigs.js:2089`; `user_id` is accepted
    /// alongside `userId` (`gigs.js:2103-2104`) and suppresses the
    /// "exclude my own gigs" branch (`gigs.js:2125`). Mirrors RN's
    /// `GigsTab` call (`src/components/profile/GigsTab.tsx:19`).
    public static func userGigs(userId: String, limit: Int = 20) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs",
            query: ["user_id": userId, "limit": String(limit)]
        )
    }

    // MARK: - Gig reviews received by a user

    /// `GET /api/reviews/user/:userId?limit=…` — gig reviews *received*
    /// by a user, with the server-computed `average_rating`, `total` and
    /// per-role `counts`. Route `backend/routes/reviews.js:149`; the
    /// handler clamps `limit` to 50. Mirrors RN's profile fetch
    /// (`src/app/user/[id].tsx:153`).
    public static func userReviews(userId: String, limit: Int = 50) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/reviews/user/\(userId)",
            query: ["limit": String(limit)]
        )
    }

    // MARK: - Skills

    /// `PUT /api/users/skills` — replace the caller's skill list. Route
    /// `backend/routes/users.js:2244`; the handler dedupes, trims, caps
    /// each entry at 100 chars and the list at 50, then echoes the
    /// cleaned array. Mirrors RN's `api.users.updateSkills`
    /// (`packages/api/src/endpoints/users.ts:67`).
    public static func updateSkills(_ body: UpdateSkillsRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/users/skills", body: body)
    }
}
