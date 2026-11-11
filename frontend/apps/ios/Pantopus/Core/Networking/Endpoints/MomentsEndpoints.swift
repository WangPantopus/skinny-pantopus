//
//  MomentsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the Moments API, `backend/routes/moments.js`
//  (contract `~/pantopus-moments/coord/CONTRACT.md`). Every route needs a
//  signed-in user and answers 404 `MOMENTS_UNAVAILABLE` while the `moments`
//  flag is off for the caller. The media upload is multipart, through a
//  background session (`MomentsBackgroundUpload`).
//

import Foundation

public enum MomentsEndpoints {
    /// The server feature flag the tab follows (`GET /api/feature-flags/moments`).
    public static let flagName = "moments"

    /// `POST /api/moments/place-preview` — the place a pin here reads as for
    /// others, whether it is the caller's home, and whether the 18+
    /// confirmation is on file. Route `backend/routes/moments.js` (place-preview).
    public static func placePreview(latitude: Double, longitude: Double) -> Endpoint {
        Endpoint(method: .post, path: "/api/moments/place-preview", body: MomentsPlacePreviewBody(latitude: latitude, longitude: longitude))
    }

    /// `POST /api/moments/place-preview` with no point (location off, contract v3.4): only the 18+ state and
    /// `has_connections`. Route `backend/routes/moments.js` (place-preview).
    public static let postingPreview = Endpoint(method: .post, path: "/api/moments/place-preview", body: MomentsEmptyBody())

    /// `POST /api/moments/adult-confirm` — the one-time "I'm 18 or older"
    /// (shared with Pulse's). Route `backend/routes/moments.js` (adult-confirm).
    public static let adultConfirm = Endpoint(method: .post, path: "/api/moments/adult-confirm")

    /// `POST /api/moments` — a new Moment; photos and videos start `uploading`.
    /// Route `backend/routes/moments.js` (create).
    public static func create(_ body: MomentCreateBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/moments", body: body)
    }

    /// `GET /api/moments/map` — the rings in a box, newest first.
    /// Route `backend/routes/moments.js` (map).
    public static func map(south: Double, west: Double, north: Double, east: Double, zoom: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/moments/map",
            query: [
                "south": coordinate(south),
                "west": coordinate(west),
                "north": coordinate(north),
                "east": coordinate(east),
                "zoom": String(zoom)
            ],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `GET /api/moments/unseen` (contract v3) — how many people have a live Moment in the box that the
    /// caller may see and hasn't watched, new since `since`; for the tab's dot. Never the caller's own.
    /// Route `backend/routes/moments.js` (unseen).
    public static func unseen(south: Double, west: Double, north: Double, east: Double, since: Date?) -> Endpoint {
        var query = [
            "south": coordinate(south),
            "west": coordinate(west),
            "north": coordinate(north),
            "east": coordinate(east),
            // This app shows Moments with no location (in the strip), so they light the dot too (contract v3.4).
            "include_unplaced": "true"
        ]
        if let since { query["since"] = ISO8601DateFormatter().string(from: since) }
        return Endpoint(method: .get, path: "/api/moments/unseen", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `GET /api/moments/mine` — the caller's own unexpired Moments, in any state.
    /// Route `backend/routes/moments.js` (mine).
    public static let mine = Endpoint(method: .get, path: "/api/moments/mine", cachePolicy: .reloadIgnoringLocalCacheData)

    /// `GET /api/moments/:id` — 410 `MOMENT_ENDED` once it has ended.
    /// Route `backend/routes/moments.js` (detail).
    public static func moment(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/moments/\(segment(id))", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `POST /api/moments/:id/view` — counted once per person; the author's own don't count.
    /// Route `backend/routes/moments.js` (view).
    public static func view(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/moments/\(segment(id))/view")
    }

    /// `GET /api/moments/:id/viewers` — Seen by, for the author.
    /// Route `backend/routes/moments.js` (viewers).
    public static func viewers(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/moments/\(segment(id))/viewers", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `PUT /api/moments/:id/reaction` — `{emoji}`, or `{emoji: null}` to take it back.
    /// Route `backend/routes/moments.js` (reaction).
    public static func react(id: String, emoji: String?) -> Endpoint {
        Endpoint(method: .put, path: "/api/moments/\(segment(id))/reaction", body: MomentsReactionBody(emoji: emoji))
    }

    /// `POST /api/moments/:id/reply` — a direct chat message to the author with the Moment quoted.
    /// Route `backend/routes/moments.js` (reply).
    public static func reply(id: String, text: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/moments/\(segment(id))/reply", body: MomentsReplyBody(text: text))
    }

    /// `DELETE /api/moments/:id` — the author's; its files go too.
    /// Route `backend/routes/moments.js` (delete).
    public static func delete(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/moments/\(segment(id))")
    }

    /// `POST /api/moments/:id/report` — the post report reasons; two people hold it for review.
    /// Route `backend/routes/moments.js` (report).
    public static func report(id: String, reason: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/moments/\(segment(id))/report", body: MomentsReportBody(reason: reason))
    }

    /// `PUT /api/moments/authors/:userId/mute` — hide this person's Moments.
    /// Route `backend/routes/moments.js` (mute).
    public static func mute(authorId: String) -> Endpoint {
        Endpoint(method: .put, path: "/api/moments/authors/\(segment(authorId))/mute")
    }

    /// `DELETE /api/moments/authors/:userId/mute` — show this person's Moments again (the Undo).
    /// Route `backend/routes/moments.js` (mute).
    public static func unmute(authorId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/moments/authors/\(segment(authorId))/mute")
    }

    /// An id as exactly one path segment (`APIClient` percent-encodes the rest).
    private static func segment(_ value: String) -> String {
        Endpoint.pathSegment(value)
    }

    private static func coordinate(_ value: Double) -> String {
        String(format: "%.5f", value)
    }
}

private struct MomentsPlacePreviewBody: Encodable {
    let latitude: Double
    let longitude: Double
}

private struct MomentsEmptyBody: Encodable {}

private struct MomentsReactionBody: Encodable {
    let emoji: String?

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        // `null` takes the reaction back, so the key is always sent.
        try c.encode(emoji, forKey: .emoji)
    }

    private enum CodingKeys: String, CodingKey {
        case emoji
    }
}

private struct MomentsReplyBody: Encodable {
    let text: String
}

private struct MomentsReportBody: Encodable {
    let reason: String
}
