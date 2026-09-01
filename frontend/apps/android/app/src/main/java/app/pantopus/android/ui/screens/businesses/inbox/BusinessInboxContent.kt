@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.inbox

import app.pantopus.android.ui.theme.PantopusIcon

// Render models for the business-side inbox — the native counterpart of
// RN's `components/business/tabs/InboxTab.tsx`. Two sections behind one
// toggle:
//   · Messages — rooms addressed to the *business* identity
//     (`GET /api/chat/business/:businessUserId/rooms`);
//   · Mentions — neighborhood posts matched to the business
//     (`GET /api/businesses/:businessId/matched-posts`).
// Mirrors iOS `BusinessInboxModels.swift`.

/** Which half of the inbox is showing. RN's `InboxSection`. */
enum class BusinessInboxSection(
    val wire: String,
    val title: String,
    val icon: PantopusIcon,
) {
    Messages("messages", "Messages", PantopusIcon.MessageSquare),
    Mentions("mentions", "Mentions", PantopusIcon.AtSign),
}

/** One conversation row in the Messages section. */
data class BusinessInboxRoom(
    val id: String,
    /** Counterpart display name, falling back to the room name. */
    val title: String,
    /** Counterpart handle without the leading `@`; empty when unknown. */
    val handle: String,
    /** Last message preview; empty when the room has no visible message. */
    val preview: String,
    /** Relative timestamp ("2h ago"); empty when unknown. */
    val timeAgo: String,
    val unreadCount: Int,
) {
    val isUnread: Boolean get() = unreadCount > 0
}

/** One post row in the Mentions section. */
data class BusinessInboxMention(
    val id: String,
    /** Post author's display name ("Someone" when the serializer omits it). */
    val authorName: String,
    val avatarUrl: String?,
    /** Title when present, otherwise the body (RN `post.title || post.content`). */
    val body: String,
    val timeAgo: String,
    /** "3 likes · 2 comments"; empty when both counts are zero. */
    val engagement: String,
)

/**
 * Render state for the active inbox section. Each section loads
 * independently so switching tabs never blanks the other half.
 */
sealed interface BusinessInboxUiState {
    data object Loading : BusinessInboxUiState

    data class LoadedRooms(val rooms: List<BusinessInboxRoom>) : BusinessInboxUiState

    data class LoadedMentions(val mentions: List<BusinessInboxMention>) : BusinessInboxUiState

    data object Empty : BusinessInboxUiState

    data class Error(val message: String) : BusinessInboxUiState
}
