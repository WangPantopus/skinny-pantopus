//
//  SchedulingErrorTests.swift
//  PantopusTests
//
//  Verifies SchedulingError.from parses the booking-specific failure shapes:
//  409 slot conflict + alternatives, 400 validation details, 501 coming-soon,
//  and the other 409 / not-found / forbidden mappings. Also covers
//  SchedulingStatus decoding (incl. unknown fallback).
//

import XCTest
@testable import Pantopus

final class SchedulingErrorTests: XCTestCase {
    // MARK: - 409 slot conflict

    func test409SlotTakenParsesAlternatives() {
        let body = """
        {"error":"SLOT_TAKEN","message":"That time was just booked.","alternatives":[
          {"start":"2026-07-01T15:00:00Z","end":"2026-07-01T15:30:00Z","startLocal":"2026-07-01T11:00:00-04:00"},
          {"start":"2026-07-01T16:00:00Z","end":"2026-07-01T16:30:00Z","startLocal":"2026-07-01T12:00:00-04:00"}
        ]}
        """
        let error = SchedulingError.from(.clientError(status: 409, message: body))
        guard case let .slotConflict(code, message, alternatives) = error else {
            return XCTFail("Expected .slotConflict, got \(error)")
        }
        XCTAssertEqual(code, "SLOT_TAKEN")
        XCTAssertEqual(message, "That time was just booked.")
        XCTAssertEqual(alternatives.count, 2)
        XCTAssertEqual(alternatives.first?.start, "2026-07-01T15:00:00Z")
        XCTAssertEqual(alternatives.first?.startLocal, "2026-07-01T11:00:00-04:00")
        XCTAssertEqual(error.alternatives.count, 2)
        XCTAssertEqual(error.code, "SLOT_TAKEN")
    }

    func test409WithAlternativesButNoCodeStillSlotConflict() {
        let body = """
        {"message":"gone","alternatives":[{"start":"a","end":"b","startLocal":"c"}]}
        """
        let error = SchedulingError.from(.clientError(status: 409, message: body))
        guard case let .slotConflict(code, _, alternatives) = error else {
            return XCTFail("Expected .slotConflict, got \(error)")
        }
        XCTAssertEqual(code, "SLOT_CONFLICT")
        XCTAssertEqual(alternatives.count, 1)
    }

    func test409NonSlotIsPlainConflict() {
        let body = #"{"error":"PAGE_PAUSED","message":"This page is not accepting bookings right now."}"#
        let error = SchedulingError.from(.clientError(status: 409, message: body))
        guard case let .conflict(code, message) = error else {
            return XCTFail("Expected .conflict, got \(error)")
        }
        XCTAssertEqual(code, "PAGE_PAUSED")
        XCTAssertEqual(message, "This page is not accepting bookings right now.")
        XCTAssertTrue(error.alternatives.isEmpty)
    }

    // MARK: - 400 validation

    func test400ValidationParsesDetails() {
        let body = """
        {"error":"Validation failed","details":[
          {"field":"email","message":"must be a valid email","code":"string.email"},
          {"field":"name","message":"is required"}
        ]}
        """
        let error = SchedulingError.from(.clientError(status: 400, message: body))
        guard case let .validation(_, details) = error else {
            return XCTFail("Expected .validation, got \(error)")
        }
        XCTAssertEqual(details.count, 2)
        XCTAssertEqual(details.first?.field, "email")
        XCTAssertEqual(details.first?.message, "must be a valid email")
        XCTAssertEqual(details.first?.code, "string.email")
        XCTAssertEqual(error.validationDetails.count, 2)
    }

    // MARK: - 501 coming soon

    func test501ConnectMapsToNotImplemented() {
        // APIClient surfaces 5xx (incl. 501) as APIError.server(status:body:).
        let body = #"{"error":"NOT_AVAILABLE","message":"External calendar sync is coming soon."}"#
        let error = SchedulingError.from(.server(status: 501, body: body))
        guard case let .notImplemented(message) = error else {
            return XCTFail("Expected .notImplemented, got \(error)")
        }
        XCTAssertEqual(message, "External calendar sync is coming soon.")
    }

    // MARK: - 404 / 403 / 401

    func test404MapsToNotFound() {
        guard case .notFound = SchedulingError.from(.notFound) else {
            return XCTFail("Expected .notFound")
        }
    }

    func test403MapsToForbidden() {
        guard case .forbidden = SchedulingError.from(.forbidden) else {
            return XCTFail("Expected .forbidden")
        }
    }

    func test401MapsToUnauthorized() {
        XCTAssertEqual(SchedulingError.from(.unauthorized), .unauthorized)
    }

    // MARK: - SchedulingStatus

    func testSchedulingStatusDecodesKnownAndUnknown() throws {
        struct Wrapper: Decodable { let status: SchedulingStatus }
        let decoder = JSONDecoder()
        let active = try decoder.decode(Wrapper.self, from: Data(#"{"status":"active"}"#.utf8))
        XCTAssertEqual(active.status, .active)
        let paused = try decoder.decode(Wrapper.self, from: Data(#"{"status":"paused"}"#.utf8))
        XCTAssertEqual(paused.status, .paused)
        let expired = try decoder.decode(Wrapper.self, from: Data(#"{"status":"expired"}"#.utf8))
        XCTAssertEqual(expired.status, .expired)
        let unknown = try decoder.decode(Wrapper.self, from: Data(#"{"status":"weird_new_state"}"#.utf8))
        XCTAssertEqual(unknown.status, .unknown)
    }
}
