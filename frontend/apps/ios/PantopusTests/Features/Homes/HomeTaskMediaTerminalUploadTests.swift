import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskMediaTerminalUploadTests: XCTestCase {
    private let f = HomeTaskMediaFixture()
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private var requests: [URLRequest] {
        SequencedURLProtocol.capturedRequests
    }

    private func prepare(_ model: HomeTaskMediaViewModel) async throws -> PendingHomeTaskUpload {
        f.routes(records: [])
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        let pending = try XCTUnwrap(model.pendingUpload)
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(records: [])), .status(409, body: "{\"code\":\"HOME_TASK_UPLOAD_RETIRED\"}")
        ]
        await model.upload(id: pending.id)
        XCTAssertTrue(model.mayAcknowledgeRemovedUpload)
        XCTAssertFalse(model.mayRetryUpload)
        return pending
    }

    func testExactRemovedRequestAcknowledgmentCannotAllocateOrSubmitAnotherUpload() async throws {
        let model = HomeTaskMediaViewModel(homeId: f.home, taskId: f.task, client: f.client())
        let pending = try await prepare(model)
        await model.acknowledgeRemovedUpload(id: f.actor)
        XCTAssertEqual(model.pendingUpload, pending)
        f.routes(records: [])
        await model.acknowledgeRemovedUpload(id: pending.id)
        XCTAssertNil(model.pendingUpload)
        XCTAssertNil(model.removedUploadId)
        XCTAssertTrue(model.mayChoose)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
        XCTAssertFalse(requests.contains { $0.httpMethod == "DELETE" })
        model.picked(f.file, revision: model.activationRevision)
        let next = try XCTUnwrap(model.pendingUpload)
        XCTAssertNotEqual(next.id, pending.id)
        await model.upload(id: pending.id)
        await model.acknowledgeRemovedUpload(id: pending.id)
        model.discardUnsent(id: pending.id)
        XCTAssertEqual(model.pendingUpload, next)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testUnknownStatusOrDifferent409CodeCannotAcknowledgeOriginalUpload() async throws {
        f.routes(records: [])
        let model = HomeTaskMediaViewModel(homeId: f.home, taskId: f.task, client: f.client())
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        let pending = try XCTUnwrap(model.pendingUpload)
        for (status, code) in [(503, "HOME_TASK_UPLOAD_RETIRED"), (409, "HOME_TASK_UPLOAD_CONFLICT"), (409, "unknown")] {
            SequencedURLProtocol.routeResponses[f.path] = [
                .status(200, body: f.list(records: [])), .status(status, body: f.json(["code": code]))
            ]
            await model.upload(id: pending.id)
            XCTAssertFalse(model.mayAcknowledgeRemovedUpload)
            await model.acknowledgeRemovedUpload(id: pending.id)
            XCTAssertEqual(model.pendingUpload, pending)
            XCTAssertTrue(model.mayRetryUpload)
        }
    }

    func testAcknowledgmentRequiresCurrentVisibleSessionAndExactPendingId() async throws {
        var identity: String? = "opening"
        let model = HomeTaskMediaViewModel(homeId: f.home, taskId: f.task, client: f.client { identity })
        let pending = try await prepare(model)
        model.suspend()
        await model.acknowledgeRemovedUpload(id: pending.id)
        XCTAssertEqual(model.pendingUpload, pending)
        f.routes(records: [])
        await model.activate(ifCurrent: model.activationRevision)
        identity = "replacement"
        await model.acknowledgeRemovedUpload(id: pending.id)
        XCTAssertEqual(model.pendingUpload, pending)
        XCTAssertFalse(model.mayAcknowledgeRemovedUpload)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }
}
