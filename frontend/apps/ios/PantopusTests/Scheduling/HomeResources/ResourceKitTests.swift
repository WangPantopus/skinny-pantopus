//
//  ResourceKitTests.swift
//  PantopusTests
//
//  Stream I12 — pure helper tests for the resources & visits kit.
//

import XCTest
@testable import Pantopus

final class ResourceKitTests: XCTestCase {
    // MARK: ResourceKind

    func testResourceKindWireMapping() {
        XCTAssertEqual(ResourceKind(wire: "charger"), .charger)
        XCTAssertEqual(ResourceKind(wire: "vehicle"), .vehicle)
        XCTAssertEqual(ResourceKind(wire: nil), .other)
        XCTAssertEqual(ResourceKind(wire: "bogus"), .other)
    }

    func testResourceKindIconAndLabel() {
        XCTAssertEqual(ResourceKind.charger.icon, .zap)
        XCTAssertEqual(ResourceKind.vehicle.icon, .car)
        XCTAssertEqual(ResourceKind.room.label, "Room")
    }

    func testChargerSmartDefaults() {
        let defaults = ResourceKind.charger.defaultRules
        XCTAssertEqual(defaults.maxDurationMin, 240)
        XCTAssertFalse(defaults.requiresApproval)
    }

    // MARK: VisitKind / WhoCanBook

    func testVisitKindContractEnum() {
        XCTAssertEqual(VisitKind.allCases, [.vendor, .guest])
        XCTAssertEqual(VisitKind(wire: "guest"), .guest)
        XCTAssertEqual(VisitKind(wire: "delivery"), .vendor) // unsupported → default
    }

    func testWhoCanBookMapping() {
        XCTAssertEqual(WhoCanBook(wire: "specific"), .specific)
        XCTAssertEqual(WhoCanBook(wire: nil), .members)
        XCTAssertEqual(WhoCanBook.members.label, "All")
    }

    // MARK: AvailableHours round-trip

    func testAvailableHoursRoundTrips() {
        let hours = AvailableHours(days: [2, 3, 4, 5, 6], start: "07:00", end: "22:00")
        let decoded = AvailableHours(json: hours.json)
        XCTAssertEqual(decoded, hours)
    }

    func testAvailableHoursEmptyObjectIsNil() {
        XCTAssertNil(AvailableHours(json: .object([:])))
        XCTAssertNil(AvailableHours(json: nil))
    }

    // MARK: ResourceHomeMember projection

    func testHomeMemberFromOccupantsFiltersInactive() {
        let occupants = [
            OccupantDTO(id: "o1", userId: "u1", role: "member", isActive: true, displayName: "Dad"),
            OccupantDTO(id: "o2", userId: "u2", role: "member", isActive: false, displayName: "Ghost")
        ]
        let members = ResourceHomeMember.from(occupants: occupants)
        XCTAssertEqual(members.count, 1)
        XCTAssertEqual(members.first?.name, "Dad")
        XCTAssertEqual(members.first?.initials, "D")
    }

    func testHomeMemberToneIsStable() {
        let member = ResourceHomeMember(id: "abc123", name: "Maria Kowalski")
        XCTAssertEqual(member.initials, "MK")
        XCTAssertEqual(member.tone, ResourceHomeMember(id: "abc123", name: "Maria Kowalski").tone)
    }

    // MARK: ResourceBooking decode (resource_id present)

    func testResourceBookingDecodesResourceId() throws {
        let json = #"""
        {"id":"b1","resource_id":"r1","start_at":"2026-06-16T09:00:00Z",
         "end_at":"2026-06-16T11:00:00Z","invitee_name":"Dad","status":"confirmed","created_by":"u1"}
        """#
        let booking = try JSONDecoder().decode(ResourceBooking.self, from: Data(json.utf8))
        XCTAssertEqual(booking.resourceId, "r1")
        XCTAssertEqual(booking.inviteeName, "Dad")
        XCTAssertTrue(booking.isLive)
        XCTAssertFalse(booking.isPending)
    }

    // MARK: ResourceTime

    func testUtcISORoundTrips() {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let iso = ResourceTime.utcISO(date)
        let parsed = SchedulingTime.parseUTC(iso)
        XCTAssertEqual(parsed?.timeIntervalSince1970 ?? -1, date.timeIntervalSince1970, accuracy: 1)
    }

    func testClockLabelFormatsWholeHour() {
        XCTAssertEqual(ResourceTime.clockLabel(hhmm: "07:00"), "7 AM")
        XCTAssertEqual(ResourceTime.clockLabel(hhmm: "22:00"), "10 PM")
    }
}
