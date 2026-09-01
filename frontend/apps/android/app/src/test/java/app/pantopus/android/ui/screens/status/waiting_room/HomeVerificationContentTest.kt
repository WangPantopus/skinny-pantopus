@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors iOS `HomeVerificationContentTests`. Pins the Verification
 * Center projection — the six `verification_status` frames RN renders on
 * `pantopus://homes/:id/waiting-room`
 * (`src/app/homes/[id]/waiting-room.tsx:242-313`), their countdown cards,
 * and the per-status action set.
 */
class HomeVerificationContentTest {
    // ── Status parsing ────────────────────────────────────────────────────

    @Test
    fun unknown_status_falls_back_to_unverified() {
        assertEquals(HomeVerificationStatus.Unverified, HomeVerificationStatus.from(null))
        assertEquals(HomeVerificationStatus.Unverified, HomeVerificationStatus.from("who_knows"))
        assertEquals(HomeVerificationStatus.PendingDoc, HomeVerificationStatus.from("pending_doc"))
        assertEquals(
            HomeVerificationStatus.ProvisionalBootstrap,
            HomeVerificationStatus.from("provisional_bootstrap"),
        )
    }

    // ── The six frames ────────────────────────────────────────────────────

    @Test
    fun pending_postcard_frame() {
        val content = HomeVerificationContent.make(HomeVerificationStatus.PendingPostcard)
        assertEquals("Check your mailbox", content.headline)
        assertEquals(HaloCircleTone.Info, content.halo.tone)
        assertEquals(PantopusIcon.Mail, content.halo.icon)
        assertTrue(content.body.contains("mailed to this address"))
    }

    @Test
    fun provisional_bootstrap_frame() {
        val content = HomeVerificationContent.make(HomeVerificationStatus.ProvisionalBootstrap)
        assertEquals("Limited access", content.headline)
        assertEquals(HaloCircleTone.Warning, content.halo.tone)
        assertTrue(content.body.contains("provisional access with limited features"))
    }

    @Test
    fun pending_approval_frame() {
        val content = HomeVerificationContent.make(HomeVerificationStatus.PendingApproval)
        assertEquals("Waiting for approval", content.headline)
        assertEquals(PantopusIcon.Hourglass, content.halo.icon)
        assertTrue(content.body.contains("household member needs to approve"))
    }

    @Test
    fun pending_doc_frame() {
        val content = HomeVerificationContent.make(HomeVerificationStatus.PendingDoc)
        assertEquals("Document under review", content.headline)
        assertEquals(HaloCircleTone.Warning, content.halo.tone)
        assertTrue(content.body.contains("1-2 business days"))
    }

    @Test
    fun provisional_splits_on_challenge_window() {
        val inWindow =
            HomeVerificationContent.make(
                HomeVerificationStatus.Provisional,
                isInChallengeWindow = true,
            )
        assertEquals("Challenge window active", inWindow.headline)
        assertEquals(HaloCircleTone.Info, inWindow.halo.tone)
        val outOfWindow = HomeVerificationContent.make(HomeVerificationStatus.Provisional)
        assertEquals("Provisional access", outOfWindow.headline)
        assertEquals(HaloCircleTone.Warning, outOfWindow.halo.tone)
    }

    @Test
    fun suspended_challenged_frame() {
        val content = HomeVerificationContent.make(HomeVerificationStatus.SuspendedChallenged)
        assertEquals("Access suspended", content.headline)
        assertEquals(PantopusIcon.AlertCircle, content.halo.icon)
        assertTrue(content.body.contains("challenged by a household member"))
    }

    @Test
    fun unverified_fallback_frame() {
        val content = HomeVerificationContent.make(HomeVerificationStatus.Unverified)
        assertEquals("Verification required", content.headline)
        assertEquals("Complete verification to access this home.", content.body)
    }

    // ── Countdown cards ───────────────────────────────────────────────────

    @Test
    fun postcard_expiry_renders_countdown() {
        val content =
            HomeVerificationContent.make(
                HomeVerificationStatus.PendingPostcard,
                postcardExpiresAt = "2026-09-01T00:00:00Z",
            )
        assertEquals("Code expires", content.countdown?.label)
        assertEquals(PantopusIcon.Mail, content.countdown?.icon)
        assertNotNull(content.countdown?.value)
    }

    @Test
    fun challenge_window_renders_countdown_only_while_open() {
        val open =
            HomeVerificationContent.make(
                HomeVerificationStatus.Provisional,
                isInChallengeWindow = true,
                challengeWindowEndsAt = "2026-09-01T00:00:00Z",
            )
        assertEquals("Challenge window ends", open.countdown?.label)
        val closed =
            HomeVerificationContent.make(
                HomeVerificationStatus.Provisional,
                isInChallengeWindow = false,
                challengeWindowEndsAt = "2026-09-01T00:00:00Z",
            )
        assertNull(closed.countdown)
    }

    @Test
    fun unparseable_date_omits_countdown_rather_than_printing_placeholder() {
        val content =
            HomeVerificationContent.make(
                HomeVerificationStatus.PendingPostcard,
                postcardExpiresAt = "not-a-date",
            )
        assertNull(content.countdown)
    }

    // ── Action sets ───────────────────────────────────────────────────────

    @Test
    fun pending_postcard_offers_code_entry_and_not_a_mailed_code_request() {
        val keys =
            HomeVerificationContent
                .make(HomeVerificationStatus.PendingPostcard)
                .actions
                .map { it.actionKey }
        assertEquals(HomeVerificationContent.ActionKey.ENTER_CODE, keys.first())
        assertFalse(keys.contains(HomeVerificationContent.ActionKey.REQUEST_MAILED_CODE))
        assertFalse(keys.contains(HomeVerificationContent.ActionKey.LANDLORD_VERIFICATION))
    }

    @Test
    fun pending_approval_offers_landlord_status_and_no_mailed_code() {
        val actions = HomeVerificationContent.make(HomeVerificationStatus.PendingApproval).actions
        val landlord =
            actions.firstOrNull { it.actionKey == HomeVerificationContent.ActionKey.LANDLORD_VERIFICATION }
        assertEquals("Check your approval status", landlord?.subtitle)
        assertFalse(
            actions.map { it.actionKey }.contains(HomeVerificationContent.ActionKey.REQUEST_MAILED_CODE),
        )
    }

    @Test
    fun provisional_offers_upload_landlord_and_mailed_code() {
        val keys =
            HomeVerificationContent
                .make(HomeVerificationStatus.Provisional)
                .actions
                .map { it.actionKey }
        assertTrue(keys.contains(HomeVerificationContent.ActionKey.UPLOAD_PROOF))
        assertTrue(keys.contains(HomeVerificationContent.ActionKey.LANDLORD_VERIFICATION))
        assertTrue(keys.contains(HomeVerificationContent.ActionKey.REQUEST_MAILED_CODE))
    }

    @Test
    fun every_frame_ends_with_move_out_and_help() {
        HomeVerificationStatus.entries.forEach { status ->
            val keys = HomeVerificationContent.make(status).actions.map { it.actionKey }
            assertEquals(
                "status ${status.raw}",
                listOf(
                    HomeVerificationContent.ActionKey.MOVE_OUT,
                    HomeVerificationContent.ActionKey.REQUEST_HELP,
                ),
                keys.takeLast(2),
            )
        }
    }

    @Test
    fun move_out_is_danger_toned() {
        val moveOut =
            HomeVerificationContent
                .make(HomeVerificationStatus.Unverified)
                .actions
                .firstOrNull { it.actionKey == HomeVerificationContent.ActionKey.MOVE_OUT }
        assertEquals(WaitingRoomActionTone.Danger, moveOut?.tone)
        assertEquals("This isn't my home", moveOut?.title)
    }
}
