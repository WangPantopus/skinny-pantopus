@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.discoverbusinesses

import app.pantopus.android.ui.screens.shared.filter_sheet.cleared
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * P5.2 — Business filter sheet mapping. Locks the typed ⇆ section
 * round-trip across every radius/rating stop, Reset → defaults, the
 * active-filter count, and section shape. Mirrors iOS
 * `BusinessFilterSheetTests`.
 */
class BusinessFilterSheetTest {
    @Test
    fun sections_round_trip_preserves_selection() {
        val original =
            DiscoverBusinessFilters(
                categories = setOf("home-services", "pets"),
                radiusMiles = 3.0,
                openNow = true,
                ratingFloor = 4.0,
            )
        assertEquals(original, businessFilters(businessSections(original)))
    }

    @Test
    fun sections_round_trip_every_radius_stop() {
        for (stop in BusinessFilterStops.radius) {
            val original = DiscoverBusinessFilters(radiusMiles = stop.value)
            assertEquals(stop.value, businessFilters(businessSections(original)).radiusMiles, 0.0)
        }
    }

    @Test
    fun sections_round_trip_rating_variants() {
        for (floor in listOf<Double?>(null, 3.0, 4.0, 4.5)) {
            val original = DiscoverBusinessFilters(ratingFloor = floor)
            assertEquals(floor, businessFilters(businessSections(original)).ratingFloor)
        }
    }

    @Test
    fun cleared_sections_parse_to_default() {
        val dirty =
            DiscoverBusinessFilters(
                categories = setOf("food", "auto"),
                radiusMiles = 0.5,
                openNow = true,
                ratingFloor = 4.5,
            )
        val parsed = businessFilters(businessSections(dirty).cleared())
        assertEquals(DiscoverBusinessFilters.Default, parsed)
        assertEquals(DiscoverBusinessFilters.DEFAULT_RADIUS_MILES, parsed.radiusMiles, 0.0)
    }

    @Test
    fun active_count() {
        assertEquals(0, DiscoverBusinessFilters.Default.activeCount)
        // Default radius is not an active filter.
        assertEquals(0, DiscoverBusinessFilters(radiusMiles = 5.0).activeCount)
        assertEquals(1, DiscoverBusinessFilters(radiusMiles = 1.0).activeCount)
        assertEquals(1, DiscoverBusinessFilters(categories = setOf("food", "pets")).activeCount)
        assertEquals(
            4,
            DiscoverBusinessFilters(
                categories = setOf("food"),
                radiusMiles = 1.0,
                openNow = true,
                ratingFloor = 4.0,
            ).activeCount,
        )
    }

    @Test
    fun sections_shape() {
        val sections = businessSections(DiscoverBusinessFilters.Default)
        assertEquals(listOf("category", "distance", "rating", "options"), sections.map { it.id })
    }
}
