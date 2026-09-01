//
//  PostsMapEndpoints.swift
//  Pantopus
//
//  Endpoint builder for the multi-layer viewport marker route used by the
//  Pulse feed's map mode and by the Explore map's post / business / home
//  layers.
//

import Foundation

/// The layers `GET /api/posts/map` knows how to fan out. The backend
/// splits `layers` on comma and lower-cases each entry
/// (`backend/routes/posts.js:1670`); anything it doesn't recognise is
/// silently ignored.
public enum PostsMapLayer: String, Sendable, CaseIterable {
    /// Neighborhood posts — `backend/routes/posts.js:1677`.
    case posts
    /// Open / assigned / in-progress gigs — `backend/routes/posts.js:1715`.
    case tasks
    /// `gig_type = offer` rows — `backend/routes/posts.js:1749`.
    case offers
    /// Published business profiles — `backend/routes/posts.js:1783`.
    case businesses
    /// Homes with a resolvable point — `backend/routes/posts.js:1810`.
    case homes
}

/// Endpoint builders for the viewport marker route in
/// `backend/routes/posts.js`.
public enum PostsMapEndpoints {
    /// `GET /api/posts/map` — route `backend/routes/posts.js:1646`.
    ///
    /// The bounding box (`south` / `west` / `north` / `east`) is required —
    /// the handler 400s without all four. `layers` defaults to `posts`
    /// server-side; pass the full set to get the cross-type marker feed.
    /// `postType` and `surface` only narrow the `posts` layer.
    ///
    /// Response is `{ markers: [...], nearest_activity_center: {...}|null }`
    /// where each marker carries a `layer_type` discriminator and a
    /// per-layer field set.
    public static func markers(
        south: Double,
        west: Double,
        north: Double,
        east: Double,
        layers: [PostsMapLayer] = [.posts],
        postType: String? = nil,
        surface: String? = nil,
        limit: Int = 200
    ) -> Endpoint {
        var query: [String: String] = [
            "south": String(south),
            "west": String(west),
            "north": String(north),
            "east": String(east),
            "limit": String(limit)
        ]
        if !layers.isEmpty {
            query["layers"] = layers.map(\.rawValue).joined(separator: ",")
        }
        if let postType, !postType.isEmpty { query["postType"] = postType }
        if let surface, !surface.isEmpty { query["surface"] = surface }
        return Endpoint(method: .get, path: "/api/posts/map", query: query)
    }
}
