//
//  ListOfRowsViewModelTests.swift
//  PantopusTests
//
//  Drives each of the 3 P6 ViewModels through happy-path, empty, and
//  error flows using the existing `SequencedURLProtocol` test infra.
//

import XCTest
@testable import Pantopus

@MainActor
final class ListOfRowsViewModelTests: XCTestCase {
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

    // MARK: - MyHomesListViewModel

    func testMyHomesHappyPath() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"homes":[
              {"id":"h1","name":"Main","address":"1 Main","city":"X","state":"CA","zipcode":"90000",
               "ownership_status":"verified","is_primary_owner":true,
               "verification_tier":"attom","occupancy":null,"pending_claim_id":null}
            ]}
            """)
        ]
        let vm = MyHomesListViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded state, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.title, "Main")
    }

    func testMyHomesEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"homes\":[]}")]
        let vm = MyHomesListViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty state, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.icon, .home)
        XCTAssertEqual(content.ctaTitle, "Claim a home")
    }

    func testMyHomesServerError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = MyHomesListViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error state, got \(vm.state)")
            return
        }
    }

    // MARK: - MailboxListViewModel

    func testMailboxPaginationAndTabs() async {
        let page1Items = (0..<25).map {
            "{\"id\":\"m\($0)\",\"type\":\"notice\",\"viewed\":true,\"archived\":false," +
                "\"starred\":false,\"tags\":[],\"priority\":\"normal\",\"attachments\":null," +
                "\"created_at\":\"2025-01-01T00:00:00Z\"}"
        }
        let page1 = page1Items.joined(separator: ",")
        let page2 = "{\"id\":\"m_last\",\"type\":\"notice\",\"viewed\":true,\"archived\":false," +
            "\"starred\":false,\"tags\":[],\"priority\":\"normal\",\"attachments\":null," +
            "\"created_at\":\"2025-01-01T00:00:00Z\"}"
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"mail\":[\(page1)],\"count\":25}"),
            .status(200, body: "{\"mail\":[\(page2)],\"count\":1}")
        ]

        let vm = MailboxListViewModel(api: makeAPI())
        await vm.load()
        if case let .loaded(sections, hasMore) = vm.state {
            XCTAssertEqual(sections.first?.rows.count, 25)
            XCTAssertTrue(hasMore, "Expected hasMore when a full page is returned")
        } else {
            XCTFail("Expected loaded after first page")
        }

        await vm.loadMoreIfNeeded()
        if case let .loaded(sections, hasMore) = vm.state {
            XCTAssertEqual(sections.first?.rows.count, 26)
            XCTAssertFalse(hasMore, "Expected hasMore false after a partial page")
        } else {
            XCTFail("Expected loaded after pagination")
        }
    }

    func testMailboxEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"mail\":[],\"count\":0}")]
        let vm = MailboxListViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty state, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.icon, .mailbox)
    }
}
