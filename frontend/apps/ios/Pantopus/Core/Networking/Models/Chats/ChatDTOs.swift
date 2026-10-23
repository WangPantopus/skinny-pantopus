//
//  ChatDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/chat/unified-conversations`, `/stats`, and the
//  socket payloads `badge:update` and `message:new`.
//
//  The unified-conversations response is a hetero union — each row is
//  either a person-grouped `conversation` (merging direct + gig rooms
//  by other participant) or a `room` (group / home). We decode both
//  variants into a single `UnifiedConversation` value with a `kind`
//  discriminator.
//

import Foundation

// swiftlint:disable file_length

// MARK: - Unified conversations

/// One entry in the unified conversations list. The backend tags rows
/// with `_type: "conversation" | "room"`; we map both into one struct
/// so the view can render either with a `ConversationRow`.
public struct UnifiedConversation: Decodable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Sendable, Hashable {
        case conversation, room
    }

    public let kind: Kind
    /// Stable id — for `.conversation` rows, the other participant id;
    /// for `.room` rows, the room id.
    public let id: String
    /// For `.room` rows: `group` | `home`. `nil` for `.conversation`.
    public let roomType: String?
    /// For `.room` rows: associated gig id when the room is gig-typed.
    public let gigId: String?
    /// For `.room` rows: associated home id when the room is home-typed.
    public let homeId: String?
    /// Display name. For `.conversation`, the other participant's name;
    /// for `.room`, the room name.
    public let name: String?
    public let avatarURL: String?
    /// Last-message preview text — may be `nil` for empty rooms.
    public let lastMessagePreview: String?
    /// ISO8601 timestamp of the last message in the conversation, if any.
    public let lastMessageAt: String?
    /// Aggregate unread across all rooms in this conversation.
    public let totalUnread: Int
    /// Topic tags attached to a person-conversation. `topic_type`
    /// values include `gig` and `marketplace`; we project them into
    /// `topicKinds` for filtering.
    public let topicKinds: [String]
    public let topics: [ConversationTopicDTO]
    /// Identity disclosure — sourced from the conversation row's
    /// `other_participant_identity.identity_kind` (`personal` /
    /// `home` / `business`). `nil` for `.room` entries.
    public let identityKind: String?
    /// Whether the other participant is verified (for `.conversation`
    /// rows). The identity serializer reports it as a `verified_resident`
    /// badge (hidden when the person turns the badge off); an explicit
    /// `verified` flag wins when present. `nil` for rooms.
    public let isVerified: Bool?

    private enum RootKeys: String, CodingKey {
        case type = "_type"
        // .conversation keys
        case otherParticipantId = "other_participant_id"
        case otherParticipantName = "other_participant_name"
        case otherParticipantAvatar = "other_participant_avatar"
        case otherParticipantIdentity = "other_participant_identity"
        case totalUnread = "total_unread"
        case lastMessageAt = "last_message_at"
        case lastMessagePreview = "last_message_preview"
        case topics
        // .room keys
        case id, roomType = "room_type"
        case roomName = "room_name"
        case gigId = "gig_id"
        case homeId = "home_id"
    }

    private enum TopicKeys: String, CodingKey {
        case topicType = "topic_type"
    }

    private enum IdentityKeys: String, CodingKey {
        case identityKind = "identity_kind"
        case verified
        case badges
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: RootKeys.self)
        let rawType = try c.decodeIfPresent(String.self, forKey: .type) ?? "conversation"
        kind = Kind(rawValue: rawType) ?? .conversation
        totalUnread = try c.decodeIfPresent(Int.self, forKey: .totalUnread) ?? 0
        lastMessageAt = try c.decodeIfPresent(String.self, forKey: .lastMessageAt)
        lastMessagePreview = try c.decodeIfPresent(String.self, forKey: .lastMessagePreview)

        // Topics → kinds. Each topic object has a `topic_type`.
        if let topics = try? c.decode([[String: JSONValue]].self, forKey: .topics) {
            topicKinds = topics.compactMap { dict in
                if case let .string(value) = dict["topic_type"] ?? .null { return value }
                return nil
            }
        } else {
            topicKinds = []
        }
        topics = (try? c.decode([ConversationTopicDTO].self, forKey: .topics)) ?? []

        switch kind {
        case .conversation:
            id = try c.decode(String.self, forKey: .otherParticipantId)
            name = try c.decodeIfPresent(String.self, forKey: .otherParticipantName)
            avatarURL = try c.decodeIfPresent(String.self, forKey: .otherParticipantAvatar)
            roomType = nil
            gigId = nil
            homeId = nil
            // Identity is a nested object emitted by the local-identity
            // serializer. Decode only the keys we render.
            if let identityContainer = try? c.nestedContainer(
                keyedBy: IdentityKeys.self, forKey: .otherParticipantIdentity
            ) {
                identityKind = try identityContainer.decodeIfPresent(String.self, forKey: .identityKind)
                let badges = try? identityContainer.decodeIfPresent([String].self, forKey: .badges)
                isVerified = try identityContainer.decodeIfPresent(Bool.self, forKey: .verified)
                    ?? badges?.contains("verified_resident")
            } else {
                identityKind = nil
                isVerified = nil
            }
        case .room:
            id = try c.decode(String.self, forKey: .id)
            name = try c.decodeIfPresent(String.self, forKey: .roomName)
            avatarURL = nil
            roomType = try c.decodeIfPresent(String.self, forKey: .roomType)
            gigId = try c.decodeIfPresent(String.self, forKey: .gigId)
            homeId = try c.decodeIfPresent(String.self, forKey: .homeId)
            identityKind = nil
            isVerified = nil
        }
    }
}

/// `GET /api/chat/rooms/:roomId` — room availability and participants.
public struct ChatRoomDetailResponse: Decodable, Sendable {
    public struct Room: Decodable, Sendable {
        public let type: String?
        /// The room's name; a Support Train's room goes by the train's title.
        public let name: String?
        public let isActive: Bool?
        public let participants: [Participant]?

        private enum CodingKeys: String, CodingKey {
            case type, name, participants
            case isActive = "is_active"
        }
    }

    public struct Participant: Decodable, Sendable {
        public let userId: String?
        /// The local-identity projection (`serializeUserAsLocalIdentity`).
        public let user: Identity?

        private enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case user
        }
    }

    public struct Identity: Decodable, Sendable {
        public let displayName: String?
    }

    public let room: Room
}

public struct ConversationTopicDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let topicType: String
    public let topicRefId: String?
    public let title: String
    public let status: String?
    public let lastActivityAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case topicType = "topic_type"
        case topicRefId = "topic_ref_id"
        case title
        case status
        case lastActivityAt = "last_activity_at"
    }
}

public struct ConversationTopicsResponse: Decodable, Sendable, Hashable {
    public let topics: [ConversationTopicDTO]
}

public struct FindOrCreateTopicResponse: Decodable, Sendable, Hashable {
    public let topic: ConversationTopicDTO
    public let created: Bool
}

/// `GET /api/chat/unified-conversations` envelope.
public struct UnifiedConversationsResponse: Decodable, Sendable, Hashable {
    public let conversations: [UnifiedConversation]
    public let total: Int?
    public let totalUnread: Int?

    private enum CodingKeys: String, CodingKey {
        case conversations, total, totalUnread
    }
}

// MARK: - Stats

/// `GET /api/chat/stats` envelope.
public struct ChatStatsResponse: Decodable, Sendable, Hashable {
    public let stats: Stats

    public struct Stats: Decodable, Sendable, Hashable {
        public let totalUnread: Int
        public let totalChats: Int?
        public let totalMessages: Int?
        public let directChats: Int?
        public let gigChats: Int?
        public let homeChats: Int?

        private enum CodingKeys: String, CodingKey {
            case totalUnread = "total_unread"
            case totalChats = "total_chats"
            case totalMessages = "total_messages"
            case directChats = "direct_chats"
            case gigChats = "gig_chats"
            case homeChats = "home_chats"
        }
    }
}

// MARK: - Socket payloads

// `SocketClient` enables `keyDecodingStrategy = .convertFromSnakeCase`,
// so these payloads omit explicit CodingKeys — property names already
// match the converted form (`total_unread` → `totalUnread`, etc.).

/// `badge:update` socket event payload.
public struct ChatBadgeUpdate: Decodable, Sendable, Hashable {
    public let totalUnread: Int

    private enum CodingKeys: String, CodingKey {
        case totalUnread
        case unreadMessages
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalUnread = try c.decodeIfPresent(Int.self, forKey: .totalUnread)
            ?? c.decodeIfPresent(Int.self, forKey: .unreadMessages)
            ?? 0
    }
}

/// `message:new` socket event payload — just the fields the chat list
/// needs to update a row. The full message envelope decoded by the
/// conversation screen is richer; we only consume the room reference +
/// preview here.
public struct ChatMessageEvent: Decodable, Sendable, Hashable {
    public let id: String?
    public let roomId: String
    public let otherUserId: String?
    public let preview: String?
    public let createdAt: String?
    public let unreadFor: Int?
}

// MARK: - Messages (T2.2)

/// One sender row inline on a `ChatMessageDTO`. Only the fields the
/// conversation view actually reads.
public struct ChatMessageSender: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePictureURL: String?
    /// The sender's public identity (`backend/serializers/identitySerializers.js`),
    /// which the messages routes send now; older servers send `name` and
    /// `username` instead.
    public let displayName: String?
    public let handle: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, displayName, handle
        case profilePictureURL = "profile_picture_url"
    }
}

/// One message row in a chat thread. Backed by the `ChatMessage` row
/// joined with its sender (`user_id` → `sender`).
public struct ChatMessageDTO: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let roomId: String
    public let userId: String?
    public private(set) var messageText: String?
    public let messageType: String
    public let metadata: JSONValue?
    public let replyToId: String?
    /// Conversation-topic the message was filed under (`topic_id`
    /// column — the serializer spreads all message columns). `nil` for
    /// general/untopiced messages.
    public let topicId: String?
    public let clientMessageId: String?
    public let createdAt: String
    public private(set) var editedAt: String?
    public let deletedAt: String?
    public let deliveredAt: String?
    public private(set) var readAt: String?
    public let sender: ChatMessageSender?
    public let reactions: [ChatReactionSummary]
    public let attachments: [ChatAttachmentDTO]
    /// The person who wrote a message sent as a business (`actor_user_id`). The
    /// server names that only to the writer, so it is set on the business's
    /// messages you wrote yourself and nil everywhere else.
    public let actorUserId: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case roomId = "room_id"
        case userId = "user_id"
        case messageText = "message_text"
        case message
        case messageType = "message_type"
        case type
        case metadata
        case replyToId = "reply_to_id"
        case topicId = "topic_id"
        case clientMessageId = "client_message_id"
        case createdAt = "created_at"
        case editedAt = "edited_at"
        case deletedAt = "deleted_at"
        case deliveredAt = "delivered_at"
        case readAt = "read_at"
        case sender
        case reactions
        case attachments
        case actorUserId = "actor_user_id"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        roomId = try c.decode(String.self, forKey: .roomId)
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
        messageText =
            try c.decodeIfPresent(String.self, forKey: .messageText)
                ?? c.decodeIfPresent(String.self, forKey: .message)
        messageType =
            try c.decodeIfPresent(String.self, forKey: .messageType)
                ?? c.decodeIfPresent(String.self, forKey: .type)
                ?? "text"
        metadata = try c.decodeIfPresent(JSONValue.self, forKey: .metadata)
        replyToId = try c.decodeIfPresent(String.self, forKey: .replyToId)
        topicId = try c.decodeIfPresent(String.self, forKey: .topicId)
        clientMessageId = try c.decodeIfPresent(String.self, forKey: .clientMessageId)
        createdAt = try c.decode(String.self, forKey: .createdAt)
        editedAt = try c.decodeIfPresent(String.self, forKey: .editedAt)
        deletedAt = try c.decodeIfPresent(String.self, forKey: .deletedAt)
        deliveredAt = try c.decodeIfPresent(String.self, forKey: .deliveredAt)
        readAt = try c.decodeIfPresent(String.self, forKey: .readAt)
        sender = try c.decodeIfPresent(ChatMessageSender.self, forKey: .sender)
        reactions = try c.decodeIfPresent([ChatReactionSummary].self, forKey: .reactions) ?? []
        attachments = try c.decodeIfPresent([ChatAttachmentDTO].self, forKey: .attachments) ?? []
        actorUserId = try c.decodeIfPresent(String.self, forKey: .actorUserId)
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(roomId, forKey: .roomId)
        try c.encodeIfPresent(userId, forKey: .userId)
        try c.encodeIfPresent(messageText, forKey: .messageText)
        try c.encode(messageType, forKey: .messageType)
        try c.encodeIfPresent(metadata, forKey: .metadata)
        try c.encodeIfPresent(replyToId, forKey: .replyToId)
        try c.encodeIfPresent(topicId, forKey: .topicId)
        try c.encodeIfPresent(clientMessageId, forKey: .clientMessageId)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(editedAt, forKey: .editedAt)
        try c.encodeIfPresent(deletedAt, forKey: .deletedAt)
        try c.encodeIfPresent(deliveredAt, forKey: .deliveredAt)
        try c.encodeIfPresent(readAt, forKey: .readAt)
        try c.encodeIfPresent(sender, forKey: .sender)
        try c.encode(reactions, forKey: .reactions)
        try c.encode(attachments, forKey: .attachments)
        try c.encodeIfPresent(actorUserId, forKey: .actorUserId)
    }

    /// Edit responses carry the changed text, not hydrated files or viewer reactions.
    public func applyingEdit(_ edited: ChatMessageDTO) -> ChatMessageDTO {
        var updated = self
        updated.messageText = edited.messageText
        updated.editedAt = edited.editedAt
        return updated
    }

    public func replacingReadAt(_ readAt: String) -> ChatMessageDTO {
        var updated = self
        updated.readAt = readAt
        return updated
    }

    public func replacingReactions(_ reactions: [ChatReactionSummary]) -> ChatMessageDTO {
        ChatMessageDTO(
            id: id,
            roomId: roomId,
            userId: userId,
            messageText: messageText,
            messageType: messageType,
            metadata: metadata,
            replyToId: replyToId,
            topicId: topicId,
            clientMessageId: clientMessageId,
            createdAt: createdAt,
            editedAt: editedAt,
            deletedAt: deletedAt,
            deliveredAt: deliveredAt,
            readAt: readAt,
            sender: sender,
            reactions: reactions,
            attachments: attachments,
            actorUserId: actorUserId
        )
    }

    public init(
        id: String,
        roomId: String,
        userId: String?,
        messageText: String?,
        messageType: String,
        metadata: JSONValue?,
        replyToId: String?,
        topicId: String? = nil,
        clientMessageId: String?,
        createdAt: String,
        editedAt: String?,
        deletedAt: String?,
        deliveredAt: String?,
        readAt: String?,
        sender: ChatMessageSender?,
        reactions: [ChatReactionSummary] = [],
        attachments: [ChatAttachmentDTO] = [],
        actorUserId: String? = nil
    ) {
        self.id = id
        self.roomId = roomId
        self.userId = userId
        self.messageText = messageText
        self.messageType = messageType
        self.metadata = metadata
        self.replyToId = replyToId
        self.topicId = topicId
        self.clientMessageId = clientMessageId
        self.createdAt = createdAt
        self.editedAt = editedAt
        self.deletedAt = deletedAt
        self.deliveredAt = deliveredAt
        self.readAt = readAt
        self.sender = sender
        self.reactions = reactions
        self.attachments = attachments
        self.actorUserId = actorUserId
    }
}

public struct ChatAttachmentDTO: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let fileURL: String?
    public let originalFilename: String?
    public let mimeType: String?
    public let fileSize: Int?
    public let fileType: String?
    public let liveVideoFileId: String?
    public let livePhotoFileId: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case fileURL = "file_url"
        case originalFilename = "original_filename"
        case mimeType = "mime_type"
        case fileSize = "file_size"
        case fileType = "file_type"
        case liveVideoFileId = "live_video_file_id"
        case livePhotoFileId = "live_photo_file_id"
    }
}

public struct ChatMediaUploadResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let media: [ChatAttachmentDTO]
}

public struct AIMediaUploadResponse: Decodable, Sendable, Hashable {
    public struct Image: Decodable, Sendable, Hashable {
        public let url: String
        public let key: String?
        public let name: String?
        public let mimeType: String?
        public let size: Int?

        private enum CodingKeys: String, CodingKey {
            case url, key, name, size
            case mimeType = "mime_type"
        }
    }

    public let message: String
    public let images: [Image]
}

public struct ChatReactionSummary: Codable, Sendable, Hashable, Identifiable {
    public var id: String {
        reaction
    }

    public let reaction: String
    public let count: Int
    public let reactedByMe: Bool
    public let users: [User]?

    public struct User: Codable, Sendable, Hashable {
        public let id: String
    }

    public init(reaction: String, count: Int, reactedByMe: Bool, users: [User]? = nil) {
        self.reaction = reaction
        self.count = count
        self.reactedByMe = reactedByMe
        self.users = users
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        reaction = try container.decode(String.self, forKey: .reaction)
        count = try container.decode(Int.self, forKey: .count)
        reactedByMe = try container.decodeIfPresent(Bool.self, forKey: .reactedByMe) ?? false
        users = try container.decodeIfPresent([User].self, forKey: .users)
    }

    public func includes(_ viewerId: String) -> Bool {
        users.map { $0.contains { $0.id == viewerId } } ?? reactedByMe
    }

    private enum CodingKeys: String, CodingKey {
        case reaction, count, users
        case reactedByMe = "reacted_by_me"
    }
}

/// `GET /api/chat/rooms/:roomId/messages` /
/// `GET /api/chat/conversations/:otherUserId/messages` envelope.
public struct ChatMessagesResponse: Decodable, Sendable, Hashable {
    public let messages: [ChatMessageDTO]
    public let hasMore: Bool?
    public let nextCursor: String?
    public let roomIds: [String]?
    /// Set when the conversation takes no messages from you: a direct chat
    /// with a draft or closed business (`code` NOT_PUBLISHED). Nil from
    /// older servers, which leave the key out.
    public var sendRefusal: ChatSendRefusal?

    private enum CodingKeys: String, CodingKey {
        case messages, hasMore, nextCursor, roomIds, sendRefusal
    }
}

/// Why a conversation takes no messages, as the server words it (`backend/routes/chats.js`
/// `unpublishedDirectRoomRefusal`).
public struct ChatSendRefusal: Decodable, Sendable, Hashable {
    public let error: String
    public let code: String?
}

/// `POST /api/chat/messages` envelope.
public struct SendChatMessageResponse: Decodable, Sendable, Hashable {
    public let message: ChatMessageDTO
}

/// `POST /api/chat/direct` envelope. The backend also returns an
/// `otherUser` summary; the conversation flow only needs the room id.
public struct CreateDirectChatResponse: Decodable, Sendable, Hashable {
    public let roomId: String

    private enum CodingKeys: String, CodingKey {
        case roomId
    }
}

/// `POST /api/chat/messages/:id/react` envelope.
public struct ReactToChatMessageResponse: Decodable, Sendable, Hashable {
    public let messageId: String?
    public let reaction: String?
    public let counts: [String: Int]?
    public let reactions: [ChatReactionSummary]?

    private enum CodingKeys: String, CodingKey {
        case messageId = "message_id"
        case reaction, counts, reactions
    }
}

// MARK: - Realtime message envelopes

/// `message:new` socket payload at the conversation view-model layer
/// — richer than `ChatMessageEvent` used by the list. The socket
/// decoder converts snake_case → camelCase automatically.
/// Full socket row plus its recipient-specific person-thread routing hint.
public struct ChatRealtimeMessageEnvelope: Decodable, Sendable {
    public let message: ChatMessageDTO
    public let otherUserId: String?

    private enum CodingKeys: String, CodingKey {
        case otherUserId = "other_user_id"
    }

    public init(from decoder: any Decoder) throws {
        message = try ChatMessageDTO(from: decoder)
        otherUserId = try decoder.container(keyedBy: CodingKeys.self).decodeIfPresent(String.self, forKey: .otherUserId)
    }
}

public struct ChatRealtimeMessage: Decodable, Sendable, Hashable {
    public let id: String
    public let roomId: String
    public let userId: String?
    public let messageText: String?
    public let messageType: String?
    public let createdAt: String?
    public let clientMessageId: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case roomId
        case userId
        case messageText
        case messageType
        case createdAt
        case clientMessageId
        case message
        case type
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        roomId = try c.decode(String.self, forKey: .roomId)
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
        messageText = try c.decodeIfPresent(String.self, forKey: .messageText)
            ?? c.decodeIfPresent(String.self, forKey: .message)
        messageType = try c.decodeIfPresent(String.self, forKey: .messageType)
            ?? c.decodeIfPresent(String.self, forKey: .type)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        clientMessageId = try c.decodeIfPresent(String.self, forKey: .clientMessageId)
    }
}

/// `message:edited` socket payload.
public struct ChatRealtimeMessageUpdate: Decodable, Sendable, Hashable {
    public let updatedMessage: ChatMessageDTO?
    public let id: String
    public let roomId: String?
    public let messageText: String?
    public let editedAt: String?
    public let deliveredAt: String?
    public let readAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case messageId
        case roomId
        case messageText
        case editedAt
        case deliveredAt
        case readAt
        case message
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        updatedMessage = try? c.decode(ChatMessageDTO.self, forKey: .message)
        let message = try c.decodeIfPresent([String: JSONValue].self, forKey: .message)
        id = try c.decodeIfPresent(String.self, forKey: .id)
            ?? c.decodeIfPresent(String.self, forKey: .messageId)
            ?? Self.string(from: message, key: "id")
            ?? ""
        roomId = try c.decodeIfPresent(String.self, forKey: .roomId)
            ?? Self.string(from: message, key: "room_id")
        messageText = try c.decodeIfPresent(String.self, forKey: .messageText)
            ?? Self.string(from: message, key: "message_text")
            ?? Self.string(from: message, key: "message")
        editedAt = try c.decodeIfPresent(String.self, forKey: .editedAt)
            ?? Self.string(from: message, key: "edited_at")
        deliveredAt = try c.decodeIfPresent(String.self, forKey: .deliveredAt)
            ?? Self.string(from: message, key: "delivered_at")
        readAt = try c.decodeIfPresent(String.self, forKey: .readAt)
            ?? Self.string(from: message, key: "read_at")
    }

    private static func string(from dict: [String: JSONValue]?, key: String) -> String? {
        guard let value = dict?[key], case let .string(raw) = value else { return nil }
        return raw
    }
}

/// `message:deleted` socket payload.
public struct ChatRealtimeMessageDelete: Decodable, Sendable, Hashable {
    public let id: String
    public let roomId: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case messageId
        case roomId
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
            ?? c.decodeIfPresent(String.self, forKey: .messageId)
            ?? ""
        roomId = try c.decodeIfPresent(String.self, forKey: .roomId)
    }
}

/// `message:reaction_updated` socket payload.
public struct ChatRealtimeReaction: Decodable, Sendable, Hashable {
    public let messageId: String
    public let reaction: String?
    public let counts: [String: Int]?
    public let reactions: [Summary]?

    public struct Summary: Decodable, Sendable, Hashable {
        public let reaction: String
        public let count: Int
        public let users: [User]?

        public struct User: Decodable, Sendable, Hashable {
            public let id: String
        }
    }
}

/// A recipient acknowledged a bounded position, not every message in the room.
public struct ChatRealtimeRead: Decodable, Sendable, Hashable {
    public let userId: String
    public let roomId: String
    public let readAt: String?
    public let throughMessageId: String?
}

/// `typing:user` / `typing:stopped` socket payloads — broadcast to a
/// room (excluding the sender) while a member types
/// (`backend/socket/chatSocketio.js:345-397`). `username` is omitted
/// here; the conversation header already knows the counterparty.
public struct ChatRealtimeTyping: Decodable, Sendable, Hashable {
    public let userId: String
    public let roomId: String
}

/// `user:online` / `user:offline` socket payloads — broadcast to every
/// connected client on a user's first connect / last disconnect
/// (`backend/socket/chatSocketio.js:240` / `:646`). Payload is
/// `{ userId }`.
public struct ChatRealtimePresence: Decodable, Sendable, Hashable {
    public let userId: String
}

/// `room:join` ack payload. Socket.IO returns recent messages as a
/// reconnect/backfill safety net after the server verifies membership.
public struct ChatRoomJoinAck: Decodable, Sendable, Hashable {
    public let success: Bool
    public let messages: [ChatMessageDTO]?
}
