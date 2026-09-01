@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.compose.runtime.Immutable

/** Filter-tab key. */
enum class ChatFilter(val key: String, val label: String) {
    All("all", "All"),
    Unread("unread", "Unread"),
    Gigs("gigs", "Gigs"),
    Market("market", "Market"),
    ;

    companion object {
        fun fromKey(key: String): ChatFilter = entries.firstOrNull { it.key == key } ?: All
    }
}

/** Variant for the per-row avatar treatment. */
sealed interface ConversationRowVariant {
    data object Dm : ConversationRowVariant

    data class Group(
        val extraAvatars: List<String> = emptyList(),
        val extraCount: Int = 0,
    ) : ConversationRowVariant

    data object AiAssistant : ConversationRowVariant
}

/** Identity disclosure chip rendered next to the name. */
enum class ConversationIdentityChip(val label: String) {
    Business("Business"),
    Home("Home"),
}

/**
 * One topic pill under a row's preview — projected from
 * `UnifiedConversationDto.topics` (title + type drive label + icon).
 */
@Immutable
data class ConversationRowTopic(
    val title: String,
    val topicType: String,
)

/** Render-only content for one row. */
@Immutable
data class ConversationRowContent(
    val id: String,
    val variant: ConversationRowVariant,
    val displayName: String,
    val initials: String,
    val avatarUrl: String?,
    val identityChip: ConversationIdentityChip?,
    val verified: Boolean,
    val preview: String,
    val timeLabel: String,
    val unread: Int,
    val pinned: Boolean,
    val topicKinds: Set<String>,
    /** Stable key for mute/hide persistence — `person:<id>` or `room:<id>`. */
    val storageKey: String,
    /** Whether the user muted notifications for this conversation. */
    val isMuted: Boolean = false,
    /** Per-row topic pills (first 2 render, the rest collapse to "+N"). */
    val topics: List<ConversationRowTopic> = emptyList(),
    /** Backing gig for gig-room rows — plumbs the A15 pinned context strip. */
    val gigId: String? = null,
)

/** Filter-tab entry the view renders. */
@Immutable
data class ChatFilterTab(
    val filter: ChatFilter,
    val badgeCount: Int? = null,
)

/** Top-level render state for the chat list. */
sealed interface ChatListUiState {
    data object Loading : ChatListUiState

    data object Empty : ChatListUiState

    data class Loaded(val rows: List<ConversationRowContent>) : ChatListUiState

    data class Error(val message: String) : ChatListUiState
}
