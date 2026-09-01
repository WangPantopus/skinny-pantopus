//
//  AddToCalendarViewModelTests.swift
//  PantopusTests
//
//  Drives the .ics download view-model against a stubbed session: 200 returns
//  the raw artifact and lands on .ready; a 5xx lands on .failed without throwing
//  to the caller.
//

import XCTest
@testable import Pantopus

@MainActor
final class AddToCalendarViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> AddToCalendarViewModel {
        let client = APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        return AddToCalendarViewModel(manageToken: "tok-123", client: client)
    }

    func testDownloadSucceedsReturnsDataAndReadyPhase() async {
        let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"
        SequencedURLProtocol.sequence = [.status(200, body: ics)]
        let viewModel = makeViewModel()

        let data = await viewModel.downloadICS()

        XCTAssertNotNil(data)
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.icsData.flatMap { String(data: $0, encoding: .utf8) }, ics)
    }

    func testDownloadFailureLandsOnFailedWithoutThrowing() async {
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"boom"}"#)]
        let viewModel = makeViewModel()

        let data = await viewModel.downloadICS()

        XCTAssertNil(data)
        XCTAssertEqual(viewModel.phase, .failed)
        XCTAssertNil(viewModel.icsData)
    }
}
