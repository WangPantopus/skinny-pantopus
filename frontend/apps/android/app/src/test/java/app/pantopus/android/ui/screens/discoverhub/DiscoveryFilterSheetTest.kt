@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.discoverhub

import app.pantopus.android.ui.screens.shared.filter_sheet.cleared
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * P5.2 — Discovery filter sheet mapping. Locks the typed ⇆ section
 * round-trip, Reset → defaults, the active-filter count, and section
 * shape. Mirrors iOS `DiscoveryFilterSheetTests`.
 */
class DiscoveryFilterSheetTest {
    @Test
    fun sections_round_trip_preserves_selection() {
        val original =
            DiscoverHubFilters(
                contentTypes = setOf(DiscoverHubSection.PEOPLE, DiscoverHubSection.GIGS),
                verifiedOnly = true,
                newestFirst = false,
            )
        assertEquals(original, discoveryFilters(discoverySections(original)))
    }

    @Test
    fun sections_round_trip_all_on() {
        val original =
            DiscoverHubFilters(
                contentTypes =
                    setOf(
                        DiscoverHubSection.PEOPLE,
                        DiscoverHubSection.BUSINESSES,
                        DiscoverHubSection.GIGS,
                        DiscoverHubSection.LISTINGS,
                    ),
                verifiedOnly = true,
                newestFirst = true,
            )
        assertEquals(original, discoveryFilters(discoverySections(original)))
    }

    @Test
    fun cleared_sections_parse_to_default() {
        val dirty =
            DiscoverHubFilters(
                contentTypes = setOf(DiscoverHubSection.PEOPLE),
                verifiedOnly = true,
                newestFirst = true,
            )
        assertEquals(DiscoverHubFilters.Default, discoveryFilters(discoverySections(dirty).cleared()))
    }

    @Test
    fun active_count() {
        assertEquals(0, DiscoverHubFilters.Default.activeCount)
        // A multi-chip selection still counts as a single dimension.
        assertEquals(
            1,
            DiscoverHubFilters(
                contentTypes = setOf(DiscoverHubSection.PEOPLE, DiscoverHubSection.GIGS),
            ).activeCount,
        )
        assertEquals(
            3,
            DiscoverHubFilters(
                contentTypes = setOf(DiscoverHubSection.PEOPLE),
                verifiedOnly = true,
                newestFirst = true,
            ).activeCount,
        )
    }

    @Test
    fun sections_shape() {
        val sections = discoverySections(DiscoverHubFilters.Default)
        assertEquals(listOf("contentType", "options"), sections.map { it.id })
    }
}
