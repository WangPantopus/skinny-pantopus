//
//  FindATimeSetupViewModelTests.swift
//  PantopusTests
//
//  Stream I11 — F4 Find a Time · Setup view-model. Verifies occupants resolve
//  into a required-by-default who's-needed list, validity gating, and that Next
//  composes a `find-a-time` request that hands a draft to F5 on overlap (and
//  surfaces a no-overlap message otherwise).
//

import XCTest
@testable import Pantopus

@MainActor
final class FindATimeSetupViewModelTests: XCTestCase {
    private var capturedDraft: FindATimeDraft?

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        capturedDraft = nil
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> FindATimeSetupViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return FindATimeSetupViewModel(
            homeId: "home1",
            tz: "America/New_York",
            initialDraft: nil,
            onProceed: { draft in self.capturedDraft = draft },
            client: client
        )
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

    private func slotsBody() -> String {
        // swiftlint:disable:next line_length
        #"{"slots":[{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T12:00:00","eligibleHosts":["u1","u2","u3"]}]}"#
    }

    func testLoadBuildsAllRequiredRows() async {
        SequencedURLProtocol.sequence = [.status(200, body: occupantsBody())]
        let viewModel = makeViewModel()
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.rows.count, 3)
        XCTAssertTrue(viewModel.rows.allSatisfy { $0.requirement == .required })
        XCTAssertTrue(viewModel.isValid)
        XCTAssertEqual(viewModel.requiredMemberIds, ["u1", "u2", "u3"])
    }

    func testInvalidWhenNoRequiredMember() async {
        SequencedURLProtocol.sequence = [.status(200, body: occupantsBody())]
        let viewModel = makeViewModel()
        await viewModel.load()
        for row in viewModel.rows {
            viewModel.setRequirement(.optional, for: row.id)
        }

        XCTAssertFalse(viewModel.hasRequiredMember)
        XCTAssertFalse(viewModel.isValid)
    }

    func testNextWithSlotsHandsDraftToF5() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: occupantsBody()),
            .status(200, body: slotsBody())
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.next()

        let draft = try? XCTUnwrap(capturedDraft)
        XCTAssertEqual(draft?.requiredMemberIds, ["u1", "u2", "u3"])
        XCTAssertEqual(draft?.mode, .collective)
        XCTAssertEqual(draft?.tz, "America/New_York")
        XCTAssertEqual(draft?.precomputedSlots?.count, 1)
        XCTAssertNil(viewModel.noOverlapMessage)

        let hitFindATime = SequencedURLProtocol.capturedRequests.contains {
            ($0.url?.path ?? "").contains("/find-a-time")
        }
        XCTAssertTrue(hitFindATime, "Next must call the find-a-time engine")
    }

    func testNextNoOverlapSurfacesMessageNotProceed() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: occupantsBody()),
            .status(200, body: #"{"slots":[]}"#)
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.next()

        XCTAssertNil(capturedDraft, "no overlap must not navigate forward")
        XCTAssertNotNil(viewModel.noOverlapMessage)
        XCTAssertEqual(viewModel.phase, .ready)
    }

    func testHomeOwnerUsesHomeAliasPath() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: occupantsBody()),
            .status(200, body: slotsBody())
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.next()

        let findRequest = SequencedURLProtocol.capturedRequests.first {
            ($0.url?.path ?? "").contains("/find-a-time")
        }
        XCTAssertEqual(findRequest?.url?.path, "/api/homes/home1/scheduling/find-a-time")
    }
}
