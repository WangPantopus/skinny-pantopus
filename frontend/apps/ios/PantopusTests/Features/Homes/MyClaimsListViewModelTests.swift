//
//  MyClaimsListViewModelTests.swift
//  PantopusTests
//
//  Covers the my-claims VM: empty + loaded + error states, plus the
//  status-to-chip-variant mapping that drives the row trailing.
//

import XCTest
@testable import Pantopus

@MainActor
final class MyClaimsListViewModelTests: XCTestCase {
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

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"claims\":[]}")
        ]
        let vm = MyClaimsListViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No claims yet")
        XCTAssertEqual(content.ctaTitle, "Add a home")
    }

    func testLoadedResponseMapsToRows() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"claims":[
              {"id":"claim-abcd1234","home_id":"h1","claim_type":"owner","method":"doc_upload",
               "status":"under_review","created_at":"2025-05-08T12:00:00Z","updated_at":"2025-05-08T12:00:00Z"}
            ]}
            """)
        ]
        let vm = MyClaimsListViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].rows.count, 1)
        let row = sections[0].rows[0]
        XCTAssertEqual(row.id, "claim-abcd1234")
        XCTAssertTrue(row.title.hasPrefix("Claim "))
        if case let .statusChip(text, variant) = row.trailing {
            XCTAssertEqual(text, "Under review")
            XCTAssertTrue(matchesInfo(variant))
        } else {
            XCTFail("Expected status chip trailing")
        }
    }

    func testErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = MyClaimsListViewModel(api: makeAPI())
        await vm.load()
        if case .error = vm.state { } else {
            XCTFail("Expected error, got \(vm.state)")
        }
    }

    private func matchesInfo(_ variant: StatusChipVariant) -> Bool {
        if case .info = variant { return true }
        return false
    }
}
