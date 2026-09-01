//
//  PersonaEditEndpoints.swift
//  Pantopus
//
//  Beacon (persona) create + edit. Kept separate from
//  `AudienceProfileEndpoints` (the read-side owner dashboard) so the
//  write path owns its own body types.
//
//  The whole persona router is feature-gated behind `isPersonaEnabled()`
//  in `backend/app.js:359`; every route below 404s when the flag is off.
//

import Foundation

public enum PersonaEditEndpoints {
    /// `POST /api/personas` — create the signed-in user's Beacon. 201 →
    /// `{ persona, channel }`. 400 when the account already has an active
    /// Beacon, 409 when the handle is taken.
    /// Route `backend/routes/personas.js:271`.
    public static func create(_ body: PersonaWriteBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/personas", body: body)
    }

    /// `PATCH /api/personas/:id` — update an owned Beacon. 200 →
    /// `{ persona }`. 403 when the caller doesn't own it, 409 on a handle
    /// conflict. Route `backend/routes/personas.js:850`.
    public static func update(personaId: String, body: PersonaWriteBody) -> Endpoint {
        Endpoint(method: .patch, path: "/api/personas/\(personaId)", body: body)
    }

    /// `GET /api/personas/compliance/categories` — the category policy
    /// ladder (which categories are selectable, which are gated behind
    /// credential verification). Route `backend/routes/personas.js:404`.
    public static let categories = Endpoint(
        method: .get,
        path: "/api/personas/compliance/categories"
    )
}
