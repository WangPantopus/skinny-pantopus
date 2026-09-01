@file:Suppress("PackageNaming", "FunctionNaming", "TooManyFunctions", "LargeClass")

package app.pantopus.android.ui.screens.shared

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * P9.1 — new-design pack snapshot lockfile (Android half).
 *
 * Locks the May 2026 design hand-off (A03 / A09 / A10 / A12 / A13 / A14 /
 * A17 / A18 / A21) as the durable visual reference for every screen built
 * out across Phases 1–8. One @Test per screen × designed variant — 88
 * rows total — each asserting that its committed reference PNG stays checked
 * in at:
 *
 *   app/src/test/snapshots/images/new-designs/<slug>.png
 *
 * This is a *presence tripwire* that mirrors the iOS
 * `NewDesignScreensSnapshotTests.swift` and lives under the Paparazzi
 * snapshot directory by convention. It deliberately does NOT use a
 * `Paparazzi` @get:Rule: the per-screen Paparazzi suites (e.g.
 * `WalletSnapshotTest`) lock the on-device Compose render; this file locks
 * the *design pack* those screens target, so it needs no Android SDK /
 * layoutlib to verify and passes wherever the JVM unit tests run. The
 * reference PNGs are byte-identical to the iOS set (one design per screen ×
 * variant, shared across platforms). See
 * `frontend/apps/ios/PantopusTests/Features/Shared/NEW_DESIGNS.md` for the
 * regeneration policy.
 */
class NewDesignScreensSnapshotTest {
    private val baselineDir: File =
        run {
            val candidates =
                listOf(
                    "src/test/snapshots/images/new-designs",
                    "app/src/test/snapshots/images/new-designs",
                    "frontend/apps/android/app/src/test/snapshots/images/new-designs",
                )
            candidates.map(::File).firstOrNull { it.isDirectory } ?: File(candidates.first())
        }

    // ---- A03 — Pulse feed (tab archetype)
    @Test
    fun a03_1_pulse_populated() {
        assertBaseline("a03-1-pulse-populated")
    }

    @Test
    fun a03_1_pulse_empty() {
        assertBaseline("a03-1-pulse-empty")
    }

    @Test
    fun a03_2_beacons_populated() {
        assertBaseline("a03-2-beacons-populated")
    }

    @Test
    fun a03_2_beacons_empty() {
        assertBaseline("a03-2-beacons-empty")
    }

    // ---- A09 — Transactional detail (sticky-dock archetype)
    @Test
    fun a09_1_task_v2_populated() {
        assertBaseline("a09-1-task-v2-populated")
    }

    @Test
    fun a09_1_task_v2_no_bids() {
        assertBaseline("a09-1-task-v2-no-bids")
    }

    @Test
    fun a09_2_gig_v1_populated() {
        assertBaseline("a09-2-gig-v1-populated")
    }

    @Test
    fun a09_2_gig_v1_awarded() {
        assertBaseline("a09-2-gig-v1-awarded")
    }

    @Test
    fun a09_3_listing_populated() {
        assertBaseline("a09-3-listing-populated")
    }

    @Test
    fun a09_3_listing_sold() {
        assertBaseline("a09-3-listing-sold")
    }

    @Test
    fun a09_4_invoice_due() {
        assertBaseline("a09-4-invoice-due")
    }

    @Test
    fun a09_4_invoice_paid() {
        assertBaseline("a09-4-invoice-paid")
    }

    // ---- A10 — Detail: content
    @Test
    fun a10_9_support_train_populated() {
        assertBaseline("a10-9-support-train-populated")
    }

    @Test
    fun a10_9_support_train_covered() {
        assertBaseline("a10-9-support-train-covered")
    }

    @Test
    fun a10_10_wallet_populated() {
        assertBaseline("a10-10-wallet-populated")
    }

    @Test
    fun a10_10_wallet_hold() {
        assertBaseline("a10-10-wallet-hold")
    }

    // ---- A12 — Wizard archetype (multi-step)
    @Test
    fun a12_4_claim_evidence_ready() {
        assertBaseline("a12-4-claim-evidence-ready")
    }

    @Test
    fun a12_4_claim_evidence_in_progress() {
        assertBaseline("a12-4-claim-evidence-in-progress")
    }

    @Test
    fun a12_5_verify_landlord_start_start() {
        assertBaseline("a12-5-verify-landlord-start-start")
    }

    @Test
    fun a12_5_verify_landlord_start_fast_track() {
        assertBaseline("a12-5-verify-landlord-start-fast-track")
    }

    @Test
    fun a12_6_verify_landlord_details_populated() {
        assertBaseline("a12-6-verify-landlord-details-populated")
    }

    @Test
    fun a12_6_verify_landlord_details_errors() {
        assertBaseline("a12-6-verify-landlord-details-errors")
    }

    @Test
    fun a12_7_postcard_verification_delivered() {
        assertBaseline("a12-7-postcard-verification-delivered")
    }

    @Test
    fun a12_7_postcard_verification_in_transit() {
        assertBaseline("a12-7-postcard-verification-in-transit")
    }

    @Test
    fun a12_10_create_business_populated() {
        assertBaseline("a12-10-create-business-populated")
    }

    @Test
    fun a12_10_create_business_search() {
        assertBaseline("a12-10-create-business-search")
    }

    @Test
    fun a12_11_start_support_train_start() {
        assertBaseline("a12-11-start-support-train-start")
    }

    @Test
    fun a12_11_start_support_train_invite() {
        assertBaseline("a12-11-start-support-train-invite")
    }

    // ---- A13 — Single-screen forms
    @Test
    fun a13_3_review_claim_pending() {
        assertBaseline("a13-3-review-claim-pending")
    }

    @Test
    fun a13_3_review_claim_challenging() {
        assertBaseline("a13-3-review-claim-challenging")
    }

    @Test
    fun a13_4_transfer_ownership_ready() {
        assertBaseline("a13-4-transfer-ownership-ready")
    }

    @Test
    fun a13_4_transfer_ownership_confirm() {
        assertBaseline("a13-4-transfer-ownership-confirm")
    }

    @Test
    fun a13_10_edit_business_page_published() {
        assertBaseline("a13-10-edit-business-page-published")
    }

    @Test
    fun a13_10_edit_business_page_setup() {
        assertBaseline("a13-10-edit-business-page-setup")
    }

    @Test
    fun a13_13_manage_train_active() {
        assertBaseline("a13-13-manage-train-active")
    }

    @Test
    fun a13_13_manage_train_closing() {
        assertBaseline("a13-13-manage-train-closing")
    }

    @Test
    fun a13_14_change_password_ready() {
        assertBaseline("a13-14-change-password-ready")
    }

    @Test
    fun a13_14_change_password_error() {
        assertBaseline("a13-14-change-password-error")
    }

    @Test
    fun a13_15_disambiguate_strong() {
        assertBaseline("a13-15-disambiguate-strong")
    }

    @Test
    fun a13_15_disambiguate_unclear() {
        assertBaseline("a13-15-disambiguate-unclear")
    }

    @Test
    fun a13_16_my_mail_day_populated() {
        assertBaseline("a13-16-my-mail-day-populated")
    }

    @Test
    fun a13_16_my_mail_day_empty() {
        assertBaseline("a13-16-my-mail-day-empty")
    }

    // ---- A14 — Settings list
    @Test
    fun a14_1_home_settings_established() {
        assertBaseline("a14-1-home-settings-established")
    }

    @Test
    fun a14_1_home_settings_newly_claimed() {
        assertBaseline("a14-1-home-settings-newly-claimed")
    }

    @Test
    fun a14_2_security_balanced() {
        assertBaseline("a14-2-security-balanced")
    }

    @Test
    fun a14_2_security_lockdown() {
        assertBaseline("a14-2-security-lockdown")
    }

    @Test
    fun a14_3_settings_settled() {
        assertBaseline("a14-3-settings-settled")
    }

    @Test
    fun a14_3_settings_onboarding() {
        assertBaseline("a14-3-settings-onboarding")
    }

    @Test
    fun a14_4_blocked_users_populated() {
        assertBaseline("a14-4-blocked-users-populated")
    }

    @Test
    fun a14_4_blocked_users_empty() {
        assertBaseline("a14-4-blocked-users-empty")
    }

    @Test
    fun a14_5_notifications_real_mix() {
        assertBaseline("a14-5-notifications-real-mix")
    }

    @Test
    fun a14_5_notifications_paused() {
        assertBaseline("a14-5-notifications-paused")
    }

    @Test
    fun a14_6_payments_populated() {
        assertBaseline("a14-6-payments-populated")
    }

    @Test
    fun a14_6_payments_empty() {
        assertBaseline("a14-6-payments-empty")
    }

    @Test
    fun a14_7_privacy_defaults() {
        assertBaseline("a14-7-privacy-defaults")
    }

    @Test
    fun a14_7_privacy_stealth() {
        assertBaseline("a14-7-privacy-stealth")
    }

    @Test
    fun a14_8_vacation_hold_scheduling() {
        assertBaseline("a14-8-vacation-hold-scheduling")
    }

    @Test
    fun a14_8_vacation_hold_active() {
        assertBaseline("a14-8-vacation-hold-active")
    }

    // ---- A17 — Mailbox detail variants
    @Test
    fun a17_1_mail_generic_open() {
        assertBaseline("a17-1-mail-generic-open")
    }

    @Test
    fun a17_1_mail_generic_acknowledged() {
        assertBaseline("a17-1-mail-generic-acknowledged")
    }

    @Test
    fun a17_2_booklet_page_view() {
        assertBaseline("a17-2-booklet-page-view")
    }

    @Test
    fun a17_2_booklet_grid_view() {
        assertBaseline("a17-2-booklet-grid-view")
    }

    @Test
    fun a17_3_certified_open() {
        assertBaseline("a17-3-certified-open")
    }

    @Test
    fun a17_3_certified_acknowledged() {
        assertBaseline("a17-3-certified-acknowledged")
    }

    @Test
    fun a17_4_community_open() {
        assertBaseline("a17-4-community-open")
    }

    @Test
    fun a17_4_community_going() {
        assertBaseline("a17-4-community-going")
    }

    @Test
    fun a17_5_coupon_open() {
        assertBaseline("a17-5-coupon-open")
    }

    @Test
    fun a17_5_coupon_added() {
        assertBaseline("a17-5-coupon-added")
    }

    @Test
    fun a17_6_gig_mail_received() {
        assertBaseline("a17-6-gig-mail-received")
    }

    @Test
    fun a17_6_gig_mail_accepted() {
        assertBaseline("a17-6-gig-mail-accepted")
    }

    @Test
    fun a17_7_memory_fresh() {
        assertBaseline("a17-7-memory-fresh")
    }

    @Test
    fun a17_7_memory_saved() {
        assertBaseline("a17-7-memory-saved")
    }

    @Test
    fun a17_8_package_delivered() {
        assertBaseline("a17-8-package-delivered")
    }

    @Test
    fun a17_8_package_transit() {
        assertBaseline("a17-8-package-transit")
    }

    @Test
    fun a17_9_party_open() {
        assertBaseline("a17-9-party-open")
    }

    @Test
    fun a17_9_party_going() {
        assertBaseline("a17-9-party-going")
    }

    @Test
    fun a17_10_records_open() {
        assertBaseline("a17-10-records-open")
    }

    @Test
    fun a17_10_records_filed() {
        assertBaseline("a17-10-records-filed")
    }

    // ---- A18 — Status / waiting / preview
    @Test
    fun a18_1_verify_email_sent_waiting() {
        assertBaseline("a18-1-verify-email-sent-waiting")
    }

    @Test
    fun a18_1_verify_email_sent_resent() {
        assertBaseline("a18-1-verify-email-sent-resent")
    }

    @Test
    fun a18_2_claim_submitted_submitted() {
        assertBaseline("a18-2-claim-submitted-submitted")
    }

    @Test
    fun a18_2_claim_submitted_approved() {
        assertBaseline("a18-2-claim-submitted-approved")
    }

    @Test
    fun a18_3_verification_submitted_waiting() {
        assertBaseline("a18-3-verification-submitted-waiting")
    }

    @Test
    fun a18_3_verification_submitted_confirmed() {
        assertBaseline("a18-3-verification-submitted-confirmed")
    }

    // ---- A21 — Public Beacon profile
    @Test
    fun a21_1_persona_populated() {
        assertBaseline("a21-1-persona-populated")
    }

    @Test
    fun a21_1_persona_empty() {
        assertBaseline("a21-1-persona-empty")
    }

    @Test
    fun a21_2_local_populated() {
        assertBaseline("a21-2-local-populated")
    }

    @Test
    fun a21_2_local_empty() {
        assertBaseline("a21-2-local-empty")
    }

    // ---- Helper

    private fun assertBaseline(slug: String) {
        val png = File(baselineDir, "$slug.png")
        assertTrue("Missing new-design baseline: ${png.path}", png.exists())
        val bytes = png.readBytes()
        assertTrue("New-design baseline too small (${bytes.size} B): ${png.path}", bytes.size > 4 * 1024)
        val magic = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        assertTrue(
            "New-design baseline isn't a PNG: ${png.path}",
            bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(magic),
        )
    }
}
