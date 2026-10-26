@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.chats

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One topic attached to a person-conversation in
 * `GET /api/chat/unified-conversations`.
 */
@JsonClass(generateAdapter = true)
data class ChatTopic(
    val id: String? = null,
    @Json(name = "topic_type") val topicType: String? = null,
    @Json(name = "topic_ref_id") val topicRefId: String? = null,
    val title: String? = null,
    val status: String? = null,
    @Json(name = "last_activity_at") val lastActivityAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class ConversationTopicsResponse(
    val topics: List<ChatTopic>,
)

@JsonClass(generateAdapter = true)
data class FindOrCreateTopicBody(
    val topicType: String,
    val topicRefId: String? = null,
    val title: String,
)

@JsonClass(generateAdapter = true)
data class FindOrCreateTopicResponse(
    val topic: ChatTopic,
    val created: Boolean,
)

/**
 * Inline identity object emitted by the local-identity serializer on a
 * `_type: "conversation"` row.
 */
@JsonClass(generateAdapter = true)
data class ChatOtherIdentity(
    val id: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "avatarUrl") val avatarUrl: String? = null,
    @Json(name = "identity_kind") val identityKind: String? = null,
    val verified: Boolean? = null,
    val badges: List<String>? = null,
) {
    /**
     * The serializer reports verification as a `verified_resident` badge
     * (hidden when the person turns the badge off); an explicit `verified`
     * flag wins when present.
     */
    val isVerified: Boolean
        get() = verified ?: (badges?.contains("verified_resident") == true)
}

/**
 * One row in the unified-conversations response. Hetero by `_type`:
 * `conversation` (person-grouped DM/gig) or `room` (group/home). The
 * fields not relevant to a variant decode as `null`.
 *
 * Route: `backend/routes/chats.js:2211`.
 */
@JsonClass(generateAdapter = true)
data class UnifiedConversationDto(
    @Json(name = "_type") val type: String? = "conversation",
    // conversation-only keys
    @Json(name = "other_participant_id") val otherParticipantId: String? = null,
    @Json(name = "other_participant_name") val otherParticipantName: String? = null,
    @Json(name = "other_participant_avatar") val otherParticipantAvatar: String? = null,
    @Json(name = "other_participant_identity") val otherParticipantIdentity: ChatOtherIdentity? = null,
    @Json(name = "room_ids") val roomIds: List<String>? = null,
    val topics: List<ChatTopic>? = null,
    // room-only keys
    val id: String? = null,
    @Json(name = "room_type") val roomType: String? = null,
    @Json(name = "room_name") val roomName: String? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "home_id") val homeId: String? = null,
    // shared
    @Json(name = "total_unread") val totalUnread: Int = 0,
    @Json(name = "unmuted_unread") val unmutedUnread: Int? = null,
    @Json(name = "last_message_at") val lastMessageAt: String? = null,
    @Json(name = "last_message_preview") val lastMessagePreview: String? = null,
    @Json(name = "notifications_enabled") val notificationsEnabled: Boolean? = null,
)

/** `GET /api/chat/unified-conversations` envelope. */
@JsonClass(generateAdapter = true)
data class UnifiedConversationsResponse(
    val conversations: List<UnifiedConversationDto>,
    val total: Int? = null,
    val totalUnread: Int? = null,
    val totalUnmutedUnread: Int? = null,
    val hasMore: Boolean = false,
    val nextCursor: String? = null,
)

/** The authoritative unread count for the room or person scope acknowledged by the read request. */
@JsonClass(generateAdapter = true)
data class ChatReadResponse(
    val unreadCount: Int? = null,
    val topicId: String? = null,
    val readScope: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatNotificationPreferencesBody(
    val notificationsEnabled: Boolean,
    val asBusinessUserId: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatNotificationPreferencesResponse(
    val notificationsEnabled: Boolean,
    val roomIds: List<String> = emptyList(),
)

/** Stats payload from `GET /api/chat/stats`. */
@JsonClass(generateAdapter = true)
data class ChatStats(
    @Json(name = "total_chats") val totalChats: Int = 0,
    @Json(name = "total_messages") val totalMessages: Int = 0,
    @Json(name = "total_unread") val totalUnread: Int = 0,
    @Json(name = "total_unmuted_unread") val totalUnmutedUnread: Int? = null,
    @Json(name = "direct_chats") val directChats: Int = 0,
    @Json(name = "gig_chats") val gigChats: Int = 0,
    @Json(name = "home_chats") val homeChats: Int = 0,
)

/** `GET /api/chat/stats` envelope. */
@JsonClass(generateAdapter = true)
data class ChatStatsResponse(
    val stats: ChatStats,
)

// MARK: - Messages (T2.2)

/** Sender projection embedded in a `ChatMessage` row. */
@JsonClass(generateAdapter = true)
data class ChatMessageSender(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    /** Current public identity projection; legacy servers still use name/username. */
    val displayName: String? = null,
    val handle: String? = null,
) {
    val displayLabel: String?
        get() = listOf(displayName, name, handle, username).firstOrNull { !it.isNullOrBlank() }
}

/** One row from `/messages`. */
@JsonClass(generateAdapter = true)
data class ChatMessageDto(
    val id: String,
    @Json(name = "room_id") val roomId: String,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "message_text") val messageText: String? = null,
    /** Canonical DB column — preferred when `message_text` is absent. */
    val message: String? = null,
    @Json(name = "message_type") val messageType: String? = null,
    /** Canonical DB column — preferred when `message_type` is absent. */
    val type: String? = null,
    val metadata: Map<String, Any>? = null,
    @Json(name = "reply_to_id") val replyToId: String? = null,
    @Json(name = "topic_id") val topicId: String? = null,
    @Json(name = "client_message_id") val clientMessageId: String? = null,
    @Json(name = "created_at") val createdAt: String = "",
    @Json(name = "edited_at") val editedAt: String? = null,
    @Json(name = "deleted_at") val deletedAt: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    @Json(name = "read_at") val readAt: String? = null,
    val sender: ChatMessageSender? = null,
    val reactions: List<ChatReactionSummary> = emptyList(),
    val attachments: List<ChatAttachmentDto> = emptyList(),
    /**
     * The person who wrote a message sent as a business. The server names that only to the writer, so it is set on
     * the business's messages you wrote yourself and null everywhere else.
     */
    @Json(name = "actor_user_id") val actorUserId: String? = null,
    @Json(name = "sync_version") val syncVersion: Long? = null,
    /** Incremental recovery can return a minimal tombstone without body or timestamp fields. */
    val deleted: Boolean = false,
)

/** Body text — API may return canonical `message` or alias `message_text`. */
val ChatMessageDto.resolvedText: String
    get() = messageText ?: message.orEmpty()

/** Message kind — API may return canonical `type` or alias `message_type`. */
val ChatMessageDto.resolvedType: String
    get() = messageType ?: type ?: "text"

@JsonClass(generateAdapter = true)
data class ChatAttachmentDto(
    val id: String,
    @Json(name = "file_url") val fileUrl: String? = null,
    @Json(name = "original_filename") val originalFilename: String? = null,
    @Json(name = "mime_type") val mimeType: String? = null,
    @Json(name = "file_size") val fileSize: Int? = null,
    @Json(name = "file_type") val fileType: String? = null,
    @Json(name = "live_video_file_id") val liveVideoFileId: String? = null,
    @Json(name = "live_photo_file_id") val livePhotoFileId: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatMediaUploadResponse(
    val message: String,
    val media: List<ChatAttachmentDto>,
)

@JsonClass(generateAdapter = true)
data class AIMediaUploadResponse(
    val message: String,
    val images: List<AIUploadedImage>,
)

@JsonClass(generateAdapter = true)
data class AIUploadedImage(
    val url: String,
    val key: String? = null,
    val name: String? = null,
    @Json(name = "mime_type") val mimeType: String? = null,
    val size: Int? = null,
)

@JsonClass(generateAdapter = true)
data class ChatReactionSummary(
    val reaction: String,
    val count: Int,
    @Json(name = "reacted_by_me") val reactedByMe: Boolean = false,
)

/** `GET /messages` envelope. */
@JsonClass(generateAdapter = true)
data class ChatMessagesResponse(
    val messages: List<ChatMessageDto>,
    val hasMore: Boolean? = null,
    @Json(name = "nextCursor") val nextCursor: String? = null,
    val roomIds: List<String>? = null,
    /**
     * Set when the conversation takes no messages from you: a direct chat with a draft or closed business (`code`
     * NOT_PUBLISHED). Null from older servers, which leave the key out.
     */
    val sendRefusal: ChatSendRefusal? = null,
    /** First-page anchor only; older pages never advance the saved recovery cursor. */
    val syncCursors: Map<String, Long> = emptyMap(),
    /** Device-only tombstone revisions prevent a delayed history response from restoring a deleted bubble. */
    val deletedMessageVersions: Map<String, Long> = emptyMap(),
    val hasMoreAfter: Boolean = false,
    val anchorMessageId: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatReadReceipt(
    val roomId: String,
    val userId: String,
    val readAt: String,
    val throughMessageId: String,
    val throughCreatedAt: String,
)

@JsonClass(generateAdapter = true)
data class ChatChangesBody(
    val cursor: Map<String, Long>,
    val until: Map<String, Long>? = null,
    val asBusinessUserId: String? = null,
    val limit: Int = 200,
    val readMessageIds: List<String>? = null,
)

@JsonClass(generateAdapter = true)
data class ChatMessageReadReceipt(val messageId: String, val readAt: String? = null)

@JsonClass(generateAdapter = true)
data class ChatChangesResponse(
    val messages: List<ChatMessageDto> = emptyList(),
    val syncCursors: Map<String, Long> = emptyMap(),
    val untilCursors: Map<String, Long> = emptyMap(),
    val hasMore: Boolean = false,
    val roomIds: List<String> = emptyList(),
    val removedRoomIds: List<String> = emptyList(),
    val resetRequired: Boolean = false,
    val readReceipts: List<ChatReadReceipt> = emptyList(),
    val messageReadReceipts: List<ChatMessageReadReceipt>? = null,
)

/** Why a conversation takes no messages, as the server words it (`backend/routes/chats.js` `unpublishedDirectRoomRefusal`). */
@JsonClass(generateAdapter = true)
data class ChatSendRefusal(
    val error: String,
    val code: String? = null,
)

/** `POST /messages` body. */
@JsonClass(generateAdapter = true)
data class SendChatMessageBody(
    val roomId: String,
    val messageText: String? = null,
    val messageType: String = "text",
    val fileIds: List<String>? = null,
    val clientMessageId: String? = null,
    val replyToId: String? = null,
    val topicId: String? = null,
    val metadata: Map<String, Any>? = null,
    val asBusinessUserId: String? = null,
)

/** `POST /messages` envelope. */
@JsonClass(generateAdapter = true)
data class SendChatMessageResponse(
    val message: ChatMessageDto,
)

/**
 * `POST /messages/:id/react` body. [reacted] is the state the tap asks for, so a retry keeps it; null (left out of the
 * JSON) lets the server toggle.
 */
@JsonClass(generateAdapter = true)
data class ReactToChatMessageBody(
    val reaction: String,
    val reacted: Boolean? = null,
)

/** `POST /messages/:id/react` envelope. */
@JsonClass(generateAdapter = true)
data class ReactToChatMessageResponse(
    val messageId: String? = null,
    val reaction: String? = null,
    val counts: Map<String, Int>? = null,
    val reactions: List<ChatReactionSummary>? = null,
)

@JsonClass(generateAdapter = true)
data class EditChatMessageBody(
    val messageText: String,
)

/** `POST /direct` body — route `chats.js:871`, validator `chats.js:135`. */
@JsonClass(generateAdapter = true)
data class CreateDirectChatBody(
    val otherUserId: String,
)

/**
 * `POST /direct` envelope. The backend also returns an `otherUser`
 * summary; the conversation flow only needs the room id.
 */
@JsonClass(generateAdapter = true)
data class CreateDirectChatResponse(
    val roomId: String,
)

/**
 * `GET /api/chat/rooms/:roomId` — only what a chat link needs to find a
 * direct room's other participant.
 */
@JsonClass(generateAdapter = true)
data class ChatRoomDetailResponse(
    val room: ChatRoomDetail,
)

@JsonClass(generateAdapter = true)
data class ChatRoomDetail(
    val type: String? = null,
    /** The room's name; a Support Train's room goes by the train's title. */
    val name: String? = null,
    val participants: List<ChatRoomParticipant>? = null,
    /** False once the room is read-only (a plan's chat after the plan, or a cancelled plan). */
    @Json(name = "is_active") val isActive: Boolean? = null,
    /** A `type: "plan"` room's plan (Nearby Plans). */
    @Json(name = "plan_id") val planId: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatRoomParticipant(
    @Json(name = "user_id") val userId: String? = null,
    /** The local-identity projection (`serializeUserAsLocalIdentity`). */
    val user: ChatRoomParticipantIdentity? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    // Missing legacy membership fields cannot prove an active reply audience.
    @Json(name = "left_at") val leftAt: String? = "",
)

@JsonClass(generateAdapter = true)
data class ChatRoomParticipantIdentity(
    val displayName: String? = null,
    val avatarUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatSearchRoomContext(
    val conversationId: String,
    val kind: String,
    val name: String,
    val identity: ChatOtherIdentity? = null,
)

@JsonClass(generateAdapter = true)
data class ChatSearchResponse(
    val messages: List<ChatMessageDto> = emptyList(),
    val roomContexts: Map<String, ChatSearchRoomContext> = emptyMap(),
    val hasMore: Boolean = false,
    val nextCursor: String? = null,
)
