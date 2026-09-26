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
/// in the message opener), the composed viewer URL, and the owner's welcome
/// note (added to the message).
public struct GuestPassShare: Identifiable, Hashable, Sendable {
    public let id: String
    public let guestName: String
    public let urlString: String
    public let note: String

    public init(id: String, guestName: String, urlString: String, note: String = "") {
        self.id = id
        self.guestName = guestName
        self.urlString = urlString
        self.note = note
    }

    /// Public guest-viewer link for a raw create-response token (64 hex
    /// characters): the web app's `/guest/:token` page on this build's public
    /// web origin, like the other public-page links. `downloadURLString` is
    /// the app-download link, meant to become a store smart-link.
    public static func url(forToken token: String) -> String {
        InviteLinks.publicPageURLString(path: "/guest/\(token)")
    }

    public var url: URL? {
        URL(string: urlString)
    }

    /// RN parity — `src/app/homes/[id]/share.tsx:76-82`.
    public var message: String {
        let opener = guestName.isEmpty ? "Here's" : "Hi \(guestName), here's"
        let base = "\(opener) your guest access to our home: \(urlString)"
        return note.isEmpty ? base : "\(base)\n\n\(note)"
    }

    /// Items handed to `UIActivityViewController`.
    public var activityItems: [Any] {
        var items: [Any] = [message]
        if let url { items.append(url) }
        return items
    }
}
