@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.screens.status.StatusPillTone
import app.pantopus.android.ui.screens.status.StatusStepState
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors iOS [WaitingRoomContentTests]. Pins the slot output of the A18.4
 * active wait + the "more info requested · review paused" secondary state so
 * design tweaks can't silently drop a required slot, and keeps the copy
 * byte-identical to the iOS twin.
 */
class WaitingRoomContentTest {
    // ── Active wait ───────────────────────────────────────────────────────

    @Test
    fun active_fills_all_required_slots() {
        val content = WaitingRoomContent.active()
        assertEquals("Waiting for approval", content.title)
        // Info-toned, pulsing halo — review isn't done, so not success green.
        assertEquals(HaloCircleTone.Info, content.halo.tone)
        assertEquals(PantopusIcon.Hourglass, content.halo.icon)
        assertTrue(content.halo.isPulsing)
        assertEquals("Under review", content.headline)
        assertTrue(content.subcopy.contains("checking your documents against county records"))
        assertEquals("418 Linden Ave · Apt 3B", content.address)
        assertEquals("CLM-4F2A", content.claimRef)
        assertNull(content.reviewerNote)
        assertEquals(listOf("Submitted", "Under review", "Approved"), content.timeline.map { it.label })
        assertEquals(
            listOf(StatusStepState.Done, StatusStepState.Current, StatusStepState.Pending),
            content.timeline.map { it.state },
        )
        assertEquals("Started 9h ago", content.timeline[1].sub)
        assertFalse(content.timelinePaused)
        assertEquals(StatusPillTone.Primary, content.etaPill.tone)
        assertEquals("Decision usually within 24–48 hours", content.etaPill.text)
        assertEquals(PantopusIcon.CalendarClock, content.etaPill.icon)
        assertEquals("Manage this claim", content.manageSectionTitle)
        assertEquals("View claim", content.primaryCta.label)
        assertEquals(PantopusIcon.FileText, content.primaryCta.icon)
        assertEquals("Back to home", content.secondaryCta.label)
    }

    @Test
    fun active_inline_actions_are_standard_update_and_danger_cancel() {
        val actions = WaitingRoomContent.active().inlineActions
        assertEquals(listOf("updateEvidence", "cancelClaim"), actions.map { it.id })
        assertEquals(listOf("Update evidence", "Cancel claim"), actions.map { it.label })
        assertEquals(listOf(PantopusIcon.FilePlus2, PantopusIcon.XCircle), actions.map { it.icon })
        assertEquals(
            listOf(WaitingRoomActionTone.Standard, WaitingRoomActionTone.Danger),
            actions.map { it.tone },
        )
        assertEquals(listOf("update_evidence", "cancel_claim"), actions.map { it.actionKey })
    }

    // ── More info requested · review paused ───────────────────────────────

    @Test
    fun moreInfo_swaps_halo_headline_and_pause() {
        val content = WaitingRoomContent.moreInfoRequested()
        assertEquals("Waiting for approval", content.title)
        assertEquals(HaloCircleTone.Warning, content.halo.tone)
        assertEquals(PantopusIcon.FileWarning, content.halo.icon)
        assertFalse(content.halo.isPulsing)
        assertEquals("We need one more thing", content.headline)
        assertTrue(content.subcopy.contains("older than 90 days"))
        assertTrue(content.subcopy.contains("last 60 days"))
        assertEquals("418 Linden Ave · Apt 3B", content.address)
        assertEquals("CLM-4F2A", content.claimRef)
        assertTrue(content.timelinePaused)
        assertEquals(
            listOf(StatusStepState.Done, StatusStepState.Current, StatusStepState.Pending),
            content.timeline.map { it.state },
        )
        assertEquals("Action needed", content.timeline[1].sub)
        assertEquals(StatusPillTone.Warning, content.etaPill.tone)
        assertEquals("Paused · respond within 7 days", content.etaPill.text)
        assertEquals(PantopusIcon.AlertCircle, content.etaPill.icon)
    }

    @Test
    fun moreInfo_shows_reviewer_note() {
        val note = WaitingRoomContent.moreInfoRequested().reviewerNote
        assertNotNull(note)
        assertEquals("Note from reviewer · Maya K.", note?.eyebrow)
        assertTrue(note?.body?.contains("July 14") == true)
        assertTrue(note?.body?.contains("last 60 days") == true)
    }

    @Test
    fun moreInfo_promotes_update_evidence_to_primary() {
        val actions = WaitingRoomContent.moreInfoRequested().inlineActions
        assertEquals(listOf("updateEvidence", "cancelClaim"), actions.map { it.id })
        assertEquals(
            listOf(WaitingRoomActionTone.Primary, WaitingRoomActionTone.Danger),
            actions.map { it.tone },
        )
        assertEquals(listOf("update_evidence", "cancel_claim"), actions.map { it.actionKey })
    }

    // ── Cross-frame invariants ────────────────────────────────────────────

    @Test
    fun dock_is_constant_across_both_frames() {
        for (content in listOf(WaitingRoomContent.active(), WaitingRoomContent.moreInfoRequested())) {
            assertEquals("view_claim", content.primaryCta.actionKey)
            assertEquals("back_to_home", content.secondaryCta.actionKey)
            assertEquals("Manage this claim", content.manageSectionTitle)
        }
    }

    @Test
    fun state_seeds_the_matching_frame() {
        assertEquals("Under review", WaitingRoomState.Active.content().headline)
        assertEquals("We need one more thing", WaitingRoomState.MoreInfoRequested.content().headline)
    }
}
