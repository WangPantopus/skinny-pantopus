package app.pantopus.android.ui.screens.root

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Locks [PantopusRoute] down: five destinations, stable order, unique
 * `path` strings, reverse lookup.
 */
class PantopusRouteTest {
    @Test fun five_entries_in_display_order() {
        val entries = PantopusRoute.entries
        assertEquals(5, entries.size)
        assertEquals(PantopusRoute.Home, entries[0])
        assertEquals(PantopusRoute.Pulse, entries[1])
        assertEquals(PantopusRoute.Tasks, entries[2])
        assertEquals(PantopusRoute.Marketplace, entries[3])
        assertEquals(PantopusRoute.Messages, entries[4])
    }

    @Test fun paths_are_unique() {
        val paths = PantopusRoute.entries.map { it.path }
        assertEquals(paths.size, paths.toSet().size)
    }

    @Test fun fromPath_round_trips() {
        for (route in PantopusRoute.entries) {
            assertEquals(route, PantopusRoute.fromPath(route.path))
        }
        assertNull(PantopusRoute.fromPath("not/a/route"))
        assertNull(PantopusRoute.fromPath(null))
    }
}
