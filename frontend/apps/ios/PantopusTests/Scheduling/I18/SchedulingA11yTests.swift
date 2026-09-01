//
//  SchedulingA11yTests.swift
//  PantopusTests
//
//  Stream I18 — H14 accessibility helpers + the audit contract. Verifies the
//  VoiceOver label builders, the Dynamic-Type reflow gate, and that the encoded
//  audit is coherent (every requirement covered; every flagged finding carries a
//  follow-up slug to file against the owning stream).
//

import SwiftUI
import XCTest
@testable import Pantopus

final class SchedulingA11yTests: XCTestCase {
    func testSlotLabelAnnouncesDateTimeAndAvailability() {
        XCTAssertEqual(
            SchedulingA11y.slotLabel(date: "Tue Jun 16", time: "3:00 PM", isAvailable: true),
            "Tue Jun 16, 3:00 PM, available"
        )
        XCTAssertEqual(
            SchedulingA11y.slotLabel(date: "Tue Jun 16", time: "3:00 PM", isAvailable: false),
            "Tue Jun 16, 3:00 PM, taken"
        )
    }

    func testTimezoneLabelOmitsMatchingHost() {
        XCTAssertEqual(
            SchedulingA11y.timezoneLabel(viewer: "Pacific Time"),
            "Times shown in Pacific Time"
        )
        XCTAssertEqual(
            SchedulingA11y.timezoneLabel(viewer: "Pacific Time", host: "Pacific Time"),
            "Times shown in Pacific Time"
        )
    }

    func testTimezoneLabelSpeaksHostMismatch() {
        XCTAssertEqual(
            SchedulingA11y.timezoneLabel(viewer: "Pacific Time", host: "Eastern Time"),
            "Times shown in Pacific Time, host is in Eastern Time"
        )
    }

    func testSlotColumnsReflowAtAccessibilitySizes() {
        XCTAssertEqual(DynamicTypeSize.large.schedulingSlotColumns, 3)
        XCTAssertEqual(DynamicTypeSize.accessibility3.schedulingSlotColumns, 1)
    }

    func testAuditCoversEveryRequirement() {
        let covered = Set(SchedulingA11yAudit.findings.map(\.requirement))
        for requirement in SchedulingA11yRequirement.allCases {
            XCTAssertTrue(covered.contains(requirement), "Audit missing requirement: \(requirement.rawValue)")
        }
    }

    func testFlaggedFindingsAllHaveFollowUps() {
        XCTAssertFalse(SchedulingA11yAudit.flagged.isEmpty, "Audit should record the known SlotPicker gaps")
        for finding in SchedulingA11yAudit.flagged {
            XCTAssertNotNil(finding.followUp, "Flagged finding \(finding.id) must name a follow-up")
            XCTAssertFalse(finding.followUp?.isEmpty ?? true)
        }
    }

    func testPassingFindingsExist() {
        XCTAssertFalse(SchedulingA11yAudit.passing.isEmpty)
    }
}
