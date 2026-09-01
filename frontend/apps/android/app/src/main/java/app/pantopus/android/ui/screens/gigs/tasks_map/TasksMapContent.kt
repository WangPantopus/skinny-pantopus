@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.tasks_map

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.gigs.GigCardContent
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridDetent
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPin
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPinState
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A11.1 Tasks map — the Gigs-only mode of the map+list hybrid archetype
 * (`ui/screens/shared/map_list_hybrid`). Reached from the Gigs feed's
 * list/map toggle. Same canvas as the generic Nearby map, filtered to
 * tasks with a "Post task" button below the locate / layers controls.
 *
 * Live data from `GET /api/gigs/in-bounds`; previews/snapshots seed from
 * [TasksMapSampleData].
 */
@Immutable
data class TaskMapItem(
    val id: String,
    val category: GigsCategory,
    val state: MapPinState,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    /** Free-form price string ("$60", "$22/walk", "$180"). */
    val price: String,
    val distanceLabel: String,
    val bidCount: Int,
    /** Gig description — feeds the expanded-detent `GigRow` list. */
    val body: String = "",
    // P2 follow-up — raw fields the structured filter sheet matches on
    // (`GigFilterCriteria.matches`). Defaults keep seed/preview items
    // passing every dimension.
    val priceValue: Double? = null,
    val scheduleType: String? = null,
    val acceptedBy: String? = null,
    val createdAt: String? = null,
) {
    /** Projection into the shell's pin model — colour from the gig category
     * swatch, white-ring / dashed-outline treatment from [state]. */
    fun toPin(): MapPin =
        MapPin(
            id = id,
            latitude = latitude,
            longitude = longitude,
            color = category.color,
            state = state,
        )

    /** Projection into the feed's card model for the expanded-detent
     * vertical list — same `GigRow` as the Gigs feed. */
    fun cardContent(): GigCardContent =
        GigCardContent(
            id = id,
            category = category,
            metaLine = distanceLabel,
            title = title,
            body = body,
            price = price,
            bidCount = bidCount,
            distanceLabel = distanceLabel,
        )
}

/**
 * What the sheet body renders at each detent — the design's three-stop
 * contract: header-only when collapsed, the card rail at the standard
 * stop, the full vertical `GigRow` list when expanded.
 */
enum class TasksMapSheetMode {
    HeaderOnly,
    Rail,
    FullList,
    ;

    companion object {
        fun mode(detent: MapListHybridDetent): TasksMapSheetMode =
            when (detent) {
                MapListHybridDetent.Collapsed -> HeaderOnly
                MapListHybridDetent.Standard -> Rail
                MapListHybridDetent.Expanded -> FullList
            }
    }
}

/**
 * Secondary CTA in the empty sheet. Ladder: "Widen search" zooms the
 * camera out ×2.5 and refetches; once a widened refetch comes back
 * empty AND the backend supplied a `nearest_activity_center`, the
 * button becomes "Jump to activity".
 */
sealed interface TasksMapEmptyAction {
    data object Widen : TasksMapEmptyAction

    data class JumpToActivity(val latitude: Double, val longitude: Double) : TasksMapEmptyAction
}

/** Render state for the Tasks map — mirrors the four-state contract. */
sealed interface TasksMapUiState {
    data object Loading : TasksMapUiState

    data class Populated(val items: List<TaskMapItem>) : TasksMapUiState

    data object Empty : TasksMapUiState

    data class Error(val message: String) : TasksMapUiState
}

/**
 * Rail-card tile glyph for a task category. Best-fit from the typed icon
 * set for the design's per-category Lucide glyphs — `spray-can`, `truck`,
 * and `book-open` aren't in [PantopusIcon], so `Sparkles`, `Package`, and
 * `GraduationCap` stand in. Mirrors iOS `taskCategoryGlyph`.
 */
fun taskCategoryGlyph(category: GigsCategory): PantopusIcon =
    when (category) {
        GigsCategory.All -> PantopusIcon.Circle
        GigsCategory.Handyman -> PantopusIcon.Hammer
        GigsCategory.Cleaning -> PantopusIcon.Sparkles
        GigsCategory.Moving -> PantopusIcon.Package
        GigsCategory.PetCare -> PantopusIcon.PawPrint
        GigsCategory.ChildCare -> PantopusIcon.Baby
        GigsCategory.Tutoring -> PantopusIcon.GraduationCap
        GigsCategory.Tech -> PantopusIcon.Laptop
        GigsCategory.Delivery -> PantopusIcon.Send
    }
