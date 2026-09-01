//
//  RoundRobinAssignmentViewModelTests.swift
//  PantopusTests
//
//  G1 · Stream I13. Verifies the assignee fold (event-type detail × roster),
//  rule inference, none-selected gating, and the assignees save (PUT replaces
//  the whole set). Route-keyed stubs.
//

import XCTest
@testable import Pantopus

@MainActor
final class RoundRobinAssignmentViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func client(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingClient {
        SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none))
    }

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> RoundRobinAssignmentViewModel {
        RoundRobinAssignmentViewModel(owner: .business(id: "biz1"), eventTypeId: "et1", client: client(routes))
    }

    // swiftlint:disable:next line_length
    private let members = #"{"members":[{"id":"m1","role_base":"owner","user":{"id":"u1","name":"Dana Reyes"}},{"id":"m2","role_base":"staff","user":{"id":"u2","name":"Marcus Lee"}}]}"#

    private func detail(_ assignees: String, mode: String = "round_robin") -> String {
        // swiftlint:disable:next line_length
        "{\"eventType\":{\"id\":\"et1\",\"name\":\"Haircut\",\"slug\":\"haircut\",\"durations\":[45],\"assignment_mode\":\"\(mode)\",\"is_active\":true},\"assignees\":\(assignees),\"questions\":[]}"
    }

    private func routes(_ detailJSON: String) -> [String: [SequencedURLProtocol.Response]] {
        [
            "/api/scheduling/event-types/et1": [.status(200, body: detailJSON)],
            "/api/businesses/biz1/members": [.status(200, body: members)],
            "/api/scheduling/event-types/et1/assignees": [.status(200, body: #"{"assignees":[]}"#)]
        ]
    }

    func testLoadInfersBalancedAndChecksAssignees() async {
        // swiftlint:disable:next line_length
        let assignees = #"[{"id":"a1","event_type_id":"et1","subject_id":"u1","subject_type":"user","weight":2,"priority":0,"is_active":true}]"#
        let model = vm(routes(detail(assignees)))
        await model.load()
        XCTAssertEqual(model.phase, .ready)
        XCTAssertEqual(model.selectedRule, .balanced)
        XCTAssertEqual(model.picks.count, 2)
        let dana = model.picks.first { $0.id == "u1" }
        XCTAssertEqual(dana?.checked, true)
        XCTAssertEqual(dana?.weight, 2)
        XCTAssertEqual(model.picks.first { $0.id == "u2" }?.checked, false)
    }

    func testInfersStrictWhenAllEqual() async {
        // swiftlint:disable:next line_length
        let assignees = #"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":0},{"id":"a2","subject_id":"u2","subject_type":"user","weight":1,"priority":0}]"#
        let model = vm(routes(detail(assignees)))
        await model.load()
        XCTAssertEqual(model.selectedRule, .strict)
        XCTAssertEqual(model.checkedCount, 2)
    }

    /// Balanced with all-default weights must survive save→reload — the wire
    /// sentinel (priority -1) is what distinguishes it from Strict.
    func testBalancedWithDefaultWeightsRoundTrips() async {
        let strictShaped = #"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":0}]"#
        let model = vm(routes(detail(strictShaped)))
        await model.load()
        model.selectRule(.balanced)
        let ok = await model.save()
        XCTAssertTrue(ok)

        guard let put = SequencedURLProtocol.capturedRequests.last(where: { $0.httpMethod == "PUT" }),
              let json = try? JSONSerialization.jsonObject(with: Self.bodyData(from: put)) as? [String: Any],
              let sent = json["assignees"] as? [[String: Any]]
        else { return XCTFail("Missing assignees PUT body") }
        XCTAssertEqual(sent.first?["priority"] as? Int, -1, "Balanced marks rows with the -1 sentinel")
        XCTAssertEqual(sent.first?["weight"] as? Int, 1)

        // Reload with the sentinel shape the save just produced.
        let reloaded = vm(routes(detail(#"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":-1}]"#)))
        await reloaded.load()
        XCTAssertEqual(reloaded.selectedRule, .balanced)
    }

    /// Single-member Priority must survive save→reload — ranks are 1-based on
    /// the wire so priority [1] is distinguishable from Strict's [0].
    func testSingleMemberPriorityRoundTrips() async {
        let strictShaped = #"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":0}]"#
        let model = vm(routes(detail(strictShaped)))
        await model.load()
        model.selectRule(.priority)
        let ok = await model.save()
        XCTAssertTrue(ok)

        guard let put = SequencedURLProtocol.capturedRequests.last(where: { $0.httpMethod == "PUT" }),
              let json = try? JSONSerialization.jsonObject(with: Self.bodyData(from: put)) as? [String: Any],
              let sent = json["assignees"] as? [[String: Any]]
        else { return XCTFail("Missing assignees PUT body") }
        XCTAssertEqual(sent.first?["priority"] as? Int, 1, "Priority ranks are 1-based on the wire")

        let reloaded = vm(routes(detail(#"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":1}]"#)))
        await reloaded.load()
        XCTAssertEqual(reloaded.selectedRule, .priority)
    }

    func testNoneSelectedDisablesDone() async {
        let assignees = #"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":0}]"#
        let model = vm(routes(detail(assignees)))
        await model.load()
        XCTAssertFalse(model.doneDisabled)
        model.toggle("u1")
        XCTAssertEqual(model.checkedCount, 0)
        XCTAssertTrue(model.doneDisabled)
    }

    func testSingleMemberFlag() async {
        let assignees = #"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":0}]"#
        let model = vm(routes(detail(assignees)))
        await model.load()
        XCTAssertTrue(model.isSingleMember)
        XCTAssertEqual(model.firstCheckedName, "Dana Reyes")
    }

    func testSaveSucceeds() async {
        let assignees = #"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":2,"priority":0}]"#
        let model = vm(routes(detail(assignees)))
        await model.load()
        let ok = await model.save()
        XCTAssertTrue(ok)
        XCTAssertNil(model.saveError)
    }

    func testSaveSurfacesInvalidAssignee() async {
        var r = routes(detail(#"[{"id":"a1","subject_id":"u1","subject_type":"user","weight":1,"priority":0}]"#))
        r["/api/scheduling/event-types/et1/assignees"] = [
            .status(
                400,
                body: #"{"error":"Validation failed","details":[{"field":"assignees","code":"INVALID_ASSIGNEE","message":"not a member"}]}"#
            )
        ]
        let model = vm(r)
        await model.load()
        let ok = await model.save()
        XCTAssertFalse(ok)
        XCTAssertNotNil(model.saveError)
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
