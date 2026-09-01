//
//  NewDesignScreensSnapshotTests.swift
//  PantopusTests
//
//  P9.1 — new-design pack snapshot lockfile (iOS half).
//
//  Locks the May 2026 design hand-off (A03 / A09 / A10 / A12 / A13 / A14 /
//  A17 / A18 / A21) as the durable visual reference for every screen built
//  out across Phases 1–8. One test per screen × designed variant — 88
//  rows total — each asserting that its committed reference PNG stays
//  checked in at:
//
//    PantopusTests/Features/Shared/__snapshots__/new-designs/<slug>.png
//
//  This is a *presence tripwire*, mirroring the convention documented in
//  the sibling `T6ScreensSnapshotTests.swift`: it fails when a baseline is
//  deleted, truncated, or replaced by a non-PNG — catching design-reference
//  drift (a dropped screen, a lost variant) in CI. It is deliberately NOT a
//  pixel diff against the live SwiftUI render: the per-screen render tests
//  (e.g. `WalletSnapshotTest`/render-smoke suites) lock the implementation;
//  this file locks the *design pack* those screens target. See
//  `NEW_DESIGNS.md` (same folder) for the regeneration policy — when, by
//  whom, and with what approval the baselines may be re-cut.
//
//  The reference PNGs are platform-neutral (the designer ships one frame per
//  screen × variant; iOS and Android target the same contract), so the same
//  bytes are committed under the Android Paparazzi snapshot dir and locked
//  by `NewDesignScreensSnapshotTest.kt`.
//

import XCTest

final class NewDesignScreensSnapshotTests: XCTestCase {
    /// PantopusTests/Features/Shared/__snapshots__/new-designs/ — resolved
    /// relative to this source file so the rig is location-independent.
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Shared
            .appendingPathComponent("__snapshots__")
            .appendingPathComponent("new-designs")
    }

    // MARK: - A03 — Pulse feed (tab archetype)

    func test_a03_1_pulse_populated() throws {
        try assertBaseline("a03-1-pulse-populated")
    }

    func test_a03_1_pulse_empty() throws {
        try assertBaseline("a03-1-pulse-empty")
    }

    func test_a03_2_beacons_populated() throws {
        try assertBaseline("a03-2-beacons-populated")
    }

    func test_a03_2_beacons_empty() throws {
        try assertBaseline("a03-2-beacons-empty")
    }

    // MARK: - A09 — Transactional detail (sticky-dock archetype)

    func test_a09_1_task_v2_populated() throws {
        try assertBaseline("a09-1-task-v2-populated")
    }

    func test_a09_1_task_v2_no_bids() throws {
        try assertBaseline("a09-1-task-v2-no-bids")
    }

    func test_a09_2_gig_v1_populated() throws {
        try assertBaseline("a09-2-gig-v1-populated")
    }

    func test_a09_2_gig_v1_awarded() throws {
        try assertBaseline("a09-2-gig-v1-awarded")
    }

    func test_a09_3_listing_populated() throws {
        try assertBaseline("a09-3-listing-populated")
    }

    func test_a09_3_listing_sold() throws {
        try assertBaseline("a09-3-listing-sold")
    }

    func test_a09_4_invoice_due() throws {
        try assertBaseline("a09-4-invoice-due")
    }

    func test_a09_4_invoice_paid() throws {
        try assertBaseline("a09-4-invoice-paid")
    }

    // MARK: - A10 — Detail: content

    func test_a10_9_support_train_populated() throws {
        try assertBaseline("a10-9-support-train-populated")
    }

    func test_a10_9_support_train_covered() throws {
        try assertBaseline("a10-9-support-train-covered")
    }

    func test_a10_10_wallet_populated() throws {
        try assertBaseline("a10-10-wallet-populated")
    }

    func test_a10_10_wallet_hold() throws {
        try assertBaseline("a10-10-wallet-hold")
    }

    // MARK: - A12 — Wizard archetype (multi-step)

    func test_a12_4_claim_evidence_ready() throws {
        try assertBaseline("a12-4-claim-evidence-ready")
    }

    func test_a12_4_claim_evidence_in_progress() throws {
        try assertBaseline("a12-4-claim-evidence-in-progress")
    }

    func test_a12_5_verify_landlord_start_start() throws {
        try assertBaseline("a12-5-verify-landlord-start-start")
    }

    func test_a12_5_verify_landlord_start_fast_track() throws {
        try assertBaseline("a12-5-verify-landlord-start-fast-track")
    }

    func test_a12_6_verify_landlord_details_populated() throws {
        try assertBaseline("a12-6-verify-landlord-details-populated")
    }

    func test_a12_6_verify_landlord_details_errors() throws {
        try assertBaseline("a12-6-verify-landlord-details-errors")
    }

    func test_a12_7_postcard_verification_delivered() throws {
        try assertBaseline("a12-7-postcard-verification-delivered")
    }

    func test_a12_7_postcard_verification_in_transit() throws {
        try assertBaseline("a12-7-postcard-verification-in-transit")
    }

    func test_a12_10_create_business_populated() throws {
        try assertBaseline("a12-10-create-business-populated")
    }

    func test_a12_10_create_business_search() throws {
        try assertBaseline("a12-10-create-business-search")
    }

    func test_a12_11_start_support_train_start() throws {
        try assertBaseline("a12-11-start-support-train-start")
    }

    func test_a12_11_start_support_train_invite() throws {
        try assertBaseline("a12-11-start-support-train-invite")
    }

    // MARK: - A13 — Single-screen forms

    func test_a13_3_review_claim_pending() throws {
        try assertBaseline("a13-3-review-claim-pending")
    }

    func test_a13_3_review_claim_challenging() throws {
        try assertBaseline("a13-3-review-claim-challenging")
    }

    func test_a13_4_transfer_ownership_ready() throws {
        try assertBaseline("a13-4-transfer-ownership-ready")
    }

    func test_a13_4_transfer_ownership_confirm() throws {
        try assertBaseline("a13-4-transfer-ownership-confirm")
    }

    func test_a13_10_edit_business_page_published() throws {
        try assertBaseline("a13-10-edit-business-page-published")
    }

    func test_a13_10_edit_business_page_setup() throws {
        try assertBaseline("a13-10-edit-business-page-setup")
    }

    func test_a13_13_manage_train_active() throws {
        try assertBaseline("a13-13-manage-train-active")
    }

    func test_a13_13_manage_train_closing() throws {
        try assertBaseline("a13-13-manage-train-closing")
    }

    func test_a13_14_change_password_ready() throws {
        try assertBaseline("a13-14-change-password-ready")
    }

    func test_a13_14_change_password_error() throws {
        try assertBaseline("a13-14-change-password-error")
    }

    func test_a13_15_disambiguate_strong() throws {
        try assertBaseline("a13-15-disambiguate-strong")
    }

    func test_a13_15_disambiguate_unclear() throws {
        try assertBaseline("a13-15-disambiguate-unclear")
    }

    func test_a13_16_my_mail_day_populated() throws {
        try assertBaseline("a13-16-my-mail-day-populated")
    }

    func test_a13_16_my_mail_day_empty() throws {
        try assertBaseline("a13-16-my-mail-day-empty")
    }

    // MARK: - A14 — Settings list

    func test_a14_1_home_settings_established() throws {
        try assertBaseline("a14-1-home-settings-established")
    }

    func test_a14_1_home_settings_newly_claimed() throws {
        try assertBaseline("a14-1-home-settings-newly-claimed")
    }

    func test_a14_2_security_balanced() throws {
        try assertBaseline("a14-2-security-balanced")
    }

    func test_a14_2_security_lockdown() throws {
        try assertBaseline("a14-2-security-lockdown")
    }

    func test_a14_3_settings_settled() throws {
        try assertBaseline("a14-3-settings-settled")
    }

    func test_a14_3_settings_onboarding() throws {
        try assertBaseline("a14-3-settings-onboarding")
    }

    func test_a14_4_blocked_users_populated() throws {
        try assertBaseline("a14-4-blocked-users-populated")
    }

    func test_a14_4_blocked_users_empty() throws {
        try assertBaseline("a14-4-blocked-users-empty")
    }

    func test_a14_5_notifications_real_mix() throws {
        try assertBaseline("a14-5-notifications-real-mix")
    }

    func test_a14_5_notifications_paused() throws {
        try assertBaseline("a14-5-notifications-paused")
    }

    func test_a14_6_payments_populated() throws {
        try assertBaseline("a14-6-payments-populated")
    }

    func test_a14_6_payments_empty() throws {
        try assertBaseline("a14-6-payments-empty")
    }

    func test_a14_7_privacy_defaults() throws {
        try assertBaseline("a14-7-privacy-defaults")
    }

    func test_a14_7_privacy_stealth() throws {
        try assertBaseline("a14-7-privacy-stealth")
    }

    func test_a14_8_vacation_hold_scheduling() throws {
        try assertBaseline("a14-8-vacation-hold-scheduling")
    }

    func test_a14_8_vacation_hold_active() throws {
        try assertBaseline("a14-8-vacation-hold-active")
    }

    // MARK: - A17 — Mailbox detail variants

    func test_a17_1_mail_generic_open() throws {
        try assertBaseline("a17-1-mail-generic-open")
    }

    func test_a17_1_mail_generic_acknowledged() throws {
        try assertBaseline("a17-1-mail-generic-acknowledged")
    }

    func test_a17_2_booklet_page_view() throws {
        try assertBaseline("a17-2-booklet-page-view")
    }

    func test_a17_2_booklet_grid_view() throws {
        try assertBaseline("a17-2-booklet-grid-view")
    }

    func test_a17_3_certified_open() throws {
        try assertBaseline("a17-3-certified-open")
    }

    func test_a17_3_certified_acknowledged() throws {
        try assertBaseline("a17-3-certified-acknowledged")
    }

    func test_a17_4_community_open() throws {
        try assertBaseline("a17-4-community-open")
    }

    func test_a17_4_community_going() throws {
        try assertBaseline("a17-4-community-going")
    }

    func test_a17_5_coupon_open() throws {
        try assertBaseline("a17-5-coupon-open")
    }

    func test_a17_5_coupon_added() throws {
        try assertBaseline("a17-5-coupon-added")
    }

    func test_a17_6_gig_mail_received() throws {
        try assertBaseline("a17-6-gig-mail-received")
    }

    func test_a17_6_gig_mail_accepted() throws {
        try assertBaseline("a17-6-gig-mail-accepted")
    }

    func test_a17_7_memory_fresh() throws {
        try assertBaseline("a17-7-memory-fresh")
    }

    func test_a17_7_memory_saved() throws {
        try assertBaseline("a17-7-memory-saved")
    }

    func test_a17_8_package_delivered() throws {
        try assertBaseline("a17-8-package-delivered")
    }

    func test_a17_8_package_transit() throws {
        try assertBaseline("a17-8-package-transit")
    }

    func test_a17_9_party_open() throws {
        try assertBaseline("a17-9-party-open")
    }

    func test_a17_9_party_going() throws {
        try assertBaseline("a17-9-party-going")
    }

    func test_a17_10_records_open() throws {
        try assertBaseline("a17-10-records-open")
    }

    func test_a17_10_records_filed() throws {
        try assertBaseline("a17-10-records-filed")
    }

    // MARK: - A18 — Status / waiting / preview

    func test_a18_1_verify_email_sent_waiting() throws {
        try assertBaseline("a18-1-verify-email-sent-waiting")
    }

    func test_a18_1_verify_email_sent_resent() throws {
        try assertBaseline("a18-1-verify-email-sent-resent")
    }

    func test_a18_2_claim_submitted_submitted() throws {
        try assertBaseline("a18-2-claim-submitted-submitted")
    }

    func test_a18_2_claim_submitted_approved() throws {
        try assertBaseline("a18-2-claim-submitted-approved")
    }

    func test_a18_3_verification_submitted_waiting() throws {
        try assertBaseline("a18-3-verification-submitted-waiting")
    }

    func test_a18_3_verification_submitted_confirmed() throws {
        try assertBaseline("a18-3-verification-submitted-confirmed")
    }

    // MARK: - A21 — Public Beacon profile

    func test_a21_1_persona_populated() throws {
        try assertBaseline("a21-1-persona-populated")
    }

    func test_a21_1_persona_empty() throws {
        try assertBaseline("a21-1-persona-empty")
    }

    func test_a21_2_local_populated() throws {
        try assertBaseline("a21-2-local-populated")
    }

    func test_a21_2_local_empty() throws {
        try assertBaseline("a21-2-local-empty")
    }

    // MARK: - Helper

    private func assertBaseline(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug).png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing new-design baseline: \(url.path)"
        )
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(
            data.count,
            4 * 1024,
            "New-design baseline too small (\(data.count) bytes): \(url.path)"
        )
        // PNG magic bytes.
        XCTAssertTrue(
            data.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            "New-design baseline isn't a PNG: \(url.path)"
        )
    }
}
