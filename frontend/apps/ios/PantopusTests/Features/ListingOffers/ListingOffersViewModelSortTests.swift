//
//  ListingOffersViewModelSortTests.swift
//  PantopusTests
//
//  T5.3.4 — Listing offers, sort menu. Covers:
//    - default sort (highest offer) + each of the four sort orders
//    - LEADING badge tracking the top offer regardless of active sort
//    - sort selection surviving a pull-to-refresh
//    - sort-menu option projection + selection marking
//    - no tabs / no FAB / share top-bar action
//

import XCTest
@testable import Pantopus

@MainActor
final class ListingOffersViewModelSortTests: ListingOffersViewModelTestCase {
    // MARK: - Sort menu

    func testDefaultSortIsHighestOffer() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(loadedRowIDs(vm), ["o-high-mid", "o-mid-old", "o-low-new"])
        XCTAssertEqual(vm.listingContext?.sortLabel, "Highest offer")
    }

    func testSelectSortLowestOffer() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectSort(.lowestOffer)
        XCTAssertEqual(loadedRowIDs(vm), ["o-low-new", "o-mid-old", "o-high-mid"])
        XCTAssertEqual(vm.listingContext?.sortLabel, "Lowest offer")
    }

    func testSelectSortNewestFirst() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectSort(.newestFirst)
        XCTAssertEqual(loadedRowIDs(vm), ["o-low-new", "o-high-mid", "o-mid-old"])
        XCTAssertEqual(vm.listingContext?.sortLabel, "Newest first")
    }

    func testSelectSortOldestFirst() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectSort(.oldestFirst)
        XCTAssertEqual(loadedRowIDs(vm), ["o-mid-old", "o-high-mid", "o-low-new"])
        XCTAssertEqual(vm.listingContext?.sortLabel, "Oldest first")
    }

    /// LEADING badge always tracks the highest-amount pending offer, even
    /// when the active sort buries it in the middle of the list.
    func testLeadingHighlightTracksTopOfferRegardlessOfSort() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectSort(.oldestFirst)
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let leading = sections.first?.rows.first { $0.highlight == .leading }
        XCTAssertEqual(leading?.id, "o-high-mid")
    }

    /// Selection survives a pull-to-refresh within the same session.
    func testSortPersistsAcrossRefresh() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON),
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectSort(.lowestOffer)
        await vm.refresh()
        XCTAssertEqual(loadedRowIDs(vm), ["o-low-new", "o-mid-old", "o-high-mid"])
        XCTAssertEqual(vm.listingContext?.sortLabel, "Lowest offer")
    }

    func testSortMenuOptionsExposeFourEntriesWithSelection() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.sortFixtureJSON)
        ]
        let vm = makeVM()
        await vm.load()
        let options = vm.listingContext?.sortOptions ?? []
        XCTAssertEqual(options.map(\.label), ["Highest offer", "Lowest offer", "Newest first", "Oldest first"])
        XCTAssertEqual(options.filter(\.isSelected).map(\.id), ["highestOffer"])
        vm.selectSort(.newestFirst)
        let after = vm.listingContext?.sortOptions ?? []
        XCTAssertEqual(after.filter(\.isSelected).map(\.id), ["newestFirst"])
    }

    // MARK: - No tabs / no FAB

    func testNoTabsExposed() {
        let vm = makeVM()
        XCTAssertEqual(vm.tabs.count, 0)
    }

    func testNoFABExposed() {
        let vm = makeVM()
        XCTAssertNil(vm.fab)
    }

    func testShareTopBarActionPresent() {
        let vm = makeVM()
        XCTAssertEqual(vm.topBarAction?.icon, .share)
    }
}
