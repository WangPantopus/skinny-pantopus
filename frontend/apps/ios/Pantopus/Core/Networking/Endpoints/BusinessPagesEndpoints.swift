//
//  BusinessPagesEndpoints.swift
//  Pantopus
//
//  C4 — the business Pages CMS. Every custom-page, block and revision route
//  lives under the `/api/businesses` mount (`backend/app.js:348`), NOT under
//  `/api/b` — that prefix (`backend/app.js:350`) only serves the two public
//  reads at the bottom of this file.
//

import Foundation

/// Endpoints for custom business pages, their block bodies, and revisions.
public enum BusinessPagesEndpoints {
    /// `GET /api/businesses/:businessId/pages` — every page for the business,
    /// ordered by `nav_order`. Requires `pages.view`.
    /// Route `backend/routes/businesses.js:2865`.
    public static func pages(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/pages")
    }

    /// `POST /api/businesses/:businessId/pages` — create a custom page.
    /// 409s when the slug is already taken for this business. Requires
    /// `pages.manage`. Route `backend/routes/businesses.js:2809`.
    public static func createPage(
        businessId: String,
        body: CreateBusinessPageRequest
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/pages", body: body)
    }

    /// `DELETE /api/businesses/:businessId/pages/:pageId` — deletes the page
    /// plus its blocks and revisions. 400s for the default page. Requires
    /// `pages.manage`. Route `backend/routes/businesses.js:2949`.
    public static func deletePage(businessId: String, pageId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/businesses/\(businessId)/pages/\(pageId)")
    }

    /// `GET /api/businesses/:businessId/pages/:pageId/blocks?revision=draft|published`
    /// — the block list at the requested revision. Requires `pages.view`.
    /// Route `backend/routes/businesses.js:3006`.
    public static func blocks(
        businessId: String,
        pageId: String,
        revision: String = "draft"
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/pages/\(pageId)/blocks",
            query: ["revision": revision]
        )
    }

    /// `PUT /api/businesses/:businessId/pages/:pageId/blocks` — replaces every
    /// block at the current draft revision (max 50 blocks). Requires
    /// `pages.edit`. Route `backend/routes/businesses.js:3066`.
    public static func saveDraftBlocks(
        businessId: String,
        pageId: String,
        body: SaveBusinessPageBlocksRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/businesses/\(businessId)/pages/\(pageId)/blocks",
            body: body
        )
    }

    /// `POST /api/businesses/:businessId/pages/:pageId/publish` — snapshots the
    /// draft into `BusinessPageRevision` and bumps `published_revision`. 400s
    /// when the draft is empty or unchanged. Requires `pages.publish`.
    /// Route `backend/routes/businesses.js:3153`.
    public static func publishPage(businessId: String, pageId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/pages/\(pageId)/publish"
        )
    }

    /// `GET /api/businesses/:businessId/pages/:pageId/revisions` — published
    /// revision history, newest first. Requires `pages.view`.
    /// Route `backend/routes/businesses.js:3241`.
    public static func revisions(businessId: String, pageId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/pages/\(pageId)/revisions"
        )
    }

    /// `POST /api/businesses/:businessId/pages/:pageId/revisions/:rev/restore`
    /// — copies a published snapshot back onto a fresh draft revision.
    /// Requires `pages.edit`. Route `backend/routes/businesses.js:3277`.
    public static func restoreRevision(
        businessId: String,
        pageId: String,
        revision: Int
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/pages/\(pageId)/revisions/\(revision)/restore"
        )
    }

    /// `GET /api/b/:username/:slug` — the public read for one named page,
    /// including its published blocks. No auth. This is the surface the
    /// `pantopus://b/:username/:slug` universal link resolves to.
    /// Route `backend/routes/businessPublicPage.js:62` (mount `backend/app.js:350`).
    public static func publicPage(username: String, slug: String) -> Endpoint {
        let encodedUser = username.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) ?? username
        let encodedSlug = slug.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) ?? slug
        return Endpoint(
            method: .get,
            path: "/api/b/\(encodedUser)/\(encodedSlug)",
            authenticated: false
        )
    }
}
