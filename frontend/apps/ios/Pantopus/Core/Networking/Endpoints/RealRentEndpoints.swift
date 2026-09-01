//
//  RealRentEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/realRent.js` (mounted under
//  `/api/homes`) — the resident's own contribution to the Real Rent
//  benchmark. The contribution gate is the product: only a VERIFIED
//  occupant may report, so `set` answers 403 `VERIFICATION_REQUIRED`
//  below T4. The block aggregate is never served here; it rides the
//  intelligence contract's `real_rent` section.
//

import Foundation

public enum RealRentEndpoints {
    /// `PUT /api/homes/:id/rent-report` — route
    /// `backend/routes/realRent.js:31`. Contribute or update (verified
    /// T4 occupants only; 400 `BAD_AMOUNT` outside $50–$50,000/mo).
    public static func set(homeId: String, request: SetRentReportRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/homes/\(homeId)/rent-report", body: request)
    }

    /// `GET /api/homes/:id/rent-report` — route
    /// `backend/routes/realRent.js:70`. The caller's own report, or
    /// `{"report": null}`.
    public static func get(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/rent-report")
    }

    /// `DELETE /api/homes/:id/rent-report` — route
    /// `backend/routes/realRent.js:87`. Withdraw the caller's report.
    public static func delete(homeId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/homes/\(homeId)/rent-report")
    }
}
