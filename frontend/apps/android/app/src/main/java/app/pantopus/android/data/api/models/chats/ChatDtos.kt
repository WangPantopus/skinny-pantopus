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
)

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
    @Json(name = "last_message_at") val lastMessageAt: String? = null,
    @Json(name = "last_message_preview") val lastMessagePreview: String? = null,
)

/** `GET /api/chat/unified-conversations` envelope. */
@JsonClass(generateAdapter = true)
data class UnifiedConversationsResponse(
    val conversations: List<UnifiedConversationDto>,
    val total: Int? = null,
    val totalUnread: Int? = null,
)

/** Stats payload from `GET /api/chat/stats`. */
@JsonClass(generateAdapter = true)
data class ChatStats(
    @Json(name = "total_chats") val totalChats: Int = 0,
    @Json(name = "total_messages") val totalMessages: Int = 0,
    @Json(name = "total_unread") val totalUnread: Int = 0,
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
)

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
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "edited_at") val editedAt: String? = null,
    @Json(name = "deleted_at") val deletedAt: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    @Json(name = "read_at") val readAt: String? = null,
    val sender: ChatMessageSender? = null,
    val reactions: List<ChatReactionSummary> = emptyList(),
    val attachments: List<ChatAttachmentDto> = emptyList(),
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
)

/** `POST /messages` envelope. */
@JsonClass(generateAdapter = true)
data class SendChatMessageResponse(
    val message: ChatMessageDto,
)

/** `POST /messages/:id/react` body. */
@JsonClass(generateAdapter = true)
data class ReactToChatMessageBody(
    val reaction: String,
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
