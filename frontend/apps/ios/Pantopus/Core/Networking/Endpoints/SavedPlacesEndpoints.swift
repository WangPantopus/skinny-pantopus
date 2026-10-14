//
//  SavedPlacesEndpoints.swift
//  Pantopus
//
//  Saved places and their owner-scoped public Today information.
//

import Foundation

public enum SavedPlacesEndpoints {
    /// `GET /api/saved-places` — the signed-in user's saved places, newest
    /// first (`order created_at desc`). Route `backend/routes/savedPlaces.js:8`.
    public static func list() -> Endpoint {
        Endpoint(method: .get, path: "/api/saved-places")
    }

    public static func today(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/saved-places/\(id)/today")
    }

    /// `GET /api/saved-places/:id/preview` — the public address preview for
    /// the saved point itself (its stored coordinates; a label can be a name
    /// that geocodes elsewhere). Same shape as `GET /api/public/place`.
    /// Route `backend/routes/savedPlaces.js:54`.
    public static func preview(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/saved-places/\(id)/preview")
    }

    /// `POST /api/saved-places` — upsert a saved place on
    /// `(user, latitude, longitude)`. `label`, `latitude`, `longitude` are
    /// required; `placeType` defaults to `searched`. Returns `201` with the
    /// upserted row. Route `backend/routes/savedPlaces.js:25`.
    public static func save(_ body: SavePlaceBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/saved-places", body: body)
    }

    /// `DELETE /api/saved-places/:id` — remove one saved place (scoped to the
    /// caller). Route `backend/routes/savedPlaces.js:64`.
    public static func remove(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/saved-places/\(id)")
    }
}
