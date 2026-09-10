import Foundation
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class PrivateClaimEvidenceTests: XCTestCase {
    private let f = PrivateEvidenceFixture()
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private var requests: [URLRequest] {
        SequencedURLProtocol.capturedRequests
    }

    private func model(client: PrivateClaimEvidenceClient? = nil, claimant: Bool = false) -> PrivateClaimEvidenceViewModel {
        PrivateClaimEvidenceViewModel(
            homeId: f.home, claimId: f.claim, claimant: claimant, expectedReviewToken: f.token, client: client ?? f.client()
        )
    }

    func testOpeningBytesDoesNotVerifyAndExplicitConfirmationDoes() async throws {
        f.routes()
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord())
        XCTAssertEqual(vm.visiblePreview?.bytes, f.file.data)
        XCTAssertFalse(vm.mayVerify)
        XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
        vm.confirmedDocument = true
        await vm.verify()
        XCTAssertFalse(vm.pendingVerification)
        XCTAssertEqual(vm.evidence.first?.status, "verified")
        XCTAssertNil(vm.visiblePreview)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
        XCTAssertFalse(requests.contains { $0.url?.path.contains("ownership-claims") == true })
    }

    func testUnknownVerificationRetriesTheSameReceiptWithoutReopeningBytes() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/verify"] = [
            .status(503, body: "{}"), .status(200, body: f.verification(["replayed": true]))
        ]
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord())
        vm.confirmedDocument = true
        await vm.verify()
        XCTAssertTrue(vm.pendingVerification)
        vm.closePreview()
        XCTAssertNil(vm.visiblePreview)
        XCTAssertTrue(vm.evidence.isEmpty)
        XCTAssertTrue(vm.mayVerify)
        await vm.verify()
        XCTAssertFalse(vm.pendingVerification)
        XCTAssertEqual(requests.filter { $0.url?.path.hasSuffix("/download") == true }.count, 1)
        let posts = requests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(posts.count, 2)
        for request in posts {
            let body = try body(request)
            XCTAssertEqual(body["review_token"] as? String, f.token)
            XCTAssertEqual(body["inspection"] as? String, f.inspection)
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), f.scope)
        }
    }

    func testMissingInspectionAndWrongBytesCannotEnableVerification() async throws {
        for headers in [["Content-Type": "text/plain"], ["Content-Type": "image/png", "X-Claim-Evidence-Inspection": f.inspection]] {
            SequencedURLProtocol.reset()
            f.routes()
            SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/download"] = [.status(200, body: "wrong", headers: headers)]
            let vm = model()
            await vm.load()
            try await vm.open(f.decodedRecord())
            vm.confirmedDocument = true
            XCTAssertNil(vm.visiblePreview)
            XCTAssertFalse(vm.mayVerify)
            await vm.verify()
            XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
        }
    }

    func testVerifiedEvidenceReadsWithoutInspectionOrVerification() async throws {
        let changes: [String: Any] = ["status": "verified", "eligible_for_review": true]
        f.routes(listBody: f.list(records: [f.record(changes)]))
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/download"] = try [
            .status(
                200,
                body: XCTUnwrap(String(
                    data: f.file.data,
                    encoding: .utf8
                )),
                headers: ["Content-Type": "text/plain"]
            )
        ]
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord(changes))
        XCTAssertNotNil(vm.visiblePreview)
        XCTAssertFalse(vm.mayVerify)
        XCTAssertFalse(requests.last { $0.url?.path.hasSuffix("/download") == true }?.url?.query?.contains("review_token") == true)
    }

    func testDifferentLocalSessionCannotReadOrActFromRetainedView() async throws {
        var session: String? = "first"
        f.routes()
        let vm = model(client: f.client { session })
        await vm.load()
        session = "second"
        XCTAssertTrue(vm.evidence.isEmpty)
        try await vm.open(f.decodedRecord())
        try await vm.remove(f.decodedRecord())
        await vm.verify()
        XCTAssertEqual(requests.count, 1)
    }

    func testDifferentServerSessionDeniesBeforeMutation() async throws {
        f.routes()
        let client = f.client()
        _ = try await client.list(homeId: f.home, claimId: f.claim)
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list([
                "claim_session": [
                    "actor_id": f.actor, "home_id": f.home, "claim_id": f.claim, "session_scope": String(repeating: "f", count: 64)
                ]
            ]))
        ]
        do { _ = try await client.remove(f.decodedRecord())
            XCTFail("Changed server session must deny")
        } catch {}
        XCTAssertFalse(client.isCurrent)
        XCTAssertFalse(requests.contains { $0.httpMethod == "DELETE" })
    }

    func testRetiredScreenDiscardsDelayedBytes() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/download"] = try [
            .status(
                200,
                body: XCTUnwrap(String(
                    data: f.file.data,
                    encoding: .utf8
                )),
                headers: [
                    "Content-Type": "text/plain",
                    "X-Claim-Evidence-Inspection": f.inspection
                ],
                delay: 0.2
            )
        ]
        let vm = model()
        await vm.load()
        let record = try f.decodedRecord()
        let task = Task { await vm.open(record) }
        for _ in 0..<100
            where !requests
            .contains(where: { $0.url?.path.hasSuffix("/download") == true }) {
            try? await Task.sleep(for: .milliseconds(5))
        }
        vm.retire()
        await task.value
        XCTAssertNil(vm.visiblePreview)
        XCTAssertTrue(vm.evidence.isEmpty)
    }

    func testWithdrawnClaimReopensPendingEvidenceAndRetiresExactRecord() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses["/api/homes/my-ownership-claims"] = [
            .status(
                200,
                body: f.claims(existing: true, status: "revoked")
            )
        ]
        let client = f.client()
        let claims = try await client.claims()
        XCTAssertEqual(claims.claims.first?.status, "revoked")
        let vm = model(client: client, claimant: true)
        await vm.load()
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)"] = [
            .status(
                200,
                body: f.json([
                    "evidence": f.record([
                        "state": "retired",
                        "available": false,
                        "status": "failed"
                    ])
                ])
            )
        ]
        try await vm.remove(f.decodedRecord())
        XCTAssertEqual(vm.evidence.first?.state, "retired")
        XCTAssertEqual(requests.filter { $0.httpMethod == "DELETE" }.count, 1)
    }

    func testForeignEvidenceAndUnknownSuccessfulReceiptCannotClaimVerification() async throws {
        for changes: [String: Any] in [["upload_id": f.actor], ["home_id": f.actor], ["action": "approve"], ["ok": false]] {
            SequencedURLProtocol.reset()
            f.routes()
            SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/verify"] = [.status(200, body: f.verification(changes))]
            let vm = model()
            await vm.load()
            try await vm.open(f.decodedRecord())
            vm.confirmedDocument = true
            await vm.verify()
            XCTAssertTrue(vm.evidence.isEmpty)
            XCTAssertTrue(vm.pendingVerification)
        }
    }

    func testRevocationOrUnavailableAccessAfterOpenHidesPriorBytesAndMetadata() async throws {
        for status in [403, 503] {
            SequencedURLProtocol.reset()
            f.routes()
            let vm = model()
            await vm.load()
            try await vm.open(f.decodedRecord())
            XCTAssertNotNil(vm.visiblePreview)
            SequencedURLProtocol.routeResponses[f.path] = [.status(status, body: "{}")]
            await vm.load()
            XCTAssertNil(vm.visiblePreview)
            XCTAssertTrue(vm.evidence.isEmpty)
            vm.confirmedDocument = true
            XCTAssertFalse(vm.mayVerify)
            XCTAssertNotNil(vm.error)
        }
    }

    func testFinalAuthorizationDenialDiscardsUnknownVerificationReceipt() async throws {
        f.routes()
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord())
        vm.confirmedDocument = true
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/verify"] = [.status(503, body: "{}")]
        await vm.verify()
        XCTAssertTrue(vm.pendingVerification)
        SequencedURLProtocol.routeResponses[f.path] = [.status(403, body: "{}")]
        await vm.verify()
        XCTAssertFalse(vm.pendingVerification)
        XCTAssertNil(vm.visiblePreview)
        XCTAssertTrue(vm.evidence.isEmpty)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testUnrenderableBytesCannotEnableExplicitVerification() async throws {
        let changes: [String: Any] = ["mime_type": "application/pdf"]
        f.routes(listBody: f.list(records: [f.record(changes)]))
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/download"] = [
            .status(
                200,
                body: "exact private proof",
                headers: [
                    "Content-Type": "application/pdf",
                    "X-Claim-Evidence-Inspection": f.inspection
                ]
            )
        ]
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord(changes))
        XCTAssertNotNil(vm.visiblePreview)
        vm.confirmedDocument = true
        XCTAssertFalse(vm.mayVerify)
        await vm.verify()
        XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
    }

    func testRetiredPendingCleanupCanBeRetriedAfterReopening() async throws {
        let changes: [String: Any] = ["state": "retired", "status": "failed", "available": false, "cleanup_pending": true]
        f.routes(listBody: f.list(records: [f.record(changes)]))
        let vm = model(claimant: true)
        await vm.load()
        let record = try f.decodedRecord(changes)
        XCTAssertTrue(vm.mayRetire(record))
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)"] = [
            .status(
                200,
                body: f
                    .json([
                        "evidence": f
                            .record(changes
                                .merging(["cleanup_pending": false]) { _, next in
                                    next
                                })
                    ])
            )
        ]
        await vm.remove(record)
        XCTAssertEqual(vm.evidence.first?.cleanupPending, false)
        XCTAssertFalse(try vm.mayRetire(XCTUnwrap(vm.evidence.first)))
    }
}

extension PrivateClaimEvidenceTests {
    func testChangedRecordBeforeDownloadCannotReadOldEvidence() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list()),
            .status(200, body: f.list(records: [f.record(["state": "retired", "available": false])]))
        ]
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord())
        XCTAssertNil(vm.visiblePreview)
        XCTAssertTrue(vm.evidence.isEmpty)
        XCTAssertFalse(requests.contains { $0.url?.path.hasSuffix("/download") == true })
    }

    func testChangedRecordOrReviewAuthorityDuringDownloadDiscardsReturnedBytes() async throws {
        let changedLists = [
            f.list(records: [f.record(["state": "retired", "available": false])]),
            f.list(records: []),
            f.list(records: [f.record(["file_name": "replacement.txt"])]),
            f.list(["can_verify": false]),
            f.list(["review_token": String(repeating: "e", count: 64)])
        ]
        for changed in changedLists {
            SequencedURLProtocol.reset()
            f.routes()
            SequencedURLProtocol.routeResponses[f.path] = [
                .status(200, body: f.list()),
                .status(200, body: f.list()),
                .status(200, body: changed)
            ]
            let vm = model()
            await vm.load()
            try await vm.open(f.decodedRecord())
            XCTAssertEqual(requests.filter { $0.url?.path.hasSuffix("/download") == true }.count, 1)
            XCTAssertNil(vm.visiblePreview)
            XCTAssertTrue(vm.evidence.isEmpty)
            vm.confirmedDocument = true
            XCTAssertFalse(vm.mayVerify)
            XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
        }
    }

    func testDisplayedReviewerSnapshotCannotAdoptNewEvidenceOnOpening() async {
        for expected in [nil, String(repeating: "e", count: 64)] as [String?] {
            SequencedURLProtocol.reset()
            f.routes()
            let vm = PrivateClaimEvidenceViewModel(
                homeId: f.home, claimId: f.claim, expectedReviewToken: expected, client: f.client()
            )
            await vm.load()
            XCTAssertTrue(vm.evidence.isEmpty)
            XCTAssertNil(vm.visiblePreview)
            XCTAssertNotNil(vm.error)
            XCTAssertFalse(requests.contains { $0.url?.path.hasSuffix("/download") == true || $0.httpMethod == "POST" })
        }
    }

    func testOwnSuccessfulVerificationCanAdvanceTheBoundReviewSnapshot() async throws {
        f.routes()
        let vm = model()
        await vm.load()
        try await vm.open(f.decodedRecord())
        vm.confirmedDocument = true
        await vm.verify()
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(["review_token": String(repeating: "d", count: 64)], records: [
                f.record(["status": "verified", "eligible_for_review": true])
            ]))
        ]
        await vm.load()
        XCTAssertEqual(vm.evidence.first?.status, "verified")
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.pendingVerification)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testLargeImageUsesBoundedDecodedPixelsForPreviewAndVerification() throws {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let size = CGSize(width: 4000, height: 2400)
        let bytes = UIGraphicsImageRenderer(size: size, format: format).pngData { context in
            UIColor.blue.setFill()
            context.fill(CGRect(origin: .zero, size: size))
        }
        let decoded = try XCTUnwrap(PrivateClaimImagePreview.decode(bytes)?.cgImage)
        XCTAssertEqual(max(decoded.width, decoded.height), PrivateClaimImagePreview.maximumPixelSize)
        let record = try f.decodedRecord(["file_name": "large.png", "file_size": bytes.count, "mime_type": "image/png"])
        let preview = PrivateClaimEvidenceViewModel.Preview(record: record, bytes: bytes, token: f.token, inspection: f.inspection)
        XCTAssertTrue(preview.canRender)
        XCTAssertNil(PrivateClaimImagePreview.decode(Data("not an image".utf8)))
    }

    func testUnknownVerificationSurvivesTimeoutOrRateLimitedRetry() async throws {
        for transientStatus in [408, 429] {
            SequencedURLProtocol.reset()
            f.routes()
            SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/verify"] = [
                .status(503, body: "{}"), .status(transientStatus, body: "{}"),
                .status(200, body: f.verification(["replayed": true]))
            ]
            let vm = model()
            await vm.load()
            try await vm.open(f.decodedRecord())
            vm.confirmedDocument = true
            await vm.verify()
            await vm.verify()
            XCTAssertTrue(vm.pendingVerification)
            XCTAssertNil(vm.visiblePreview)
            XCTAssertTrue(vm.evidence.isEmpty)
            await vm.verify()
            XCTAssertFalse(vm.pendingVerification)
            XCTAssertEqual(vm.evidence.first?.status, "verified")
            let attempts = requests.filter { $0.httpMethod == "POST" }
            XCTAssertEqual(attempts.count, 3)
            for attempt in attempts {
                let payload = try body(attempt)
                XCTAssertEqual(payload["review_token"] as? String, f.token)
                XCTAssertEqual(payload["inspection"] as? String, f.inspection)
            }
            XCTAssertEqual(requests.filter { $0.url?.path.hasSuffix("/download") == true }.count, 1)
        }
    }

    func testUnicodeFilenameHasAnExplicitUTF8MultipartParameter() throws {
        let name = "住所-証明-é.txt"
        let file = MultipartFile(fieldName: "file", filename: name, mimeType: "text/plain", data: f.file.data)
        let data = MultipartUploader.buildBody(boundary: "private", file: file, extendedFilenames: true)
        let body = try XCTUnwrap(String(data: data, encoding: .utf8))
        XCTAssertTrue(body.contains("filename*=UTF-8''%E4%BD%8F%E6%89%80-%E8%A8%BC%E6%98%8E-%C3%A9.txt"))
        XCTAssertTrue(body.contains("exact private proof"))
    }

    private func body(_ request: URLRequest) throws -> [String: Any] {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 1024)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count < 0 { throw APIError.invalidResponse }
                if count == 0 { break }
                data.append(buffer, count: count)
            }
        }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
