@file:Suppress("MagicNumber", "PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.nearby.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.ui.screens.gigs.GigFilterCriteria
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterRange
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSection
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetShell

/**
 * P5.3 — Nearby map filter bottom sheet. Same gig dimensions as
 * [GigFilterCriteria] plus an entity-type selector at the top and a
 * distance-radius slider. Mirrors the iOS `MapFilterSheet.swift`.
 */

/** Which entity kinds the map shows. [Both] is the cleared position. */
enum class MapEntityType(
    val key: String,
    val label: String,
) {
    Both("both", "Both"),
    Gigs("gigs", "Gigs"),
    Listings("listings", "Listings"),
    ;

    val allowsGigs: Boolean get() = this != Listings
    val allowsListings: Boolean get() = this != Gigs

    companion object {
        fun fromKey(key: String?): MapEntityType = entries.firstOrNull { it.key == key } ?: Both
    }
}

/**
 * The applied Nearby-map filter selection. Wraps a [GigFilterCriteria]
 * for the gig dimensions and layers entity-type + distance on top.
 */
@Immutable
data class MapFilterCriteria(
    val entityType: MapEntityType = MapEntityType.Both,
    /** Lower distance handle (miles). [DISTANCE_MIN] == no lower bound. */
    val distanceLower: Float = DISTANCE_MIN,
    /** Upper distance handle (miles). [DISTANCE_MAX] == no radius cap. */
    val distanceUpper: Float = DISTANCE_MAX,
    /** Shared gig dimensions (category / budget / schedule / bids / age). */
    val gig: GigFilterCriteria = GigFilterCriteria(),
) {
    val isDistanceActive: Boolean
        get() = distanceLower > DISTANCE_MIN || distanceUpper < DISTANCE_MAX

    val activeCount: Int
        get() {
            var count = gig.activeCount
            if (entityType != MapEntityType.Both) count++
            if (isDistanceActive) count++
            return count
        }

    fun toSections(): List<FilterSection> {
        val head =
            listOf(
                FilterSection(
                    id = "entityType",
                    title = "Show",
                    control =
                        FilterControl.Radio(
                            options = MapEntityType.entries.map { FilterOption(it.key, it.label) },
                            selectedId = entityType.key,
                        ),
                ),
                FilterSection(
                    id = "distance",
                    title = "Distance (mi)",
                    control =
                        FilterControl.RangeSlider(
                            FilterRange(DISTANCE_MIN, DISTANCE_MAX, distanceLower, distanceUpper, DISTANCE_STEP),
                        ),
                ),
            )
        // The map contributes its own radius *range* and the gig criteria
        // contribute radius *presets*; both are kept deliberately, and they
        // intersect when filtering. Two headers reading "Distance" would be
        // unreadable, so the gig-supplied one is retitled here only. The ids
        // stay as they are — both parse sides discriminate on control type,
        // and the shell iterates by index, so the repeat is harmless.
        return head +
            gig.toSections().map { section ->
                if (section.id == "distance") section.copy(title = "Gig radius") else section
            }
    }

    fun matchesDistance(miles: Double?): Boolean {
        if (!isDistanceActive) return true
        if (miles == null) return false
        val withinLower = miles >= distanceLower
        val withinUpper = distanceUpper >= DISTANCE_MAX || miles <= distanceUpper
        return withinLower && withinUpper
    }

    fun matchesGig(
        gigDto: GigDto,
        distanceMiles: Double?,
        nowEpochSeconds: Long,
    ): Boolean = entityType.allowsGigs && matchesDistance(distanceMiles) && gig.matches(gigDto, nowEpochSeconds)

    // Schedule / open-to-bids / posted-within are gig-only concepts —
    // listings only honour the category + budget dimensions.
    fun matchesListing(
        listing: ListingDto,
        distanceMiles: Double?,
    ): Boolean {
        return entityType.allowsListings &&
            matchesDistance(distanceMiles) &&
            gig.matchesCategory(GigsCategory.fromBackendKey(listing.category)) &&
            gig.matchesBudget(listing.price)
    }

    companion object {
        const val DISTANCE_MIN = 0f
        const val DISTANCE_MAX = 5f
        const val DISTANCE_STEP = 1f

        fun fromSections(sections: List<FilterSection>): MapFilterCriteria {
            var entityType = MapEntityType.Both
            var distanceLower = DISTANCE_MIN
            var distanceUpper = DISTANCE_MAX
            sections.forEach { section ->
                val control = section.control
                when (section.id) {
                    "entityType" ->
                        if (control is FilterControl.Radio) entityType = MapEntityType.fromKey(control.selectedId)
                    "distance" ->
                        if (control is FilterControl.RangeSlider) {
                            distanceLower = control.range.lower
                            distanceUpper = control.range.upper
                        }
                }
            }
            // Gig dimensions parse themselves out of the same section list by id.
            return MapFilterCriteria(
                entityType = entityType,
                distanceLower = distanceLower,
                distanceUpper = distanceUpper,
                gig = GigFilterCriteria.fromSections(sections),
            )
        }
    }
}

/** Nearby map filter bottom sheet. */
@Composable
fun MapFilterSheet(
    criteria: MapFilterCriteria,
    onApply: (MapFilterCriteria) -> Unit,
    onDismiss: () -> Unit,
) {
    FilterSheetShell(
        sections = criteria.toSections(),
        onApply = { sections -> onApply(MapFilterCriteria.fromSections(sections)) },
        onDismiss = onDismiss,
        title = "Filters",
    )
}
