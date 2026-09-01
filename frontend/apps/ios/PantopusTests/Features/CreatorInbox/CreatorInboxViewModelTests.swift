//
//  CreatorInboxViewModelTests.swift
//  PantopusTests
//
//  Covers the P1.2 Creator Inbox VM: `load()` projects threads + filter
//  chip counts, empty persona transitions to `.empty`, empty thread
//  list also transitions to `.empty`, filter selection narrows the
//  visible rows.
//

import XCTest
@testable import Pantopus

@MainActor
final class CreatorInboxViewModelTests: XCTestCase {
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

    private static let meJSON = """
    {
      "persona": {
        "id": "p_demo",
        "handle": "mariak",
        "displayName": "Maria K.",
        "category": "creator",
        "followerCount": 24,
        "postCount": 7
      },
      "channel": null
    }
    """

    private static let threadsJSON = """
    {"threads":[
      {"id":"th_gold","fanHandle":"derek_tan","fanDisplayName":"Derek Tan",
       "tier":{"rank":4,"name":"Gold"},
       "lastMessagePreview":"Could I commission a custom loaf?","lastMessageAt":"2026-05-15T10:00:00Z",
       "unreadCount":2,"flagged":false,"verifiedLocal":true,
       "counterpartyUserId":"u_derek"},
      {"id":"th_silver","fanHandle":"lenapap","fanDisplayName":"Lena P.",
       "tier":{"rank":3,"name":"Silver"},
       "lastMessagePreview":"Question on step 4","lastMessageAt":"2026-05-15T09:30:00Z",
       "unreadCount":1,"flagged":false,"verifiedLocal":true,
       "counterpartyUserId":"u_lena"},
      {"id":"th_bronze_unread","fanHandle":"ravidesai","fanDisplayName":"Ravi Desai",
       "tier":{"rank":2,"name":"Bronze"},
       "lastMessagePreview":"Voice message 0:42","lastMessageAt":"2026-05-15T08:30:00Z",
       "unreadCount":3,"flagged":false,"verifiedLocal":false,
       "counterpartyUserId":"u_ravi"},
      {"id":"th_flagged","fanHandle":"marcok","fanDisplayName":"Marco K.",
       "tier":{"rank":2,"name":"Bronze"},
       "lastMessagePreview":"Heads up — impersonation report","lastMessageAt":"2026-05-14T12:00:00Z",
       "unreadCount":0,"flagged":true,"verifiedLocal":true,
       "counterpartyUserId":"u_marco"},
      {"id":"th_free","fanHandle":"junie_l","fanDisplayName":"Junie L.",
       "tier":{"rank":1,"name":"Free"},
       "lastMessagePreview":"Following from the market!","lastMessageAt":"2026-05-12T15:00:00Z",
       "unreadCount":0,"flagged":false,"verifiedLocal":false,
       "counterpartyUserId":"u_junie"}
    ]}
    """

    private static let emptyThreadsJSON = """
    {"threads":[]}
    """

    private func loadedSequence() -> [SequencedURLProtocol.Response] {
        [
            .status(200, body: Self.meJSON),
            .status(200, body: Self.threadsJSON)
        ]
    }

    func testLoadProjectsThreadsAndChipCounts() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.header.handle, "@mariak")
        XCTAssertEqual(loaded.rows.count, 5)
        XCTAssertEqual(loaded.counts.total, 5)
        XCTAssertEqual(loaded.counts.unread, 3) // gold, silver, bronze_unread
        XCTAssertEqual(loaded.counts.flagged, 1)
        // Chips: All=5, Unread=3, Bronze+=4 (gold+silver+2 bronze), Flagged=1
        XCTAssertEqual(loaded.chips.count, 4)
        XCTAssertEqual(loaded.chips.first { $0.filter == .all }?.count, 5)
        XCTAssertEqual(loaded.chips.first { $0.filter == .unread }?.count, 3)
        XCTAssertEqual(loaded.chips.first { $0.filter == .bronzePlus }?.count, 4)
        XCTAssertEqual(loaded.chips.first { $0.filter == .flagged }?.count, 1)
    }

    func testFilterUnreadNarrowsRows() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        vm.selectFilter(.unread)
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded after filter")
            return
        }
        XCTAssertEqual(loaded.rows.count, 3)
        XCTAssertTrue(loaded.rows.allSatisfy(\.unread))
    }

    func testFilterBronzePlusExcludesFreeTier() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        vm.selectFilter(.bronzePlus)
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded after filter")
            return
        }
        XCTAssertEqual(loaded.rows.count, 4)
        XCTAssertFalse(loaded.rows.contains { $0.tierRank == 1 })
    }

    func testFilterFlaggedIsolatesFlaggedRow() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        vm.selectFilter(.flagged)
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded after filter")
            return
        }
        XCTAssertEqual(loaded.rows.count, 1)
        XCTAssertEqual(loaded.rows.first?.id, "th_flagged")
        XCTAssertTrue(loaded.rows.first?.flagged ?? false)
    }

    func testEmptyPersonaTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"persona": null, "channel": null}
            """)
        ]
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(header) = vm.state else {
            XCTFail("Expected .empty for null persona")
            return
        }
        XCTAssertNil(header.handle)
    }

    func testEmptyThreadListTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.meJSON),
            .status(200, body: Self.emptyThreadsJSON)
        ]
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(header) = vm.state else {
            XCTFail("Expected .empty when threads array is empty")
            return
        }
        XCTAssertEqual(header.handle, "@mariak")
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error on 500")
            return
        }
    }

    func testActiveFilterDefaultsToAll() {
        let vm = CreatorInboxViewModel(api: makeAPI())
        XCTAssertEqual(vm.activeFilter, .all)
    }

    /// Persona DMs are addressed by thread id — never by a user id (the
    /// serializer emits none). The destination must therefore carry the
    /// row id verbatim, plus the persona whose inbox this is.
    func testThreadDestinationRoutesOnThreadIdNotUserId() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = CreatorInboxViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        guard let row = loaded.rows.first(where: { $0.id == "th_gold" }) else {
            XCTFail("Expected gold thread")
            return
        }
        let dest = vm.threadDestination(for: row)
        XCTAssertEqual(dest.threadId, "th_gold")
        XCTAssertFalse(dest.personaId.isEmpty)
        XCTAssertNotEqual(dest.threadId, row.counterpartyUserId)
        XCTAssertEqual(dest.displayName, "Derek Tan")
        XCTAssertTrue(dest.verified)
    }
}
