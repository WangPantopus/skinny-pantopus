//
//  T6ScreensSnapshotTests.swift
//  PantopusTests
//
//  T6 — screen-level snapshot lockfile.
//
//  Verifies the design-reference baseline PNGs (one per new T6 screen)
//  stay checked in at their canonical location:
//
//    `frontend/apps/ios/PantopusTests/__Snapshots__/t6/<slug>-ios.png`
//
//  Each baseline is generated from the design package at
//  `/tmp/designs/A08 — per-screen batch 1/` via the playwright harness
//  at `/home/user/pantopus/render-t6.mjs` (kept in repo root for
//  regeneration). They are the **visual contract** that the on-device
//  SwiftUI render targets.
//
//  Drift at the screen level — a missing tab, a wrong FAB variant, a
//  dropped banner — gets caught by this test failing because someone
//  accidentally removed the PNG. **Until** real SwiftUI snapshot tests
//  land (T6+ candidate that requires adding `swift-snapshot-testing` to
//  `project.yml` and constructing fixture state for each screen), this
//  tripwire is the minimum lockfile guard against PNG loss.
//
//  To regenerate the baselines:
//    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render-t6.mjs
//    cp /tmp/t6-snapshots/*.png \
//       frontend/apps/ios/PantopusTests/__Snapshots__/t6/
//    # then rename to add -ios.png suffix (or use the harness's
//    # built-in rename pass).
//
//  Mirrors the T5 pattern at `T5ScreensSnapshotTests.swift`.
//

import XCTest

final class T6ScreensSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        // PantopusTests/__Snapshots__/t6/  (relative to the test bundle's
        // source root — the file URL of the current test file).
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Shared
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6")
    }

    // MARK: - Auth (T6.1b / T6.1c)

    func test_auth_ios_baseline_is_present() throws {
        try assertBaseline("auth")
    }

    // MARK: - Refreshed Tier-1 surfaces (T6.2a / T6.2b / T6.3f)

    func test_hub_ios_baseline_is_present() throws {
        try assertBaseline("hub")
    }

    func test_me_ios_baseline_is_present() throws {
        try assertBaseline("me")
    }

    func test_myHomes_ios_baseline_is_present() throws {
        try assertBaseline("my-homes")
    }

    func test_myListings_ios_baseline_is_present() throws {
        try assertBaseline("my-listings")
    }

    func test_myBusinesses_ios_baseline_is_present() throws {
        try assertBaseline("my-businesses")
    }

    func test_myPosts_ios_baseline_is_present() throws {
        try assertBaseline("my-posts")
    }

    func test_myBids_ios_baseline_is_present() throws {
        try assertBaseline("my-bids")
    }

    func test_myTasks_ios_baseline_is_present() throws {
        try assertBaseline("my-tasks")
    }

    // MARK: - Settings (T6.2c)

    func test_settings_ios_baseline_is_present() throws {
        try assertBaseline("settings")
    }

    func test_legalStatic_ios_baseline_is_present() throws {
        try assertBaseline("legal-static")
    }

    // MARK: - Home pillar (T6.3a–T6.4c)

    func test_bills_ios_baseline_is_present() throws {
        try assertBaseline("bills")
    }

    func test_maintenance_ios_baseline_is_present() throws {
        try assertBaseline("maintenance")
    }

    func test_householdTasks_ios_baseline_is_present() throws {
        try assertBaseline("household-tasks")
    }

    func test_packages_ios_baseline_is_present() throws {
        try assertBaseline("packages")
    }

    func test_polls_ios_baseline_is_present() throws {
        try assertBaseline("polls")
    }

    func test_owners_ios_baseline_is_present() throws {
        try assertBaseline("owners")
    }

    func test_members_ios_baseline_is_present() throws {
        try assertBaseline("members")
    }

    func test_pets_ios_baseline_is_present() throws {
        try assertBaseline("pets")
    }

    func test_accessCodes_ios_baseline_is_present() throws {
        try assertBaseline("access-codes")
    }

    func test_emergencyInfo_ios_baseline_is_present() throws {
        try assertBaseline("emergency-info")
    }

    func test_documents_ios_baseline_is_present() throws {
        try assertBaseline("documents")
    }

    func test_homeCalendar_ios_baseline_is_present() throws {
        try assertBaseline("home-calendar")
    }

    // MARK: - Mailbox A17 (T6.5a–T6.5e)

    func test_mailboxMobile_ios_baseline_is_present() throws {
        try assertBaseline("mailbox-mobile")
    }

    func test_mailboxItemDetail_ios_baseline_is_present() throws {
        try assertBaseline("mailbox-item-detail")
    }

    func test_a17_1_mailItem_ios_baseline_is_present() throws {
        try assertBaseline("a17-1-mail-item-generic")
    }

    func test_a17_2_booklet_ios_baseline_is_present() throws {
        try assertBaseline("a17-2-booklet")
    }

    func test_a17_3_certified_ios_baseline_is_present() throws {
        try assertBaseline("a17-3-certified-mail")
    }

    func test_a17_4_community_ios_baseline_is_present() throws {
        try assertBaseline("a17-4-community-mail")
    }

    func test_ceremonialMailOpen_ios_baseline_is_present() throws {
        try assertBaseline("ceremonial-mail-open")
    }

    func test_ceremonialMailCompose_ios_baseline_is_present() throws {
        try assertBaseline("ceremonial-mail-compose")
    }

    func test_vault_ios_baseline_is_present() throws {
        try assertBaseline("vault")
    }

    // MARK: - Chat + New Message (T6.6b)

    func test_chatList_ios_baseline_is_present() throws {
        try assertBaseline("chat-list")
    }

    func test_chatConversation_ios_baseline_is_present() throws {
        try assertBaseline("chat-conversation")
    }

    func test_newMessage_ios_baseline_is_present() throws {
        try assertBaseline("new-message")
    }

    // MARK: - MapListHybrid (T6.6a)

    func test_mapListHybrid_ios_baseline_is_present() throws {
        try assertBaseline("map-list-hybrid")
    }

    func test_mapListHybridPrint_ios_baseline_is_present() throws {
        try assertBaseline("map-list-hybrid-print")
    }

    // MARK: - Support Trains + Review Signups (T6.6c / P26.5)

    func test_supportTrains_ios_baseline_is_present() throws {
        try assertBaseline("support-trains")
    }

    func test_reviewSignups_ios_baseline_is_present() throws {
        try assertBaseline("review-signups")
    }

    // MARK: - Long-tail leaf refresh sweep (T6.6c / P26.9)

    func test_transactionalDetail_ios_baseline_is_present() throws {
        try assertBaseline("transactional-detail")
    }

    func test_contentDetail_ios_baseline_is_present() throws {
        try assertBaseline("content-detail")
    }

    func test_publicBeaconProfile_ios_baseline_is_present() throws {
        try assertBaseline("public-beacon-profile")
    }

    func test_creatorAudience_ios_baseline_is_present() throws {
        try assertBaseline("creator-audience")
    }

    func test_creatorInbox_ios_baseline_is_present() throws {
        try assertBaseline("creator-inbox")
    }

    func test_identityCenter_ios_baseline_is_present() throws {
        try assertBaseline("identity-center")
    }

    func test_privacyHandshake_ios_baseline_is_present() throws {
        try assertBaseline("privacy-handshake")
    }

    func test_tokenAccept_ios_baseline_is_present() throws {
        try assertBaseline("token-accept")
    }

    func test_statusWaiting_ios_baseline_is_present() throws {
        try assertBaseline("status-waiting")
    }

    // MARK: - Archetype demos (T6.6c)

    func test_form_ios_baseline_is_present() throws {
        try assertBaseline("form")
    }

    func test_wizard_ios_baseline_is_present() throws {
        try assertBaseline("wizard")
    }

    func test_listOfRows_ios_baseline_is_present() throws {
        try assertBaseline("list-of-rows")
    }

    // MARK: - Other refreshes (T6.6c / P26.9 sweep)

    func test_gigs_ios_baseline_is_present() throws {
        try assertBaseline("gigs")
    }

    func test_marketplace_ios_baseline_is_present() throws {
        try assertBaseline("marketplace")
    }

    func test_pulse_ios_baseline_is_present() throws {
        try assertBaseline("pulse")
    }

    func test_offers_ios_baseline_is_present() throws {
        try assertBaseline("offers")
    }

    func test_listingOffers_ios_baseline_is_present() throws {
        try assertBaseline("listing-offers")
    }

    func test_notifications_ios_baseline_is_present() throws {
        try assertBaseline("notifications")
    }

    func test_connections_ios_baseline_is_present() throws {
        try assertBaseline("connections")
    }

    func test_discoverHub_ios_baseline_is_present() throws {
        try assertBaseline("discover-hub")
    }

    func test_discoverBusinesses_ios_baseline_is_present() throws {
        try assertBaseline("discover-businesses")
    }

    func test_reviewClaims_ios_baseline_is_present() throws {
        try assertBaseline("review-claims")
    }

    private func assertBaseline(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing T6 baseline: \(url.path)"
        )
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 4 * 1024, "T6 baseline too small (\(data.count) bytes): \(url.path)")
        // Verify PNG magic bytes
        XCTAssertTrue(
            data.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            "T6 baseline isn't a PNG: \(url.path)"
        )
    }
}
