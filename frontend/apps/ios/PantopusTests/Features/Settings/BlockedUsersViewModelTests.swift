//
//  BlockedUsersViewModelTests.swift
//  PantopusTests
//
//  Covers the four ListOfRows states (loading→loaded, loading→empty,
//  loading→error) and the optimistic unblock flow (success removes
//  the row; failure restores it).
//
//  N04: the screen reads BOTH existing block contracts in a fixed order
//  — `GET /api/users/blocked` (UserBlock) first, then
//  `GET /api/privacy/blocks` (UserProfileBlock) — so every sequence below
//  supplies two load responses. The added cases pin the personal-block
//  path: that a profile block is visible here at all, that Unblock sends
//  `DELETE /api/users/:userId/block` for it, and that one list failing
//  does not hide the other.
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

    /// `GET /api/users/blocked` — flattened UserBlock rows (blocks.js:145).
    private static let twoPersonalJSON = """
    {"blocked":[
      {"id":"ub1","user_id":"u_carol","username":"carol","name":"Carol",
       "profile_picture_url":null,"reason":"Harassment","created_at":"2026-05-03T00:00:00Z"},
      {"id":"ub2","user_id":"u_dave","username":"dave","name":null,
       "profile_picture_url":null,"reason":null,"created_at":"2026-04-28T00:00:00Z"}
    ]}
    """

    private static let noPersonalJSON = """
    {"blocked":[]}
    """

    private static let twoBlocksJSON = """
    {"blocks":[
      {"id":"b1","blocked_user_id":"u_alice","block_scope":"full","reason":"Spam","created_at":"2026-05-01T00:00:00Z",
       "blocked":{"id":"u_alice","username":"alice","name":"Alice","profile_picture_url":null}},
      {"id":"b2","blocked_user_id":"u_bob","block_scope":"search_only","reason":null,"created_at":"2026-05-02T00:00:00Z",
       "blocked":{"id":"u_bob","username":"bob","name":"Bob","profile_picture_url":null}}
    ]}
    """

    func testLoadEmptyProducesEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.noPersonalJSON),
            .status(200, body: "{\"blocks\":[]}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
    }

    func testLoadPopulatedProducesLoadedRows() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.noPersonalJSON),
            .status(200, body: Self.twoBlocksJSON)
        ]
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
        // Both lists must fail before the screen reports an error.
        SequencedURLProtocol.sequence = [
            .status(500, body: "{}"),
            .status(500, body: "{}")
        ]
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
            .status(200, body: Self.noPersonalJSON),
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
            .status(200, body: Self.noPersonalJSON),
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

    // ── N04: the personal-block (UserBlock) half of the screen ──────────

    /// The regression this screen existed without: a block made from a
    /// profile or a chat writes UserBlock, and before N04 nothing here read
    /// that table, so the row never appeared and could never be lifted.
    func testPersonalBlocksAppearInTheList() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPersonalJSON),
            .status(200, body: "{\"blocks\":[]}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["ub1", "ub2"])
        XCTAssertEqual(sections[0].rows[0].title, "Carol")
        // No name on the second row — falls back to the @handle, the same
        // rule the privacy rows already use.
        XCTAssertEqual(sections[0].rows[1].title, "@dave")
        // Personal blocks are account-wide, so they carry no scope suffix.
        XCTAssertEqual(sections[0].rows[0].subtitle, "Blocked May 3, 2026")
    }

    /// Both contracts render into one list, personal first, each keeping
    /// the order its own route returned.
    func testBothContractsRenderInOneList() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPersonalJSON),
            .status(200, body: Self.twoBlocksJSON)
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["ub1", "ub2", "b1", "b2"])
        XCTAssertEqual(sections[0].header, "Blocked · 4")
    }

    /// Unblocking a personal block must address the UserBlock route by user
    /// id — not the privacy route by block id.
    func testUnblockPersonalBlockSendsUsersBlockDelete() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPersonalJSON),
            .status(200, body: "{\"blocks\":[]}"),
            .status(200, body: "{\"success\":true}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        await vm.unblock("ub1")

        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after unblock")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["ub2"])

        guard let delete = SequencedURLProtocol.capturedRequests.last else {
            XCTFail("Expected a captured unblock request")
            return
        }
        XCTAssertEqual(delete.httpMethod, "DELETE")
        XCTAssertEqual(delete.url?.path, "/api/users/u_carol/block")
    }

    /// A failed personal unblock restores the row, same as the privacy path.
    func testUnblockPersonalBlockRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPersonalJSON),
            .status(200, body: "{\"blocks\":[]}"),
            .status(500, body: "{}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        await vm.unblock("ub1")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after rollback")
            return
        }
        XCTAssertEqual(Set(sections[0].rows.map(\.id)), Set(["ub1", "ub2"]))
    }

    /// One list failing must not hide the other — a personal block stays
    /// visible and liftable when the Identity Firewall list is down.
    func testPersonalBlocksSurviveAPrivacyListFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPersonalJSON),
            .status(500, body: "{}")
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["ub1", "ub2"])
    }

    /// And the reverse: the privacy list still renders when the personal
    /// list is unavailable.
    func testPrivacyBlocksSurviveAPersonalListFailure() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{}"),
            .status(200, body: Self.twoBlocksJSON)
        ]
        let vm = BlockedUsersViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["b1", "b2"])
    }
}
