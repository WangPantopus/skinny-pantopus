//
//  TokenAcceptEndpoints.swift
//  Pantopus
//
//  T3.5 Token / Accept — single-decision screen that resolves an
//  invite token (from `pantopus://invite/:token`) into one of three
//  flavors (home invite, business seat invite, guest pass) and then
//  hands the accept call to the right backend route.
//

import Foundation

public enum TokenAcceptEndpoints {
    // MARK: - Resolution (no auth required for home + guest)

    /// `GET /api/homes/invitations/token/:token` — home-invite preview.
    /// Route `backend/routes/home.js:1793`.
    public static func homeInvite(token: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/invitations/token/\(token)",
            authenticated: false
        )
    }

    /// `GET /api/businesses/seats/invite-details?token=X` — business
    /// seat preview. Requires auth (the route is verifyToken'd on the
    /// server side). Route `backend/routes/businessSeats.js:138`.
    public static func businessSeatInvite(token: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/seats/invite-details",
            query: ["token": token]
        )
    }

    /// `GET /api/homes/guest/:token` — public guest pass preview.
    /// Route `backend/routes/homeGuest.js:20`.
    public static func guestPass(token: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/guest/\(token)",
            authenticated: false
        )
    }

    // MARK: - Accept / decline

    /// `POST /api/homes/invitations/token/:token/accept`. Route
    /// `backend/routes/home.js:2040`.
    public static func acceptHomeInvite(token: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/invitations/token/\(token)/accept")
    }

    /// `POST /api/homes/invitations/:invitationId/reject`. Route
    /// `backend/routes/home.js:2013`.
    public static func declineHomeInvite(invitationId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/invitations/\(invitationId)/reject")
    }

    /// `POST /api/businesses/seats/accept-invite`. Route
    /// `backend/routes/businessSeats.js:207`.
    public static func acceptBusinessSeat(body: BusinessSeatAcceptBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/seats/accept-invite", body: body)
    }

    /// `POST /api/businesses/seats/decline-invite`. Route
    /// `backend/routes/businessSeats.js:358`.
    public static func declineBusinessSeat(body: BusinessSeatDeclineBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/seats/decline-invite", body: body)
    }
}

/// `POST /api/businesses/seats/accept-invite` request body.
public struct BusinessSeatAcceptBody: Encodable, Sendable {
    public let token: String
    public let displayName: String?

    public init(token: String, displayName: String? = nil) {
        self.token = token
        self.displayName = displayName
    }

    enum CodingKeys: String, CodingKey {
        case token
        case displayName = "display_name"
    }
}

/// `POST /api/businesses/seats/decline-invite` request body.
public struct BusinessSeatDeclineBody: Encodable, Sendable {
    public let token: String

    public init(token: String) {
        self.token = token
    }
}
