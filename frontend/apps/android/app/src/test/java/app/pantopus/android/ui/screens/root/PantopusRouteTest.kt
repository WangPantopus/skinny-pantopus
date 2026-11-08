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
 * 2026-10-17), and with it on the Pulse build S3 tabs; Plans is drawn only while its switch is on. Messages is never on
 * the bar (founder decision 2026-11-08): the chat button opens it, Mail while Mailbox is off (Mail is the conversation
 * list then, so it leaves the bar too) and Messages while it is on. Unique `path` strings, the legacy Place path
 * preserved, and the off-bar routes still resolvable so existing pushes land (Nearby, Tasks and Marketplace belong to
 * Pulse with the redesign on).
 */
class PantopusRouteTest {
    @After fun tearDown() {
        LaunchFeatures.overrideForTesting = null
    }

    @Test fun launch_tabs_and_redesign_tabs() {
        // Mailbox is off for launch (contract §9): Mail is the conversation list, opened by the chat button.
        LaunchFeatures.overrideForTesting = emptySet()
        // The Pulse redesign is off for launch: the October 13 bar with Plans, its Nearby route named Pulse since the
        // founder's November 7 decision, without Messages.
        assertEquals(listOf("Place", "Today", "Pulse", "Plans"), PantopusRoute.entries.map { it.label })
        assertEquals(PantopusRoute.entries, PantopusRoute.barTabs(plansOn = true))
        assertEquals(listOf("Place", "Today", "Pulse"), PantopusRoute.barTabs(plansOn = false).map { it.label })
        assertEquals(PantopusRoute.Nearby, PantopusRoute.barTabFor(PantopusRoute.Pulse))
        assertEquals(PantopusRoute.Plans, PantopusRoute.barTabFor(PantopusRoute.Plans))
        // The Messages route belongs to Mail, which is the conversation list while Mailbox is off.
        assertEquals(PantopusRoute.Mail, PantopusRoute.barTabFor(PantopusRoute.Messages))
        assertEquals(PantopusRoute.Mail, PantopusRoute.messagesTab)
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.PULSE_REDESIGN)
        val entries = PantopusRoute.entries
        assertEquals(listOf(PantopusRoute.Place, PantopusRoute.Today, PantopusRoute.Pulse, PantopusRoute.Plans), entries)
        // With Mailbox on, Mail is the Mailbox and stays on the bar; Messages is off it, with the redesign off and on.
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.MAILBOX)
        assertEquals(listOf("Place", "Today", "Pulse", "Plans", "Mail"), PantopusRoute.entries.map { it.label })
        assertEquals(listOf("Place", "Today", "Pulse", "Mail"), PantopusRoute.barTabs(plansOn = false).map { it.label })
        assertEquals(PantopusRoute.Messages, PantopusRoute.barTabFor(PantopusRoute.Messages))
        assertEquals(PantopusRoute.Messages, PantopusRoute.messagesTab)
        LaunchFeatures.overrideForTesting = setOf(LaunchFeature.PULSE_REDESIGN, LaunchFeature.MAILBOX)
        val mailEntries = PantopusRoute.entries
        assertEquals(listOf("Place", "Today", "Pulse", "Plans", "Mail"), mailEntries.map { it.label })
        // The Plans switch decides whether the bar draws Plans.
        assertEquals(mailEntries, PantopusRoute.barTabs(plansOn = true))
        assertEquals(
            listOf(PantopusRoute.Place, PantopusRoute.Today, PantopusRoute.Pulse, PantopusRoute.Mail),
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
                    listOf(
                        PantopusRoute.Nearby,
                        PantopusRoute.Tasks,
                        PantopusRoute.Marketplace,
                        PantopusRoute.Messages,
                        PantopusRoute.Mail,
                    ),
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
