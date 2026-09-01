//
//  MyHouseholdAvailabilityViewModelTests.swift
//  PantopusTests
//
//  Stream I10 — F8 boundary screen: not-set-up detection from the personal
//  availability endpoint + device-local exposure-toggle persistence.
//

import XCTest
@testable import Pantopus

@MainActor
final class MyHouseholdAvailabilityViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func ephemeralDefaults() -> UserDefaults {
        // swiftlint:disable:next force_unwrapping
        UserDefaults(suiteName: "test-\(UUID().uuidString)")!
    }

    private static let emptyAvailability = "{\"schedules\":[],\"rules\":[],\"overrides\":[]}"
    private static let setUpAvailability = """
    {"schedules":[{"id":"s1","user_id":"u1","name":"Working hours",
      "timezone":"America/New_York","is_default":true}],
     "rules":[],"overrides":[]}
    """

    func testNotSetUpWhenNoSchedules() async {
        SequencedURLProtocol.routeResponses = [
            "/api/scheduling/availability": [.status(200, body: Self.emptyAvailability)]
        ]
        let vm = MyHouseholdAvailabilityViewModel(
            homeId: "home-1",
            api: makeAPI(),
            defaults: ephemeralDefaults()
        )
        await vm.load()
        XCTAssertEqual(vm.phase, .ready)
        XCTAssertFalse(vm.personalIsSetUp)
    }

    func testSetUpWhenSchedulesPresent() async {
        SequencedURLProtocol.routeResponses = [
            "/api/scheduling/availability": [.status(200, body: Self.setUpAvailability)]
        ]
        let vm = MyHouseholdAvailabilityViewModel(
            homeId: "home-1",
            api: makeAPI(),
            defaults: ephemeralDefaults()
        )
        await vm.load()
        XCTAssertTrue(vm.personalIsSetUp)
    }

    func testErrorWhenAvailabilityFails() async {
        SequencedURLProtocol.routeResponses = [
            "/api/scheduling/availability": [.status(500, body: "{\"error\":\"boom\"}")]
        ]
        let vm = MyHouseholdAvailabilityViewModel(
            homeId: "home-1",
            api: makeAPI(),
            defaults: ephemeralDefaults()
        )
        await vm.load()
        guard case .error = vm.phase else {
            XCTFail("Expected .error, got \(vm.phase)")
            return
        }
    }

    func testExposureToggleTogglesAndPersistsPerHome() async {
        let defaults = ephemeralDefaults()
        SequencedURLProtocol.routeResponses = [
            "/api/scheduling/availability": [.status(200, body: Self.setUpAvailability)]
        ]
        let vm = MyHouseholdAvailabilityViewModel(homeId: "home-1", api: makeAPI(), defaults: defaults)
        await vm.load()
        XCTAssertTrue(vm.roundRobin)
        await vm.setExposure(.roundRobin, to: false)
        XCTAssertFalse(vm.roundRobin)
        XCTAssertNil(vm.savingExposure)

        // A fresh VM for the same home reads the persisted value.
        let vm2 = MyHouseholdAvailabilityViewModel(homeId: "home-1", api: makeAPI(), defaults: defaults)
        XCTAssertFalse(vm2.roundRobin)
        // A different home keeps the default.
        let other = MyHouseholdAvailabilityViewModel(homeId: "home-2", api: makeAPI(), defaults: defaults)
        XCTAssertTrue(other.roundRobin)
    }

    func testTogglesIgnoredWhenNotSetUp() async {
        SequencedURLProtocol.routeResponses = [
            "/api/scheduling/availability": [.status(200, body: Self.emptyAvailability)]
        ]
        let vm = MyHouseholdAvailabilityViewModel(
            homeId: "home-1",
            api: makeAPI(),
            defaults: ephemeralDefaults()
        )
        await vm.load()
        let before = vm.autoDecline
        await vm.setExposure(.autoDecline, to: !before)
        XCTAssertEqual(vm.autoDecline, before)
    }
}
