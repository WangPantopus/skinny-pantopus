@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs

import androidx.compose.runtime.Immutable

/**
 * Tasks-tab feed-scope segmentation. RN's Tasks tab puts three chips above
 * the category row — All / Tasks / Support Trains — and in the All scope
 * interleaves nearby Support Trains
 * (`GET /api/activities/support-trains/nearby`) into the gig feed, newest
 * first. Mirrors `apps/mobile/src/app/(tabs)/gigs.tsx:104,342-362`.
 */
enum class GigsFeedScope(
    val key: String,
    val label: String,
) {
    /** Tasks **and** nearby Support Trains, interleaved by recency. */
    All("all", "All"),

    /** Tasks only — the sectioned browse surface stays available here. */
    Tasks("tasks", "Tasks"),

    /** Nearby Support Trains only. */
    SupportTrains("support_trains", "Support Trains"),
    ;

    /** Gigs are fetched in every scope except the Support-Trains-only one. */
    val includesGigs: Boolean get() = this != SupportTrains

    /** Support Trains are fetched in every scope except the Tasks-only one. */
    val includesSupportTrains: Boolean get() = this != Tasks

    /** Empty-state headline, scope-aware (RN `GigsEmptyState(feedTab)`). */
    val emptyHeadline: String
        get() =
            when (this) {
                All -> "Nothing nearby yet"
                Tasks -> "No gigs nearby"
                SupportTrains -> "No Support Trains nearby"
            }

    /** Empty-state body, scope-aware. */
    val emptyBody: String
        get() =
            when (this) {
                All -> "Be the first to post a task for your neighbors."
                Tasks -> "Be the first to post one."
                SupportTrains -> "Support Trains published near you will show up here."
            }
}

/**
 * One nearby Support Train row rendered inline in the Tasks feed.
 * Mirrors RN `components/gig-browse/SupportTrainRow.tsx`.
 */
@Immutable
data class SupportTrainRowContent(
    val id: String,
    val title: String,
    /** "1.2mi · 3h ago" — distance + published age, either piece optional. */
    val metaLine: String,
    /** "Springfield, IL · 3 open slots" (area dropped when unknown). */
    val subtitle: String,
)

/**
 * A single row in the merged Tasks feed. `sortKey` is the row's epoch
 * timestamp (gig `created_at`, train `published_at`) so both kinds sort
 * newest-first together, exactly like RN's `feedRows` memo.
 */
@Immutable
sealed interface GigsFeedRow {
    val sortKey: Long
    val rowKey: String

    data class Gig(
        val content: GigCardContent,
        override val sortKey: Long,
    ) : GigsFeedRow {
        override val rowKey: String get() = "gig-${content.id}"
    }

    data class SupportTrain(
        val content: SupportTrainRowContent,
        override val sortKey: Long,
    ) : GigsFeedRow {
        override val rowKey: String get() = "st-${content.id}"
    }
}
