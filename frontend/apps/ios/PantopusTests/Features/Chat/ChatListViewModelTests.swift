//
//  ChatListViewModelTests.swift
//  PantopusTests
//
//  Covers chat list VM: load → loaded with AI row pinned, empty,
//  error, filter rebinding, projection of identity chip + verified
//  bit, unread bolding flag.
//

import XCTest
@testable import Pantopus

// swiftlint:disable force_unwrapping

@MainActor
final class ChatListViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: TestSession.make(),
            retryPolicy: .none
        )
    }

    private static let directConversationJSON = """
    {
      "_type": "conversation",
      "other_participant_id": "u1",
      "other_participant_name": "Marcus R.",
      "other_participant_username": "marcus",
      "other_participant_avatar": null,
      "other_participant_identity": {
        "id": "u1",
        "display_name": "Marcus R.",
        "avatarUrl": null,
        "identity_kind": "personal",
        "verified": true
      },
      "room_ids": ["r1"],
      "total_unread": 2,
      "last_message_at": "2026-04-20T10:00:00Z",
      "last_message_preview": "Can you start at 9?",
      "topics": [{"id":"t1","topic_type":"gig","title":"Shelves"}]
    }
    """

    private static let businessConversationJSON = """
    {
      "_type": "conversation",
      "other_participant_id": "b1",
      "other_participant_name": "Dahlia's Petals",
      "other_participant_username": "dahlias",
      "other_participant_avatar": null,
      "other_participant_identity": {
        "id": "b1",
        "display_name": "Dahlia's Petals",
        "avatarUrl": null,
        "identity_kind": "business",
        "verified": true
      },
      "room_ids": ["r2"],
      "total_unread": 1,
      "last_message_at": "2026-04-20T09:00:00Z",
      "last_message_preview": "On the porch.",
      "topics": []
    }
    """

    private static let groupRoomJSON = """
    {
      "_type": "room",
      "id": "g1",
      "room_type": "group",
      "room_name": "Rose Court Block",
      "description": null,
      "gig_id": null,
      "home_id": null,
      "total_unread": 0,
      "last_message_at": "2026-04-19T12:00:00Z",
      "last_message_preview": "I'll grab the chairs",
      "topics": []
    }
    """

    private static func listJSON(_ rows: String...) -> String {
        let joined = rows.joined(separator: ",")
        return "{\"conversations\":[\(joined)],\"total\":\(rows.count),\"totalUnread\":3}"
    }

    private static let statsJSON = """
    {"stats":{"total_chats":3,"total_messages":17,"total_unread":3,"direct_chats":2,"gig_chats":1,"home_chats":0}}
    """

    func testLoadProducesLoadedWithAIRowPinned() async {
        URLProtocolStub.stub(
            path: "/api/chat/unified-conversations",
            response: .json(Self.listJSON(Self.directConversationJSON, Self.businessConversationJSON, Self.groupRoomJSON))
        )
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared)
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.first?.id, "ai_assistant", "AI row pins first")
        XCTAssertEqual(rows.count, 4, "AI row + 3 conversations")
        let marcus = rows.first { $0.id == "u1" }
        XCTAssertEqual(marcus?.displayName, "Marcus R.")
        XCTAssertEqual(marcus?.unread, 2)
        XCTAssertTrue(marcus?.verified ?? false)
        XCTAssertNil(marcus?.identityChip)
        XCTAssertTrue(marcus?.topicKinds.contains("gig") ?? false)
        XCTAssertEqual(marcus?.topics.first?.title, "Shelves", "row carries topic pills for the chips under the preview")
        XCTAssertEqual(marcus?.topics.first?.topicType, "gig")
        let business = rows.first { $0.id == "b1" }
        XCTAssertEqual(business?.identityChip, .business)
        XCTAssertEqual(business?.topics, [], "no pills when a conversation has no topics")
    }

    func testLoadEmptyTransitionsEmpty() async {
        URLProtocolStub.stub(path: "/api/chat/unified-conversations", response: .json(Self.listJSON()))
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared)
        await vm.load()
        if case .empty = vm.state { /* ok */ } else {
            XCTFail("Expected .empty when no conversations")
        }
    }

    func testLoadFailureTransitionsError() async {
        URLProtocolStub.stub(path: "/api/chat/unified-conversations", response: .json("{}", status: 500))
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json("{}", status: 500))
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared)
        await vm.load()
        if case .error = vm.state { /* ok */ } else {
            XCTFail("Expected .error on 5xx")
        }
    }

    func testSelectFilterFiltersRowsWithoutRefetch() async {
        URLProtocolStub.stub(
            path: "/api/chat/unified-conversations",
            response: .json(Self.listJSON(Self.directConversationJSON, Self.businessConversationJSON, Self.groupRoomJSON))
        )
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared)
        await vm.load()
        vm.selectFilter(.gigs)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after gigs filter")
            return
        }
        // AI row + 1 gig-tagged conversation
        XCTAssertEqual(rows.count, 2)
        XCTAssertTrue(rows.contains { $0.id == "u1" })
        XCTAssertFalse(rows.contains { $0.id == "b1" })
    }

    func testUnreadFilterShowsOnlyUnreadRows() async {
        URLProtocolStub.stub(
            path: "/api/chat/unified-conversations",
            response: .json(Self.listJSON(Self.directConversationJSON, Self.businessConversationJSON, Self.groupRoomJSON))
        )
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared)
        await vm.load()
        vm.selectFilter(.unread)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after unread filter")
            return
        }
        let nonAI = rows.filter { $0.id != "ai_assistant" }
        XCTAssertTrue(nonAI.allSatisfy { $0.unread > 0 })
    }

    func testRootBadgeStoreSeedsUnreadMessagesFromStats() async {
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        URLProtocolStub.stub(path: "/api/chat/unified-conversations", response: .json(Self.listJSON()))
        let store = ChatBadgeStore(api: makeAPI(), socket: .shared)
        await store.start()
        XCTAssertEqual(store.unreadMessages, 3)
        store.stop()
    }

    func testHideConversationRemovesRowFromList() async {
        URLProtocolStub.stub(
            path: "/api/chat/unified-conversations",
            response: .json(Self.listJSON(Self.directConversationJSON, Self.businessConversationJSON, Self.groupRoomJSON))
        )
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let prefs = ChatConversationPreferences(defaults: makeDefaults())
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared, preferences: prefs)
        await vm.load()
        vm.hideConversation(storageKey: "person:u1")
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected loaded after hide")
            return
        }
        XCTAssertFalse(rows.contains { $0.id == "u1" })
    }

    func testMuteConversationExcludesUnreadFromFilterBadge() async {
        URLProtocolStub.stub(
            path: "/api/chat/unified-conversations",
            response: .json(Self.listJSON(Self.directConversationJSON, Self.businessConversationJSON, Self.groupRoomJSON))
        )
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let prefs = ChatConversationPreferences(defaults: makeDefaults())
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared, preferences: prefs)
        await vm.load()
        vm.toggleMute(storageKey: "person:u1")
        XCTAssertEqual(vm.unreadByFilter[.unread], 1)
    }

    func testHiddenConversationAutoUnhidesWhenUnreadArrives() async {
        let hiddenDirect = """
        {
          "_type": "conversation",
          "other_participant_id": "u1",
          "other_participant_name": "Marcus R.",
          "other_participant_identity": {
            "id": "u1",
            "display_name": "Marcus R.",
            "identity_kind": "personal",
            "verified": true
          },
          "room_ids": ["r1"],
          "total_unread": 4,
          "last_message_at": "2026-04-20T10:00:00Z",
          "last_message_preview": "New ping",
          "topics": []
        }
        """
        URLProtocolStub.stub(
            path: "/api/chat/unified-conversations",
            responses: [
                .json(Self.listJSON(Self.directConversationJSON, Self.businessConversationJSON, Self.groupRoomJSON)),
                .json(Self.listJSON(hiddenDirect, Self.businessConversationJSON, Self.groupRoomJSON))
            ]
        )
        URLProtocolStub.stub(path: "/api/chat/stats", response: .json(Self.statsJSON))
        let prefs = ChatConversationPreferences(defaults: makeDefaults())
        let vm = ChatListViewModel(api: makeAPI(), socket: .shared, preferences: prefs)
        await vm.load()
        vm.hideConversation(storageKey: "person:u1")
        await vm.refresh()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected loaded after refresh")
            return
        }
        XCTAssertTrue(rows.contains { $0.id == "u1" })
    }

    private func makeDefaults() -> UserDefaults {
        let suite = "ChatListViewModelTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }
}
