//
//  PulseEndpoints.swift
//  Pantopus
//
//  The Pulse routes under `/api/pulse` (`backend/routes/pulse.js`,
//  docs/product/pulse-build/02-contract.md). Requests are camelCase,
//  responses snake_case.
//

import Foundation

/// Endpoints of the Pulse build's own routes.
public enum PulseEndpoints {
    /// `POST /api/pulse/posts/:postId/keep-open` — the asker keeps an open Ask
    /// open 7 more days, once (contract §2.12). Route `backend/routes/pulse.js:98`.
    public static func keepAskOpen(postId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/keep-open")
    }

    /// `POST /api/pulse/posts/:postId/close` — the asker closes an open Ask:
    /// `closed`, or `closed_unanswered` when nobody else replied (contract
    /// §2.12). Route `backend/routes/pulse.js:142`.
    public static func closeAsk(postId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/close")
    }
}
