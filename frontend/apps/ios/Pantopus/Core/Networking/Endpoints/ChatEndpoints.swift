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
    public static func unifiedConversations(limit: Int = 100) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/chat/unified-conversations",
            query: ["limit": String(limit)]
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
        after: String? = nil
    ) -> Endpoint {
        var query: [String: String] = ["limit": String(limit)]
        if let before { query["before"] = before }
        if let after { query["after"] = after }
        return Endpoint(method: .get, path: "/api/chat/rooms/\(roomId)/messages", query: query)
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
        var query: [String: String] = ["limit": String(limit)]
        if let before { query["before"] = before }
        if let after { query["after"] = after }
        if let topicId { query["topicId"] = topicId }
        return Endpoint(method: .get, path: "/api/chat/conversations/\(otherUserId)/messages", query: query)
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

    /// `POST /api/chat/messages/:id/react` — toggle a single-character
    /// reaction on a message. Route `backend/routes/chats.js:2558`.
    public static func reactToMessage(id: String, reaction: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/chat/messages/\(id)/react",
            body: ReactToChatMessageBody(reaction: reaction)
        )
    }

    /// `POST /api/chat/rooms/:roomId/read` — mark every message in the
    /// room as read for the current user. Route
    /// `backend/routes/chats.js:1953`.
    public static func markRoomRead(roomId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/chat/rooms/\(roomId)/read")
    }

    /// `POST /api/chat/conversations/:otherUserId/read` — mark every
    /// shared-room message read for a person-grouped thread. Route
    /// `backend/routes/chats.js:1265`.
    public static func markConversationRead(otherUserId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/chat/conversations/\(otherUserId)/read")
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

    public init(
        roomId: String,
        messageText: String?,
        messageType: String = "text",
        fileIds: [String]? = nil,
        clientMessageId: String? = nil,
        replyToId: String? = nil,
        topicId: String? = nil,
        metadata: [String: JSONValue]? = nil
    ) {
        self.roomId = roomId
        self.messageText = messageText
        self.messageType = messageType
        self.fileIds = fileIds
        self.clientMessageId = clientMessageId
        self.replyToId = replyToId
        self.topicId = topicId
        self.metadata = metadata
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

/// `POST /api/chat/messages/:id/react` body.
public struct ReactToChatMessageBody: Encodable, Sendable {
    public let reaction: String

    public init(reaction: String) {
        self.reaction = reaction
    }
}

public struct EditChatMessageBody: Encodable, Sendable {
    public let messageText: String

    public init(messageText: String) {
        self.messageText = messageText
    }
}
