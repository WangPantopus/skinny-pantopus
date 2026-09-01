//
//  BusinessesEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/businesses.js`. T6.3f added
//  the `myBusinesses()` helper that backs the My businesses screen.
//  Business discovery (search / nearby) lives in its own namespace
//  under `BusinessDiscoveryEndpoints`.
//

import Foundation

/// Endpoints under `/api/businesses/*`.
public enum BusinessesEndpoints {
    /// `GET /api/businesses/my-businesses` — every business the current
    /// user owns or staffs (via BusinessSeat or legacy BusinessTeam).
    /// Route `backend/routes/businesses.js:682`.
    public static func myBusinesses() -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/my-businesses")
    }

    /// `GET /api/businesses/:businessId` — the authenticated detail
    /// fetch. Returns `business + profile + locations + access`. The
    /// `access` block tells the caller whether the viewer owns / staffs
    /// the business; for a non-owning viewer the rest of the response
    /// still renders (this is the public-style read).
    /// Route `backend/routes/businesses.js:912`.
    public static func business(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)")
    }

    /// `GET /api/businesses/public/:username` — unauthenticated public
    /// view used to surface hours + catalog + founding badge for a
    /// published business. The viewer only knows the business UUID at
    /// tap time, so the Business Profile screen calls
    /// [business(businessId:)] first to resolve `username`, then folds
    /// this response in for the Overview hours and Services tabs. The
    /// endpoint 404s for unpublished businesses; the VM absorbs that
    /// silently and renders the empty state for the affected tabs.
    /// Route `backend/routes/businesses.js:3277`.
    public static func publicBusiness(username: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/public/\(username)",
            authenticated: false
        )
    }

    /// `GET /api/businesses/:businessId/catalog/items` — the owner/staff
    /// catalog list (requires `catalog.view`). Unlike
    /// [publicBusiness(username:)] this answers before the profile is
    /// published, so the editor's setup checklist can tick "Services" on a
    /// business that has never been published.
    /// Route `backend/routes/businesses.js:2386`.
    public static func catalogItems(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/catalog/items")
    }

    /// `GET /api/businesses/:businessId/dashboard` — the owner-scoped fetch.
    /// Returns the publish state, edit recency, and the onboarding checklist
    /// that backs the owner dashboard's profile-strength card. 403s for a
    /// viewer with no access. Route `backend/routes/businesses.js:979`.
    public static func dashboard(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/dashboard")
    }

    /// `GET /api/businesses/:businessId/insights` — the owner analytics fetch
    /// (views / followers / reviews + week-over-week trends) that backs the
    /// owner dashboard's "This week" tiles. `period` is `7d | 30d | 90d`.
    /// Route `backend/routes/businesses.js:3915`.
    public static func insights(businessId: String, period: String = "30d") -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/insights",
            query: ["period": period]
        )
    }

    /// `GET /api/businesses/:businessId/reviews` — the owner reviews list
    /// (enriched with reviewer + gig + any published owner response). Backs
    /// the owner dashboard's reply composer. Route
    /// `backend/routes/businesses.js:3441`.
    public static func reviews(businessId: String, page: Int = 1, limit: Int = 20) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/reviews",
            query: ["page": "\(page)", "limit": "\(limit)"]
        )
    }

    /// `POST /api/businesses/:businessId/reviews/:reviewId/respond` — save or
    /// update the owner's reply on a review. Route
    /// `backend/routes/businesses.js:3552`.
    public static func respondToReview(
        businessId: String,
        reviewId: String,
        response: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/reviews/\(reviewId)/respond",
            body: ["response": response]
        )
    }

    /// `POST /api/businesses/:businessId/follow` — save/follow a public
    /// business. Route `backend/routes/businesses.js:3621`.
    public static func follow(businessId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/follow")
    }

    /// `POST /api/businesses/:businessId/inbox/start` — open (or resume) a
    /// direct inquiry chat with a business. Body `{ subject? }`; returns
    /// `{ roomId, existing }`. Route `backend/routes/businesses.js:3939`.
    public static func startInquiry(businessId: String, subject: String? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/inbox/start",
            body: StartBusinessInquiryBody(subject: subject)
        )
    }

    /// `GET /api/businesses/:businessId/locations` — owner/staff list of
    /// active locations. Route `backend/routes/businesses.js:1742`.
    public static func locations(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/locations")
    }

    /// `PATCH /api/businesses/:businessId` — update business profile fields
    /// (`name`, `tagline`, `description`, contact, categories, …).
    /// Route `backend/routes/businesses.js:1134`.
    public static func updateBusiness(
        businessId: String,
        body: UpdateBusinessRequest
    ) -> Endpoint {
        Endpoint(method: .patch, path: "/api/businesses/\(businessId)", body: body)
    }

    /// `POST /api/businesses/:businessId/publish` — publish the business
    /// profile. Route `backend/routes/businesses.js:1350`.
    public static func publishBusiness(businessId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/publish")
    }

    /// `GET /api/businesses/:businessId/locations/:locationId/hours` —
    /// weekly hours for a location. Route `backend/routes/businesses.js:2084`.
    public static func locationHours(businessId: String, locationId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/locations/\(locationId)/hours"
        )
    }

    /// `PUT /api/businesses/:businessId/locations/:locationId/hours` — bulk
    /// replace weekly hours. Route `backend/routes/businesses.js:2023`.
    public static func setLocationHours(
        businessId: String,
        locationId: String,
        body: SetBusinessHoursRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/businesses/\(businessId)/locations/\(locationId)/hours",
            body: body
        )
    }

    /// `PATCH /api/businesses/:businessId/locations/:locationId` — update a
    /// location row. Route `backend/routes/businesses.js:1776`.
    public static func updateLocation(
        businessId: String,
        locationId: String,
        body: UpdateBusinessLocationRequest
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/businesses/\(businessId)/locations/\(locationId)",
            body: body
        )
    }

    /// `GET /api/businesses/check-username` — username availability check
    /// (no auth). Returns `{ available, reason? }`.
    /// Route `backend/routes/businesses.js:358`.
    public static func checkUsername(username: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/check-username",
            query: ["username": username],
            authenticated: false
        )
    }

    /// `POST /api/businesses/create-full` — atomic create with optional
    /// location + hours. Route `backend/routes/businesses.js:554`.
    public static func createBusinessFull(_ body: CreateBusinessFullRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/create-full", body: body)
    }
}
