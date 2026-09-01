//
//  UniversalSearchEndpoints.swift
//  Pantopus
//
//  S2 — Universal search. One screen fans out across five independent
//  backend search surfaces (tasks / people / beacons / businesses /
//  homes). Each route lives in a different backend router, so they are
//  collected here rather than piled into the five feature endpoint
//  files.
//
//  Endpoint drift vs. the RN parity doc: the doc quotes
//  `GET /api/identity-search`; the real mount is `/api/identity`
//  (`backend/app.js:357`) + `router.get('/search', …)`
//  (`backend/routes/identitySearch.js:370`) → `GET /api/identity/search`.
//

import Foundation

/// Endpoint builders for the five search surfaces the universal search
/// screen fans out to. Every helper names its backend route file + line.
public enum UniversalSearchEndpoints {
    /// `GET /api/gigs/search?q=&limit=&offset=&status=` — route
    /// `backend/routes/gigs.js:1822` (mounted `backend/app.js:309`).
    /// Rejects a `q` shorter than 2 characters with a 400, so callers
    /// must gate on `trimmed.count >= 2`. `limit` is capped at 50
    /// server-side.
    public static func gigs(query: String, limit: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs/search",
            query: ["q": query, "limit": String(limit), "status": "open"]
        )
    }

    /// `GET /api/users/search?q=&type=&limit=` — route
    /// `backend/routes/users.js:2367` (mounted `backend/app.js:306`).
    /// `type` is validated against `all | people | business`; the
    /// universal search People tab uses `people` so business accounts
    /// stay in the Businesses tab. `limit` is capped at 20 server-side.
    public static func people(query: String, limit: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/users/search",
            query: ["q": query, "type": "people", "limit": String(limit)]
        )
    }

    /// `GET /api/identity/search?q=&scope=&limit=` — route
    /// `backend/routes/identitySearch.js:370`.
    ///
    /// **Feature-gated.** `backend/app.js:357` only mounts
    /// `/api/identity` inside `if (isIdentityFirewallEnabled())`, so on a
    /// deployment with the Identity Firewall off this 404s. Callers must
    /// treat `APIError.notFound` as "this surface is unavailable" and
    /// keep the rest of the screen rendering.
    ///
    /// `scope` is validated against `all | local_profiles |
    /// public_profiles`; the Beacons tab passes `public_profiles` so the
    /// response only carries `type == "public_profile"` rows.
    public static func profiles(query: String, limit: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/identity/search",
            query: ["q": query, "scope": "public_profiles", "limit": String(limit)]
        )
    }

    /// `GET /api/businesses/discover?q=&limit=&offset=` — route
    /// `backend/routes/businesses.js:832` (mounted `backend/app.js:348`).
    /// Returns published `BusinessProfile` rows only. Rejects a `q`
    /// shorter than 2 characters with a 400.
    public static func businesses(query: String, limit: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/discover",
            query: ["q": query, "limit": String(limit)]
        )
    }

    /// `GET /api/homes/discover?q=&limit=&offset=` — route
    /// `backend/routes/home.js:2297` (mounted `backend/app.js:326`).
    /// Only surfaces `visibility == "public_preview"` homes whose
    /// `privacy_mask_level` is `normal`. Rejects a `q` shorter than 2
    /// characters with a 400.
    public static func homes(query: String, limit: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/discover",
            query: ["q": query, "limit": String(limit)]
        )
    }
}
