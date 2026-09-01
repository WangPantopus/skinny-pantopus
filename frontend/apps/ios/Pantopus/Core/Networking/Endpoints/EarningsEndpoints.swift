//
//  EarningsEndpoints.swift
//  Pantopus
//
//  Lifetime earnings / spending summaries from `backend/routes/pays.js`
//  (mounted at `/api/payments` — `backend/app.js:331`). These back the
//  "Earnings & Spending" card on Settings → Payments, mirroring RN
//  `components/payments/PayoutsTab.tsx` (`api.payments.getEarnings()` /
//  `getSpending()`).
//
//  Both figures are lifetime totals in integer cents and are deliberately
//  *not* the wallet balance: total earned includes funds still in
//  review/hold, while the wallet hero shows only withdrawable funds.
//

import Foundation

public enum EarningsEndpoints {
    /// `GET /api/payments/earnings` — route `backend/routes/pays.js:1111`.
    /// Lifetime earned / paid / escrowed / available for the signed-in user.
    public static func earnings() -> Endpoint {
        Endpoint(method: .get, path: "/api/payments/earnings")
    }

    /// `GET /api/payments/spending` — route `backend/routes/pays.js:1142`.
    /// Lifetime spent / paid / refunded for the signed-in user.
    public static func spending() -> Endpoint {
        Endpoint(method: .get, path: "/api/payments/spending")
    }
}
