//
//  PublicProfileNeighborSnapshotTests.swift
//  PantopusTests
//
//  B.2 (A10.5) — structural render + content coverage for the canonical
//  neighbor profile across both design frames (Derek populated · Sasha
//  new neighbor). Same pattern as PublicProfileSnapshotTests: asserts the
//  view tree hosts with non-zero geometry, plus content invariants for
//  the degraded stat strip, verification ledger, and new-neighbor
//  sections.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PublicProfileNeighborSnapshotTests: XCTestCase {
    // MARK: - Render — populated (Derek)

    func test_neighbor_populated_eachTab_renders() {
        for tab in NeighborProfileTab.allCases {
            assertRenders(NeighborFixtureHost(content: PublicProfileSampleData.derekPopulated, tab: tab))
        }
    }

    // MARK: - Render — new neighbor (Sasha)

    func test_neighbor_newNeighbor_eachTab_renders() {
        for tab in NeighborProfileTab.allCases {
            assertRenders(NeighborFixtureHost(content: PublicProfileSampleData.sashaNewNeighbor, tab: tab))
        }
    }

    // MARK: - Tab order matches A10.5 task spec

    func test_tabOrder_isAboutReviewsVerificationsPosts() {
        XCTAssertEqual(NeighborProfileTab.allCases, [.about, .reviews, .verifications, .posts])
    }

    // MARK: - Populated frame invariants

    func test_populatedFrame_content() {
        let c = PublicProfileSampleData.derekPopulated
        XCTAssertFalse(c.isNewNeighbor)
        XCTAssertEqual(c.reviewCount, 47)
        XCTAssertEqual(c.primaryCtaLabel, "Message")
        XCTAssertEqual(c.hero.identity, .personal)
        XCTAssertEqual(c.hero.kicker, "Neighbor since 2022")
        XCTAssertEqual(c.verifications.count, 4)
        XCTAssertFalse(c.reviews.isEmpty, "Populated frame has a featured review")
        XCTAssertNil(c.mutuals, "Populated frame has no mutual-neighbors strip")
    }

    // MARK: - New-neighbor degradation + secondary sections

    func test_newNeighborFrame_degradesAndCarriesSecondarySections() {
        let c = PublicProfileSampleData.sashaNewNeighbor
        XCTAssertTrue(c.isNewNeighbor)
        XCTAssertEqual(c.reviewCount, 0)
        XCTAssertTrue(c.reviews.isEmpty)
        XCTAssertEqual(c.primaryCtaLabel, "Say hi")
        XCTAssertEqual(c.hero.identity, .fresh)

        // Stat strip degrades to — / 0 / New.
        XCTAssertEqual(c.stats.map(\.value), ["—", "0", "New"])

        // Three secondary sections stand in for absent reviews.
        XCTAssertFalse(c.verifications.isEmpty, "verifications recap present")
        XCTAssertNotNil(c.mutuals, "mutual-neighbors strip present")
        XCTAssertNotNil(c.welcome, "welcome prompt present")
        XCTAssertEqual(c.mutuals?.count, 4)
    }

    func test_identityChipLabels() {
        XCTAssertEqual(NeighborIdentity.personal.label, "Personal · Verified")
        XCTAssertEqual(NeighborIdentity.home.label, "Home · Verified")
        XCTAssertEqual(NeighborIdentity.business.label, "Business · Verified")
        XCTAssertEqual(NeighborIdentity.fresh.label, "Verified · New here")
    }

    // MARK: - Render helper

    private func assertRenders(_ view: some View, file: StaticString = #filePath, line: UInt = #line) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 820))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 820)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}

@MainActor
private struct NeighborFixtureHost: View {
    let content: NeighborProfileContent
    @State var tab: NeighborProfileTab

    var body: some View {
        NeighborProfileLayout(
            content: content,
            selectedTab: $tab,
            connectState: .idle,
            onBack: {},
            onMessage: {},
            onConnect: {},
            onReport: {},
            onBlock: {},
            onOverflow: {}
        )
    }
}
