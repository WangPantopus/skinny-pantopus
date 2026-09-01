//
//  GuestPassShare.swift
//  Pantopus
//
//  A13.6 — Share payload for a freshly-issued guest pass.
//
//  `POST /api/homes/:id/guest-passes` (route `backend/routes/homeIam.js:667`)
//  returns `{ pass, token }` — the raw share secret is handed back exactly
//  once and the response carries **no** `share_url` / `url` field. The
//  viewer link is therefore composed here from the public guest page the
//  web app serves at `/guest/:token`
//  (`pantopus/frontend/apps/web/src/app/guest/[token]/page.tsx`), which
//  resolves the token through `GET /api/homes/guest/:token`
//  (route `backend/routes/homeGuest.js:20`).
//
//  Because the token is never returned again, sharing is only possible in
//  the moment right after creation — exactly as RN does in
//  `src/app/homes/[id]/share.tsx:60-82`. Rows in the guest-pass list have
//  no token and therefore expose revoke only.
//
//  Field-for-field parity with Android `GuestPassShare.kt`.
//

import Foundation

/// One shareable guest pass — the pass id, the guest's first name (used
/// in the message opener), and the composed viewer URL.
public struct GuestPassShare: Identifiable, Hashable, Sendable {
    public let id: String
    public let guestName: String
    public let urlString: String

    public init(id: String, guestName: String, urlString: String) {
        self.id = id
        self.guestName = guestName
        self.urlString = urlString
    }

    /// Public guest-viewer link for a raw create-response token.
    /// Host comes from `InviteLinks.downloadURLString` so there is one
    /// place to swap when the marketing / web origin changes.
    public static func url(forToken token: String) -> String {
        "\(InviteLinks.downloadURLString)/guest/\(token)"
    }

    public var url: URL? {
        URL(string: urlString)
    }

    /// RN parity — `src/app/homes/[id]/share.tsx:76-82`.
    public var message: String {
        let opener = guestName.isEmpty ? "Here's" : "Hi \(guestName), here's"
        return "\(opener) your guest access to our home: \(urlString)"
    }

    /// Items handed to `UIActivityViewController`.
    public var activityItems: [Any] {
        var items: [Any] = [message]
        if let url { items.append(url) }
        return items
    }
}
