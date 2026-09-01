//
//  DiscoveryFilterSheetTests.swift
//  PantopusTests
//
//  P5.2 — Discovery filter sheet. Covers the typed ⇆ section mapping
//  round-trip, Reset → defaults, the active-filter count, and that the
//  sheet view materialises through every control branch.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class DiscoveryFilterSheetTests: XCTestCase {
    // MARK: - Mapping round-trip

    func testSectionsRoundTripPreservesSelection() {
        let original = DiscoverHubFilters(
            contentTypes: [DiscoverHubSection.people, DiscoverHubSection.gigs],
            verifiedOnly: true,
            newestFirst: false
        )
        let parsed = DiscoveryFilterSheet.filters(from: DiscoveryFilterSheet.sections(from: original))
        XCTAssertEqual(parsed, original)
    }

    func testSectionsRoundTripAllOn() {
        let original = DiscoverHubFilters(
            contentTypes: [
                DiscoverHubSection.people,
                DiscoverHubSection.businesses,
                DiscoverHubSection.gigs,
                DiscoverHubSection.listings
            ],
            verifiedOnly: true,
            newestFirst: true
        )
        let parsed = DiscoveryFilterSheet.filters(from: DiscoveryFilterSheet.sections(from: original))
        XCTAssertEqual(parsed, original)
    }

    func testSectionsShape() {
        let sections = DiscoveryFilterSheet.sections(from: .default)
        XCTAssertEqual(sections.map(\.id), ["contentType", "options"])
        if case let .chipGroup(options, _) = sections[0].control {
            XCTAssertEqual(options.map(\.id), ["people", "businesses", "gigs", "listings"])
        } else {
            XCTFail("Expected chipGroup for content type")
        }
        if case let .toggle(options, _) = sections[1].control {
            XCTAssertEqual(options.map(\.id), ["verified-only", "newest-first"])
        } else {
            XCTFail("Expected toggle for options")
        }
    }

    // MARK: - Reset → defaults

    func testClearedSectionsParseToDefault() {
        let dirty = DiscoverHubFilters(
            contentTypes: [DiscoverHubSection.people],
            verifiedOnly: true,
            newestFirst: true
        )
        let cleared = DiscoveryFilterSheet.sections(from: dirty).cleared()
        XCTAssertEqual(DiscoveryFilterSheet.filters(from: cleared), .default)
    }

    // MARK: - Active count

    func testActiveCount() {
        XCTAssertEqual(DiscoverHubFilters.default.activeCount, 0)
        XCTAssertEqual(
            DiscoverHubFilters(contentTypes: [DiscoverHubSection.people]).activeCount,
            1
        )
        // A multi-chip selection still counts as a single dimension.
        XCTAssertEqual(
            DiscoverHubFilters(
                contentTypes: [DiscoverHubSection.people, DiscoverHubSection.gigs]
            ).activeCount,
            1
        )
        XCTAssertEqual(
            DiscoverHubFilters(
                contentTypes: [DiscoverHubSection.people],
                verifiedOnly: true,
                newestFirst: true
            ).activeCount,
            3
        )
    }

    // MARK: - View construction

    func testSheetMaterialises() {
        let sheet = DiscoveryFilterSheet(
            initialFilters: DiscoverHubFilters(
                contentTypes: [DiscoverHubSection.people],
                verifiedOnly: true
            ),
            onApply: { _ in },
            onClose: {}
        )
        _ = UIHostingController(rootView: sheet)
    }
}
