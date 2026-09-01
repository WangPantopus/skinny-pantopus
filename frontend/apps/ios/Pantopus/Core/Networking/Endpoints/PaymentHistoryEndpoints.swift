//
//  PaymentHistoryEndpoints.swift
//  Pantopus
//
//  The combined payment + payout history feed behind Settings → Payments →
//  Activity (`backend/routes/pays.js`, mounted at `/api/payments`). Kept in
//  its own file so the shared `PaymentsEndpoints` surface doesn't grow a
//  merge hot-spot.
//

import Foundation

public enum PaymentHistoryEndpoints {
    /// `GET /api/payments/history` — route `backend/routes/pays.js:732`.
    /// Merged `Payment` + `Payout` rows for the signed-in user, newest first.
    /// `limit` is clamped server-side to 1…100 and `offset` must stay under
    /// 500 (the handler 400s beyond that).
    public static func history(limit: Int = 50, offset: Int = 0) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/payments/history",
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }
}
