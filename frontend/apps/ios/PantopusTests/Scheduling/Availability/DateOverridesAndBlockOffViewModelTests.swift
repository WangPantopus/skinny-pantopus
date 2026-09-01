//
//  DateOverridesAndBlockOffViewModelTests.swift
//  PantopusTests
//
//  Stream I3 — B6 date-overrides + B9 block-off projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class DateOverridesAndBlockOffViewModelTests: XCTestCase {
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

    // swiftlint:disable:next line_length
    private static let twoSchedulesOverrides = #"{"schedules":[],"rules":[],"overrides":[{"schedule_id":"s1","date":"2026-07-04","is_unavailable":true},{"schedule_id":"s2","date":"2026-08-01","is_unavailable":true}]}"#

    private static let emptyComposite = #"{"schedules":[],"rules":[],"overrides":[]}"#
    private static let blockResponse = #"""
    {"block":{"id":"b1","start_at":"2026-06-18T14:00:00Z","end_at":"2026-06-18T15:00:00Z"}}
    """#

    // MARK: B6 — Date Overrides

    func testOverridesFilterBySchedule() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoSchedulesOverrides)]
        let viewModel = DateOverridesViewModel(scheduleId: "s1", client: makeClient())
        await viewModel.load()
        guard case .ready = viewModel.phase else {
            return XCTFail("Expected .ready, got \(viewModel.phase)")
        }
        XCTAssertEqual(viewModel.overrides.count, 1)
        XCTAssertEqual(viewModel.overrides.first?.date, "2026-07-04")
    }

    func testAddOverridePersistsWholeSet() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.emptyComposite),
            .status(200, body: #"{"overrides":[{"schedule_id":"s1","date":"2026-12-25","is_unavailable":true}]}"#)
        ]
        let viewModel = DateOverridesViewModel(scheduleId: "s1", client: makeClient())
        await viewModel.load()
        viewModel.mode = .unavailable
        await viewModel.addOverride()
        XCTAssertEqual(viewModel.overrides.count, 1)
        XCTAssertEqual(viewModel.overrides.first?.isUnavailable, true)
    }

    /// Flipping the holiday set must strip only IMPORT-SHAPED entries — a
    /// hand-authored custom-hours override that falls on a holiday date
    /// survives both enabling (skipped, not replaced by a full-day block) and
    /// disabling (not deleted with the imports).
    func testHolidayToggleSparesCustomOverridesOnHolidayDates() async {
        let year = Calendar.current.component(.year, from: Date())
        let july4 = "\(year)-07-04"
        // A custom-hours (partial-day) override on Independence Day.
        // swiftlint:disable:next line_length
        let composite = #"{"schedules":[],"rules":[],"overrides":[{"schedule_id":"s1","date":"\#(july4)","is_unavailable":false,"start_time":"09:00","end_time":"12:00"}]}"#
        // Echo endpoint: the VM re-reads its own PUT payload's shape, so a
        // minimal echo keeps the local list consistent for the assert.
        // swiftlint:disable:next line_length
        let echo = #"{"overrides":[{"schedule_id":"s1","date":"\#(july4)","is_unavailable":false,"start_time":"09:00","end_time":"12:00"}]}"#
        SequencedURLProtocol.sequence = [
            .status(200, body: composite),
            .status(200, body: echo)
        ]
        let viewModel = DateOverridesViewModel(scheduleId: "s1", client: makeClient())
        await viewModel.load()
        await viewModel.toggleHolidays(true)

        guard let put = SequencedURLProtocol.capturedRequests.last,
              let json = try? JSONSerialization.jsonObject(with: Self.bodyData(from: put)) as? [String: Any],
              let sent = json["overrides"] as? [[String: Any]]
        else { return XCTFail("Missing overrides payload") }
        let july4Rows = sent.filter { ($0["date"] as? String) == july4 }
        XCTAssertEqual(july4Rows.count, 1, "the user's July 4 override must not be duplicated by the import")
        XCTAssertEqual(july4Rows.first?["is_unavailable"] as? Bool, false, "custom hours survive enabling the set")
        XCTAssertEqual(july4Rows.first?["start_time"] as? String, "09:00")
        // Every other holiday arrives as the import shape.
        let holidayCount = USHolidays.forYear(year).count
        XCTAssertEqual(sent.count, holidayCount, "one row per holiday — July 4 stays the user's own entry")
    }

    /// A blocked date range must serialize a contiguous YYYY-MM-DD span, all
    /// marked unavailable.
    func testRangeBlockSendsContiguousDates() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.emptyComposite),
            .status(200, body: #"{"overrides":[]}"#)
        ]
        let calendar = Calendar.current
        let start = calendar.date(from: DateComponents(year: 2026, month: 7, day: 4)) ?? Date()
        let end = calendar.date(byAdding: .day, value: 2, to: start) ?? start
        let viewModel = DateOverridesViewModel(scheduleId: "s1", client: makeClient())
        await viewModel.load()
        viewModel.isRange = true
        viewModel.selectedDate = start
        viewModel.rangeEndDate = end
        await viewModel.addOverride()

        guard let put = SequencedURLProtocol.capturedRequests.last,
              put.url?.path == "/api/scheduling/availability/s1/overrides"
        else { return XCTFail("Expected a PUT to /availability/s1/overrides") }
        let body = Self.bodyData(from: put)
        guard let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
              let overrides = json["overrides"] as? [[String: Any]]
        else { return XCTFail("Missing overrides payload") }
        XCTAssertEqual(overrides.count, 3) // Jul 4, 5, 6
        XCTAssertTrue(overrides.allSatisfy { ($0["is_unavailable"] as? Bool) == true })
    }

    // MARK: B9 — Block Off Time

    func testBlockOffValidity() {
        let viewModel = BlockOffTimeViewModel(client: makeClient())
        viewModel.allDay = false
        viewModel.startTime = .nineAM
        viewModel.endTime = .fivePM
        XCTAssertTrue(viewModel.isValid)
        viewModel.startTime = .fivePM
        viewModel.endTime = .nineAM
        XCTAssertFalse(viewModel.isValid)
        viewModel.allDay = true
        XCTAssertTrue(viewModel.isValid)
    }

    func testBlockOffSaveCreatesBlock() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.blockResponse)]
        let viewModel = BlockOffTimeViewModel(client: makeClient())
        viewModel.reason = "Dentist"
        let ok = await viewModel.save()
        XCTAssertTrue(ok)
        XCTAssertNil(viewModel.saveError)
    }

    /// All-day + weekly must serialize an RRULE and absolute ISO instants.
    func testBlockOffAllDayWeeklySendsRRule() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.blockResponse)]
        let viewModel = BlockOffTimeViewModel(client: makeClient())
        viewModel.allDay = true
        viewModel.repeats = .weekly
        viewModel.reason = "Out Fridays"
        let ok = await viewModel.save()
        XCTAssertTrue(ok)

        guard let post = SequencedURLProtocol.capturedRequests.last,
              post.url?.path == "/api/scheduling/availability/blocks"
        else { return XCTFail("Expected a POST to /availability/blocks") }
        let body = Self.bodyData(from: post)
        guard let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else {
            return XCTFail("Missing block payload")
        }
        XCTAssertEqual(json["recurrence_rule"] as? String, "FREQ=WEEKLY")
        XCTAssertEqual(json["title"] as? String, "Out Fridays")
        XCTAssertFalse((json["start_at"] as? String ?? "").isEmpty)
        XCTAssertFalse((json["end_at"] as? String ?? "").isEmpty)
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
