//
//  MailSentEndpoints.swift
//  Pantopus
//
//  Sent (launch key `mailbox`): what this person has sent, newest first,
//  and one sent card. Taking a card back uses the card's own route
//  (`HolidayCardEndpoints.takeBack`). The server answers 404 while the key
//  is off.
//

import Foundation

public enum MailSentEndpoints {
    /// `GET /api/mailbox/sent?before=&limit=` — route `backend/routes/mailbox.js`
    /// (declared before `GET /:id`). `before` is the last page's `next`.
    public static func sent(before: String? = nil, limit: Int = 25) -> Endpoint {
        var query = ["limit": String(limit)]
        if let before { query["before"] = before }
        return Endpoint(method: .get, path: "/api/mailbox/sent", query: query)
    }

    /// `GET /api/mailbox/sent/:id` — route `backend/routes/mailbox.js`: the
    /// card with its note and trail, for its sender only.
    public static func piece(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/sent/\(id)")
    }
}
