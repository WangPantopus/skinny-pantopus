import XCTest
@testable import Pantopus

@MainActor
final class DocumentReplacementTests: XCTestCase {
    private let oldVersion = "f3b52a86-5d16-4c30-b96d-cc3eb3c37323"
    private let bytes = Data("new private replacement bytes".utf8)

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func document(version: String?) -> String {
        let versionField = version.map { ",\"file_version\":\"\($0)\"" } ?? ""
        return """
        {"id":"doc-1","file_id":"doc-1","home_id":"home-1","doc_type":"receipt",
        "title":"Original title","visibility":"members","details":{"tags":"keep"},
        "content_url":"/api/homes/home-1/documents/doc-1/content"\(versionField)}
        """
    }

    private func makeVM() -> DocumentDetailViewModel {
        DocumentDetailViewModel(
            homeId: "home-1",
            documentId: "doc-1",
            api: APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            uploader: MultipartUploader(session: SequencedURLProtocol.makeSession())
        )
    }

    private func load(_ vm: DocumentDetailViewModel, version: String?) async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"documents\":[\(document(version: version))]}"),
            .status(200, body: "old private bytes")
        ]
        await vm.load()
    }

    private func pick(_ vm: DocumentDetailViewModel, data: Data? = nil) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("replacement.txt")
        try (data ?? bytes).write(to: url)
        await vm.pickReplacement(url: url)
    }

    private func uploadId() throws -> String {
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.last)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/homes/home-1/documents/doc-1/replace")
        let body = try XCTUnwrap(request.authTestBodyData())
        XCTAssertNotNil(body.range(of: bytes))
        let text = try XCTUnwrap(String(data: body, encoding: .utf8))
        XCTAssertTrue(text.contains("name=\"expected_version\"\r\n\r\n\(oldVersion)"))
        XCTAssertFalse(text.contains("name=\"title\""))
        let field = try XCTUnwrap(text.components(separatedBy: "name=\"upload_id\"\r\n\r\n").dropFirst().first)
        let id = try XCTUnwrap(field.components(separatedBy: "\r\n").first)
        XCTAssertNotNil(UUID(uuidString: id))
        return id
    }

    func testRetryKeepsUploadIdentityAndReloadsExactBytesAtOriginalLink() async throws {
        let vm = makeVM()
        await load(vm, version: oldVersion)
        XCTAssertTrue(vm.beginReplacement())
        try await pick(vm)
        SequencedURLProtocol.sequence = [.status(503, body: "{}")]
        await vm.replace()
        let id = try uploadId()
        XCTAssertNil(vm.content)
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertFalse(vm.isMutating)
        SequencedURLProtocol.sequence = try [
            .status(200, body: "{\"document\":\(document(version: id)),\"reused\":true}"),
            .status(200, body: "{\"documents\":[\(document(version: id))]}"),
            .status(200, body: XCTUnwrap(String(data: bytes, encoding: .utf8)))
        ]
        await vm.replace()
        guard case let .loaded(current) = vm.state else { return XCTFail("Replacement did not load") }
        XCTAssertEqual(current.id, "doc-1")
        XCTAssertEqual(current.title, "Original title")
        XCTAssertEqual(current.details["tags"], "keep")
        XCTAssertEqual(current.fileVersion, id)
        XCTAssertEqual(vm.content, bytes)
        XCTAssertEqual(vm.toast?.text, "File replaced.")
        XCTAssertNil(vm.replacementFile)
        XCTAssertFalse(vm.shouldDismiss)
        let attempts = SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(attempts.count, 2)
        XCTAssertNotNil(try XCTUnwrap(attempts.last?.authTestBodyData()).range(of: Data(id.utf8)))
    }

    func testDeniedStaleAndUnconfirmedResponsesHideContentWithoutClaimingSuccess() async throws {
        for (status, body) in [
            (403, "{}"),
            (409, "{}"),
            (503, "{}"),
            (200, "{}"),
            (200, "{\"document\":\(document(version: oldVersion))}")
        ] {
            SequencedURLProtocol.reset()
            let vm = makeVM()
            await load(vm, version: oldVersion)
            XCTAssertTrue(vm.beginReplacement())
            try await pick(vm)
            SequencedURLProtocol.sequence = [.status(status, body: body)]
            await vm.replace()
            XCTAssertNil(vm.content)
            XCTAssertNil(vm.toast)
            XCTAssertFalse(vm.shouldDismiss)
            XCTAssertFalse(vm.isMutating)
            guard case .error = vm.state else { return XCTFail("Invalid replacement was accepted") }
        }
    }

    func testAccessRevokedBeforeReloadNeverShowsReplacementSuccess() async throws {
        let vm = makeVM()
        await load(vm, version: oldVersion)
        XCTAssertTrue(vm.beginReplacement())
        try await pick(vm)
        SequencedURLProtocol.sequence = [.status(503, body: "{}")]
        await vm.replace()
        let id = try uploadId()
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"document\":\(document(version: id))}"), .status(403, body: "{}")
        ]
        await vm.replace()
        XCTAssertNil(vm.content)
        XCTAssertNil(vm.toast)
        guard case .error = vm.state else { return XCTFail("Revoked access was ignored") }
    }

    func testCancellationPreservesOriginalAndDoesNotUpload() async throws {
        let vm = makeVM()
        await load(vm, version: oldVersion)
        XCTAssertTrue(vm.beginReplacement())
        try await pick(vm)
        vm.cancelReplacement()
        await vm.replace()
        XCTAssertNil(vm.replacementFile)
        XCTAssertEqual(vm.content, Data("old private bytes".utf8))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testEmptyPickerFileCannotBeConfirmed() async throws {
        let vm = makeVM()
        await load(vm, version: oldVersion)
        XCTAssertTrue(vm.beginReplacement())
        try await pick(vm, data: Data())
        await vm.replace()
        XCTAssertNil(vm.replacementFile)
        XCTAssertNotNil(vm.toast)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testOlderServerWithoutFileVersionCannotStartReplacement() async {
        let vm = makeVM()
        await load(vm, version: nil)
        XCTAssertFalse(vm.beginReplacement())
        await vm.replace()
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }
}
