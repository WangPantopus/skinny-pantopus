@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.community

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.p3.CommunityFeedItemDto
import app.pantopus.android.data.api.models.mailbox.p3.CommunityReactionCountDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxCommunityRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import javax.inject.Inject

/**
 * Type filter chips above the feed. [ALL] sends no `type` query param;
 * every other entry maps 1:1 onto the backend `community_type` column
 * (`categoryCommunityType`, `backend/routes/mailboxV2Phase3.js:812`).
 */
enum class CommunityFeedFilter(
    val slug: String,
    val label: String,
    val icon: PantopusIcon,
) {
    ALL("all", "All", PantopusIcon.Megaphone),
    CIVIC_NOTICE("civic_notice", "Civic", PantopusIcon.Landmark),
    NEIGHBORHOOD_EVENT("neighborhood_event", "Events", PantopusIcon.PartyPopper),
    LOCAL_BUSINESS("local_business", "Business", PantopusIcon.ShoppingBag),
    BUILDING_ANNOUNCEMENT("building_announcement", "Building", PantopusIcon.Building2),
    ;

    /** `type` query param for the feed call; null for "All". */
    val backendType: String? get() = if (this == ALL) null else slug
}

/** The `community_type` of a published item, as rendered on a card. */
enum class CommunityFeedType(
    val slug: String,
    val label: String,
    val icon: PantopusIcon,
) {
    CIVIC_NOTICE("civic_notice", "Civic Notice", PantopusIcon.Landmark),
    NEIGHBORHOOD_EVENT("neighborhood_event", "Event", PantopusIcon.PartyPopper),
    LOCAL_BUSINESS("local_business", "Business", PantopusIcon.ShoppingBag),
    BUILDING_ANNOUNCEMENT("building_announcement", "Announcement", PantopusIcon.Building2),
    ;

    companion object {
        fun fromRaw(raw: String?): CommunityFeedType = entries.firstOrNull { it.slug == raw } ?: CIVIC_NOTICE
    }
}

/**
 * The four reaction types the backend validator accepts
 * (`backend/routes/mailboxV2Phase3.js:51`).
 */
enum class CommunityReactionType(
    val slug: String,
    val label: String,
    val icon: PantopusIcon,
) {
    ACKNOWLEDGED("acknowledged", "Noted", PantopusIcon.CheckCheck),
    WILL_ATTEND("will_attend", "Going", PantopusIcon.CalendarCheck),
    CONCERNED("concerned", "Concerned", PantopusIcon.AlertTriangle),
    THUMBS_UP("thumbs_up", "Thanks", PantopusIcon.ThumbsUp),
}

/** One card in the feed, projected from [CommunityFeedItemDto]. */
data class CommunityFeedItem(
    val id: String,
    val type: CommunityFeedType,
    val title: String,
    val body: String?,
    val senderDisplay: String,
    val timeAgo: String?,
    val verifiedSender: Boolean,
    val views: Int,
    val neighborsReceived: Int,
    val rsvpCount: Int,
    val hasEventDate: Boolean,
    /** Reaction slug → count. */
    val reactionCounts: Map<String, Int>,
    /** Reaction slugs the caller has already sent. */
    val userReactions: Set<String>,
) {
    /**
     * RSVP is offered only on neighborhood events that carry a date —
     * matching RN `community.tsx:165` + `CommunityCard.tsx`.
     */
    val offersRsvp: Boolean get() = type == CommunityFeedType.NEIGHBORHOOD_EVENT && hasEventDate

    fun countFor(reaction: CommunityReactionType): Int = reactionCounts[reaction.slug] ?: 0

    fun isReacted(reaction: CommunityReactionType): Boolean = userReactions.contains(reaction.slug)
}

/** Render states for the Community-mail feed. */
sealed interface CommunityMailUiState {
    data object Loading : CommunityMailUiState

    data class Loaded(
        val items: List<CommunityFeedItem>,
        val total: Int,
    ) : CommunityMailUiState

    data object Empty : CommunityMailUiState

    data class Error(
        val message: String,
    ) : CommunityMailUiState
}

/**
 * A17.4 — Community mail feed view-model. Backed by
 * `backend/routes/mailboxV2Phase3.js`:
 * `GET community/feed` (565), `POST community/react` (694),
 * `POST community/rsvp` (746), `POST community/flag` (790).
 *
 * Mirrors iOS `CommunityMailViewModel`.
 */
@HiltViewModel
class CommunityMailViewModel
    @Inject
    constructor(
        private val repository: MailboxCommunityRepository,
        networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        /** Drives the shared offline strip in the screen chrome. */
        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        private val _state = MutableStateFlow<CommunityMailUiState>(CommunityMailUiState.Loading)
        val state: StateFlow<CommunityMailUiState> = _state.asStateFlow()

        private val _selectedFilter = MutableStateFlow(CommunityFeedFilter.ALL)
        val selectedFilter: StateFlow<CommunityFeedFilter> = _selectedFilter.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        /** Non-null while the flag confirmation dialog is up. */
        private val _pendingFlagItemId = MutableStateFlow<String?>(null)
        val pendingFlagItemId: StateFlow<String?> = _pendingFlagItemId.asStateFlow()

        private var loadGeneration = 0

        fun load() {
            if (_state.value is CommunityMailUiState.Loaded) return
            _state.value = CommunityMailUiState.Loading
            fetchFeed()
        }

        fun refresh() = fetchFeed()

        fun selectFilter(filter: CommunityFeedFilter) {
            if (filter == _selectedFilter.value) return
            _selectedFilter.value = filter
            _state.value = CommunityMailUiState.Loading
            fetchFeed()
        }

        private fun fetchFeed() {
            loadGeneration += 1
            val generation = loadGeneration
            val filter = _selectedFilter.value
            viewModelScope.launch {
                when (val result = repository.feed(type = filter.backendType, limit = PAGE_SIZE)) {
                    is NetworkResult.Success -> {
                        if (generation != loadGeneration) return@launch
                        val items = result.data.items.map(::project)
                        _state.value =
                            if (items.isEmpty()) {
                                CommunityMailUiState.Empty
                            } else {
                                CommunityMailUiState.Loaded(items, result.data.total ?: items.size)
                            }
                    }

                    is NetworkResult.Failure -> {
                        if (generation != loadGeneration) return@launch
                        _state.value = CommunityMailUiState.Error(result.error.message)
                    }
                }
            }
        }

        /**
         * Toggles a reaction. The backend returns the recomputed counts and
         * is the source of truth for them; the caller's own membership is
         * toggled locally, matching RN `community.tsx:60-70`.
         */
        fun react(
            itemId: String,
            reaction: CommunityReactionType,
        ) {
            viewModelScope.launch {
                when (val result = repository.react(itemId, reaction.slug)) {
                    is NetworkResult.Success ->
                        applyReaction(itemId, reaction, result.data.reactions.orEmpty())

                    is NetworkResult.Failure -> _toast.value = "Couldn't save that reaction."
                }
            }
        }

        private fun applyReaction(
            itemId: String,
            reaction: CommunityReactionType,
            counts: List<CommunityReactionCountDto>,
        ) {
            val current = _state.value as? CommunityMailUiState.Loaded ?: return
            val updated =
                current.items.map { item ->
                    if (item.id != itemId) {
                        item
                    } else {
                        item.copy(
                            reactionCounts = counts.associate { it.reactionType to it.count },
                            userReactions =
                                if (item.userReactions.contains(reaction.slug)) {
                                    item.userReactions - reaction.slug
                                } else {
                                    item.userReactions + reaction.slug
                                },
                        )
                    }
                }
            _state.value = current.copy(items = updated)
        }

        fun rsvp(itemId: String) {
            viewModelScope.launch {
                when (val result = repository.rsvp(itemId)) {
                    is NetworkResult.Success -> {
                        val count = result.data.rsvpCount ?: 0
                        val noun = if (count == 1) "person" else "people"
                        _toast.value = "You're on the list! $count $noun attending."
                        applyRsvp(itemId, count)
                    }

                    is NetworkResult.Failure -> _toast.value = "Could not RSVP."
                }
            }
        }

        private fun applyRsvp(
            itemId: String,
            count: Int,
        ) {
            val current = _state.value as? CommunityMailUiState.Loaded ?: return
            val updated =
                current.items.map { item ->
                    if (item.id != itemId) {
                        item
                    } else {
                        item.copy(
                            rsvpCount = count,
                            reactionCounts =
                                item.reactionCounts +
                                    (CommunityReactionType.WILL_ATTEND.slug to count),
                            userReactions =
                                item.userReactions + CommunityReactionType.WILL_ATTEND.slug,
                        )
                    }
                }
            _state.value = current.copy(items = updated)
        }

        /** Stage the destructive confirm — the screen names the item first. */
        fun requestFlag(itemId: String) {
            _pendingFlagItemId.value = itemId
        }

        fun cancelFlag() {
            _pendingFlagItemId.value = null
        }

        /** Title of the item awaiting confirmation, so the dialog can name it. */
        fun pendingFlagTitle(): String? {
            val id = _pendingFlagItemId.value ?: return null
            val loaded = _state.value as? CommunityMailUiState.Loaded ?: return null
            return loaded.items.firstOrNull { it.id == id }?.title
        }

        fun confirmFlag() {
            val itemId = _pendingFlagItemId.value ?: return
            _pendingFlagItemId.value = null
            viewModelScope.launch {
                _toast.value =
                    when (val result = repository.flag(itemId)) {
                        is NetworkResult.Success -> result.data.message ?: "Item flagged for review"
                        is NetworkResult.Failure -> "Couldn't flag that item."
                    }
            }
        }

        fun consumeToast() {
            _toast.value = null
        }

        // ─── Projection ────────────────────────────────────────────

        private fun project(dto: CommunityFeedItemDto): CommunityFeedItem =
            CommunityFeedItem(
                id = dto.id,
                type = CommunityFeedType.fromRaw(dto.communityType),
                title = dto.title?.takeIf { it.isNotBlank() } ?: "Shared mail",
                body = dto.body?.takeIf { it.isNotBlank() },
                senderDisplay = dto.senderDisplay?.takeIf { it.isNotBlank() } ?: "Community Member",
                timeAgo = relativeTimestamp(dto.createdAt),
                verifiedSender = dto.verifiedSender ?: false,
                views = dto.views ?: 0,
                neighborsReceived = dto.neighborsReceived ?: 0,
                rsvpCount = dto.rsvpCount ?: 0,
                hasEventDate = !dto.eventDate.isNullOrBlank(),
                reactionCounts = dto.reactions.orEmpty().associate { it.reactionType to it.count },
                userReactions = dto.userReactions.orEmpty().toSet(),
            )

        companion object {
            private const val PAGE_SIZE = 30
            private const val SECONDS_PER_MINUTE = 60L
            private const val SECONDS_PER_HOUR = 3_600L
            private const val SECONDS_PER_DAY = 86_400L
            private const val SECONDS_PER_WEEK = 604_800L

            /** "just now" / "12m ago" / "4h ago" / "3d ago" / "2w ago". */
            fun relativeTimestamp(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant =
                    runCatching { Instant.parse(iso) }.getOrNull()
                        ?: runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrNull()
                        ?: return null
                val elapsed = Duration.between(instant, Instant.now()).seconds
                return when {
                    elapsed < SECONDS_PER_MINUTE -> "just now"
                    elapsed < SECONDS_PER_HOUR -> "${elapsed / SECONDS_PER_MINUTE}m ago"
                    elapsed < SECONDS_PER_DAY -> "${elapsed / SECONDS_PER_HOUR}h ago"
                    elapsed < SECONDS_PER_WEEK -> "${elapsed / SECONDS_PER_DAY}d ago"
                    else -> "${elapsed / SECONDS_PER_WEEK}w ago"
                }
            }
        }
    }
