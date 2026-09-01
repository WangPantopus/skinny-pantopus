//
//  GigReassignmentGateTests.swift
//  PantopusTests
//
//  Pre-start release gates: the poster's "Replace worker"
//  (`POST /reopen-bidding`) and the assigned worker's "Can't make it"
//  (`POST /worker-release`). Both must match the backend preconditions in
//  `backend/routes/gigs.js` so the affordance never shows where the server
//  would answer 400/403. Mirrors the Android
//  `GigReassignmentGateTest` suite.
//

import XCTest
@testable import Pantopus

@MainActor
final class GigReassignmentGateTests: XCTestCase {
    private func decodeGig(_ json: String) throws -> GigDTO {
        try JSONDecoder().decode(GigDTO.self, from: Data(json.utf8))
    }

    private static let assigned =
        #"{"id":"g1","title":"Task","status":"assigned","user_id":"owner-1","accepted_by":"worker-1"}"#
    private static let assignedStarted =
        #"{"id":"g1","title":"Task","status":"assigned","user_id":"owner-1","accepted_by":"worker-1","#
            + #""started_at":"2026-01-01T10:00:00Z"}"#
    private static let inProgress =
        #"{"id":"g1","title":"Task","status":"in_progress","user_id":"owner-1","accepted_by":"worker-1"}"#
    private static let open =
        #"{"id":"g1","title":"Task","status":"open","user_id":"owner-1"}"#

    func testWorkerReleaseGateNeedsAssignedWorkerBeforeStart() throws {
        let gig = try decodeGig(Self.assigned)
        let started = try decodeGig(Self.assignedStarted)
        let running = try decodeGig(Self.inProgress)
        XCTAssertTrue(GigDetailViewModel.workerCanRelease(gig: gig, currentUserId: "worker-1"))
        XCTAssertFalse(
            GigDetailViewModel.workerCanRelease(gig: gig, currentUserId: "owner-1"),
            "Poster is not the assigned worker"
        )
        XCTAssertFalse(
            GigDetailViewModel.workerCanRelease(gig: gig, currentUserId: nil),
            "Signed-out viewer"
        )
        XCTAssertFalse(
            GigDetailViewModel.workerCanRelease(gig: running, currentUserId: "worker-1"),
            "In-progress task is past the exit"
        )
        XCTAssertFalse(
            GigDetailViewModel.workerCanRelease(gig: started, currentUserId: "worker-1"),
            "started_at closes the window even while assigned"
        )
    }

    func testReplaceWorkerGateNeedsPosterBeforeStart() throws {
        let gig = try decodeGig(Self.assigned)
        let started = try decodeGig(Self.assignedStarted)
        let openGig = try decodeGig(Self.open)
        XCTAssertTrue(GigDetailViewModel.ownerCanReplaceWorker(gig: gig, currentUserId: "owner-1"))
        XCTAssertFalse(
            GigDetailViewModel.ownerCanReplaceWorker(gig: gig, currentUserId: "worker-1"),
            "Worker cannot replace themselves this way"
        )
        XCTAssertFalse(
            GigDetailViewModel.ownerCanReplaceWorker(gig: gig, currentUserId: nil),
            "Signed-out viewer"
        )
        XCTAssertFalse(
            GigDetailViewModel.ownerCanReplaceWorker(gig: openGig, currentUserId: "owner-1"),
            "Open task has no worker to replace"
        )
        XCTAssertFalse(
            GigDetailViewModel.ownerCanReplaceWorker(gig: started, currentUserId: "owner-1"),
            "started_at closes the window even while assigned"
        )
    }
}
