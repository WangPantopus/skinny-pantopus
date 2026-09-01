//
//  RecordWatchEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/homeRecordWatch.js` (mounted
//  under `/api/homes`) — Home Record Watch's rate-watch half: the
//  loan-month baseline held against Freddie Mac's weekly PMMS average.
//  Watches are personal per home+user.
//

import Foundation

public enum RecordWatchEndpoints {
    /// `PUT /api/homes/:id/record-watch` — route
    /// `backend/routes/homeRecordWatch.js:27`. Set or replace
    /// (verified T4 occupants only).
    public static func set(homeId: String, request: SetRecordWatchRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/homes/\(homeId)/record-watch", body: request)
    }

    /// `GET /api/homes/:id/record-watch` — route
    /// `backend/routes/homeRecordWatch.js:61`. The caller's watch with
    /// a live evaluation, or `{"watch": null}`.
    public static func get(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/record-watch")
    }

    /// `DELETE /api/homes/:id/record-watch` — route
    /// `backend/routes/homeRecordWatch.js:79`.
    public static func delete(homeId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/homes/\(homeId)/record-watch")
    }
}
