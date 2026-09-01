//
//  SpatialPrimitivesSnapshotTests.swift
//  PantopusTests
//
//  P1.3 — Render-smoke snapshots for the three spatial / temporal
//  primitives that unblock A10.9, A14.7, A14.8:
//
//    - SlotCalendar — one assertion per cell state (past, today,
//      filled, open, mine) plus a full mixed-state grid.
//    - FuzzMap — one assertion per fuzz stop (5 frames).
//    - DateSpan — one assertion per tone variant (3 frames).
//
//  Each test hosts the view in a `UIHostingController`, sizes the host
//  to the component's natural frame, and asserts the host builds. This
//  mirrors `ComponentRenderTests.swift` — visual baseline PNGs ship as
//  a follow-up tripwire under `__Snapshots__/spatial-primitives/`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class SpatialPrimitivesSnapshotTests: XCTestCase {
    // MARK: - Helpers

    private func assertRenders(
        _ label: String,
        size: CGSize,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(origin: .zero, size: size)
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    private static let cellSize = CGSize(width: 60, height: 60)
    private static let calendarSize = CGSize(width: 360, height: 320)
    private static let fuzzSize = CGSize(width: 320, height: 180)
    private static let dateSpanSize = CGSize(width: 320, height: 80)

    // MARK: - SlotCalendar — per-cell-state snapshots

    func testSlotCalendar_pastCell() {
        assertRenders("SlotCalendar past", size: Self.calendarSize) {
            SlotCalendar(days: Self.days(allState: .past)) { _ in }
        }
    }

    func testSlotCalendar_todayCell() {
        assertRenders("SlotCalendar today", size: Self.calendarSize) {
            SlotCalendar(days: Self.days(allState: .today)) { _ in }
        }
    }

    func testSlotCalendar_filledCell() {
        assertRenders("SlotCalendar filled", size: Self.calendarSize) {
            SlotCalendar(days: Self.days(allState: .filled)) { _ in }
        }
    }

    func testSlotCalendar_openCell() {
        assertRenders("SlotCalendar open", size: Self.calendarSize) {
            SlotCalendar(days: Self.days(allState: .open)) { _ in }
        }
    }

    func testSlotCalendar_mineCell() {
        assertRenders("SlotCalendar mine", size: Self.calendarSize) {
            SlotCalendar(days: Self.days(allState: .mine)) { _ in }
        }
    }

    func testSlotCalendar_mixedStates() {
        assertRenders("SlotCalendar mixed", size: Self.calendarSize) {
            SlotCalendar(days: Self.mixedDays()) { _ in }
        }
    }

    // MARK: - FuzzMap — per-stop snapshots

    func testFuzzMap_exact() {
        assertRenders("FuzzMap exact", size: Self.fuzzSize) {
            FuzzMap(stop: .exact)
        }
    }

    func testFuzzMap_block() {
        assertRenders("FuzzMap block", size: Self.fuzzSize) {
            FuzzMap(stop: .block)
        }
    }

    func testFuzzMap_quarterMile() {
        assertRenders("FuzzMap quarter mile", size: Self.fuzzSize) {
            FuzzMap(stop: .quarterMile)
        }
    }

    func testFuzzMap_halfMile() {
        assertRenders("FuzzMap half mile", size: Self.fuzzSize) {
            FuzzMap(stop: .halfMile)
        }
    }

    func testFuzzMap_neighborhood() {
        assertRenders("FuzzMap neighborhood", size: Self.fuzzSize) {
            FuzzMap(stop: .neighborhood)
        }
    }

    // MARK: - DateSpan — per-tone snapshots

    func testDateSpan_info() {
        assertRenders("DateSpan info", size: Self.dateSpanSize) {
            DateSpan(days: 13, fromWeekday: "MON", toWeekday: "WED", tone: .info)
        }
    }

    func testDateSpan_success() {
        assertRenders("DateSpan success", size: Self.dateSpanSize) {
            DateSpan(days: 7, fromWeekday: "FRI", toWeekday: "THU", tone: .success)
        }
    }

    func testDateSpan_warning() {
        assertRenders("DateSpan warning", size: Self.dateSpanSize) {
            DateSpan(days: 30, fromWeekday: "TUE", toWeekday: "WED", tone: .warning)
        }
    }

    // MARK: - Fixtures

    private static func days(allState: SlotCalendarState) -> [SlotCalendarDay] {
        let base = Date(timeIntervalSince1970: 1_733_011_200) // 2024-12-01
        let cal = Calendar(identifier: .gregorian)
        return (0..<28).map { i in
            let date = cal.date(byAdding: .day, value: i, to: base) ?? base
            let day = cal.dateComponents([.day], from: date).day ?? 1
            return SlotCalendarDay(
                id: "fixture-\(allState.rawValue)-\(i)",
                date: date,
                dayNumber: day,
                state: allState
            )
        }
    }

    private static func mixedDays() -> [SlotCalendarDay] {
        let base = Date(timeIntervalSince1970: 1_733_011_200)
        let cal = Calendar(identifier: .gregorian)
        let states: [SlotCalendarState] = [
            .past, .past, .past, .past, .past, .past, .past,
            .past, .today, .filled, .open, .filled, .open, .filled,
            .open, .filled, .open, .mine, .open, .open, .filled,
            .open, .open, .open, .open, .open, .open, .open
        ]
        return states.enumerated().map { i, s in
            let date = cal.date(byAdding: .day, value: i, to: base) ?? base
            let day = cal.dateComponents([.day], from: date).day ?? 1
            return SlotCalendarDay(
                id: "mixed-\(i)",
                date: date,
                dayNumber: day,
                state: s
            )
        }
    }
}
