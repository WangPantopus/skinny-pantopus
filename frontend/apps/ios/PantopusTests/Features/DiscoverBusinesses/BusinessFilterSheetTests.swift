//
//  BusinessFilterSheetTests.swift
//  PantopusTests
//
//  P5.2 — Business filter sheet. Covers the typed ⇆ section mapping
//  round-trip, Reset → defaults, the active-filter count, and that the
//  sheet view materialises through every control branch.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class BusinessFilterSheetTests: XCTestCase {
    // MARK: - Mapping round-trip

    func testSectionsRoundTripPreservesSelection() {
        let original = DiscoverBusinessFilters(
            categories: ["home-services", "pets"],
            radiusMiles: 3,
            openNow: true,
            ratingFloor: 4
        )
        let parsed = BusinessFilterSheet.filters(from: BusinessFilterSheet.sections(from: original))
        XCTAssertEqual(parsed, original)
    }

    func testSectionsRoundTripRatingFloorVariants() {
        for floor: Double? in [nil, 3, 4, 4.5] {
            let original = DiscoverBusinessFilters(ratingFloor: floor)
            let parsed = BusinessFilterSheet.filters(
                from: BusinessFilterSheet.sections(from: original)
            )
            XCTAssertEqual(parsed.ratingFloor, floor)
        }
    }

    func testSectionsRoundTripEveryRadiusStop() {
        for stop in BusinessFilterSheet.radiusStops {
            let original = DiscoverBusinessFilters(radiusMiles: stop.value)
            let parsed = BusinessFilterSheet.filters(
                from: BusinessFilterSheet.sections(from: original)
            )
            XCTAssertEqual(parsed.radiusMiles, stop.value)
        }
    }

    func testSectionsShape() {
        let sections = BusinessFilterSheet.sections(from: .default)
        XCTAssertEqual(sections.map(\.id), ["category", "distance", "rating", "options"])
        if case let .chipGroup(options, _) = sections[0].control {
            XCTAssertEqual(
                options.map(\.id),
                ["home-services", "food", "retail", "wellness", "auto", "pets", "other"]
            )
        } else {
            XCTFail("Expected chipGroup for category")
        }
        if case let .stepSlider(stops, selectedIndex, defaultIndex) = sections[1].control {
            XCTAssertEqual(stops.map(\.id), ["0.5", "1", "3", "5", "10"])
            // Default radius (5 mi) sits at index 3.
            XCTAssertEqual(selectedIndex, 3)
            XCTAssertEqual(defaultIndex, 3)
        } else {
            XCTFail("Expected stepSlider for distance")
        }
        if case let .radio(options, selectedId) = sections[2].control {
            XCTAssertEqual(options.map(\.id), ["any", "3", "4", "4.5"])
            XCTAssertEqual(selectedId, "any")
        } else {
            XCTFail("Expected radio for rating")
        }
        if case let .toggle(options, _) = sections[3].control {
            XCTAssertEqual(options.map(\.id), ["open-now"])
        } else {
            XCTFail("Expected toggle for availability")
        }
    }

    // MARK: - Reset → defaults

    func testClearedSectionsParseToDefault() {
        let dirty = DiscoverBusinessFilters(
            categories: ["food", "auto"],
            radiusMiles: 0.5,
            openNow: true,
            ratingFloor: 4.5
        )
        let cleared = BusinessFilterSheet.sections(from: dirty).cleared()
        let parsed = BusinessFilterSheet.filters(from: cleared)
        XCTAssertEqual(parsed, .default)
        // Reset returns the radius to the backend default (5 mi).
        XCTAssertEqual(parsed.radiusMiles, DiscoverBusinessFilters.defaultRadiusMiles)
    }

    // MARK: - Active count

    func testActiveCount() {
        XCTAssertEqual(DiscoverBusinessFilters.default.activeCount, 0)
        // Default radius is not an active filter.
        XCTAssertEqual(DiscoverBusinessFilters(radiusMiles: 5).activeCount, 0)
        XCTAssertEqual(DiscoverBusinessFilters(radiusMiles: 1).activeCount, 1)
        XCTAssertEqual(DiscoverBusinessFilters(categories: ["food", "pets"]).activeCount, 1)
        XCTAssertEqual(
            DiscoverBusinessFilters(
                categories: ["food"],
                radiusMiles: 1,
                openNow: true,
                ratingFloor: 4
            ).activeCount,
            4
        )
    }

    // MARK: - View construction

    func testSheetMaterialises() {
        let sheet = BusinessFilterSheet(
            initialFilters: DiscoverBusinessFilters(
                categories: ["home-services"],
                radiusMiles: 3,
                openNow: true,
                ratingFloor: 4
            ),
            onApply: { _ in },
            onClose: {}
        )
        _ = UIHostingController(rootView: sheet)
    }
}
