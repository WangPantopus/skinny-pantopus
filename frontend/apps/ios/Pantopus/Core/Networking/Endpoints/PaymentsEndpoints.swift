//
//  PaymentsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the Stripe payment-methods surface
//  (`backend/routes/pays.js`, mounted at `/api/payments`). Phase 3 (3A):
//  list / add (via PaymentSheet) / set-default / remove saved methods.
//  Connect onboarding, payouts, checkout and tips land with 3B/3C/3D.
//

import Foundation

public enum PaymentsEndpoints {
    /// `GET /api/payments/methods` — route `backend/routes/pays.js:701`.
    /// Saved cards / bank accounts, default-first.
    public static func methods() -> Endpoint {
        Endpoint(method: .get, path: "/api/payments/methods")
    }

    /// `POST /api/payments/payment-sheet-add-card` — route
    /// `backend/routes/pays.js:1095`. SetupIntent params for the mobile
    /// PaymentSheet "add a card" flow. The attached card is reconciled into
    /// the `PaymentMethod` table server-side via the
    /// `payment_method.attached` webhook, so the client just refreshes
    /// `methods()` on success.
    public static func addCardSheet() -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/payment-sheet-add-card")
    }

    /// `POST /api/payments/intent` — route `backend/routes/pays.js:280`.
    /// Block 3B checkout: creates a PaymentIntent for the gig / marketplace
    /// order and returns the full set of params the mobile PaymentSheet
    /// needs (`clientSecret` + `customer` + `ephemeralKey` +
    /// `publishableKey`). The server owns the payee and amount; the client
    /// passes only the order reference (gig or listing/offer id pair). The
    /// charge is reconciled into the `Payment` table by Stripe webhooks, so
    /// the client refreshes the order from the backend on success — it never
    /// marks paid locally.
    public static func intent(body: CreatePaymentIntentBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/intent", body: body)
    }

    /// `POST /api/payments/tip` — route `backend/routes/pays.js:913`.
    /// Block 3D: the gig poster tips the assigned worker on a completed +
    /// owner-confirmed gig. Returns the mobile PaymentSheet params
    /// (`clientSecret` + `customer` + `ephemeralKey` + `publishableKey`) plus
    /// the `paymentId` used to reconcile via `tipRefreshStatus`.
    public static func tip(body: TipRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/tip", body: body)
    }

    /// `POST /api/payments/tip/{paymentId}/refresh-status` — route
    /// `backend/routes/pays.js:1012`. Best-effort status sync after the mobile
    /// PaymentSheet succeeds (before the webhook lands).
    public static func tipRefreshStatus(paymentId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/payments/tip/\(paymentId)/refresh-status")
    }

    /// `PUT /api/payments/methods/{id}/default` — route
    /// `backend/routes/pays.js:754`. Promote a saved method to default.
    public static func setDefaultMethod(id: String) -> Endpoint {
        Endpoint(method: .put, path: "/api/payments/methods/\(id)/default")
    }

    /// `DELETE /api/payments/methods/{id}` — route
    /// `backend/routes/pays.js:776`. Detach + delete a saved method.
    public static func removeMethod(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/payments/methods/\(id)")
    }
}
