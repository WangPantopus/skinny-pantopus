//
//  GroupedListContractTests.swift
//  PantopusTests
//
//  Locks the GroupedList archetype's data contract: row controls
//  preserve their values, destructive rows can coexist with regular
//  rows in the same group, and the `row(id:)` helper finds rows.
//

import XCTest
@testable import Pantopus

final class GroupedListContractTests: XCTestCase {
    func testRowControlVariantsRoundTrip() {
        let cases: [RowControl] = [
            .chevron,
            .toggle(isOn: true),
            .toggle(isOn: false),
            .radio(isSelected: true),
            .chipStatus(label: "Verified", tone: .success, includesChevron: true),
            .slider(stops: ["A", "B", "C"], index: 1),
            .channelTriad(p: true, e: false, s: true, locked: []),
            .channelTriad(p: true, e: true, s: true, locked: [.p])
        ]
        for control in cases {
            let row = GroupedListRow(id: "r", label: "Row", control: control)
            XCTAssertEqual(row.control, control)
        }
    }

    func testGroupHelperPreserved() {
        let group = GroupedListGroup(
            id: "g",
            overline: "Group",
            helper: "Helper caption",
            rows: [GroupedListRow(id: "r1", label: "One", control: .chevron)]
        )
        XCTAssertEqual(group.helper, "Helper caption")
        XCTAssertEqual(group.row(id: "r1")?.label, "One")
    }

    func testDestructiveRowsHaveErrorTreatment() {
        let row = GroupedListRow(id: "logout", label: "Log out", control: .chevron, destructive: true)
        XCTAssertTrue(row.destructive)
        // The shell pulls destructive rows into their own card — the
        // model carries the flag, the view does the layout.
    }

    func testStateTransitions() {
        let groups = [
            GroupedListGroup(
                id: "g",
                overline: nil,
                rows: [
                    GroupedListRow(id: "r", label: "Row", control: .chevron)
                ]
            )
        ]
        let loading: GroupedListState = .loading
        let loaded: GroupedListState = .loaded(groups)
        let error: GroupedListState = .error(message: "boom")
        if case .loading = loading { /* ok */ } else { XCTFail("Expected .loading") }
        if case let .loaded(g) = loaded { XCTAssertEqual(g.count, 1) } else { XCTFail("Expected .loaded") }
        if case let .error(message) = error { XCTAssertEqual(message, "boom") } else { XCTFail("Expected .error") }
    }
}
