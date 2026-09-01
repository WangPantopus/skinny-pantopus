@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.newmessage

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon

/** Identity badge tint on the picker row's avatar verification overlay. */
enum class NewMessageIdentityBadge { Personal, Home, Business }

/**
 * One row in the picker. Renders as avatar-with-badge → name +
 * locality + optional sub-line → chevron.
 */
@Immutable
data class NewMessageContactRow(
    val id: String,
    val userId: String,
    val name: String,
    val initials: String,
    val locality: String?,
    val sub: String?,
    val subIcon: PantopusIcon?,
    val verified: Boolean,
    val identity: NewMessageIdentityBadge,
)

/**
 * Stable section ids. Mirrors `NewMessageSectionID` on iOS so cross-
 * platform UI tests can address the same overline.
 */
enum class NewMessageSectionId(val key: String) {
    Connections("connections"),
    Recent("recent"),
    AllVerified("allVerified"),
}

@Immutable
data class NewMessageSection(
    val id: NewMessageSectionId,
    val label: String,
    val rows: List<NewMessageContactRow>,
)

/** Top-level render state for the picker. */
sealed interface NewMessageUiState {
    data object Loading : NewMessageUiState

    /** All three sections empty AND no active search → pivot to the
     * search-affordance empty frame. */
    data object Empty : NewMessageUiState

    data class Loaded(val sections: List<NewMessageSection>) : NewMessageUiState

    data class Error(val message: String) : NewMessageUiState
}

/**
 * Routing payload emitted when the user taps a contact row. The host
 * (`RootTabScreen`) maps this onto a chat-conversation push using the
 * existing person thread mode.
 */
@Immutable
data class NewMessageDestination(
    val userId: String,
    val displayName: String,
    val initials: String,
    val verified: Boolean,
    val locality: String?,
)
