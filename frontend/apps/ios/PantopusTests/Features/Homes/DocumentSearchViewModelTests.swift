//
//  DocumentSearchViewModelTests.swift
//  PantopusTests
//
//  P4.5 — Covers the Document Search VM:
//    - corpus loads once; isLoading clears on settle (success + failure)
//    - blank query → no results (shell falls back to recent/empty)
//    - matching across title / category label / tags (case-insensitive)
//    - result rows reuse the Documents row projection + append tag chips
//

import XCTest
@testable import Pantopus

@MainActor
final class DocumentSearchViewModelTests: XCTestCase {
    private struct DocumentFixture {
        let id: String
        let docType: String
        let title: String
        let tags: String?
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM() -> DocumentSearchViewModel {
        let frozen = Self.fixedNow
        return DocumentSearchViewModel(homeId: "home-1", api: makeAPI()) { frozen }
    }

    private func dto(
        id: String = "d1",
        docType: String = "lease",
        title: String = "Lease.pdf",
        details: [String: String] = [:]
    ) -> HomeDocumentDTO {
        HomeDocumentDTO(
            id: id,
            homeId: "home-1",
            docType: docType,
            title: title,
            mimeType: "application/pdf",
            sizeBytes: 2_400_000,
            visibility: "members",
            details: details,
            createdAt: "2026-05-10T00:00:00Z"
        )
    }

    /// Build a `{ "documents": [...] }` response body.
    private static func body(
        _ docs: [DocumentFixture]
    ) -> String {
        let items = docs
            .map { d -> String in
                let details = d.tags.map { "{\"tags\":\"\($0)\"}" } ?? "{}"
                return "{\"id\":\"\(d.id)\",\"home_id\":\"home-1\",\"doc_type\":\"\(d.docType)\","
                    + "\"title\":\"\(d.title)\",\"mime_type\":\"application/pdf\",\"size_bytes\":1024,"
                    + "\"visibility\":\"members\",\"details\":\(details),"
                    + "\"created_at\":\"2026-05-10T00:00:00Z\"}"
            }
            .joined(separator: ",")
        return "{\"documents\":[\(items)]}"
    }

    private static func fixture(
        _ id: String,
        _ docType: String,
        _ title: String,
        _ tags: String? = nil
    ) -> DocumentFixture {
        DocumentFixture(
            id: id,
            docType: docType,
            title: title,
            tags: tags
        )
    }

    // MARK: - Pure matching

    func testMatchesByTitle() {
        let d = dto(title: "Renters Insurance.pdf")
        XCTAssertTrue(DocumentSearchViewModel.matches(d, query: "renters"))
        XCTAssertTrue(DocumentSearchViewModel.matches(d, query: "INSURANCE"))
        XCTAssertFalse(DocumentSearchViewModel.matches(d, query: "warranty"))
    }

    func testMatchesByCategoryLabel() {
        // doc_type "insurance" → category label "Insurance".
        let d = dto(docType: "insurance", title: "Policy.pdf")
        XCTAssertTrue(DocumentSearchViewModel.matches(d, query: "insurance"))
    }

    func testMatchesByTag() {
        let d = dto(title: "Policy.pdf", details: ["tags": "wifi, router, fiber"])
        XCTAssertTrue(DocumentSearchViewModel.matches(d, query: "router"))
        XCTAssertTrue(DocumentSearchViewModel.matches(d, query: "WIFI"))
        XCTAssertFalse(DocumentSearchViewModel.matches(d, query: "ethernet"))
    }

    func testFilterBlankQueryYieldsEmpty() {
        let docs = [dto(id: "a"), dto(id: "b")]
        XCTAssertTrue(DocumentSearchViewModel.filter(docs, query: "").isEmpty)
        XCTAssertTrue(DocumentSearchViewModel.filter(docs, query: "   ").isEmpty)
    }

    func testFilterReturnsOnlyMatches() {
        let docs = [
            dto(id: "lease", docType: "lease", title: "Lease.pdf"),
            dto(id: "ins", docType: "insurance", title: "Renters Policy.pdf")
        ]
        XCTAssertEqual(DocumentSearchViewModel.filter(docs, query: "renters").map(\.id), ["ins"])
    }

    func testTagChipsProjectFromDetails() {
        let chips = DocumentSearchViewModel.tagChips(for: dto(details: ["tags": "alpha, beta"]))
        XCTAssertEqual(chips.map(\.text), ["alpha", "beta"])
        XCTAssertEqual(chips.first?.icon, .tag)
        XCTAssertEqual(chips.first?.tint, .status(.neutral))
    }

    func testTagChipsEmptyWhenNoTags() {
        XCTAssertTrue(DocumentSearchViewModel.tagChips(for: dto()).isEmpty)
    }

    // MARK: - Load + query lifecycle

    func testInitialStateIsLoadingWithNoResults() {
        let vm = makeVM()
        XCTAssertTrue(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testLoadClearsLoadingAndKeepsResultsEmptyForBlankQuery() async {
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body: Self.body(
                    [
                        Self.fixture("d1", "lease", "Lease.pdf")
                    ]
                )
            )
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testQueryFiltersLoadedCorpus() async {
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body: Self.body(
                    [
                        Self.fixture("d1", "lease", "Lease.pdf", "signed"),
                        Self.fixture("d2", "insurance", "Renters Policy.pdf", "renters,policy")
                    ]
                )
            )
        ]
        let vm = makeVM()
        await vm.load()
        vm.query = "renters"
        XCTAssertEqual(vm.results.map(\.id), ["d2"])
        vm.query = "zzzzz"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testLoadFailureLeavesEmptyResults() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.isLoading)
        vm.query = "lease"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testRowModelReusesDocumentRowWithTagChips() async {
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body: Self.body(
                    [
                        Self.fixture("d1", "insurance", "Renters Policy.pdf", "renters,policy")
                    ]
                )
            )
        ]
        let vm = makeVM()
        await vm.load()
        vm.query = "renters"
        guard let match = vm.results.first else {
            XCTFail("Expected a result")
            return
        }
        let row = vm.rowModel(for: match)
        XCTAssertEqual(row.title, "Renters Policy.pdf")
        // First chip is the reused category chip; tag chips follow inline.
        XCTAssertEqual(row.chips?.first?.text, "Insurance")
        XCTAssertTrue(row.chips?.contains { $0.text == "renters" } ?? false)
        XCTAssertTrue(row.chips?.contains { $0.text == "policy" } ?? false)
        if case .typeIcon = row.leading {} else {
            XCTFail("Expected reused typeIcon leading")
        }
    }
}
