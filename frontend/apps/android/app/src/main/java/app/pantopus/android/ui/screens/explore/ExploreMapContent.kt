@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.explore

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import kotlin.math.abs

/**
 * A11.2 Explore — content models for the cross-type discovery map.
 * Mirrors the iOS `ExploreMapContent.swift`. Four entity kinds (task /
 * item / post / spot), each with its own accent color, pin glyph, and
 * per-type badge.
 */

/**
 * The discovery entity kinds the Explore map mixes.
 *
 * `Task` / `Item` come from the gig + listing in-bounds routes; `Post`,
 * `Spot` (business), and `Home` come from the multi-layer viewport route
 * `GET /api/posts/map` — route `backend/routes/posts.js:1646`.
 */
enum class ExploreKind(
    val key: String,
    val pluralLabel: String,
    val singularLabel: String,
) {
    Task("task", "Tasks", "Task"),
    Item("item", "Items", "Item"),
    Post("post", "Posts", "Post"),
    Spot("spot", "Spots", "Spot"),
    Home("home", "Homes", "Home"),
    ;

    /**
     * Accent color — design palette mapped to existing tokens: task →
     * gigs orange, item → business violet, post → primary-500 sky, spot
     * → home green, home → home-dark green. (No new tokens introduced.)
     */
    val color: Color
        get() =
            when (this) {
                Task -> PantopusColors.gigs
                Item -> PantopusColors.business
                Post -> PantopusColors.primary500
                Spot -> PantopusColors.home
                Home -> PantopusColors.homeDark
            }

    /** White glyph rendered inside the pin + on the rail-card tile. */
    val glyph: PantopusIcon
        get() =
            when (this) {
                Task -> PantopusIcon.Hammer
                Item -> PantopusIcon.Tag
                Post -> PantopusIcon.MessageCircle
                Spot -> PantopusIcon.Building2
                Home -> PantopusIcon.Home
            }

    /** Items render as a rounded square; the others as discs. */
    val isSquarePin: Boolean get() = this == Item

    companion object {
        fun fromKey(key: String?): ExploreKind? = entries.firstOrNull { it.key == key }
    }
}

/** Per-pin lifecycle state — confirmed gets a white ring, pending dashes. */
enum class ExploreEntityState { Confirmed, Pending }

/** Per-type badge tone — resolves to a token color pair at render time. */
enum class ExploreBadgeTone { Bids, New, Replies, Rating }

/** Coordinate target used when another surface asks Explore to open a saved place on the map. */
@Immutable
data class ExploreMapFocus(
    val latitude: Double,
    val longitude: Double,
    val label: String,
)

@Immutable
data class ExploreBadge(
    val text: String,
    val tone: ExploreBadgeTone,
)

/** One pin / one card / one row, rolled up. */
@Immutable
data class ExploreEntity(
    val id: String,
    val kind: ExploreKind,
    val state: ExploreEntityState,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    /** Leading meta token — "$60" / "Asked 2h ago" / "Open". */
    val metaLead: String,
    val distanceLabel: String,
    val distanceMiles: Double,
    val badge: ExploreBadge?,
    val city: String? = null,
    val stateName: String? = null,
    val geocodePlaceId: String? = null,
    val sourceId: String? = null,
    val verified: Boolean,
    val openNow: Boolean,
)

/** Sort applied locally to the sheet body. */
enum class ExploreSort(val key: String, val label: String) {
    Closest("closest", "Closest"),
    Newest("newest", "Newest"),
}

/** Bottom-sheet snap stop — mirrors the Nearby map's three positions. */
enum class ExploreSheetStop(val heightFraction: Float) {
    Collapsed(0.20f),
    Standard(0.40f),
    Expanded(0.70f),
}

/** A clustered group of ≥2 entities. */
@Immutable
data class ExploreCluster(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val kind: ExploreKind,
    val count: Int,
    val entityIds: List<String>,
    val minLatitude: Double,
    val maxLatitude: Double,
    val minLongitude: Double,
    val maxLongitude: Double,
)

/** One drawable marker — a single typed pin or a cluster glyph. */
sealed interface ExploreMarker {
    val id: String
    val latitude: Double
    val longitude: Double

    @Immutable
    data class Entity(val entity: ExploreEntity) : ExploreMarker {
        override val id: String get() = "entity_${entity.id}"
        override val latitude: Double get() = entity.latitude
        override val longitude: Double get() = entity.longitude
    }

    @Immutable
    data class Cluster(val cluster: ExploreCluster) : ExploreMarker {
        override val id: String get() = "cluster_${cluster.id}"
        override val latitude: Double get() = cluster.latitude
        override val longitude: Double get() = cluster.longitude
    }
}

/** Render state for the Explore map screen. */
sealed interface ExploreMapUiState {
    data object Loading : ExploreMapUiState

    data class Loaded(
        val entities: List<ExploreEntity>,
        val markers: List<ExploreMarker>,
        val userCoordinate: UserCoordinate?,
        val selectedId: String?,
    ) : ExploreMapUiState {
        /** Designed empty state — filters narrowed a load to zero results. */
        val isEmpty: Boolean get() = entities.isEmpty()
    }

    data class Error(val message: String) : ExploreMapUiState
}

/**
 * The applied Explore-map filter selection. An empty [kinds] set means
 * "all kinds" (the cleared / no-filter position), matching the Discover
 * hub content-type convention.
 */
@Immutable
data class ExploreFilterCriteria(
    val kinds: Set<ExploreKind> = emptySet(),
    val distanceUpper: Float = DISTANCE_STOPS.last(),
    val verifiedOnly: Boolean = false,
    val openNow: Boolean = false,
) {
    val distanceIndex: Int
        get() =
            DISTANCE_STOPS.indexOf(distanceUpper).takeIf { it >= 0 }
                ?: DISTANCE_STOPS.indices.minBy { abs(DISTANCE_STOPS[it] - distanceUpper) }

    val isDistanceActive: Boolean get() = distanceUpper < DISTANCE_STOPS[DISTANCE_DEFAULT_INDEX]

    val isKindActive: Boolean get() = kinds.isNotEmpty() && kinds.size < ExploreKind.entries.size

    /** Number of active dimensions — drives the pill badge + header suffix. */
    val activeCount: Int
        get() {
            var count = 0
            if (isKindActive) count++
            if (isDistanceActive) count++
            if (verifiedOnly) count++
            if (openNow) count++
            return count
        }

    fun matches(entity: ExploreEntity): Boolean =
        (!isKindActive || kinds.contains(entity.kind)) &&
            (!isDistanceActive || entity.distanceMiles <= distanceUpper) &&
            (!verifiedOnly || entity.verified) &&
            (!openNow || entity.openNow)

    fun toSections(): List<FilterSection> =
        listOf(
            FilterSection(
                id = "contentType",
                title = "Content type",
                control =
                    FilterControl.ChipGroup(
                        options = ExploreKind.entries.map { FilterOption(it.key, it.pluralLabel) },
                        selectedIds = kinds.map { it.key }.toSet(),
                    ),
            ),
            FilterSection(
                id = "distance",
                title = "Distance",
                control =
                    FilterControl.StepSlider(
                        stops = DISTANCE_STOPS.map { FilterOption(stopId(it), stopLabel(it)) },
                        selectedIndex = distanceIndex,
                        defaultIndex = DISTANCE_DEFAULT_INDEX,
                    ),
            ),
            FilterSection(
                id = "refine",
                title = "Refine",
                control =
                    FilterControl.Toggle(
                        options =
                            listOf(
                                FilterOption("verified", "Verified only"),
                                FilterOption("openNow", "Open now"),
                            ),
                        selectedIds =
                            buildSet {
                                if (verifiedOnly) add("verified")
                                if (openNow) add("openNow")
                            },
                    ),
            ),
        )

    companion object {
        val DISTANCE_STOPS = listOf(0.5f, 1f, 3f, 5f, 10f)
        val DISTANCE_DEFAULT_INDEX = DISTANCE_STOPS.size - 1

        private fun stopId(value: Float): String = if (value == value.toInt().toFloat()) value.toInt().toString() else value.toString()

        private fun stopLabel(value: Float): String = "${stopId(value)} mi"

        fun fromSections(sections: List<FilterSection>): ExploreFilterCriteria {
            var kinds = emptySet<ExploreKind>()
            var distanceUpper = DISTANCE_STOPS.last()
            var verifiedOnly = false
            var openNow = false
            sections.forEach { section ->
                when (val control = section.control) {
                    is FilterControl.ChipGroup ->
                        if (section.id == "contentType") {
                            kinds = control.selectedIds.mapNotNull { ExploreKind.fromKey(it) }.toSet()
                        }
                    is FilterControl.StepSlider ->
                        if (section.id == "distance") {
                            distanceUpper = DISTANCE_STOPS.getOrElse(control.selectedIndex) { DISTANCE_STOPS.last() }
                        }
                    is FilterControl.Toggle ->
                        if (section.id == "refine") {
                            verifiedOnly = control.selectedIds.contains("verified")
                            openNow = control.selectedIds.contains("openNow")
                        }
                    else -> Unit
                }
            }
            return ExploreFilterCriteria(kinds, distanceUpper, verifiedOnly, openNow)
        }
    }
}
