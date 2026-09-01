@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.audience_profile

import androidx.compose.runtime.Immutable

/** Three tabs on the management surface (mirrors iOS). */
enum class AudienceProfileTab(val key: String, val title: String) {
    Updates("updates", "Updates"),
    Followers("followers", "Followers"),
    Threads("threads", "Threads"),
}

/**
 * Single-select sort order for the Followers list. Default is
 * [NewestActive] — the natural API order, which the backend serves
 * most-recently-active-first.
 */
enum class FollowerSort(val key: String, val title: String) {
    NewestActive("newestActive", "Newest active"),
    HighestTier("highestTier", "Highest tier"),
    RecentlyJoined("recentlyJoined", "Recently joined"),
    MostEngaged("mostEngaged", "Most engaged"),
}

/** Tier visibility for the Updates composer. Matches the backend enum. */
enum class UpdateVisibility(val wire: String, val title: String) {
    Public("public", "Public"),
    Followers("followers", "Followers"),
    TierOrAbove("tier_or_above", "Tier and above"),
    ;

    companion object {
        fun fromWire(value: String?): UpdateVisibility = values().firstOrNull { it.wire == value } ?: Followers
    }
}

@Immutable
data class UpdateComposerState(
    val text: String = "",
    val visibility: UpdateVisibility = UpdateVisibility.Followers,
    val targetTierRank: Int? = null,
    val isSubmitting: Boolean = false,
    val error: String? = null,
) {
    /** Composer can submit if non-empty body and tier rank is valid for tierOrAbove. */
    val canSubmit: Boolean
        get() {
            val trimmed = text.trim()
            if (trimmed.isEmpty()) return false
            if (visibility == UpdateVisibility.TierOrAbove && targetTierRank == null) return false
            return !isSubmitting
        }
}

@Immutable
data class AudienceHeaderContent(
    val displayName: String,
    val handle: String?,
    val followerCount: Int,
    val newThisWeek: Int,
    val postCount: Int,
)

@Immutable
data class UpdateCardContent(
    val id: String,
    val body: String,
    val timeAgo: String,
    val visibility: UpdateVisibility,
    val targetTierRank: Int?,
    val deliveredCount: Int,
    val readCount: Int,
) {
    val visibilityLabel: String
        get() =
            when (visibility) {
                UpdateVisibility.Public -> "Public"
                UpdateVisibility.Followers -> "Followers"
                UpdateVisibility.TierOrAbove -> targetTierRank?.let { "Tier $it+" } ?: "Tier"
            }
}

@Immutable
data class AnalyticsCellContent(
    val id: String,
    val label: String,
    val value: String,
    val trend: String? = null,
)

@Immutable
data class TierBreakdownContent(
    val total: Int,
    val segments: List<TierSegment>,
) {
    @Immutable
    data class TierSegment(
        val id: String,
        val rank: Int,
        val name: String,
        val count: Int,
    )
}

@Immutable
data class FollowerRowContent(
    val id: String,
    val displayName: String,
    val handle: String,
    val avatarUrl: String?,
    val tierName: String,
    val tierRank: Int,
    val tenureLabel: String?,
    val tenureMonths: Int?,
    val joinedMonth: String?,
    val verifiedLocal: Boolean,
)

@Immutable
data class TierChipContent(
    val id: String,
    val rank: Int?,
    val label: String,
    val count: Int,
)

@Immutable
data class ThreadRowContent(
    val id: String,
    val displayName: String,
    val handle: String,
    val avatarUrl: String?,
    val tierName: String?,
    /** Tier rank (1=Free / Follower, 2=Bronze, 3=Silver, 4=Gold). Drives
     *  the "Bronze+" filter chip (matches when `tierRank >= 2`). */
    val tierRank: Int,
    val preview: String,
    val timeAgo: String,
    val unreadCount: Int,
    /** Creator-flagged thread — drives the Flagged filter chip. */
    val flagged: Boolean,
)

/** Filter chip selection on the Threads tab. Mirrors iOS `ThreadsFilter`
 *  and the matching chip strip used by the standalone Creator Inbox. */
enum class ThreadsFilter(val key: String, val title: String) {
    All("all", "All threads"),
    Unread("unread", "Unread"),

    /** Bronze tier and above. Projection treats this as `tierRank >= 2`
     *  (rank 1 is Free / Follower). */
    BronzePlus("bronze_plus", "Bronze+"),
    Flagged("flagged", "Flagged"),
}

/** Render model for a single Threads-tab filter chip.
 *  `count` is null for the Flagged chip — the design omits a count there. */
@Immutable
data class ThreadsFilterChipContent(
    val id: String,
    val filter: ThreadsFilter,
    val label: String,
    val count: Int?,
)

@Immutable
data class AudienceProfileLoaded(
    val header: AudienceHeaderContent,
    val updates: List<UpdateCardContent>,
    val analyticsCells: List<AnalyticsCellContent>,
    val tierBreakdown: TierBreakdownContent,
    val tierChips: List<TierChipContent>,
    val followers: List<FollowerRowContent>,
    val threads: List<ThreadRowContent>,
    val threadsFilterChips: List<ThreadsFilterChipContent>,
    val channelId: String?,
)

sealed interface AudienceProfileUiState {
    data object Loading : AudienceProfileUiState

    data class Empty(val message: String) : AudienceProfileUiState

    data class Loaded(val content: AudienceProfileLoaded) : AudienceProfileUiState

    data class Error(val message: String) : AudienceProfileUiState
}
