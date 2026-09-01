//
//  NeighborhoodViewModelTests.swift
//  PantopusTests
//
//  Wedge Phase 1 — the density-gated Neighborhood door.
//

import XCTest
@testable import Pantopus

@MainActor
final class NeighborhoodViewModelTests: XCTestCase {
    private func makeClient() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    func testLoadDecodesGrowingMeter() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/neighborhood/meter"] = [
            .status(200, body: """
            {"state":"growing","verified_count":12,"k_anon_min":5,"threshold":20,
             "unlocked":false,"area":{"city":"Camas","state":"WA"}}
            """)
        ]

        let vm = NeighborhoodViewModel(client: makeClient())
        await vm.load()

        guard case let .loaded(meter) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(meter.state, .growing)
        XCTAssertEqual(meter.verifiedCount, 12)
        XCTAssertEqual(meter.kAnonMin, 5)
        XCTAssertEqual(meter.threshold, 20)
        XCTAssertFalse(meter.unlocked)
        XCTAssertEqual(meter.area?.city, "Camas")
    }

    func testLoadDecodesFormingMeterWithWithheldCount() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/neighborhood/meter"] = [
            .status(200, body: """
            {"state":"forming","verified_count":null,"k_anon_min":5,"threshold":20,
             "unlocked":false,"area":null}
            """)
        ]

        let vm = NeighborhoodViewModel(client: makeClient())
        await vm.load()

        guard case let .loaded(meter) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(meter.state, .forming)
        XCTAssertNil(meter.verifiedCount)
        XCTAssertNil(meter.area)
    }

    func testLoadDecodesNoPlace() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/neighborhood/meter"] = [
            .status(200, body: """
            {"state":"no_place","verified_count":null,"k_anon_min":5,"threshold":20,
             "unlocked":false,"area":null}
            """)
        ]

        let vm = NeighborhoodViewModel(client: makeClient())
        await vm.load()

        guard case let .loaded(meter) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(meter.state, .noPlace)
    }

    func testServerErrorLandsInErrorState() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/neighborhood/meter"] = [
            .status(500, body: "{\"error\":\"Failed to load the neighborhood meter\"}")
        ]

        let vm = NeighborhoodViewModel(client: makeClient())
        await vm.load()

        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    func testLoadIsIdempotentOnceLoaded() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/neighborhood/meter"] = [
            .status(200, body: """
            {"state":"unlocked","verified_count":25,"k_anon_min":5,"threshold":20,
             "unlocked":true,"area":{"city":"Camas","state":"WA"}}
            """)
        ]

        let vm = NeighborhoodViewModel(client: makeClient())
        await vm.load()
        // Second load must not refetch (no second stubbed response exists —
        // a refetch would land in .error).
        await vm.load()

        guard case let .loaded(meter) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertTrue(meter.unlocked)
    }
}
