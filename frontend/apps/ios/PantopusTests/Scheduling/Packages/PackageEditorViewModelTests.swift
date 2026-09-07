//
//  PackageEditorViewModelTests.swift
//  PantopusTests
//
//  G9 · Stream I15. Validation, create, edit-seed, and per-session math.
//

import XCTest
@testable import Pantopus

@MainActor
final class PackageEditorViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = true
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = false
        super.tearDown()
    }

    private func vm(packageId: String?, _ routes: [String: [SequencedURLProtocol.Response]]) -> PackageEditorViewModel {
        PackageEditorViewModel(
            owner: .business(id: "biz1"),
            packageId: packageId,
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    // swiftlint:disable:next line_length
    private let eventTypes = #"{"eventTypes":[{"id":"et1","name":"Haircut","slug":"haircut","durations":[45],"default_duration":45,"is_active":true}]}"#
    // swiftlint:disable:next line_length
    private let onePackage = #"{"packages":[{"id":"pk1","owner_type":"business","owner_id":"biz1","name":"5-session cleaning","sessions_count":5,"price_cents":22000,"currency":"USD","event_type_id":"et1","is_active":true,"created_at":"2026-06-10T00:00:00Z"}]}"#

    func testValidationRequiresName() async {
        let model = vm(packageId: nil, ["/api/scheduling/event-types": [.status(200, body: eventTypes)]])
        await model.load()
        XCTAssertFalse(model.isValid)
        var done = false
        await model.save { done = true }
        XCTAssertTrue(model.nameError)
        XCTAssertFalse(done)
    }

    func testCreateSavesAndCallsOnDone() async {
        // swiftlint:disable:next line_length
        let created = #"{"package":{"id":"pkNew","owner_type":"business","owner_id":"biz1","name":"3 deep cleans","sessions_count":3,"price_cents":33000,"currency":"USD","is_active":true,"created_at":"2026-06-15T00:00:00Z"}}"#
        let model = vm(packageId: nil, [
            "/api/scheduling/event-types": [.status(200, body: eventTypes)],
            "/api/scheduling/packages": [.status(201, body: created)]
        ])
        await model.load()
        model.name = "3 deep cleans"
        model.sessionsCount = 3
        model.priceText = "330"
        XCTAssertTrue(model.isValid)
        var done = false
        await model.save { done = true }
        XCTAssertTrue(done)
        XCTAssertFalse(model.nameError)
    }

    func testEditSeedsFields() async {
        let model = vm(packageId: "pk1", [
            "/api/scheduling/event-types": [.status(200, body: eventTypes)],
            "/api/scheduling/packages": [.status(200, body: onePackage)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .ready)
        XCTAssertEqual(model.name, "5-session cleaning")
        XCTAssertEqual(model.sessionsCount, 5)
        XCTAssertEqual(model.priceText, "220.00")
        XCTAssertEqual(model.selectedEventTypeId, "et1")
        XCTAssertTrue(model.isActive)
    }

    func testPerSessionMath() async {
        let model = vm(packageId: nil, ["/api/scheduling/event-types": [.status(200, body: eventTypes)]])
        await model.load()
        model.priceText = "240.00"
        model.sessionsCount = 5
        XCTAssertTrue(model.perSessionLabel.contains("48"))
    }

    func testSelectEventTypeToggles() async {
        let model = vm(packageId: nil, ["/api/scheduling/event-types": [.status(200, body: eventTypes)]])
        await model.load()
        model.selectEventType("et1")
        XCTAssertEqual(model.selectedEventTypeId, "et1")
        model.selectEventType("et1")
        XCTAssertNil(model.selectedEventTypeId)
    }
}
