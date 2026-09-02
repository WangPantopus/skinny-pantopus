package app.pantopus.android.ui.screens.root

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks [PantopusRoute] down (Wedge v2 D2): four tabs in a stable order,
 * unique `path` strings, the legacy Place path preserved, and the
 * off-bar pillars still resolvable so existing pushes land.
 */
class PantopusRouteTest {
    @Test fun four_tabs_in_display_order() {
        val entries = PantopusRoute.entries
        assertEquals(4, entries.size)
        assertEquals(PantopusRoute.Place, entries[0])
        assertEquals(PantopusRoute.Today, entries[1])
        assertEquals(PantopusRoute.Nearby, entries[2])
        assertEquals(PantopusRoute.Mail, entries[3])
        assertEquals(listOf("Place", "Today", "Nearby", "Mail"), entries.map { it.label })
    }

    @Test fun place_keeps_the_legacy_path() {
        assertEquals("root/home", PantopusRoute.Place.path)
    }

    @Test fun paths_are_unique_across_every_root_destination() {
        val paths = PantopusRoute.all.map { it.path }
        assertEquals(paths.size, paths.toSet().size)
        assertTrue(
            PantopusRoute.all.containsAll(
                listOf(PantopusRoute.Pulse, PantopusRoute.Tasks, PantopusRoute.Marketplace, PantopusRoute.Messages),
            ),
        )
    }

    @Test fun fromPath_round_trips_tabs_and_off_bar_routes() {
        for (route in PantopusRoute.all) {
            assertEquals(route, PantopusRoute.fromPath(route.path))
        }
        assertNull(PantopusRoute.fromPath("not/a/route"))
        assertNull(PantopusRoute.fromPath(null))
    }
}
