import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class VerifyLandlordLeaseAttachmentTests: XCTestCase {
    private let home = "b0000000-0000-4000-8000-000000000001"
    private let actor = "b0000000-0000-4000-8000-000000000002"
    private let lease = "b0000000-0000-4000-8000-000000000003"
    private let scope = String(repeating: "a", count: 64)
    private var path: String {
        "/api/v1/tenant/home/\(home)/lease-files"
    }

    private var requests: [URLRequest] {
        SequencedURLProtocol.capturedRequests
    }

    private var picked: PickedFile {
        PickedFile(filename: "private.txt", mimeType: "text/plain", data: Data("lease".utf8))
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func json(_ value: [String: Any]) throws -> String {
        try XCTUnwrap(String(data: JSONSerialization.data(withJSONObject: value), encoding: .utf8))
    }

    private func model(identity: @escaping () -> String? = { "opening" }) -> VerifyLandlordLeaseAttachment {
        VerifyLandlordLeaseAttachment(
            homeId: home,
            api: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            uploader: MultipartUploader(session: SequencedURLProtocol.makeSession()),
            actorId: actor,
            identity: identity
        )
    }

    private func file(_ id: String, changes: [String: Any] = [:]) -> [String: Any] {
        [
            "id": id,
            "home_id": home,
            "file_name": "private.txt",
            "file_size": 5,
            "mime_type": "text/plain",
            "available": true,
            "lease_id": NSNull()
        ].merging(changes) { _, value in value }
    }

    private func routes(_ id: String) throws {
        SequencedURLProtocol.routeResponses = try [
            "\(path)/session": Array(repeating: .status(200, body: json([
                "home_id": home, "actor_id": actor, "session_scope": scope
            ])), count: 15),
            "/api/v1/tenant/home/\(home)/status": Array(repeating: .status(200, body: json([
                "home_id": home, "request_context": ["home_id": home, "actor_id": actor, "lease_id": NSNull(), "lease_state": NSNull()],
                "lease": ["state": "none", "lease": NSNull()]
            ])), count: 10),
            path: [.status(201, body: json(["file": file(id)]))],
            "\(path)/\(id)": [.status(202, body: "{\"deleted\":true,\"cleanup_pending\":true}")]
        ]
    }

    private func finish(_ model: VerifyLandlordLeaseAttachment) async throws {
        let deadline = Date().addingTimeInterval(3)
        while model.isBusy, Date() < deadline {
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertFalse(model.isBusy, "Attachment operation must settle")
    }

    private func uploaded() async throws -> VerifyLandlordLeaseAttachment {
        let vm = model()
        try vm.select(picked)
        try routes(XCTUnwrap(vm.uploadId))
        vm.retry()
        try await finish(vm)
        XCTAssertNotNil(vm.file)
        return vm
    }

    func testPickingDoesNotCreateARequestAndUploadShowsOnlyRealFileDetails() async throws {
        let vm = try await uploaded()
        XCTAssertEqual(vm.file?.id, vm.uploadId)
        XCTAssertEqual(vm.displayFile?.typeLabel, "TXT")
        XCTAssertNil(vm.displayFile?.pageCount)
        XCTAssertNil(vm.displayFile?.detectedOwner)
        XCTAssertEqual(vm.displayFile?.uploadStatus, "Uploaded privately")
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.map { $0.url?.path }, [path])
        let request = try XCTUnwrap(requests.last)
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
    }

    func testLostUploadReplyRetriesOriginalIdBytesAndContext() async throws {
        let vm = model()
        try vm.select(picked)
        let id = try XCTUnwrap(vm.uploadId)
        try routes(id)
        SequencedURLProtocol.routeResponses[path] = try [.status(503, body: "{}"), .status(200, body: json(["file": file(id)]))]
        vm.retry()
        try await finish(vm)
        XCTAssertTrue(vm.needsRetry)
        XCTAssertNil(vm.file)
        vm.retry()
        try await finish(vm)
        XCTAssertEqual(vm.file?.id, id)
        let uploads = requests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(uploads.count, 2)
        for request in uploads {
            let body = try XCTUnwrap(String(data: request.authTestBodyData() ?? Data(), encoding: .utf8))
            XCTAssertTrue(body.contains(id))
            XCTAssertTrue(body.contains("lease"))
            XCTAssertTrue(body.contains(actor))
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
        }
        XCTAssertEqual(requests.filter { $0.url?.path.hasSuffix("/status") == true }.count, 1)
    }

    func testRemovalWaitsForServerAcknowledgementAndRetainsFailedDraft() async throws {
        let vm = try await uploaded()
        let id = try XCTUnwrap(vm.uploadId)
        SequencedURLProtocol.routeResponses["\(path)/\(id)"] = [
            .status(503, body: "{}"), .status(202, body: "{\"deleted\":true,\"cleanup_pending\":true}")
        ]
        vm.remove()
        try await finish(vm)
        XCTAssertTrue(vm.hasDraft)
        XCTAssertEqual(vm.retryLabel, "Retry removal")
        do { _ = try await vm.requestApproval(TenantRequestApprovalRequest(homeId: home))
            XCTFail("An unresolved removal must not submit the old file")
        } catch {}
        vm.retry()
        try await finish(vm)
        XCTAssertFalse(vm.hasDraft)
        XCTAssertNil(vm.uploadId)
        XCTAssertEqual(requests.filter { $0.httpMethod == "DELETE" }.count, 2)
    }

    func testAccountChangeBeforeRetryDoesNotUpload() async throws {
        var identity: String? = "opening"
        let vm = model { identity }
        try vm.select(picked)
        identity = "other"
        vm.retry()
        try await finish(vm)
        XCTAssertTrue(requests.isEmpty)
        vm.clear()
        XCTAssertNil(vm.displayFile)
    }

    func testClosedPickerAndLateUploadCannotPublish() async throws {
        let vm = model()
        vm.choose()
        vm.retirePendingWork()
        vm.received(.success([URL(fileURLWithPath: "/not-an-owned-file")]))
        XCTAssertFalse(vm.hasDraft)
        try vm.select(picked)
        let id = try XCTUnwrap(vm.uploadId)
        try routes(id)
        SequencedURLProtocol.routeResponses[path] = try [.status(201, body: json(["file": file(id)]), delay: 0.15)]
        vm.retry()
        let deadline = Date().addingTimeInterval(3)
        while !requests.contains(where: { $0.httpMethod == "POST" }), Date() < deadline {
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertTrue(requests.contains { $0.httpMethod == "POST" })
        vm.retirePendingWork()
        try await Task.sleep(for: .milliseconds(250))
        XCTAssertNil(vm.file)
        XCTAssertTrue(vm.needsRetry)
    }

    func testChangedSessionAndWrongFileReceiptAreRejected() async throws {
        let vm = model()
        try vm.select(picked)
        let id = try XCTUnwrap(vm.uploadId)
        try routes(id)
        SequencedURLProtocol.routeResponses[path] = try [.status(201, body: json(["file": file(lease)]))]
        vm.retry()
        try await finish(vm)
        XCTAssertNil(vm.file)
        let changed = try json(["home_id": home, "actor_id": actor, "session_scope": String(repeating: "b", count: 64)])
        SequencedURLProtocol.routeResponses["\(path)/session"] = [.status(200, body: changed)]
        vm.retry()
        try await finish(vm)
        XCTAssertNil(vm.file)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testRequestRetryKeepsOriginalAttachmentContextAfterLostCommitReply() async throws {
        let vm = try await uploaded()
        let id = try XCTUnwrap(vm.uploadId)
        let reply = try json([
            "lease": [
                "id": lease, "home_id": home, "state": "pending", "metadata": ["lease_file_id": id]
            ]
        ])
        SequencedURLProtocol.routeResponses["/api/v1/tenant/request-approval"] = [
            .status(503, body: "{}"), .status(201, body: reply)
        ]
        let request = TenantRequestApprovalRequest(homeId: home, startAt: "2026-09-14T00:00:00.000Z", message: "Original note")
        do { _ = try await vm.requestApproval(request)
            XCTFail("Lost reply must remain unconfirmed")
        } catch {}
        let saved = try await vm.requestApproval(request)
        XCTAssertEqual(saved.id, lease)
        let posts = requests.filter { $0.url?.path == "/api/v1/tenant/request-approval" }
        XCTAssertEqual(posts.count, 2)
        for post in posts {
            let body = try XCTUnwrap(post.authTestJSONBody())
            XCTAssertEqual(body["lease_file_id"] as? String, id)
            XCTAssertEqual(body["message"] as? String, "Original note")
            XCTAssertEqual((body["request_context"] as? [String: Any])?["actor_id"] as? String, actor)
            XCTAssertEqual(post.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
        }
    }

    func testUnsupportedOrEmptyFileDoesNotReserveAnything() throws {
        let vm = model()
        for file in [
            PickedFile(filename: "empty.txt", mimeType: "text/plain", data: Data()),
            PickedFile(filename: "page.html", mimeType: "text/html", data: Data("html".utf8))
        ] {
            XCTAssertThrowsError(try vm.select(file))
            XCTAssertFalse(vm.hasDraft)
        }
        XCTAssertTrue(requests.isEmpty)
    }
}
