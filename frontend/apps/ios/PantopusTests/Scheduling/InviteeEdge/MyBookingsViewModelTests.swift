//
//  MyBookingsViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D11 My Bookings. Covers the lean
//  `/my-bookings` decode, dedupe-by-id, and the upcoming / past split around now.
//

import XCTest
@testable import Pantopus

@MainActor
final class MyBookingsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> MyBookingsViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return MyBookingsViewModel(push: { _ in }, client: client)
    }

    private func iso(_ offsetDays: Int) -> String {
        let date = Calendar.current.date(byAdding: .day, value: offsetDays, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private func totalRows(_ groups: [BookingGroup]) -> Int {
        groups.reduce(0) { $0 + $1.bookings.count }
    }

    func testEmptyResolvesEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"bookings":[]}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .empty = viewModel.state else { return XCTFail("expected empty, got \(viewModel.state)") }
    }

    func testSplitsUpcomingAndPast() async {
        let json = """
        {"bookings":[
          {"id":"b1","owner_type":"user","status":"confirmed","start_at":"\(iso(3))"},
          {"id":"b2","owner_type":"home","status":"completed","start_at":"\(iso(-3))"}
        ]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .loaded = viewModel.state else { return XCTFail("expected loaded, got \(viewModel.state)") }
        XCTAssertEqual(totalRows(viewModel.upcomingGroups), 1)
        XCTAssertEqual(totalRows(viewModel.pastGroups), 1)
    }

    func testDedupesById() async {
        let json = """
        {"bookings":[
          {"id":"dup","owner_type":"user","status":"confirmed","start_at":"\(iso(2))"},
          {"id":"dup","owner_type":"user","status":"confirmed","start_at":"\(iso(2))"}
        ]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(totalRows(viewModel.upcomingGroups), 1)
    }

    func testPendingBecomesNeedsAttention() async {
        let json = """
        {"bookings":[{"id":"b1","owner_type":"business","status":"pending","start_at":"\(iso(4))"}]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertTrue(viewModel.upcomingGroups.first?.attention == true)
    }

    func testErrorSurfaces() async {
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"boom"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .error = viewModel.state else { return XCTFail("expected error, got \(viewModel.state)") }
    }
}
