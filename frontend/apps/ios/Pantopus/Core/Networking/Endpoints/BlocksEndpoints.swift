//
//  BlocksEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/blocks.js`. The router is mounted
//  at `/api/users` (see `backend/app.js:305`) so routes are
//  `/api/users/:userId/block` and `/api/users/blocked`.
//

import Foundation

/// Endpoints under `/api/users/*/block` and `/api/users/blocked`.
public enum BlocksEndpoints {
    /// `POST /api/users/:userId/block` — block another user.
    /// Route `backend/routes/blocks.js:13`.
    public static func block(userId: String, reason: String? = nil) -> Endpoint {
        if let reason {
            return Endpoint(
                method: .post,
                path: "/api/users/\(userId)/block",
                body: BlockUserBody(reason: reason)
            )
        }
        return Endpoint(method: .post, path: "/api/users/\(userId)/block")
    }

    /// `DELETE /api/users/:userId/block` — unblock a user.
    /// Route `backend/routes/blocks.js:101`.
    public static func unblock(userId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/users/\(userId)/block")
    }
}

/// `POST /api/users/:userId/block` body. `reason` is optional.
private struct BlockUserBody: Encodable {
    let reason: String?
}
