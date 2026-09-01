//
//  EarnOffersEndpoints.swift
//  Pantopus
//
//  Mailbox Earn drawer — paid-offer wall. Mounted at
//  `app.use('/api/mailbox/v2', require('./routes/mailboxV2'))`
//  (`backend/app.js:315`); the route-relative declarations live in the
//  `EARN ENDPOINTS` block of `backend/routes/mailboxV2.js`.
//

import Foundation

/// Endpoint builders for the Earn offer wall in `backend/routes/mailboxV2.js`.
public enum EarnOffersEndpoints {
    /// `GET /api/mailbox/v2/earn/offers` — route
    /// `backend/routes/mailboxV2.js:794`. Active, unexpired `EarnOffer`
    /// rows (max 20, newest first), each enriched with the caller's
    /// `opened` flag + `EarnTransaction`.
    public static func offers() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/earn/offers")
    }

    /// `GET /api/mailbox/v2/earn/balance` — route
    /// `backend/routes/mailboxV2.js:831`. Server-computed
    /// `{ balance: { total, available, pending } }`.
    public static func balance() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/earn/balance")
    }

    /// `POST /api/mailbox/v2/earn/open` — route
    /// `backend/routes/mailboxV2.js:858`. Creates the pending
    /// `EarnTransaction` and starts the dwell window. Returns **429** with
    /// `{ capped: true }` once the caller has opened 10 offers today.
    public static func openOffer(offerId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/earn/open",
            body: EarnOpenOfferRequest(offerId: offerId)
        )
    }

    /// `POST /api/mailbox/v2/earn/close/:offerId` — route
    /// `backend/routes/mailboxV2.js:940`. Banks the reward when
    /// `dwellMs >= 15000` (the server's `MIN_DWELL_MS`); the response's
    /// `consumed` flag is the only authority on whether it counted.
    public static func closeOffer(offerId: String, dwellMs: Int) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/earn/close/\(offerId)",
            body: EarnCloseOfferRequest(dwellMs: dwellMs)
        )
    }

    /// `POST /api/mailbox/v2/earn/save/:offerId` — route
    /// `backend/routes/mailboxV2.js:979`. Logs an `offer_saved` mail event.
    public static func saveOffer(offerId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/earn/save/\(offerId)")
    }

    /// `POST /api/mailbox/v2/earn/reveal/:offerId` — route
    /// `backend/routes/mailboxV2.js:989`. Returns `{ code }` (nullable) and
    /// logs `offer_code_revealed`.
    public static func revealOffer(offerId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/earn/reveal/\(offerId)")
    }
}
