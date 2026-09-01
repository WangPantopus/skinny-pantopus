@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.status

import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors iOS [StatusWaitingContentTests]. Pins the slot output of each
 * A18 design frame and its secondary state so design tweaks don't silently
 * drop a required slot.
 */
class StatusWaitingContentTest {
    // ── A18.2 Claim submitted ─────────────────────────────────────────────

    @Test
    fun claimSubmitted_fills_all_required_slots() {
        val content = StatusWaitingContent.claimSubmitted(homeName = "418 Linden Ave")
        assertEquals(HaloCircleTone.Success, content.halo.tone)
        assertEquals(PantopusIcon.Check, content.halo.icon)
        assertEquals("Claim submitted", content.headline)
        assertEquals("418 Linden Ave", content.addressChip)
        assertEquals(StatusPillTone.Success, content.statusPill?.tone)
        assertEquals("Decision usually within 3 business days", content.statusPill?.text)
        assertNull(content.timeline[0].sub)
        assertEquals(3, content.timeline.size)
        assertEquals(
            listOf(StatusStepState.Done, StatusStepState.Pending, StatusStepState.Pending),
            content.timeline.map { it.state },
        )
        assertEquals("view_status", content.primaryCta?.actionKey)
        assertEquals(PantopusIcon.ArrowRight, content.primaryCta?.icon)
        assertEquals("back_to_home", content.secondaryCta?.actionKey)
        assertTrue(content.actionStack.isEmpty())
    }

    @Test
    fun claimSubmitted_without_home_name_omits_chip() {
        assertNull(StatusWaitingContent.claimSubmitted(homeName = null).addressChip)
        assertNull(StatusWaitingContent.claimSubmitted(homeName = "").addressChip)
    }

    @Test
    fun claimApproved_swaps_halo_pill_and_dock() {
        val content = StatusWaitingContent.claimSubmitted(homeName = "418 Linden Ave", approved = true)
        assertEquals(PantopusIcon.BadgeCheck, content.halo.icon)
        assertEquals("You're the owner", content.headline)
        assertEquals(StatusPillTone.Success, content.statusPill?.tone)
        assertEquals("Approved", content.statusPill?.text)
        assertEquals(
            listOf(StatusStepState.Done, StatusStepState.Done, StatusStepState.Done),
            content.timeline.map { it.state },
        )
        assertEquals("Open your home", content.primaryCta?.label)
        assertEquals("View claim", content.secondaryCta?.label)
    }

    @Test
    fun claimApproved_uses_supplied_dates_instead_of_samples() {
        val content =
            StatusWaitingContent.claimSubmitted(
                homeName = "418 Linden Ave",
                approved = true,
                submittedOn = "Mar 2",
                decidedOn = "Mar 6",
            )
        assertEquals("Approved · Mar 6", content.statusPill?.text)
        assertEquals(listOf("Mar 2", null, "Mar 6"), content.timeline.map { it.sub })
    }

    // ── A18.3 Verification submitted ──────────────────────────────────────

    @Test
    fun verificationSubmitted_fills_all_required_slots() {
        val content =
            StatusWaitingContent.verificationSubmitted(
                homeName = "418 Linden Ave · Apt 3B",
                landlordEmail = "r.osman@acme-realty.com",
            )
        assertEquals(HaloCircleTone.Success, content.halo.tone)
        assertEquals(PantopusIcon.Check, content.halo.icon)
        assertEquals("Verification submitted", content.headline)
        assertEquals("r.osman@acme-realty.com", content.bodyEmphasis)
        assertTrue(content.subcopy.contains("r.osman@acme-realty.com"))
        assertEquals("418 Linden Ave · Apt 3B", content.addressChip)
        assertEquals(StatusPillTone.Success, content.statusPill?.tone)
        assertEquals("Most landlords confirm in 1–2 days", content.statusPill?.text)
        assertEquals(listOf("Lease + ID", "Landlord confirms", "Verified"), content.timeline.map { it.label })
        assertEquals(
            listOf(StatusStepState.Done, StatusStepState.Pending, StatusStepState.Pending),
            content.timeline.map { it.state },
        )
        // A18.3 inverts A18.2: "Back to home" is the primary CTA.
        assertEquals("Back to home", content.primaryCta?.label)
        assertEquals(PantopusIcon.Home, content.primaryCta?.icon)
        assertEquals("View status", content.secondaryCta?.label)
    }

    @Test
    fun verificationConfirmed_swaps_halo_pill_and_timeline() {
        val content =
            StatusWaitingContent.verificationSubmitted(
                homeName = "418 Linden Ave · Apt 3B",
                landlordEmail = "r.osman@acme-realty.com",
                landlordName = "Rashida Osman",
                confirmed = true,
            )
        assertEquals(PantopusIcon.UserCheck, content.halo.icon)
        assertEquals("Landlord confirmed", content.headline)
        assertEquals("Rashida Osman", content.bodyEmphasis)
        assertEquals(StatusPillTone.Primary, content.statusPill?.tone)
        assertEquals("Final review in progress", content.statusPill?.text)
        assertEquals(
            listOf(StatusStepState.Done, StatusStepState.Done, StatusStepState.Current),
            content.timeline.map { it.state },
        )
        assertEquals("Back to home", content.primaryCta?.label)
    }

    @Test
    fun verificationConfirmed_without_name_falls_back() {
        val content =
            StatusWaitingContent.verificationSubmitted(
                homeName = null,
                landlordEmail = "r.osman@acme-realty.com",
                confirmed = true,
            )
        assertEquals("Your landlord", content.bodyEmphasis)
        assertTrue(content.subcopy.startsWith("Your landlord"))
    }

    // ── A18.1 Check your email ────────────────────────────────────────────

    @Test
    fun checkYourEmail_waiting_state() {
        val content = StatusWaitingContent.checkYourEmail(email = "maria.k@email.com")
        assertEquals(HaloCircleTone.Info, content.halo.tone)
        assertEquals(PantopusIcon.MailCheck, content.halo.icon)
        assertEquals("Check your email", content.headline)
        assertEquals("maria.k@email.com", content.bodyEmphasis)
        assertEquals(StatusPillTone.Neutral, content.statusPill?.tone)
        assertEquals("Waiting for link click…", content.statusPill?.text)
        assertTrue(content.statusPill?.isSpinning == true)
        assertEquals(listOf("openMail", "resendEmail", "changeEmail"), content.actionStack.map { it.id })
        assertEquals(
            listOf(
                StatusActionButtonStyle.Primary,
                StatusActionButtonStyle.Outline,
                StatusActionButtonStyle.Underline,
            ),
            content.actionStack.map { it.style },
        )
        assertFalse(content.actionStack[1].isDisabled)
        assertEquals("Resend email", content.actionStack[1].label)
        assertTrue(content.footnote?.contains("spam") == true)
        assertNull(content.primaryCta)
        assertNull(content.secondaryCta)
        assertTrue(content.timeline.isEmpty())
    }

    @Test
    fun checkYourEmail_resent_state() {
        val content = StatusWaitingContent.checkYourEmail(email = "maria.k@email.com", resent = true)
        assertEquals(StatusPillTone.Success, content.statusPill?.tone)
        assertEquals("New link sent · just now", content.statusPill?.text)
        assertFalse(content.statusPill?.isSpinning == true)
        val resend = content.actionStack[1]
        assertTrue(resend.isDisabled)
        assertEquals("Resend in 0:42", resend.label)
        assertEquals(PantopusIcon.Timer, resend.icon)
        assertTrue(content.footnote?.contains("Double-check") == true)
    }

    @Test
    fun checkYourEmail_without_email_falls_back() {
        val content = StatusWaitingContent.checkYourEmail(email = null)
        assertNull(content.bodyEmphasis)
        assertTrue(content.subcopy.contains("your email"))
        assertFalse(content.subcopy.contains("@"))
    }

    // ── Under review (retained recipe) ────────────────────────────────────

    @Test
    fun underReview_fills_all_required_slots() {
        val content = StatusWaitingContent.underReview(homeName = "412 Elm St", submittedAgo = "2 days ago")
        assertEquals(HaloCircleTone.Warning, content.halo.tone)
        assertEquals("Under review", content.headline)
        assertTrue(content.subcopy.contains("412 Elm St"))
        assertTrue(content.subcopy.contains("2 days ago"))
        assertEquals(StatusPillTone.Warning, content.statusPill?.tone)
        assertEquals(3, content.timeline.size)
        assertEquals("review", content.currentStageId)
        assertEquals(listOf("addEvidence", "contactSupport"), content.actionCards.map { it.id })
        assertEquals(3, content.explainerBullets.size)
    }

    @Test
    fun underReview_without_submittedAgo_omits_clause() {
        val content = StatusWaitingContent.underReview(homeName = "412 Elm St", submittedAgo = null)
        assertFalse(content.subcopy.contains("Submitted "))
    }

    // ── Cross-frame invariants ────────────────────────────────────────────

    @Test
    fun every_frame_exposes_an_actionable_element() {
        val frames =
            listOf(
                StatusWaitingContent.claimSubmitted(homeName = null),
                StatusWaitingContent.claimSubmitted(homeName = null, approved = true),
                StatusWaitingContent.verificationSubmitted(homeName = null, landlordEmail = "l@x.com"),
                StatusWaitingContent.verificationSubmitted(homeName = null, landlordEmail = "l@x.com", confirmed = true),
                StatusWaitingContent.checkYourEmail(email = null),
                StatusWaitingContent.checkYourEmail(email = null, resent = true),
                StatusWaitingContent.underReview(homeName = null),
            )
        for (frame in frames) {
            assertTrue(
                "Frame ${frame.headline} needs a primary CTA or an action stack",
                frame.primaryCta != null || frame.actionStack.isNotEmpty(),
            )
        }
    }

    @Test
    fun homesClaimTimeline_has_three_stages() {
        assertEquals(
            listOf("submitted", "review", "complete"),
            StatusWaitingContent.homesClaimTimeline.map { it.id },
        )
    }
}
