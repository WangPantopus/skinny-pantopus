//
//  MembershipEndpoints.swift
//  Pantopus
//
//  A10.8 Membership (fan-side). The fan's own membership to a persona plus
//  the single-tap cancel. Backend keeps the persona / membership names on
//  the wire; the UI renames at the VM boundary. The router is mounted at
//  `/api/personas/:id/membership` (`backend/app.js:367`) and gates `:id` to
//  a UUID.
//

import Foundation

public enum MembershipEndpoints {
    /// `GET /api/personas/:id/membership` — the calling fan's own
    /// membership for `personaId` (UUID). Route
    /// `backend/routes/personaMembership.js:108`.
    public static func membership(personaId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(personaId)/membership")
    }

    /// `POST /api/personas/:id/membership/cancel` — cancel at period end.
    /// No charge: free memberships cancel immediately, paid memberships
    /// flip `cancel_at_period_end` (a non-charging Stripe flag). Upgrade /
    /// downgrade / refund are paid actions deferred to Phase 3. Route
    /// `backend/routes/personaMembership.js:204`.
    public static func cancelMembership(personaId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/personas/\(personaId)/membership/cancel")
    }

    /// `POST /api/personas/:id/membership/upgrade` — move to a **higher**
    /// tier rank. Takes effect immediately (Stripe proration on the
    /// current invoice). Route `backend/routes/personaMembership.js:121`.
    public static func upgrade(personaId: String, tierRank: Int) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/personas/\(personaId)/membership/upgrade",
            body: MembershipTierChangeBody(tierRank: tierRank)
        )
    }

    /// `POST /api/personas/:id/membership/downgrade` — move to a **lower**
    /// tier rank. Scheduled via `subscriptionSchedule`, so it lands at
    /// `current_period_end` and the fan keeps their current perks until
    /// then. Route `backend/routes/personaMembership.js:162`.
    public static func downgrade(personaId: String, tierRank: Int) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/personas/\(personaId)/membership/downgrade",
            body: MembershipTierChangeBody(tierRank: tierRank)
        )
    }

    /// `POST /api/personas/:id/membership/refund-request` — SLA-missed
    /// refund. The backend re-checks that at least one of the fan's
    /// threads is genuinely in `sla_missed` before issuing a prorated
    /// refund, then cancels at period end. Route
    /// `backend/routes/personaMembership.js:251`.
    public static func refundRequest(
        personaId: String,
        body: MembershipRefundRequestBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/personas/\(personaId)/membership/refund-request",
            body: body
        )
    }

    /// `GET /api/personas/:handle/tiers` — the public tier ladder the tier
    /// picker offers. Addressed by **handle**, not id (the UUID-gated
    /// routers fall through for handle-shaped URLs). Route
    /// `backend/routes/personas.js:1111`.
    public static func publicTiers(handle: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(handle)/tiers")
    }
}
