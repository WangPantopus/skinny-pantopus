//
//  HolidayCardEndpoints.swift
//  Pantopus
//
//  Christmas cards (launch keys `holiday_cards` + `mailbox`): the season's
//  pictures and today's card, sending one, and taking it back. The server
//  answers 404 while either key is off.
//

import Foundation

public enum HolidayCardEndpoints {
    /// `GET /api/mailbox/cards` — route `backend/routes/mailbox.js:1756`.
    public static func cards() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/cards")
    }

    /// `POST /api/mailbox/cards` — route `backend/routes/mailbox.js:1789`.
    /// One card a day; answers 201 `{ card }`.
    public static func send(_ body: SendHolidayCardBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards", body: body)
    }

    /// `POST /api/mailbox/cards/:id/take-back` — route
    /// `backend/routes/mailbox.js:1952`. Until the carrier's 7 a.m. pickup (by
    /// email: until they open it).
    public static func takeBack(cardId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards/\(cardId)/take-back")
    }
}
