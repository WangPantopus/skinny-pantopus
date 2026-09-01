@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.broadcast_detail

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.audience_profile.UpdateVisibility

/**
 * P1.3 Broadcast detail full-screen takeover — pushed from a tap on
 * an update card inside the creator's Audience Profile. Render models
 * for the hero card, 4-cell analytics grid, per-tier read breakdown,
 * and reply rows. Mirrors the iOS `BroadcastDetailContent.swift`
 * shape exactly so cross-platform parity tests can compare the
 * projection one-to-one.
 */
@Immutable
data class BroadcastDetailHero(
    val body: String,
    val visibility: UpdateVisibility,
    val targetTierRank: Int?,
    val timestamp: String,
    val mediaUrl: String?,
) {
    /** Chip label — "All beacons" for public, "Tier N+" for tier-or-above. */
    val visibilityLabel: String
        get() =
            when (visibility) {
                UpdateVisibility.Public -> "All beacons"
                UpdateVisibility.Followers -> "Followers"
                UpdateVisibility.TierOrAbove -> targetTierRank?.let { "Tier $it+" } ?: "Tier"
            }
}

@Immutable
data class BroadcastAnalyticsCell(
    val id: String,
    val label: String,
    val value: String,
    val sub: String? = null,
)

@Immutable
data class BroadcastTierBreakdown(
    val total: Int,
    val segments: List<Segment>,
) {
    @Immutable
    data class Segment(
        val id: String,
        val rank: Int,
        val name: String,
        val count: Int,
    ) {
        /** Percentage of the parent breakdown, rounded to nearest int. */
        fun percent(of: Int): Int {
            if (of <= 0) return 0
            return ((count.toDouble() / of.toDouble()) * 100.0).toInt()
        }
    }
}

@Immutable
data class BroadcastReplyRow(
    val id: String,
    val displayName: String,
    val handle: String,
    val avatarUrl: String?,
    val tierName: String,
    val tierRank: Int,
    val body: String,
    val timeAgo: String,
)

@Immutable
data class BroadcastDetailLoaded(
    val broadcastId: String,
    val hero: BroadcastDetailHero,
    val analyticsCells: List<BroadcastAnalyticsCell>,
    val tierBreakdown: BroadcastTierBreakdown,
    val replies: List<BroadcastReplyRow>,
    val totalReplies: Int,
)

sealed interface BroadcastDetailUiState {
    data object Loading : BroadcastDetailUiState

    data class Loaded(val content: BroadcastDetailLoaded) : BroadcastDetailUiState

    data class Error(val message: String) : BroadcastDetailUiState
}
