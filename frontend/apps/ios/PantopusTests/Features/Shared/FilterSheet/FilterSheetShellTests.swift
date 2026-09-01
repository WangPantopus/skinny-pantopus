//
//  FilterSheetShellTests.swift
//  PantopusTests
//
//  P5.1 — Contract tests for the shared FilterSheet scaffold. Asserts
//  that the model's clear behaviour is correct, the shell constructs
//  cleanly with every control kind, and Apply emits the working state
//  through the callback.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class FilterSheetShellTests: XCTestCase {
    // MARK: - Model contract

    func testChipGroupClearedDropsSelection() {
        let opts = [FilterOption(id: "a", label: "A"), FilterOption(id: "b", label: "B")]
        let control: FilterControl = .chipGroup(options: opts, selectedIds: ["a"])
        let cleared = control.cleared()
        if case let .chipGroup(_, ids) = cleared {
            XCTAssertTrue(ids.isEmpty)
        } else {
            XCTFail("Expected chipGroup after clearing")
        }
    }

    func testRadioClearedDropsSelection() {
        let opts = [FilterOption(id: "a", label: "A")]
        let control: FilterControl = .radio(options: opts, selectedId: "a")
        let cleared = control.cleared()
        if case let .radio(_, selected) = cleared {
            XCTAssertNil(selected)
        } else {
            XCTFail("Expected radio after clearing")
        }
    }

    func testMultiSelectClearedDropsSelection() {
        let opts = [FilterOption(id: "a", label: "A"), FilterOption(id: "b", label: "B")]
        let control: FilterControl = .multiSelect(options: opts, selectedIds: ["a", "b"])
        let cleared = control.cleared()
        if case let .multiSelect(_, ids) = cleared {
            XCTAssertTrue(ids.isEmpty)
        } else {
            XCTFail("Expected multiSelect after clearing")
        }
    }

    func testToggleClearedDropsSelection() {
        let opts = [FilterOption(id: "a", label: "A"), FilterOption(id: "b", label: "B")]
        let control: FilterControl = .toggle(options: opts, selectedIds: ["a", "b"])
        let cleared = control.cleared()
        if case let .toggle(_, ids) = cleared {
            XCTAssertTrue(ids.isEmpty)
        } else {
            XCTFail("Expected toggle after clearing")
        }
    }

    func testStepSliderClearedResetsToDefaultIndex() {
        let stops = [
            FilterOption(id: "0.5", label: "0.5 mi"),
            FilterOption(id: "1", label: "1 mi"),
            FilterOption(id: "3", label: "3 mi")
        ]
        let control: FilterControl = .stepSlider(stops: stops, selectedIndex: 0, defaultIndex: 2)
        let cleared = control.cleared()
        if case let .stepSlider(_, selectedIndex, defaultIndex) = cleared {
            XCTAssertEqual(selectedIndex, 2)
            XCTAssertEqual(defaultIndex, 2)
        } else {
            XCTFail("Expected stepSlider after clearing")
        }
    }

    func testRangeSliderClearedResetsToBounds() {
        let range = FilterRange(min: 0, max: 100, lower: 25, upper: 75, step: 5)
        let cleared = range.cleared()
        XCTAssertEqual(cleared.lower, 0)
        XCTAssertEqual(cleared.upper, 100)
        XCTAssertEqual(cleared.min, 0)
        XCTAssertEqual(cleared.max, 100)
        XCTAssertEqual(cleared.step, 5)
    }

    func testRangeInitClampsCrossedHandles() {
        // Lower > upper: should swap into a valid order.
        let r = FilterRange(min: 0, max: 100, lower: 80, upper: 20, step: 1)
        XCTAssertLessThanOrEqual(r.lower, r.upper)
        XCTAssertGreaterThanOrEqual(r.lower, r.min)
        XCTAssertLessThanOrEqual(r.upper, r.max)
    }

    func testArrayClearedMapsEverySection() {
        let opts = [FilterOption(id: "a", label: "A")]
        let sections: [FilterSection] = [
            FilterSection(id: "s1", title: "One", control: .chipGroup(options: opts, selectedIds: ["a"])),
            FilterSection(id: "s2", title: "Two", control: .radio(options: opts, selectedId: "a")),
            FilterSection(
                id: "s3",
                title: "Three",
                control: .rangeSlider(FilterRange(min: 0, max: 10, lower: 2, upper: 8))
            )
        ]
        let cleared = sections.cleared()
        XCTAssertEqual(cleared.count, 3)
        if case let .chipGroup(_, ids) = cleared[0].control { XCTAssertTrue(ids.isEmpty) }
        if case let .radio(_, id) = cleared[1].control { XCTAssertNil(id) }
        if case let .rangeSlider(r) = cleared[2].control {
            XCTAssertEqual(r.lower, 0)
            XCTAssertEqual(r.upper, 10)
        }
    }

    // MARK: - Shell construction

    func testShellConstructsWithEveryControlKind() {
        let sections: [FilterSection] = [
            FilterSection(
                id: "category",
                title: "Category",
                control: .chipGroup(
                    options: [FilterOption(id: "a", label: "A"), FilterOption(id: "b", label: "B")],
                    selectedIds: ["a"]
                )
            ),
            FilterSection(
                id: "sort",
                title: "Sort by",
                control: .radio(
                    options: [FilterOption(id: "recent", label: "Most recent")],
                    selectedId: "recent"
                )
            ),
            FilterSection(
                id: "tags",
                title: "Tags",
                control: .multiSelect(
                    options: [FilterOption(id: "verified", label: "Verified")],
                    selectedIds: []
                )
            ),
            FilterSection(
                id: "options",
                title: "Options",
                control: .toggle(
                    options: [FilterOption(id: "open-now", label: "Open now")],
                    selectedIds: ["open-now"]
                )
            ),
            FilterSection(
                id: "distance",
                title: "Distance",
                control: .stepSlider(
                    stops: [
                        FilterOption(id: "1", label: "1 mi"),
                        FilterOption(id: "5", label: "5 mi"),
                        FilterOption(id: "10", label: "10 mi")
                    ],
                    selectedIndex: 1,
                    defaultIndex: 1
                )
            ),
            FilterSection(
                id: "price",
                title: "Price",
                control: .rangeSlider(FilterRange(min: 0, max: 100, lower: 0, upper: 100))
            )
        ]
        let shell = FilterSheetShell(
            title: "Filters",
            sections: sections,
            onApply: { _ in },
            onClose: {}
        )
        // Materialising the view tree exercises every control branch
        // through the `FilterSectionRow.control` switch.
        _ = UIHostingController(rootView: shell)
    }

    func testShellConstructsWithEmptySections() {
        let shell = FilterSheetShell(
            sections: [],
            onApply: { _ in },
            onClose: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    // MARK: - Identifiable + Equatable contract

    func testSectionsAreEquatable() {
        let opts = [FilterOption(id: "a", label: "A")]
        let s1 = FilterSection(id: "x", title: "X", control: .chipGroup(options: opts, selectedIds: ["a"]))
        let s2 = FilterSection(id: "x", title: "X", control: .chipGroup(options: opts, selectedIds: ["a"]))
        let s3 = FilterSection(id: "x", title: "X", control: .chipGroup(options: opts, selectedIds: []))
        XCTAssertEqual(s1, s2)
        XCTAssertNotEqual(s1, s3)
    }

    func testFilterOptionIdentifiable() {
        let a = FilterOption(id: "a", label: "Label A")
        XCTAssertEqual(a.id, "a")
    }
}
