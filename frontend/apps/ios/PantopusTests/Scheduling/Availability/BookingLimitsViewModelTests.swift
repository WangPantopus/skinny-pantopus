//
//  BookingLimitsViewModelTests.swift
//  PantopusTests
//
//  Stream I3 — B7 booking-limits projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingLimitsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        ))
    }

    private static let detail = """
    {"eventType":{"id":"et1","name":"Intro call","slug":"intro","durations":[30],
     "min_notice_min":240,"max_horizon_days":30,"slot_interval_min":30,"daily_cap":5,"per_booker_cap":2},
     "assignees":[],"questions":[]}
    """

    /// An event type with NO caps set (daily_cap / per_booker_cap absent → null).
    private static let detailNoCaps = """
    {"eventType":{"id":"et1","name":"Intro call","slug":"intro","durations":[30],
     "min_notice_min":240,"max_horizon_days":30,"slot_interval_min":30},
     "assignees":[],"questions":[]}
    """

    /// Values the steppers can't represent exactly: 90 min notice rounds to
    /// the 2 h stepper; a 20-min interval snaps to the 15-min chip. Untouched,
    /// neither may be re-sent.
    private static let detailLossyValues = """
    {"eventType":{"id":"et1","name":"Intro call","slug":"intro","durations":[30],
     "min_notice_min":90,"max_horizon_days":30,"slot_interval_min":20,"daily_cap":5,"per_booker_cap":2},
     "assignees":[],"questions":[]}
    """

    private static let updated = #"{"eventType":{"id":"et1","name":"Intro call","slug":"intro","durations":[30]}}"#

    func testLoadAppliesFields() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        guard case .ready = viewModel.phase else {
            return XCTFail("Expected .ready, got \(viewModel.phase)")
        }
        XCTAssertEqual(viewModel.minNoticeHours, 4) // 240 / 60
        XCTAssertEqual(viewModel.horizonDays, 30)
        XCTAssertEqual(viewModel.slotInterval, .halfHour)
        XCTAssertEqual(viewModel.dailyCap, 5)
        XCTAssertEqual(viewModel.perBookerCap, 2)
        XCTAssertFalse(viewModel.isDirty)
        XCTAssertFalse(viewModel.windowConflict)
    }

    func testWindowConflictDisablesSave() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        viewModel.minNoticeHours = 1000 // > 30 days * 24h
        XCTAssertTrue(viewModel.windowConflict)
        XCTAssertFalse(viewModel.isValid)
        XCTAssertFalse(viewModel.canSave)
    }

    func testSaveSucceedsAfterEdit() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail), .status(200, body: Self.updated)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        viewModel.horizonDays = 45
        XCTAssertTrue(viewModel.canSave)
        let ok = await viewModel.save()
        XCTAssertTrue(ok)
        XCTAssertNil(viewModel.saveError)
    }

    /// Per-field-dirty: editing only the window must NOT re-send the untouched
    /// (and possibly lossy) min_notice / slot_interval / cap fields.
    func testUntouchedFieldsNotResent() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail), .status(200, body: Self.updated)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        viewModel.horizonDays = 45
        _ = await viewModel.save()

        guard let put = SequencedURLProtocol.capturedRequests.last else {
            return XCTFail("Missing PUT request")
        }
        let body = Self.bodyData(from: put)
        guard let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else {
            return XCTFail("Missing body")
        }
        XCTAssertEqual(json["max_horizon_days"] as? Int, 45)
        XCTAssertNil(json["min_notice_min"])
        XCTAssertNil(json["slot_interval_min"])
        XCTAssertNil(json["daily_cap"])
        XCTAssertNil(json["per_booker_cap"])
    }

    /// Moving a cap stepper sends the new cap.
    func testCapChangeIsSent() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail), .status(200, body: Self.updated)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        viewModel.dailyCap = 10
        _ = await viewModel.save()

        guard let put = SequencedURLProtocol.capturedRequests.last else {
            return XCTFail("Missing PUT request")
        }
        guard let json = try? JSONSerialization.jsonObject(with: Self.bodyData(from: put)) as? [String: Any] else {
            return XCTFail("Missing body")
        }
        XCTAssertEqual(json["daily_cap"] as? Int, 10)
    }

    /// Lossy wire values (sub-hour notice, off-chip interval) must survive a
    /// save that only touched the horizon — the UI can't represent 90/20
    /// exactly, so re-deriving them from the untouched steppers (120/15) and
    /// sending that silently rewrote the server's values.
    func testLossyUntouchedNoticeAndIntervalNotResent() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detailLossyValues), .status(200, body: Self.updated)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.minNoticeHours, 2) // 90 min rounds to 2 h
        XCTAssertEqual(viewModel.slotInterval, .every15) // 20 min snaps to the 15 chip
        viewModel.horizonDays = 45
        XCTAssertTrue(viewModel.canSave)
        _ = await viewModel.save()

        guard let put = SequencedURLProtocol.capturedRequests.last,
              let json = try? JSONSerialization.jsonObject(with: Self.bodyData(from: put)) as? [String: Any]
        else { return XCTFail("Missing body") }
        XCTAssertEqual(json["max_horizon_days"] as? Int, 45)
        XCTAssertNil(json["min_notice_min"], "untouched lossy notice must not be re-sent")
        XCTAssertNil(json["slot_interval_min"], "untouched lossy interval must not be re-sent")
    }

    /// A no-cap event type whose cap stepper is untouched must NOT acquire a cap
    /// just because the stepper shows a default value.
    func testNoCapEventTypeNotCappedWhenUntouched() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detailNoCaps), .status(200, body: Self.updated)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        viewModel.horizonDays = 45 // change something else
        _ = await viewModel.save()

        guard let put = SequencedURLProtocol.capturedRequests.last,
              let json = try? JSONSerialization.jsonObject(with: Self.bodyData(from: put)) as? [String: Any]
        else { return XCTFail("Missing body") }
        XCTAssertNil(json["daily_cap"])
        XCTAssertNil(json["per_booker_cap"])
    }

    func testLoadFailureProducesError() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND"}"#)]
        let viewModel = BookingLimitsViewModel(owner: .personal, eventTypeId: "et1", client: makeClient())
        await viewModel.load()
        guard case .error = viewModel.phase else {
            return XCTFail("Expected .error, got \(viewModel.phase)")
        }
    }

    /// URLProtocol-stubbed sessions expose the body via httpBodyStream.
    private static func bodyData(from request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
        var data = Data()
        stream.open()
        defer { stream.close() }
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
