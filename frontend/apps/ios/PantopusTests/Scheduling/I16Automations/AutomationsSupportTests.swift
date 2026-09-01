//
//  AutomationsSupportTests.swift
//  PantopusTests
//
//  Stream I16 — pure-logic tests for the automations domain vocabulary
//  (trigger/channel mapping, offset + reminder formatting, variable catalog).
//

import XCTest
@testable import Pantopus

final class AutomationsSupportTests: XCTestCase {
    func testTriggerSummaries() {
        XCTAssertEqual(WorkflowTrigger(wire: "booking_created").summary(offsetMinutes: 0), "When a booking is created")
        XCTAssertEqual(WorkflowTrigger(wire: "cancelled").summary(offsetMinutes: 0), "When a booking is cancelled")
        XCTAssertEqual(WorkflowTrigger.beforeStart.summary(offsetMinutes: 60), "1 hour before it starts")
        XCTAssertEqual(WorkflowTrigger.afterEnd.summary(offsetMinutes: 1440), "1 day after it ends")
        // Offset 0 on an offset trigger collapses to the instant phrasing.
        XCTAssertEqual(WorkflowTrigger.beforeStart.summary(offsetMinutes: 0), "When it starts")
    }

    func testTriggerWireFallback() {
        XCTAssertEqual(WorkflowTrigger(wire: "garbage"), .bookingCreated)
        XCTAssertTrue(WorkflowTrigger.beforeStart.usesOffset)
        XCTAssertFalse(WorkflowTrigger.bookingCreated.usesOffset)
    }

    func testChannelMapping() {
        XCTAssertEqual(WorkflowChannel(wire: "in_app"), .inApp)
        XCTAssertTrue(WorkflowChannel.sms.isComingSoon)
        XCTAssertFalse(WorkflowChannel.email.isComingSoon)
        XCTAssertTrue(WorkflowChannel.email.needsSubject)
        XCTAssertEqual(WorkflowChannel.email.actionSummary, "Email attendees")
        XCTAssertEqual(WorkflowChannel.push.actionSummary, "Notify you")
    }

    func testDurationFormatting() {
        XCTAssertEqual(AutomationsFormat.duration(45), "45 minutes")
        XCTAssertEqual(AutomationsFormat.duration(60), "1 hour")
        XCTAssertEqual(AutomationsFormat.duration(120), "2 hours")
        XCTAssertEqual(AutomationsFormat.duration(1440), "1 day")
        XCTAssertEqual(AutomationsFormat.duration(10080), "1 week")
    }

    func testRemindersSummary() {
        let summary = AutomationsFormat.remindersSummary([60, 1440])
        XCTAssertEqual(summary, "1 day + 1 hour before · Push")
        XCTAssertEqual(AutomationsFormat.remindersSummary([]), "No reminders yet")
        // "At start" (0) drops the "before" suffix.
        XCTAssertEqual(AutomationsFormat.remindersSummary([0]), "at start · Push")
    }

    func testReminderSmartDefault() {
        XCTAssertEqual(ReminderPreset.smartDefault.sorted(by: >), [1440, 60])
        XCTAssertEqual(ReminderPreset.all.count, 6)
    }

    func testVariableCatalogSearch() {
        let grouped = TemplateVariableCatalog.grouped(filter: "name")
        let labels = grouped.flatMap(\.items).map(\.label)
        XCTAssertTrue(labels.contains("Attendee name"))
        XCTAssertTrue(labels.contains("Host name"))
        XCTAssertFalse(labels.contains("Reschedule link"))

        XCTAssertTrue(TemplateVariableCatalog.grouped(filter: "zzz").isEmpty)
        XCTAssertEqual(TemplateVariableCatalog.sampleValues["attendee_name"], "Maria K.")
    }

    func testStartersAreDistinct() {
        let ids = Set(StarterTemplate.all.map(\.id))
        XCTAssertEqual(ids.count, StarterTemplate.all.count)
        XCTAssertTrue(StarterTemplate.all.contains { $0.channel == .email && $0.subject != nil })
    }
}
