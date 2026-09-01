//
//  WhosFreeViewModelTests.swift
//  PantopusTests
//
//  Stream I11 — F7 Who's Free view-model. Verifies the heat grid composes
//  free/busy cells from `whos-free`, marks members absent from the availability
//  set as unknown, always passes tz on the read, and detects a fully-booked
//  window.
//

import XCTest
@testable import Pantopus

@MainActor
final class WhosFreeViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> WhosFreeViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return WhosFreeViewModel(homeId: "home1", tz: "America/New_York", push: { _ in }, client: client)
    }

    private func occupantsBody() -> String {
        """
        {"occupants":[
          {"id":"o1","user_id":"u1","role":"member","is_active":true,"display_name":"Maria"},
          {"id":"o2","user_id":"u2","role":"member","is_active":true,"display_name":"David"},
          {"id":"o3","user_id":"u3","role":"member","is_active":true,"display_name":"Ava"}
        ],"pendingInvites":[]}
        """
    }

    /// u1 free 16:00–17:00Z → 12:00 EDT → the 12p bucket (index 2). u2 present but
    /// fully busy. u3 absent from `members` → unknown.
    private func whosFreeBody() -> String {
        """
        {"members":["u1","u2"],"freeByMember":{
          "u1":[{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T17:00:00Z","startLocal":"2030-07-01T12:00:00","eligibleHosts":["u1"]}],
          "u2":[]
        }}
        """
    }

    func testGridBuildsFreeBusyUnknown() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: occupantsBody()),
            .status(200, body: whosFreeBody())
        ]
        let viewModel = makeViewModel()
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.rows.count, 3)

        let maria = viewModel.rows.first { $0.member.id == "u1" }
        XCTAssertEqual(maria?.cells[2], .free, "Maria is free in the 12p bucket")
        XCTAssertEqual(maria?.cells[0], .busy)

        let david = viewModel.rows.first { $0.member.id == "u2" }
        XCTAssertTrue(david?.cells.allSatisfy { $0 == .busy } ?? false)

        let ava = viewModel.rows.first { $0.member.id == "u3" }
        XCTAssertTrue(ava?.cells.allSatisfy { $0 == .unknown } ?? false)
        XCTAssertTrue(viewModel.hasUnknownMember)
        XCTAssertFalse(viewModel.hasNoFreeTime)

        let freeRequest = SequencedURLProtocol.capturedRequests.first { ($0.url?.path ?? "").contains("/whos-free") }
        XCTAssertEqual(freeRequest?.url?.path, "/api/homes/home1/scheduling/whos-free")
        XCTAssertTrue((freeRequest?.url?.query ?? "").contains("tz="), "tz must always be passed on a who's-free read")
    }

    func testFullyBookedWindowHasNoFreeTime() async {
        let allBusy = """
        {"members":["u1","u2"],"freeByMember":{"u1":[],"u2":[]}}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: occupantsBody()),
            .status(200, body: allBusy)
        ]
        let viewModel = makeViewModel()
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertTrue(viewModel.hasNoFreeTime)
    }
}
