//
//  FridgeCardsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/fridgeCards.js` (mounted
//  under `/api/homes`) — the Fridge Card: the 911-ready household
//  card. Cards are HOUSEHOLD documents: any member lists them,
//  managers revoke, issuing needs home-manage + verified occupancy.
//

import Foundation

public enum FridgeCardsEndpoints {
    /// `POST /api/homes/:id/fridge-cards` — route
    /// `backend/routes/fridgeCards.js:34`. Issue (verified home
    /// managers only; 10/day limiter server-side). Content outside
    /// the section vocabulary is rejected with 400 BAD_CONTENT.
    public static func issue(homeId: String, request: IssueFridgeCardRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/fridge-cards", body: request)
    }

    /// `GET /api/homes/:id/fridge-cards` — route
    /// `backend/routes/fridgeCards.js:66`. The home's cards, any
    /// member, newest first.
    public static func list(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/fridge-cards")
    }

    /// `POST /api/homes/:id/fridge-cards/:cardId/revoke` — route
    /// `backend/routes/fridgeCards.js:83`. Pulls the card's public
    /// content immediately (health-adjacent data).
    public static func revoke(homeId: String, cardId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/fridge-cards/\(cardId)/revoke")
    }
}
