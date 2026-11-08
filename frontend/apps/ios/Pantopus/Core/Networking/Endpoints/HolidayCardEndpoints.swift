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
    /// `GET /api/mailbox/cards` — route `backend/routes/mailbox.js:1776`.
    public static func cards() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/cards")
    }

    /// `GET /api/mailbox/cards/arrivals?to=` — route
    /// `backend/routes/mailbox.js:1809`. When a card to this person can come,
    /// by their clock; the same checks as sending them one.
    public static func arrivals(toUserId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/cards/arrivals", query: ["to": toUserId])
    }

    /// `POST /api/mailbox/cards` — route `backend/routes/mailbox.js:1837`.
    /// One card a day; answers 201 `{ card }`.
    public static func send(_ body: SendHolidayCardBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards", body: body)
    }

    /// `POST /api/mailbox/cards/preview` — route `backend/routes/mailbox.js`
    /// (next to `POST /cards`). The same body and every check sending runs,
    /// storing and sending nothing: what the other person will see.
    public static func preview(_ body: SendHolidayCardBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards/preview", body: body)
    }

    /// `POST /api/mailbox/cards/batch/preview` — route
    /// `backend/routes/mailbox.js:2441`. A list's look (digital stamps on):
    /// every check its send runs, storing and sending nothing.
    public static func previewList(_ body: SendHolidayCardListBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards/batch/preview", body: body)
    }

    /// `POST /api/mailbox/cards/batch` — route `backend/routes/mailbox.js:2484`.
    /// One card to every person and address on the list, each its own card;
    /// answers card by card.
    public static func sendList(_ body: SendHolidayCardListBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards/batch", body: body)
    }

    /// `POST /api/mailbox/cards/shared`: counts one share of a card's picture (`card_table`). Answers 204.
    public static func shared(_ body: HolidayCardSharedBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards/shared", body: body)
    }

    /// `GET /api/mailbox/cards/:id/link`: the link again, for its sender, while it waits. 409 with the reason otherwise.
    public static func link(cardId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/cards/\(cardId)/link")
    }

    /// `POST /api/mailbox/cards/:id/take-back` — route
    /// `backend/routes/mailbox.js:1988`. Until the carrier's 7 a.m. pickup (by
    /// email: until they open it).
    public static func takeBack(cardId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/cards/\(cardId)/take-back")
    }
}
