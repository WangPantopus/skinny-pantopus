import XCTest
@testable import Pantopus

@MainActor
final class DocumentFileAccessTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeVM() -> DocumentDetailViewModel {
        DocumentDetailViewModel(homeId: "home-1", documentId: "doc-1", api: APIClient(
            environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none
        ))
    }

    private var documents: String {
        #"{"documents":[{"id":"doc-1","home_id":"home-1","doc_type":"other","title":"Private file","content_url":"https://untrusted.invalid/file"}]}"#
    }

    func testDownloadUsesAuthenticatedHomePathAndReturnsExactBytes() async {
        SequencedURLProtocol.sequence = [.status(200, body: documents), .status(200, body: "exact private bytes")]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.content, Data("exact private bytes".utf8))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map { $0.url?.path }, [
            "/api/homes/home-1/documents", "/api/homes/home-1/documents/doc-1/content"
        ])
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.host == "untrusted.invalid" })
    }

    func testRevokedAccessClearsPreviouslyLoadedContent() async {
        SequencedURLProtocol.sequence = [.status(200, body: documents), .status(200, body: "private bytes"), .status(403, body: "{}")]
        let vm = makeVM()
        await vm.load()
        XCTAssertNotNil(vm.content)
        await vm.refresh()
        XCTAssertNil(vm.content)
        guard case .error = vm.state else { return XCTFail("Denied content remained visible") }
    }

    func testFileDenialAfterAllowedListNeverDisplaysPrivateBytes() async {
        SequencedURLProtocol.sequence = [.status(200, body: documents), .status(403, body: "{}")]
        let vm = makeVM()
        await vm.load()
        XCTAssertNil(vm.content)
        guard case .error = vm.state else { return XCTFail("File denial was ignored") }
    }

    func testBackgroundClearRemovesPrivateDocumentState() async {
        SequencedURLProtocol.sequence = [.status(200, body: documents), .status(200, body: "private bytes")]
        let vm = makeVM()
        await vm.load()
        vm.clearContent()
        XCTAssertNil(vm.content)
        XCTAssertEqual(vm.state, .loading)
    }

    func testExportRechecksAccessAndWritesExactFileThenRemovesTheCopy() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: documents), .status(200, body: "export bytes")]
        let vm = makeVM()
        let exported = await vm.exportFile()
        let url = try XCTUnwrap(exported)
        XCTAssertEqual(try Data(contentsOf: url), Data("export bytes".utf8))
        vm.clearExport()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        SequencedURLProtocol.sequence = [.status(403, body: "{}")]
        let denied = await vm.exportFile()
        XCTAssertNil(denied)
        XCTAssertNil(vm.content)
    }
}
