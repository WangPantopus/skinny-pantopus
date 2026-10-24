//
//  ChatEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/chats.js`. Mounted at
//  `/api/chat` (see `backend/app.js:325`).
//

import Foundation

/// Endpoints under `/api/chat/*` consumed by the Chat List + Chat
/// Conversation screens (T2.1 / T2.2).
public enum ChatEndpoints {
    /// `GET /api/chat/unified-conversations` — person-grouped chat list.
    /// Route `backend/routes/chats.js:2211`.
    public static func unifiedConversations(limit: Int = 100, before: String? = nil, query text: String? = nil) -> Endpoint {
        var query = ["limit": String(limit)]
        if let before { query["before"] = before }
        if let text { query["q"] = text }
        return Endpoint(
            method: .get,
            path: "/api/chat/unified-conversations",
            query: query
        )
    }

    public static func setPreferences(
        conversationId: String, isRoom: Bool, notificationsEnabled: Bool
    ) -> Endpoint {
        let collection = isRoom ? "rooms" : "conversations"
        return Endpoint(
            method: .patch,
            path: "/api/chat/\(collection)/\(conversationId)/preferences",
            body: ["notificationsEnabled": notificationsEnabled]
        )
    }

    /// `GET /api/chat/rooms/:roomId` — the room's type and participants,
    /// for participants only. A chat link carries only the room id; this
    /// tells a direct room's other person apart.
    public static func room(roomId: String, asBusinessUserId: String? = nil) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/chat/rooms/\(roomId)",
            query: asBusinessUserId.map { ["asBusinessUserId": $0] } ?? [:]
        )
    }

    /// `GET /api/chat/stats` — lightweight badge counts.
    /// Route `backend/routes/chats.js:2140`.
    public static func stats() -> Endpoint {
        Endpoint(method: .get, path: "/api/chat/stats")
    }

    /// `GET /api/chat/rooms/:roomId/messages` — paginated room thread.
    /// Route `backend/routes/chats.js:1340`.
    public static func roomMessages(
        roomId: String,
        limit: Int = 60,
        before: String? = nil,
        after: String? = nil,
        asBusinessUserId: String? = nil
    ) -> Endpoint {
        var query: [String: String] = ["limit": String(limit), "sync": "true"]
        if let before { query["before"] = before }
        if let after { query["after"] = after }
        if let asBusinessUserId { query["asBusinessUserId"] = asBusinessUserId }
        return Endpoint(
            method: .get,
            path: "/api/chat/rooms/\(roomId)/messages",
            query: query,
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `GET /api/chat/conversations/:otherUserId/messages` — paginated
    /// person-grouped thread. Route `backend/routes/chats.js:1157`.
    public static func conversationMessages(
        otherUserId: String,
        limit: Int = 60,
        before: String? = nil,
        after: String? = nil,
        topicId: String? = nil
    ) -> Endpoint {
        var query: [String: String] = ["limit": String(limit), "sync": "true"]
        if let before { query["before"] = before }
        if let after { query["after"] = after }
        if let topicId { query["topicId"] = topicId }
        return Endpoint(
            method: .get,
            path: "/api/chat/conversations/\(otherUserId)/messages",
            query: query,
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// Keep per-room cursors in the POST body, including large person threads.
    public static func changes(
        conversationId: String,
        isRoom: Bool,
        cursor: [String: Int64],
        until: [String: Int64]?,
        asBusinessUserId: String? = nil,
        readMessageIds: [String]? = nil
    ) -> Endpoint {
        let collection = isRoom ? "rooms" : "conversations"
        return Endpoint(
            method: .post,
            path: "/api/chat/\(collection)/\(conversationId)/changes",
            body: ChatChangesBody(cursor: cursor, until: until, asBusinessUserId: asBusinessUserId, readMessageIds: readMessageIds),
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    public static func search(query text: String, before: String? = nil) -> Endpoint {
        var query = ["q": text, "limit": "50"]
        if let before { query["before"] = before }
        return Endpoint(method: .get, path: "/api/chat/search", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    public static func messageContext(
        conversationId: String,
        isRoom: Bool,
        messageId: String,
        asBusinessUserId: String? = nil
    ) -> Endpoint {
        let collection = isRoom ? "rooms" : "conversations"
        var query = ["limit": "25"]
        if let asBusinessUserId { query["asBusinessUserId"] = asBusinessUserId }
        return Endpoint(
            method: .get,
            path: "/api/chat/\(collection)/\(conversationId)/messages/\(messageId)/context",
            query: query,
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `POST /api/chat/direct` — find-or-create the 1:1 direct room
    /// with another user. Idempotent server-side
    /// (`get_or_create_direct_chat`), so safe to call before every
    /// first send in a person thread. Route `backend/routes/chats.js:871`.
    public static func createDirectChat(otherUserId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/chat/direct",
            body: CreateDirectChatBody(otherUserId: otherUserId)
        )
    }

    /// `POST /api/chat/messages` — send a message. Route
    /// `backend/routes/chats.js:1438`. `clientMessageId` is the
    /// optimistic id the mobile client minted; the server echoes it
    /// back so the UI can swap the temp row for the persisted one.
    public static func sendMessage(body: SendChatMessageBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/chat/messages", body: body)
    }

    /// `PUT /api/chat/messages/:messageId` — edit an owned message.
    /// Route `backend/routes/chats.js:1774`.
    public static func editMessage(id: String, body: EditChatMessageBody) -> Endpoint {
        Endpoint(method: .put, path: "/api/chat/messages/\(id)", body: body)
    }

    /// `DELETE /api/chat/messages/:messageId` — soft-delete an owned message.
    /// Route `backend/routes/chats.js:1850`.
    public static func deleteMessage(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/chat/messages/\(id)")
    }

    /// `POST /api/chat/messages/:id/react` — add (`reacted: true`) or
    /// remove (`reacted: false`) a single-character reaction on a message,
    /// so a retry keeps the asked-for state; without `reacted` the server
    /// toggles it. Route `backend/routes/chats.js:2558`.
    public static func reactToMessage(id: String, reaction: String, reacted: Bool? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/chat/messages/\(id)/react",
            body: ReactToChatMessageBody(reaction: reaction, reacted: reacted)
        )
    }

    /// `POST /api/chat/rooms/:roomId/read` — mark every message in the
    /// room as read for the current user. Route
    /// `backend/routes/chats.js:1953`.
    public static func markRoomRead(roomId: String, asBusinessUserId: String? = nil, throughMessageId: String? = nil) -> Endpoint {
        var body: [String: String] = [:]
        if let asBusinessUserId { body["asBusinessUserId"] = asBusinessUserId }
        if let throughMessageId { body["throughMessageId"] = throughMessageId }
        return Endpoint(
            method: .post,
            path: "/api/chat/rooms/\(roomId)/read",
            body: body
        )
    }

    /// Mark only the explicitly viewed room boundaries in a person thread.
    /// Omitted rooms keep their unread state. The single cursor remains for
    /// callers speaking the older protocol.
    public static func markConversationRead(
        otherUserId: String,
        throughMessageId: String? = nil,
        throughMessageIds: [String: String]? = nil
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/chat/conversations/\(otherUserId)/read",
            body: ChatReadBoundariesBody(throughMessageId: throughMessageId, throughMessageIds: throughMessageIds)
        )
    }

    /// A distinct route prevents an older server from treating a filtered
    /// boundary as a whole-conversation acknowledgement.
    public static func markTopicRead(
        conversationId: String,
        isRoom: Bool,
        topicId: String,
        throughMessageIds: [String: String],
        asBusinessUserId: String? = nil
    ) -> Endpoint {
        let collection = isRoom ? "rooms" : "conversations"
        return Endpoint(
            method: .post,
            path: "/api/chat/\(collection)/\(conversationId)/topics/\(topicId)/read",
            body: ChatReadBoundariesBody(
                throughMessageId: nil, throughMessageIds: throughMessageIds, asBusinessUserId: asBusinessUserId
            )
        )
    }

    /// `GET /api/chat/conversations/:otherUserId/topics` — list topic chips.
    /// Route `backend/routes/chats.js:2466`.
    public static func conversationTopics(otherUserId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/chat/conversations/\(otherUserId)/topics")
    }

    /// `POST /api/chat/conversations/:otherUserId/topics` — find or create
    /// a task/listing/general topic for a person-pair conversation.
    /// Route `backend/routes/chats.js:2398`.
    public static func findOrCreateTopic(otherUserId: String, body: FindOrCreateTopicBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/chat/conversations/\(otherUserId)/topics", body: body)
    }
}

private struct ChatChangesBody: Encodable {
    let cursor: [String: Int64]
    let until: [String: Int64]?
    let asBusinessUserId: String?
    let readMessageIds: [String]?
    let limit = 200
}

/// `POST /api/chat/direct` body. Matches the Joi validator at
/// `backend/routes/chats.js:135`.
public struct CreateDirectChatBody: Encodable, Sendable {
    public let otherUserId: String

    public init(otherUserId: String) {
        self.otherUserId = otherUserId
    }
}

/// `POST /api/chat/messages` body. Matches the Joi validator at
/// `backend/routes/chats.js:146`.
public struct SendChatMessageBody: Encodable, Sendable {
    public let roomId: String
    public let messageText: String?
    public let messageType: String
    public let fileIds: [String]?
    public let clientMessageId: String?
    public let replyToId: String?
    public let topicId: String?
    public let metadata: [String: JSONValue]?
    public let asBusinessUserId: String?

    public init(
        roomId: String,
        messageText: String?,
        messageType: String = "text",
        fileIds: [String]? = nil,
        clientMessageId: String? = nil,
        replyToId: String? = nil,
        topicId: String? = nil,
        metadata: [String: JSONValue]? = nil,
        asBusinessUserId: String? = nil
    ) {
        self.roomId = roomId
        self.messageText = messageText
        self.messageType = messageType
        self.fileIds = fileIds
        self.clientMessageId = clientMessageId
        self.replyToId = replyToId
        self.topicId = topicId
        self.metadata = metadata
        self.asBusinessUserId = asBusinessUserId
    }
}

public struct FindOrCreateTopicBody: Encodable, Sendable {
    public let topicType: String
    public let topicRefId: String?
    public let title: String

    public init(topicType: String, topicRefId: String? = nil, title: String) {
        self.topicType = topicType
        self.topicRefId = topicRefId
        self.title = title
    }
}

/// `POST /api/chat/messages/:id/react` body. A nil `reacted` is left out
/// of the JSON.
public struct ReactToChatMessageBody: Encodable, Sendable {
    public let reaction: String
    public let reacted: Bool?

    public init(reaction: String, reacted: Bool? = nil) {
        self.reaction = reaction
        self.reacted = reacted
    }
}

public struct EditChatMessageBody: Encodable, Sendable {
    public let messageText: String

    public init(messageText: String) {
        self.messageText = messageText
    }
}

private struct ChatReadBoundariesBody: Encodable {
    let throughMessageId: String?
    let throughMessageIds: [String: String]?
    var asBusinessUserId: String?
}
