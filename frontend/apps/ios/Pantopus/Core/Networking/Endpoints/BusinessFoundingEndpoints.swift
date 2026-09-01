//
//  BusinessFoundingEndpoints.swift
//  Pantopus
//
//  First-50 "Founding Business" offer (RN `src/app/businesses/[id]/index.tsx`
//  lines 108-144). The owner dashboard reads the global slot status on load
//  and an eligible owner claims a numbered slot from the banner.
//

import Foundation

public enum BusinessFoundingEndpoints {
    /// `GET /api/businesses/founding-offer/status` — global slot
    /// availability plus the caller's already-claimed businesses.
    /// Route `backend/routes/businessFounding.js:29`; mounted at
    /// `/api/businesses` (`backend/app.js:345`, before the `/:businessId`
    /// catch-all so the static path wins).
    public static let foundingOfferStatus = Endpoint(
        method: .get,
        path: "/api/businesses/founding-offer/status"
    )

    /// `POST /api/businesses/:businessId/founding-offer/claim` — claim a
    /// numbered founding slot. Owner-only; 400 when the page isn't
    /// published or verification is below `document_verified`, 409 when
    /// already claimed or all 50 slots are gone.
    /// Route `backend/routes/businessFounding.js:98`.
    public static func claimFoundingOffer(businessId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/founding-offer/claim"
        )
    }
}
