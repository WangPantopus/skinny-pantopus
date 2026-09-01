@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.creator_inbox

import androidx.compose.runtime.Immutable

/** Filter chip selection in the top strip. Mirrors iOS. */
enum class CreatorInboxFilter(val key: String, val title: String) {
    All("all", "All threads"),
    Unread("unread", "Unread"),

    /** Bronze tier and above. Projection treats this as `tierRank >= 2`
     *  (rank 1 is Free / Follower). */
    BronzePlus("bronze_plus", "Bronze+"),
    Flagged("flagged", "Flagged"),
}

/** A single thread row in the Creator Inbox list. */
@Immutable
data class CreatorInboxRowContent(
    val id: String,
    val displayName: String,
    val handle: String,
    val initials: String,
    val avatarUrl: String?,
    /** Tier name shown after the handle. `null` hides the chip. */
    val tierName: String?,
    /** Tier rank (1=Free, 2=Bronze, 3=Silver, 4=Gold). */
    val tierRank: Int,
    val preview: String,
    val timeAgo: String,
    val unread: Boolean,
    val flagged: Boolean,
    val verifiedLocal: Boolean,
    /**
     * Counterparty user id, when the serializer happens to emit one. NEVER
     * used as a routing key for the DM thread — persona DMs carry no user id
     * by design (`backend/routes/personaDms.js:12`), so the row routes on
     * [id] (the `PersonaDmThread` id) instead.
     */
    val counterpartyUserId: String?,
    /** Optional persona chip when the inbox spans multiple personas. */
    val personaChip: String?,
    /**
     * Persona that owns this thread — the `:id` path segment of every
     * `/api/personas/:id/dms/…` call made from the thread surface.
     */
    val personaId: String = "",
    /** `PersonaMembership` id the thread hangs off. Display/audit only. */
    val membershipId: String? = null,
)

/** Filter chip render model — live count + matching filter case. */
@Immutable
data class CreatorInboxChipContent(
    val id: String,
    val filter: CreatorInboxFilter,
    val label: String,
    val count: Int,
)

/** Counts shown in the sunken status banner below the top bar. */
@Immutable
data class CreatorInboxCounts(
    val total: Int,
    val unread: Int,
    val flagged: Int,
)

/** Header subtitle — `@handle` of the persona whose inbox this is. */
@Immutable
data class CreatorInboxHeader(
    val title: String,
    val handle: String?,
    /** True when this inbox spans more than one persona — drives the
     *  per-row persona chip. */
    val isCrossPersona: Boolean,
)

/** Loaded composition. */
@Immutable
data class CreatorInboxLoaded(
    val header: CreatorInboxHeader,
    val rows: List<CreatorInboxRowContent>,
    val counts: CreatorInboxCounts,
    val chips: List<CreatorInboxChipContent>,
)

sealed interface CreatorInboxUiState {
    data object Loading : CreatorInboxUiState

    data class Loaded(val content: CreatorInboxLoaded) : CreatorInboxUiState

    data class Empty(val header: CreatorInboxHeader) : CreatorInboxUiState

    data class Error(val message: String) : CreatorInboxUiState
}
