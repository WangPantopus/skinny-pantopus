//
//  BlockedUsersViewModelTests.swift
//  PantopusTests
//
//  Covers the four ListOfRows states (loading→loaded, loading→empty,
//  loading→error) and the optimistic unblock flow (success removes
//  the row; failure restores it).
//

import XCTest
@testable import Pantopus

@MainActor
final class BlockedUsersViewModelTests: XCTestCase {
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

    private static let twoBlocksJSON = """
    {"blocks":[
      {"id":"b1","blocked_user_id":"u_alice","block_scope":"full","reason":"Spam","created_at":"2026-05-01T00:00:00Z",
       "blocked":{"id":"u_alice","username":"alice","name":"Alice","profile_picture_url":null}},
      {"id":"b2","blocked_user_id":"u_bob","block_scope":"search_only","reason":null,"created_at":"2026-05-02T00:00:00Z",
       "blocked":{"id":"u_bob","username":"bob","name":"Bob","profile_picture_url":null}}
    ]}
    """

    func testLoadEmptyProducesEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"blocks\":[]}")]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
    }

    func testLoadPopulatedProducesLoadedRows() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoBlocksJSON)]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections.count, 1)
        // A14.4 — single card with a privacy-contract helper below it.
        guard case .card = sections[0].style else {
            XCTFail("Expected a .card section style")
            return
        }
        XCTAssertNotNil(sections[0].footer)
        let rows = sections[0].rows
        XCTAssertEqual(rows.map(\.id), ["b1", "b2"])
        XCTAssertEqual(rows[0].title, "Alice")
        // A14.4 source-context line: "Blocked <date>" + scope context.
        // `full` scope carries no suffix; `search_only` appends "Search only".
        XCTAssertEqual(rows[0].subtitle, "Blocked May 1, 2026")
        XCTAssertEqual(rows[1].subtitle, "Blocked May 2, 2026 · Search only")
        // Trailing is the neutral Unblock pill (replaces the kebab).
        guard case let .pillButton(label, tone, _) = rows[0].trailing else {
            XCTFail("Expected a pillButton trailing")
            return
        }
        XCTAssertEqual(label, "Unblock")
        XCTAssertEqual(tone, .neutral)
    }

    func testLoadFailureProducesErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case let .error(message) = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
        XCTAssertFalse(message.isEmpty)
    }

    func testOptimisticUnblockRemovesRowOnSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoBlocksJSON),
            .status(200, body: "{\"message\":\"Block removed\"}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        await vm.unblock("b1")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after unblock")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["b2"])
    }

    func testOptimisticUnblockRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoBlocksJSON),
            .status(500, body: "{}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        await vm.unblock("b1")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after rollback")
            return
        }
        XCTAssertEqual(Set(sections[0].rows.map(\.id)), Set(["b1", "b2"]))
    }
}
