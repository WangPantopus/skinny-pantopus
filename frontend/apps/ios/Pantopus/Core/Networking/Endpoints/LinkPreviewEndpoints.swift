//
//  LinkPreviewEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/linkPreview.js`. Mounted at
//  `/api/link-preview` (see `backend/app.js:489`).
//

import Foundation

public enum LinkPreviewEndpoints {
    /// `GET /api/link-preview?url=` — route `backend/routes/linkPreview.js:346`.
    /// The server reads the page, so the link's host never sees the
    /// viewer's device. Text only: no image is offered. A 502 means the
    /// linked page didn't load — routine, so it isn't reported as an error.
    public static func preview(url: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/link-preview",
            query: ["url": url],
            reportsServerErrors: false
        )
    }
}
