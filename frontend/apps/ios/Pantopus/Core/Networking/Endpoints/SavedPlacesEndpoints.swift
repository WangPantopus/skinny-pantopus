//
//  SavedPlacesEndpoints.swift
//  Pantopus
//
//  BLOCK 2E — "Saved places". The three routes already exist on the backend
//  (mounted at `/api/saved-places` in `backend/app.js:389`); this screen does
//  not add or change any server behaviour.
//

import Foundation

public enum SavedPlacesEndpoints {
    /// `GET /api/saved-places` — the signed-in user's saved places, newest
    /// first (`order created_at desc`). Route `backend/routes/savedPlaces.js:8`.
    public static func list() -> Endpoint {
        Endpoint(method: .get, path: "/api/saved-places")
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
