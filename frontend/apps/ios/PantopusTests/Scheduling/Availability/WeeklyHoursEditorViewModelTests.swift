//
//  WeeklyHoursEditorViewModelTests.swift
//  PantopusTests
//
//  Stream I3 — B5 weekly-hours editor projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class WeeklyHoursEditorViewModelTests: XCTestCase {
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

    private static let composite = """
    {"schedules":[{"id":"s1","name":"Working hours","timezone":"America/New_York","is_default":true}],
     "rules":[{"schedule_id":"s1","weekday":1,"start_time":"09:00","end_time":"17:00"}],
     "overrides":[]}
    """

    func testLoadBuildsSevenDaysWithMondayEnabled() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.composite)]
        let viewModel = WeeklyHoursEditorViewModel(scheduleId: "s1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .ready = viewModel.phase else {
            return XCTFail("Expected .ready, got \(viewModel.phase)")
        }
        XCTAssertEqual(viewModel.days.count, 7)
        let monday = viewModel.days.first { $0.weekday == 1 }
        XCTAssertEqual(monday?.isEnabled, true)
        XCTAssertEqual(monday?.ranges.count, 1)
        let sunday = viewModel.days.first { $0.weekday == 0 }
        XCTAssertEqual(sunday?.isEnabled, false)
        XCTAssertFalse(viewModel.isDirty)
        XCTAssertFalse(viewModel.allOff)
    }

    func testEditMarksDirtyThenSaveClearsIt() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.composite),
            .status(200, body: #"{"rules":[{"schedule_id":"s1","weekday":1,"start_time":"09:00","end_time":"17:00"}]}"#)
        ]
        let viewModel = WeeklyHoursEditorViewModel(scheduleId: "s1", push: { _ in }, client: makeClient())
        await viewModel.load()
        viewModel.setEnabled(2, true) // enable Tuesday
        XCTAssertTrue(viewModel.isDirty)
        XCTAssertTrue(viewModel.formValid)
        await viewModel.save()
        XCTAssertNil(viewModel.saveError)
        XCTAssertFalse(viewModel.isDirty)
    }

    /// The wire payload is load-bearing: weekday must be the backend 0=Sun..6=Sat
    /// index, times must be HH:MM, and only enabled days are sent.
    func testSaveSendsCorrectRulesPayload() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.composite),
            .status(200, body: #"{"rules":[]}"#)
        ]
        let viewModel = WeeklyHoursEditorViewModel(scheduleId: "s1", push: { _ in }, client: makeClient())
        await viewModel.load()
        viewModel.setEnabled(2, true) // Tuesday → seeds 9–5
        await viewModel.save()

        guard let put = SequencedURLProtocol.capturedRequests.last,
              put.url?.path == "/api/scheduling/availability/s1/rules"
        else { return XCTFail("Expected a PUT to /availability/s1/rules") }
        let body = Self.bodyData(from: put)
        guard let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
              let rules = json["rules"] as? [[String: Any]]
        else { return XCTFail("Missing rules payload") }
        let weekdays = rules.compactMap { $0["weekday"] as? Int }.sorted()
        XCTAssertEqual(weekdays, [1, 2]) // Mon + Tue only, no disabled days
        for rule in rules {
            XCTAssertEqual(rule["start_time"] as? String, "09:00")
            XCTAssertEqual(rule["end_time"] as? String, "17:00")
        }
    }

    func testApplyDefaultAndCopyHours() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.composite)]
        let viewModel = WeeklyHoursEditorViewModel(scheduleId: "s1", push: { _ in }, client: makeClient())
        await viewModel.load()

        viewModel.applyNineToFiveDefault()
        let enabled = viewModel.days.filter(\.isEnabled).map(\.weekday).sorted()
        XCTAssertEqual(enabled, [1, 2, 3, 4, 5])
        XCTAssertTrue(viewModel.isDirty)

        viewModel.copyHours(from: 1, to: [6, 0]) // Monday → Sat + Sun
        XCTAssertEqual(viewModel.days.first { $0.weekday == 6 }?.isEnabled, true)
        XCTAssertEqual(viewModel.days.first { $0.weekday == 0 }?.ranges.count, 1)
    }

    func testAllOffWhenEveryDayDisabled() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.composite)]
        let viewModel = WeeklyHoursEditorViewModel(scheduleId: "s1", push: { _ in }, client: makeClient())
        await viewModel.load()
        for weekday in Weekday.displayOrder {
            viewModel.setEnabled(weekday, false)
        }
        XCTAssertTrue(viewModel.allOff)
        XCTAssertTrue(viewModel.formValid) // all-off is valid
    }

    func testMissingScheduleProducesError() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"schedules":[],"rules":[],"overrides":[]}"#)]
        let viewModel = WeeklyHoursEditorViewModel(scheduleId: "missing", push: { _ in }, client: makeClient())
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
