import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskMediaViewModelTests: XCTestCase {
    private let f = HomeTaskMediaFixture()
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private var requests: [URLRequest] {
        SequencedURLProtocol.capturedRequests
    }

    private func model(client: HomeTaskMediaClient? = nil) -> HomeTaskMediaViewModel {
        HomeTaskMediaViewModel(homeId: f.home, taskId: f.task, client: client ?? f.client())
    }

    func testUnknownUploadKeepsSameBytesAndUuidThrough408429AndSuccessfulRetry() async throws {
        f.routes(records: [])
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        let pending = try XCTUnwrap(model.pendingUpload)
        for status in [503, 408, 429] {
            SequencedURLProtocol.routeResponses[f.path] = [.status(200, body: f.list(records: [])), .status(status, body: "{}")]
            await model.upload(id: pending.id)
            XCTAssertEqual(model.pendingUpload, pending)
            XCTAssertTrue(model.mayRetryUpload)
            XCTAssertFalse(model.mayDiscardUnsent)
            model.discardUnsent(id: pending.id)
            model.picked(
                ClaimPickedFile(filename: "replacement.txt", mimeType: "text/plain", data: Data("other".utf8)),
                revision: model.activationRevision
            )
            XCTAssertEqual(model.pendingUpload, pending)
            XCTAssertNil(model.notice)
        }
        let record = f.record(pending: pending)
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(records: [])), .status(200, body: f.json(["media": [record]])),
            .status(200, body: f.list(records: [record])), .status(200, body: f.list(records: [record]))
        ]
        await model.upload(id: pending.id)
        XCTAssertNil(model.pendingUpload)
        XCTAssertEqual(model.notice, "Private attachment saved.")
        let posts = requests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(posts.count, 4)
        for request in posts {
            let body = try f.body(request)
            XCTAssertTrue(body.contains(pending.id))
            XCTAssertTrue(body.contains(f.fileText))
            XCTAssertFalse(body.contains("replacement.txt"))
        }
    }

    func testUnsubmittedSelectionCanBeDiscardedWithoutAnyPost() async {
        f.routes(records: [])
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        XCTAssertTrue(model.mayDiscardUnsent)
        guard let pending = model.pendingUpload else { return XCTFail("No selected upload") }
        model.discardUnsent(id: pending.id)
        XCTAssertNil(model.pendingUpload)
        XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
    }

    func testLatePickerCannotPopulateHiddenOrReplacementSession() async {
        var identity: String? = "opening"
        f.routes()
        let model = model(client: f.client { identity })
        await model.activate(ifCurrent: model.activationRevision)
        let pickerRevision = model.activationRevision
        model.suspend()
        model.picked(f.file, revision: pickerRevision)
        XCTAssertNil(model.pendingUpload)
        await model.activate(ifCurrent: model.activationRevision)
        identity = "replacement"
        model.picked(f.file, revision: model.activationRevision)
        XCTAssertNil(model.pendingUpload)
        XCTAssertTrue(model.media.isEmpty)
    }

    func testSuspendKeepsOriginalUnconfirmedUploadButHidesFilesAndPreview() async throws {
        f.routes()
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        let pending = try XCTUnwrap(model.pendingUpload)
        SequencedURLProtocol.routeResponses[f.path] = [.status(200, body: f.list()), .status(503, body: "{}")]
        await model.upload(id: pending.id)
        model.suspend()
        XCTAssertFalse(model.isActive)
        XCTAssertTrue(model.media.isEmpty)
        XCTAssertNil(model.visiblePreview)
        XCTAssertEqual(model.pendingUpload, pending)
        f.routes()
        await model.activate(ifCurrent: model.activationRevision)
        XCTAssertTrue(model.mayRetryUpload)
        XCTAssertEqual(model.pendingUpload, pending)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testQueuedActivationCannotReviveAHiddenAttachmentScreen() async {
        f.routes()
        let model = model()
        let revision = model.activationRevision
        model.suspend()
        await model.activate(ifCurrent: revision)
        XCTAssertFalse(model.isActive)
        XCTAssertTrue(requests.isEmpty)
    }

    func testUnknownRemovalRetriesSameIdAfterServerRetirement() async throws {
        f.routes()
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)"] = [.status(503, body: "{}")]
        let record = try f.decoded()
        await model.remove(record)
        XCTAssertEqual(model.pendingRemoval?.id, f.upload)
        XCTAssertTrue(model.media.isEmpty)
        XCTAssertNil(model.notice)
        let incomplete = f.record(["state": "retired", "available": false, "cleanup_pending": true])
        let retired = f.record(["state": "retired", "available": false, "cleanup_pending": false])
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(records: [incomplete])), .status(200, body: f.list(records: [retired])),
            .status(200, body: f.list(records: [retired]))
        ]
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)"] = [.status(200, body: f.json(["media": retired]))]
        await model.retryRemoval()
        XCTAssertNil(model.pendingRemoval)
        XCTAssertEqual(model.notice, "Attachment removed. Its history remains.")
        let deletes = requests.filter { $0.httpMethod == "DELETE" }
        XCTAssertEqual(deletes.count, 2)
        XCTAssertTrue(deletes.allSatisfy { $0.url?.path == "\(f.path)/\(f.upload)" })
    }

    func testReopenedIncompleteReservationAndCleanupExposeOnlyCurrentRemoval() async throws {
        let cases: [[String: Any]] = [
            ["state": "reserved", "available": false],
            ["state": "retired", "available": false, "cleanup_pending": true]
        ]
        for changes in cases {
            SequencedURLProtocol.reset()
            f.routes(records: [f.record(changes)])
            let model = model()
            await model.activate(ifCurrent: model.activationRevision)
            XCTAssertTrue(try model.mayRemove(f.decoded(changes)))
            XCTAssertNil(model.pendingUpload)
            XCTAssertNil(model.visiblePreview)
            XCTAssertFalse(requests.contains { $0.httpMethod != "GET" })
        }
    }

    func testRevocationAfterPreviewClearsPreviouslyLoadedBytes() async throws {
        f.routes()
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        let record = try f.decoded()
        await model.open(record)
        XCTAssertEqual(model.visiblePreview?.bytes, f.file.data)
        SequencedURLProtocol.routeResponses[f.taskPath] = [.status(403, body: "{}")]
        await model.load()
        XCTAssertNil(model.visiblePreview)
        XCTAssertTrue(model.media.isEmpty)
        XCTAssertFalse(model.mayChoose)
    }

    func testDelayedDownloadCannotRestorePreviewAfterLeaving() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/download"] = [
            .status(200, body: f.fileText, headers: ["Content-Type": f.file.mimeType], delay: 0.08)
        ]
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        let record = try f.decoded()
        let opening = Task { await model.open(record) }
        try await f.waitForRequest { $0.url?.path.hasSuffix("/download") == true }
        model.suspend()
        await opening.value
        XCTAssertNil(model.visiblePreview)
        XCTAssertTrue(model.media.isEmpty)
        XCTAssertFalse(model.isActive)
    }

    func testRetiringSessionClearsPendingPrivateBytesAndReceipt() async {
        f.routes()
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        XCTAssertNotNil(model.pendingUpload)
        model.retire()
        XCTAssertNil(model.pendingUpload)
        XCTAssertNil(model.pendingRemoval)
        XCTAssertNil(model.visiblePreview)
        XCTAssertFalse(model.isCurrent)
    }

    func testBackgroundReturnRechecksAfterDelayedUploadWithoutAutomaticallyPostingAgain() async throws {
        f.routes(records: [])
        let model = model()
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        let pending = try XCTUnwrap(model.pendingUpload)
        let record = f.record(pending: pending)
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(records: [])),
            .status(200, body: f.json(["media": [record]]), delay: 0.08),
            .status(200, body: f.list(records: [record]))
        ]
        let uploading = Task { await model.upload(id: pending.id) }
        try await f.waitForRequest { $0.httpMethod == "POST" }
        model.suspend()
        await model.activate(ifCurrent: model.activationRevision)
        await uploading.value
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while model.media.first?.id != pending.id, ContinuousClock.now < deadline {
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(model.media.first?.id, pending.id)
        XCTAssertEqual(model.pendingUpload, pending)
        XCTAssertNil(model.notice)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testSessionReplacementDuringUploadCannotPublishOldCompletion() async throws {
        var identity: String? = "opening"
        f.routes(records: [])
        let model = model(client: f.client { identity })
        await model.activate(ifCurrent: model.activationRevision)
        model.picked(f.file, revision: model.activationRevision)
        let pending = try XCTUnwrap(model.pendingUpload)
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(records: [])),
            .status(200, body: f.json(["media": [f.record(pending: pending)]]), delay: 0.08)
        ]
        let uploading = Task { await model.upload(id: pending.id) }
        try await f.waitForRequest { $0.httpMethod == "POST" }
        identity = "replacement"
        await uploading.value
        XCTAssertFalse(model.isCurrent)
        XCTAssertTrue(model.media.isEmpty)
        XCTAssertNil(model.notice)
        model.retire()
        XCTAssertNil(model.pendingUpload)
    }
}
