//
//  BroadcastReadEndpoints.swift
//  Pantopus
//
//  Broadcast read receipts. RN marks a broadcast read as soon as it is
//  rendered on the public Beacon profile
//  (`src/app/persona/[personaHandle]/index.tsx:63-72`); the increment is what
//  feeds the creator's read-count analytics on the broadcast timeline.
//

import Foundation

public enum BroadcastReadEndpoints {
    /// `POST /api/broadcast/messages/:messageId/read` — increment the
    /// broadcast's `read_count` for the calling viewer. The owner's own
    /// reads are ignored server-side; blocked or under-tier viewers get
    /// 403. Route `backend/routes/broadcastChannels.js:602`; mounted at
    /// `/api/broadcast` (`backend/app.js:383`).
    public static func markRead(messageId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/broadcast/messages/\(messageId)/read"
        )
    }
}
