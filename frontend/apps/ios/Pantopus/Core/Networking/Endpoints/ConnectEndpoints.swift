//
//  ConnectEndpoints.swift
//  Pantopus
//
//  Stripe Connect (Express) onboarding + payout-account endpoints from
//  `backend/routes/pays.js` (mounted at `/api/payments`). Block 3C wires the
//  seller payout side: create/ensure the connected account, fetch a
//  Stripe-hosted Account Link to onboard, read the onboarding / payouts-enabled
//  state, and open the Express dashboard. We NEVER build bank/identity/KYC UI —
//  Stripe hosts all of it.
//

import Foundation

public enum ConnectEndpoints {
    /// `POST /api/payments/connect/account` — route `backend/routes/pays.js:161`.
    /// Create/ensure the seller's Express connected account. Returns 201 on
    /// create; a 400 "Stripe account already exists" means it's already there
    /// (the client treats that as success and proceeds to onboarding).
    public static func createAccount(body: ConnectCreateAccountRequest = .init()) -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/connect/account", body: body)
    }

    /// `POST /api/payments/connect/onboarding` — route `backend/routes/pays.js:213`.
    /// Returns a single-use Stripe-hosted Account Link URL to open in the
    /// in-app browser. `returnUrl` / `refreshUrl` default server-side.
    public static func onboarding(body: ConnectOnboardingRequest = .init()) -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/connect/onboarding", body: body)
    }

    /// `GET /api/payments/connect/account` — route `backend/routes/pays.js:243`.
    /// Live onboarding / payouts-enabled status (re-synced from Stripe). 404
    /// when the seller has no connected account yet.
    public static func accountStatus() -> Endpoint {
        Endpoint(method: .get, path: "/api/payments/connect/account")
    }

    /// `POST /api/payments/connect/dashboard` — route `backend/routes/pays.js:265`.
    /// Express dashboard login link for an onboarded seller.
    public static func dashboard() -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/connect/dashboard")
    }
}
