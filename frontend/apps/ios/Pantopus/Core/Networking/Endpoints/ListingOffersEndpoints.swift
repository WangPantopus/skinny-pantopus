//
//  ListingOffersEndpoints.swift
//  Pantopus
//
//  T5.3.4 — endpoints for the per-listing offers screen. Distinct from
//  `ListingsEndpoints` (which deals with the listing itself) and from
//  `OffersEndpoints` (which deals with the cross-listing gig-bid surface).
//

import Foundation

/// Endpoints under `/api/listings/:listingId/offers/*`. All routes live
/// in `backend/routes/listingOffers.js`.
public enum ListingOffersEndpoints {
    /// `GET /api/listings/:listingId/offers` — list every offer the
    /// caller can see for the listing. Seller sees all; buyer sees their
    /// own. Route `backend/routes/listingOffers.js:78`.
    public static func list(listingId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/listings/\(listingId)/offers")
    }

    /// `POST /api/listings/:listingId/offers/:offerId/accept`. Route
    /// `backend/routes/listingOffers.js:163`.
    public static func accept(listingId: String, offerId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/listings/\(listingId)/offers/\(offerId)/accept"
        )
    }

    /// `POST /api/listings/:listingId/offers/:offerId/decline`. Route
    /// `backend/routes/listingOffers.js:180`.
    public static func decline(listingId: String, offerId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/listings/\(listingId)/offers/\(offerId)/decline"
        )
    }

    /// `POST /api/listings/:listingId/offers/:offerId/counter`. Route
    /// `backend/routes/listingOffers.js:144`.
    public static func counter(
        listingId: String,
        offerId: String,
        body: CounterListingOfferBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/listings/\(listingId)/offers/\(offerId)/counter",
            body: body
        )
    }
}
