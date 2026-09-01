//
//  DocumentsViewModelTests.swift
//  PantopusTests
//
//  Covers the Documents VM (T6.4b / P17):
//    - four-state transitions
//    - category bucket mapping from `HomeDocument.doc_type`
//    - file-type inference from mime_type / filename
//    - chip filter narrows visible rows (recent / expiring / shared)
//    - banner summary projection (count + storage + expiring)
//

import XCTest
@testable import Pantopus

@MainActor
final class DocumentsViewModelTests: XCTestCase {
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

    /// Fixed clock so expiring / recent filtering and date formatting
    /// stay deterministic across runs.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM() -> DocumentsViewModel {
        let frozen = Self.fixedNow
        return DocumentsViewModel(homeId: "home-1", api: makeAPI()) { frozen }
    }

    private func dto(
        id: String = "d1",
        docType: String = "lease",
        title: String = "Lease.pdf",
        mimeType: String? = "application/pdf",
        sizeBytes: Int64? = 2_400_000,
        visibility: String = "members",
        details: [String: String] = [:],
        createdAt: String? = "2026-05-10T00:00:00Z"
    ) -> HomeDocumentDTO {
        HomeDocumentDTO(
            id: id,
            homeId: "home-1",
            docType: docType,
            title: title,
            mimeType: mimeType,
            sizeBytes: sizeBytes,
            visibility: visibility,
            details: details,
            createdAt: createdAt
        )
    }

    // MARK: - Four states

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"documents\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No documents yet")
        XCTAssertEqual(content.ctaTitle, "Upload document")
    }

    func testErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadedResponseBucketsByCategoryAndOrders() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"documents":[
              {"id":"d1","home_id":"home-1","doc_type":"insurance","title":"State Farm.pdf",
               "mime_type":"application/pdf","size_bytes":1100000,"visibility":"members"},
              {"id":"d2","home_id":"home-1","doc_type":"lease","title":"Lease.pdf",
               "mime_type":"application/pdf","size_bytes":2400000,"visibility":"members"},
              {"id":"d3","home_id":"home-1","doc_type":"manual","title":"LG fridge.pdf",
               "mime_type":"application/pdf","size_bytes":4200000,"visibility":"members"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        // Order is lease → insurance → warranty (manual maps onto warranty).
        XCTAssertEqual(sections.count, 3)
        XCTAssertEqual(sections[0].header, "Lease & ownership")
        XCTAssertEqual(sections[1].header, "Insurance")
        XCTAssertEqual(sections[2].header, "Warranties & manuals")
    }

    // MARK: - Category mapping

    func testCategoryMapping() {
        XCTAssertEqual(DocumentCategory.from(docType: "lease"), .lease)
        XCTAssertEqual(DocumentCategory.from(docType: "insurance"), .insurance)
        XCTAssertEqual(DocumentCategory.from(docType: "warranty"), .warranty)
        XCTAssertEqual(DocumentCategory.from(docType: "manual"), .warranty)
        XCTAssertEqual(DocumentCategory.from(docType: "permit"), .permit)
        XCTAssertEqual(DocumentCategory.from(docType: "floor_plan"), .permit)
        XCTAssertEqual(DocumentCategory.from(docType: "receipt"), .tax)
        XCTAssertEqual(DocumentCategory.from(docType: "photo"), .other)
        XCTAssertEqual(DocumentCategory.from(docType: "paint_color"), .other)
        XCTAssertEqual(DocumentCategory.from(docType: "other"), .other)
    }

    // MARK: - File-type inference

    func testFileTypeInferenceFromMime() {
        XCTAssertEqual(DocumentFileType.from(mimeType: "application/pdf"), .pdf)
        XCTAssertEqual(DocumentFileType.from(mimeType: "image/jpeg"), .image)
        XCTAssertEqual(DocumentFileType.from(mimeType: "image/png"), .image)
        XCTAssertEqual(DocumentFileType.from(mimeType: "application/msword"), .doc)
        XCTAssertEqual(
            DocumentFileType.from(
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
            .doc
        )
        XCTAssertEqual(
            DocumentFileType.from(
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            .sheet
        )
        XCTAssertEqual(DocumentFileType.from(mimeType: "application/zip"), .archive)
    }

    func testFileTypeInferenceFromFilenameFallback() {
        XCTAssertEqual(DocumentFileType.from(mimeType: nil, filename: "policy.pdf"), .pdf)
        XCTAssertEqual(DocumentFileType.from(mimeType: "application/octet-stream", filename: "photo.HEIC"), .image)
        XCTAssertEqual(DocumentFileType.from(mimeType: nil, filename: "taxes.xlsx"), .sheet)
        XCTAssertEqual(DocumentFileType.from(mimeType: nil, filename: "evidence.zip"), .archive)
        // Unknown extension → pdf (the "safe default" tile colour).
        XCTAssertEqual(DocumentFileType.from(mimeType: nil, filename: "blob.xyz"), .pdf)
    }

    // MARK: - Filtering

    func testExpiringChipFiltersToNext90Days() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"documents":[
              {"id":"a","home_id":"home-1","doc_type":"insurance","title":"A.pdf",
               "details":{"expires_at":"2026-06-15T00:00:00Z"}},
              {"id":"b","home_id":"home-1","doc_type":"insurance","title":"B.pdf",
               "details":{"expires_at":"2027-01-15T00:00:00Z"}}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = DocumentsFilter.expiring.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        let ids = sections.flatMap { $0.rows.map(\.id) }
        // Doc A expires within 90 days of fixed now (2026-05-15 → 2026-08-13);
        // Doc B (2027-01-15) is outside the window.
        XCTAssertEqual(ids, ["a"])
    }

    func testRecentChipFiltersToLast30Days() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"documents":[
              {"id":"a","home_id":"home-1","doc_type":"insurance","title":"A.pdf",
               "created_at":"2026-05-10T00:00:00Z"},
              {"id":"b","home_id":"home-1","doc_type":"insurance","title":"B.pdf",
               "created_at":"2025-09-01T00:00:00Z"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = DocumentsFilter.recent.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        let ids = sections.flatMap { $0.rows.map(\.id) }
        XCTAssertEqual(ids, ["a"])
    }

    // MARK: - Banner summary

    func testBannerSummarySumsBytesAndExpiringCount() {
        let docs = [
            dto(id: "a", sizeBytes: 1_000_000, details: ["expires_at": "2026-06-15T00:00:00Z"]),
            dto(id: "b", sizeBytes: 500_000),
            dto(id: "c", sizeBytes: 2_000_000, details: ["expires_at": "2027-06-15T00:00:00Z"])
        ]
        let summary = DocumentsViewModel.summarize(documents: docs, now: Self.fixedNow)
        XCTAssertEqual(summary.totalCount, 3)
        XCTAssertEqual(summary.expiringCount, 1)
        XCTAssertNotNil(summary.storageUsedLabel)
        XCTAssertTrue(summary.hasContent)
    }

    func testRowProjectionFillsFilenameAndChips() {
        let doc = dto(
            docType: "lease",
            title: "Lease — 412 Birch Ln (2024–2026).pdf",
            mimeType: "application/pdf",
            sizeBytes: 2_400_000,
            details: [
                "uploaded_by": "John",
                "version": "v3 signed",
                "expires_at": "2026-06-15T00:00:00Z"
            ]
        )
        let projection = DocumentsViewModel.project(dto: doc, now: Self.fixedNow)
        XCTAssertEqual(projection.filename, "Lease — 412 Birch Ln (2024–2026).pdf")
        XCTAssertEqual(projection.category, .lease)
        XCTAssertEqual(projection.fileType, .pdf)
        XCTAssertEqual(projection.version, "v3 signed")
        XCTAssertNotNil(projection.uploadedLabel)
        XCTAssertNotNil(projection.expiresLabel)
        // Within 60 days → urgent (orange).
        XCTAssertTrue(projection.expiresUrgent)
    }
}
