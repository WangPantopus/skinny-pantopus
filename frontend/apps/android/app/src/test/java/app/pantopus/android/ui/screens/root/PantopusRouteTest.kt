package app.pantopus.android.ui.screens.root

import app.pantopus.android.core.LaunchFeature
import app.pantopus.android.core.LaunchFeatures
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks [PantopusRoute] down (Pulse build S3): five tabs in a stable order (the last is Messages while Mailbox is
 * off; Plans is drawn only while its switch is on), unique `path` strings, the legacy Place path preserved, and the
 * off-bar routes still resolvable so existing pushes land (Nearby, Tasks and Marketplace belong to Pulse).
 */
class PantopusRouteTest {
    @After fun tearDown() {
        LaunchFeatures.overrideForTesting = null
    }

    @Test fun five_tabs_in_display_order_and_four_without_plans() {
        // Mailbox is off for launch (contract §9): the last tab reads Messages.
        LaunchFeatures.overrideForTesting = emptySet()
        val entries = PantopusRoute.entries
        assertEquals(5, entries.size)
        assertEquals(PantopusRoute.Place, entries[0])
        assertEquals(PantopusRoute.Today, entries[1])
        assertEquals(PantopusRoute.Pulse, entries[2])
        assertEquals(PantopusRoute.Plans, entries[3])
        assertEquals(PantopusRoute.Mail, entries[4])
        assertEquals(listOf("Place", "Today", "Pulse", "Plans", "Messages"), entries.map { it.label })
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.MAILBOX)
        assertEquals(listOf("Place", "Today", "Pulse", "Plans", "Mail"), entries.map { it.label })
        // The Plans switch decides whether the bar draws Plans.
        assertEquals(entries, PantopusRoute.barTabs(plansOn = true))
        assertEquals(listOf(PantopusRoute.Place, PantopusRoute.Today, PantopusRoute.Pulse, PantopusRoute.Mail), PantopusRoute.barTabs(plansOn = false))
    }

    @Test fun the_old_nearby_door_and_its_pillars_belong_to_pulse() {
        assertEquals(PantopusRoute.Pulse, PantopusRoute.barTabFor(PantopusRoute.Nearby))
        assertEquals(PantopusRoute.Pulse, PantopusRoute.barTabFor(PantopusRoute.Tasks))
        assertEquals(PantopusRoute.Pulse, PantopusRoute.barTabFor(PantopusRoute.Marketplace))
        assertEquals(PantopusRoute.Mail, PantopusRoute.barTabFor(PantopusRoute.Messages))
    }

    @Test fun place_keeps_the_legacy_path() {
        assertEquals("root/home", PantopusRoute.Place.path)
    }

    @Test fun paths_are_unique_across_every_root_destination() {
        val paths = PantopusRoute.all.map { it.path }
        assertEquals(paths.size, paths.toSet().size)
        assertTrue(
            PantopusRoute.all.containsAll(
                listOf(PantopusRoute.Nearby, PantopusRoute.Tasks, PantopusRoute.Marketplace, PantopusRoute.Messages),
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
