//
//  SchedulingStatusPillTests.swift
//  PantopusTests
//
//  Verifies the backend-status → pill mapping (tolerant of snake_case /
//  aliases / unknown) and the semantic tone bucketing the pill renders.
//

import XCTest
@testable import Pantopus

final class SchedulingStatusPillTests: XCTestCase {
    func testKnownStatusesMap() {
        XCTAssertEqual(SchedulingPillStatus(backend: "confirmed"), .confirmed)
        XCTAssertEqual(SchedulingPillStatus(backend: "pending"), .pending)
        XCTAssertEqual(SchedulingPillStatus(backend: "cancelled"), .cancelled)
        XCTAssertEqual(SchedulingPillStatus(backend: "declined"), .declined)
        XCTAssertEqual(SchedulingPillStatus(backend: "no_show"), .noShow)
        XCTAssertEqual(SchedulingPillStatus(backend: "paused"), .paused)
        XCTAssertEqual(SchedulingPillStatus(backend: "draft"), .draft)
        XCTAssertEqual(SchedulingPillStatus(backend: "secret"), .secret)
        XCTAssertEqual(SchedulingPillStatus(backend: "expired"), .expired)
        XCTAssertEqual(SchedulingPillStatus(backend: "unavailable"), .unavailable)
        XCTAssertEqual(SchedulingPillStatus(backend: "active"), .active)
    }

    func testAliasesAndCasingAndSeparators() {
        XCTAssertEqual(SchedulingPillStatus(backend: "PENDING_APPROVAL"), .pending)
        XCTAssertEqual(SchedulingPillStatus(backend: "approved"), .confirmed)
        XCTAssertEqual(SchedulingPillStatus(backend: "canceled"), .cancelled)
        XCTAssertEqual(SchedulingPillStatus(backend: "NoShow"), .noShow)
        XCTAssertEqual(SchedulingPillStatus(backend: "fully-booked"), .unavailable)
        XCTAssertEqual(SchedulingPillStatus(backend: "live"), .active)
    }

    func testUnknownFallsBack() {
        XCTAssertEqual(SchedulingPillStatus(backend: "weird_new_state"), .unknown)
        XCTAssertEqual(SchedulingPillStatus(backend: ""), .unknown)
    }

    func testToneBuckets() {
        XCTAssertEqual(SchedulingPillStatus.confirmed.tone, .success)
        XCTAssertEqual(SchedulingPillStatus.active.tone, .success)
        XCTAssertEqual(SchedulingPillStatus.completed.tone, .success)
        // Pending / draft read as calm INFO-blue (in-progress / unpublished),
        // not an amber warning.
        XCTAssertEqual(SchedulingPillStatus.pending.tone, .info)
        XCTAssertEqual(SchedulingPillStatus.draft.tone, .info)
        XCTAssertEqual(SchedulingPillStatus.declined.tone, .error)
        XCTAssertEqual(SchedulingPillStatus.noShow.tone, .error)
        XCTAssertEqual(SchedulingPillStatus.expired.tone, .error)
        // Paused / cancelled / unknown render neutral grey.
        XCTAssertEqual(SchedulingPillStatus.paused.tone, .neutral)
        XCTAssertEqual(SchedulingPillStatus.cancelled.tone, .neutral)
        XCTAssertEqual(SchedulingPillStatus.unknown.tone, .neutral)
    }

    func testEveryCaseHasNonEmptyLabel() {
        for status in SchedulingPillStatus.allCases {
            XCTAssertFalse(status.label.isEmpty, "\(status) has an empty label")
        }
    }
}
