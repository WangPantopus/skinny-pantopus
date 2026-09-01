//
//  SchedulingOwnerTests.swift
//  PantopusTests
//
//  Verifies the owner-context contract: path prefix, GET query items, write
//  body owner fields, and `OwnerScopedBody` JSON splicing.
//

import XCTest
@testable import Pantopus

final class SchedulingOwnerTests: XCTestCase {
    // MARK: - Path prefix

    func testPathPrefix() {
        XCTAssertEqual(SchedulingOwner.personal.pathPrefix, "/api/scheduling")
        XCTAssertEqual(SchedulingOwner.business(id: "biz-1").pathPrefix, "/api/scheduling")
        XCTAssertEqual(SchedulingOwner.home(homeId: "home-9").pathPrefix, "/api/homes/home-9/scheduling")
    }

    // MARK: - Query items

    func testQueryItemsOnlyForBusiness() {
        XCTAssertTrue(SchedulingOwner.personal.queryItems.isEmpty)
        XCTAssertTrue(SchedulingOwner.home(homeId: "h").queryItems.isEmpty)
        XCTAssertEqual(
            SchedulingOwner.business(id: "biz-1").queryItems,
            ["owner_type": "business", "owner_id": "biz-1"]
        )
    }

    func testQueryMergePreservesFilters() {
        let merged = SchedulingOwner.business(id: "biz-1").query(merging: ["status": "upcoming"])
        XCTAssertEqual(merged["owner_type"], "business")
        XCTAssertEqual(merged["owner_id"], "biz-1")
        XCTAssertEqual(merged["status"], "upcoming")
    }

    // MARK: - Owner body

    func testOwnerBodyOnlyForBusiness() {
        XCTAssertTrue(SchedulingOwner.personal.ownerBody.isEmpty)
        XCTAssertTrue(SchedulingOwner.home(homeId: "h").ownerBody.isEmpty)
        XCTAssertEqual(
            SchedulingOwner.business(id: "biz-1").ownerBody,
            ["owner_type": "business", "owner_id": "biz-1"]
        )
    }

    // MARK: - OwnerScopedBody encoding

    private func encodedObject(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        let object = try JSONSerialization.jsonObject(with: data)
        return try XCTUnwrap(object as? [String: Any])
    }

    func testOwnerScopedBodySplicesBusinessOwnerFields() throws {
        let payload = CreateEventTypeRequest(name: "Intro Call", slug: "intro")
        let wrapped = OwnerScopedBody(owner: .business(id: "biz-1"), payload: payload)
        let object = try encodedObject(wrapped)
        XCTAssertEqual(object["name"] as? String, "Intro Call")
        XCTAssertEqual(object["slug"] as? String, "intro")
        XCTAssertEqual(object["owner_type"] as? String, "business")
        XCTAssertEqual(object["owner_id"] as? String, "biz-1")
    }

    func testOwnerScopedBodyOmitsOwnerForPersonal() throws {
        let payload = CreateEventTypeRequest(name: "Intro Call", slug: "intro")
        let wrapped = OwnerScopedBody(owner: .personal, payload: payload)
        let object = try encodedObject(wrapped)
        XCTAssertEqual(object["name"] as? String, "Intro Call")
        XCTAssertNil(object["owner_type"])
        XCTAssertNil(object["owner_id"])
    }

    func testOwnerScopedBodyOmitsOwnerForHome() throws {
        let payload = CreateVisitRequest(title: "Plumber", startAt: "2026-07-01T15:00:00Z", endAt: "2026-07-01T16:00:00Z")
        let wrapped = OwnerScopedBody(owner: .home(homeId: "home-9"), payload: payload)
        let object = try encodedObject(wrapped)
        XCTAssertEqual(object["title"] as? String, "Plumber")
        XCTAssertNil(object["owner_type"])
        XCTAssertNil(object["owner_id"])
    }

    // MARK: - Endpoint wiring

    func testHomeEndpointUsesAliasPath() {
        let endpoint = SchedulingEndpoints.getBookingPage(owner: .home(homeId: "home-9"))
        XCTAssertEqual(endpoint.path, "/api/homes/home-9/scheduling/booking-page")
        XCTAssertTrue(endpoint.query.isEmpty)
    }

    func testBusinessGetEndpointCarriesOwnerQuery() {
        let endpoint = SchedulingEndpoints.getBookings(owner: .business(id: "biz-1"), status: "pending")
        XCTAssertEqual(endpoint.path, "/api/scheduling/bookings")
        XCTAssertEqual(endpoint.query["owner_type"], "business")
        XCTAssertEqual(endpoint.query["owner_id"], "biz-1")
        XCTAssertEqual(endpoint.query["status"], "pending")
    }

    func testAvailabilityIsAlwaysPersonal() {
        let endpoint = SchedulingEndpoints.getAvailability()
        XCTAssertEqual(endpoint.path, "/api/scheduling/availability")
        XCTAssertTrue(endpoint.query.isEmpty)
    }

    func testPublicEndpointsAreUnauthenticated() {
        XCTAssertFalse(SchedulingPublicEndpoints.bookPage(slug: "ada").authenticated)
        XCTAssertFalse(
            SchedulingPublicEndpoints.slots(
                slug: "ada",
                eventTypeSlug: "intro",
                from: "2026-07-01",
                to: "2026-07-08",
                tz: "America/New_York"
            ).authenticated
        )
    }
}
