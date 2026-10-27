package app.pantopus.android.ui.screens.root

import app.pantopus.android.core.LaunchFeature
import app.pantopus.android.core.LaunchFeatures
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks [PantopusRoute] down: the October 13 tabs plus Plans while the Pulse redesign is off (launch cut 11; founder,
 * 2026-10-17), and with it on five tabs (Pulse build S3); Plans is drawn only while its switch is on. Each in a stable
 * order (the last is Messages while Mailbox is off; with it on Messages follows Mail as a sixth tab, the Mail tab of
 * 2026-10-27), unique `path` strings, the legacy Place path preserved, and the off-bar routes still resolvable so
 * existing pushes land (Nearby, Tasks and Marketplace belong to Pulse with the redesign on).
 */
class PantopusRouteTest {
    @After fun tearDown() {
        LaunchFeatures.overrideForTesting = null
    }

    @Test fun launch_tabs_and_redesign_tabs() {
        // Mailbox is off for launch (contract §9): the last tab reads Messages.
        LaunchFeatures.overrideForTesting = emptySet()
        // The Pulse redesign is off for launch: the October 13 bar with Plans before Messages, and Pulse behind Nearby.
        assertEquals(listOf("Place", "Today", "Nearby", "Plans", "Messages"), PantopusRoute.entries.map { it.label })
        assertEquals(PantopusRoute.entries, PantopusRoute.barTabs(plansOn = true))
        // While the Plans switch is off, the October 13 bar exactly.
        assertEquals(listOf("Place", "Today", "Nearby", "Messages"), PantopusRoute.barTabs(plansOn = false).map { it.label })
        assertEquals(PantopusRoute.Nearby, PantopusRoute.barTabFor(PantopusRoute.Pulse))
        assertEquals(PantopusRoute.Plans, PantopusRoute.barTabFor(PantopusRoute.Plans))
        // The Messages route belongs to Mail, which is the conversation list while Mailbox is off.
        assertEquals(PantopusRoute.Mail, PantopusRoute.barTabFor(PantopusRoute.Messages))
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.PULSE_REDESIGN)
        val entries = PantopusRoute.entries
        assertEquals(5, entries.size)
        assertEquals(PantopusRoute.Place, entries[0])
        assertEquals(PantopusRoute.Today, entries[1])
        assertEquals(PantopusRoute.Pulse, entries[2])
        assertEquals(PantopusRoute.Plans, entries[3])
        assertEquals(PantopusRoute.Mail, entries[4])
        assertEquals(listOf("Place", "Today", "Pulse", "Plans", "Messages"), entries.map { it.label })
        // With Mailbox on, Messages is its own tab after Mail, with the Pulse redesign off and on.
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.MAILBOX)
        assertEquals(listOf("Place", "Today", "Nearby", "Plans", "Mail", "Messages"), PantopusRoute.entries.map { it.label })
        assertEquals(listOf("Place", "Today", "Nearby", "Mail", "Messages"), PantopusRoute.barTabs(plansOn = false).map { it.label })
        assertEquals(PantopusRoute.Messages, PantopusRoute.barTabFor(PantopusRoute.Messages))
        assertEquals(PantopusRoute.Messages, PantopusRoute.messagesTab)
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.PULSE_REDESIGN, LaunchFeature.MAILBOX)
        val mailEntries = PantopusRoute.entries
        assertEquals(listOf("Place", "Today", "Pulse", "Plans", "Mail", "Messages"), mailEntries.map { it.label })
        // The Plans switch decides whether the bar draws Plans.
        assertEquals(mailEntries, PantopusRoute.barTabs(plansOn = true))
        assertEquals(
            listOf(PantopusRoute.Place, PantopusRoute.Today, PantopusRoute.Pulse, PantopusRoute.Mail, PantopusRoute.Messages),
            PantopusRoute.barTabs(plansOn = false),
        )
    }

    @Test fun place_keeps_the_legacy_path() {
        assertEquals("root/home", PantopusRoute.Place.path)
    }

    @Test fun paths_are_unique_across_every_root_destination() {
        for (features in FEATURE_SETS) {
            LaunchFeatures.overrideForTesting = features
            val paths = PantopusRoute.all.map { it.path }
            assertEquals(paths.size, paths.toSet().size)
            assertTrue(
                PantopusRoute.all.containsAll(
                    listOf(PantopusRoute.Nearby, PantopusRoute.Tasks, PantopusRoute.Marketplace, PantopusRoute.Messages),
                ),
            )
        }
    }

    @Test fun fromPath_round_trips_tabs_and_off_bar_routes() {
        for (features in FEATURE_SETS) {
            LaunchFeatures.overrideForTesting = features
            for (route in PantopusRoute.all) {
                assertEquals(route, PantopusRoute.fromPath(route.path))
            }
        }
        assertNull(PantopusRoute.fromPath("not/a/route"))
        assertNull(PantopusRoute.fromPath(null))
    }

    private companion object {
        val FEATURE_SETS =
            listOf(
                emptySet(),
                setOf(LaunchFeature.PULSE_REDESIGN),
                setOf(LaunchFeature.MAILBOX),
                setOf(LaunchFeature.PULSE_REDESIGN, LaunchFeature.MAILBOX),
            )
    }
}
