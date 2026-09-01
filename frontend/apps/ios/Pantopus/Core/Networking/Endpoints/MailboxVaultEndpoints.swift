//
//  MailboxVaultEndpoints.swift
//  Pantopus
//
//  T6.5e (P19.5) — Endpoint builders for the Mailbox Vault routes in
//  `backend/routes/mailboxV2Phase2.js`. The phase-2 routes are mounted
//  at `/api/mailbox/v2/p2` (see `backend/app.js:314`).
//

import Foundation

public enum MailboxVaultEndpoints {
    /// `GET /api/mailbox/v2/p2/vault/folders` — route
    /// `backend/routes/mailboxV2Phase2.js:952`. Returns the user's
    /// vault folders, optionally filtered by drawer
    /// (`personal` / `home` / `business`).
    public static func folders(drawer: String? = "personal") -> Endpoint {
        var query: [String: String] = [:]
        if let drawer { query["drawer"] = drawer }
        return Endpoint(method: .get, path: "/api/mailbox/v2/p2/vault/folders", query: query)
    }

    /// `POST /api/mailbox/v2/p2/vault/folder` — route
    /// `backend/routes/mailboxV2Phase2.js:983`. Creates a custom
    /// vault folder under the supplied drawer.
    public static func createFolder(body: CreateVaultFolderBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/p2/vault/folder", body: body)
    }

    /// `GET /api/mailbox/v2/p2/vault/folder/:folderId/items` — route
    /// `backend/routes/mailboxV2Phase2.js:1033`. Returns the mail
    /// items filed under the supplied folder.
    public static func folderItems(folderId: String, limit: Int = 50, offset: Int = 0) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/mailbox/v2/p2/vault/folder/\(folderId)/items",
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }

    /// `POST /api/mailbox/v2/p2/vault/file` — route
    /// `backend/routes/mailboxV2Phase2.js:1054`. Files a single
    /// mail item to a vault folder ("Save to vault").
    public static func file(body: FileToVaultBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/p2/vault/file", body: body)
    }

    /// `GET /api/mailbox/v2/p2/vault/search` — route
    /// `backend/routes/mailboxV2Phase2.js:1145`. Searches the whole
    /// archive server-side: sender / subject / content by default, plus
    /// two special forms the handler sniffs — an amount (`$87`, `$87.00`)
    /// and a month (`March 2025`). Passing `drawer: nil` searches every
    /// drawer, which is what the Vault search field does.
    public static func search(
        query: String,
        drawer: String? = nil,
        folderId: String? = nil,
        limit: Int = 20,
        offset: Int = 0
    ) -> Endpoint {
        var params: [String: String] = [
            "q": query,
            "limit": String(limit),
            "offset": String(offset)
        ]
        if let drawer { params["drawer"] = drawer }
        if let folderId { params["folderId"] = folderId }
        return Endpoint(method: .get, path: "/api/mailbox/v2/p2/vault/search", query: params)
    }
}

public struct CreateVaultFolderBody: Encodable, Sendable {
    public let drawer: String
    public let label: String
    public let icon: String?
    public let color: String?

    public init(drawer: String, label: String, icon: String? = nil, color: String? = nil) {
        self.drawer = drawer
        self.label = label
        self.icon = icon
        self.color = color
    }
}

public struct FileToVaultBody: Encodable, Sendable {
    public let mailId: String
    public let folderId: String

    public init(mailId: String, folderId: String) {
        self.mailId = mailId
        self.folderId = folderId
    }
}
