//
//  SettingsViewModelTests.swift
//  PantopusTests
//
//  Covers the Settings index data source: load produces the expected
//  groups + destructive sign-out card, and every wired sub-route id
//  surfaces in the index. (A14.5 Notifications + A14.7 Privacy moved to
//  NotificationSettingsViewModelTests / PrivacyViewModelTests.)
//

import XCTest
@testable import Pantopus

@MainActor
final class SettingsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    // MARK: - Index

    func testIndexLoadProducesAllExpectedGroups() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"blocks\":[]}") // privacy/blocks fetch
        ]
        let vm = SettingsIndexViewModel(api: makeAPI(), auth: AuthManager.previewSignedIn)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        let ids = groups.map(\.id)
        XCTAssertEqual(ids, ["account", "privacy", "notifications", "payments", "support", "session"])
        // Verify destructive row sits in its own group with no overline.
        XCTAssertNil(groups.last?.overline)
        XCTAssertEqual(groups.last?.rows.first?.id, "signOut")
        XCTAssertTrue(groups.last?.rows.first?.destructive ?? false)
    }

    /// P8 / T6.2c — every row in the support / account / privacy
    /// groups now routes to a real sub-screen rather than
    /// `NotYetAvailableView`. The router test belongs in the view
    /// itself, but here we assert the row ids the router maps from.
    func testIndexRowIdsCoverEveryWiredSubRoute() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"blocks\":[]}")]
        let vm = SettingsIndexViewModel(api: makeAPI(), auth: AuthManager.previewSignedIn)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let allRowIds = Set(groups.flatMap { $0.rows.map(\.id) })
        // Six sub-routes wired in P8; two stay placeholders (export +
        // paymentsPayouts).
        let wired: Set<String> = ["blocks", "password", "verification", "help", "legal", "about"]
        XCTAssertTrue(wired.isSubset(of: allRowIds), "Missing wired row ids: \(wired.subtracting(allRowIds))")
        let placeheld: Set<String> = ["export", "paymentsPayouts"]
        XCTAssertTrue(placeheld.isSubset(of: allRowIds), "Placeholder routes must still surface in the index.")
    }
}
