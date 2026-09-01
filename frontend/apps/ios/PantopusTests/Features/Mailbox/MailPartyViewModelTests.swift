//
//  MailPartyViewModelTests.swift
//  PantopusTests
//
//  Coverage for the Family Mail Party surface
//  (`backend/routes/mailboxV2Phase2.js`, mounted at `/api/mailbox/v2/p2`):
//    GET  /party/active   (:926)
//    POST /party/create   (:741)
//    POST /party/join     (:816)
//    POST /party/decline  (:866)
//    POST /party/reaction (:875)
//    POST /party/assign   (:887)
//  plus the two supporting reads — the Home drawer (`mailboxV2.js:280`)
//  for startable items and the occupants roster (`home.js:3705`) for the
//  hand-off list.
//
//  Mirrors `MailPartyViewModelTest.kt` on Android.
//

// swiftlint:disable multiline_literal_brackets type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class MailPartyViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    // MARK: - Paths

    private static let activePath = "/api/mailbox/v2/p2/party/active"
    private static let createPath = "/api/mailbox/v2/p2/party/create"
    private static let joinPath = "/api/mailbox/v2/p2/party/join"
    private static let declinePath = "/api/mailbox/v2/p2/party/decline"
    private static let reactionPath = "/api/mailbox/v2/p2/party/reaction"
    private static let assignPath = "/api/mailbox/v2/p2/party/assign"
    private static let drawerPath = "/api/mailbox/v2/drawer/home"
    private static let occupantsPath = "/api/homes/h-1/occupants"

    // MARK: - Fixtures

    private static let twoSessions = """
    {"sessions":[
      {"id":"s-1","mail_id":"m-1","home_id":"h-1","status":"pending",
       "Mail":{"id":"m-1","subject":"Property tax notice","sender_display":"Elm Park Assessor"}},
      {"id":"s-2","mail_id":"m-2","home_id":"h-1","status":"active",
       "Mail":{"id":"m-2","sender_display":"EBMUD"}}
    ]}
    """

    private static let oneDrawerItem = """
    {"mail":[
      {"id":"m-9","type":"physical","created_at":"2026-08-17T10:00:00Z",
       "display_title":"Water bill","sender_display":"EBMUD","sender_trust":"verified_utility"}
    ],"total":1,"drawer":"home"}
    """

    private static let emptyDrawer = """
    {"mail":[],"total":0,"drawer":"home"}
    """

    private static let twoOccupants = """
    {"occupants":[
      {"id":"o-1","user_id":"u-1","role":"owner","is_active":true,"display_name":"Marcus Kovacs"},
      {"id":"o-2","user_id":"u-2","role":"restricted_member","is_active":true,"username":"tess"}
    ],"pendingInvites":[]}
    """

    private static let noOccupants = """
    {"occupants":[],"pendingInvites":[]}
    """

    private static let createdSession = """
    {"session":{"id":"s-9","mail_id":"m-9","home_id":"h-1","status":"pending"},"expiresIn":90}
    """

    // MARK: - Discover

    func test_noSessionsAndNoHomeMailRendersEmpty() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.emptyDrawer)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()

        guard case .empty = vm.discover else {
            return XCTFail("Expected empty, got \(vm.discover)")
        }
        XCTAssertEqual(vm.discoverSubtitle, "Open household mail together")
    }

    func test_loadProjectsSessionsAndStartableItems() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: Self.twoSessions)],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()

        guard case let .loaded(sessions, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        XCTAssertEqual(sessions.count, 2)
        XCTAssertEqual(sessions[0].id, "s-1")
        XCTAssertEqual(sessions[0].title, "Property tax notice")
        XCTAssertEqual(sessions[0].senderDisplay, "Elm Park Assessor")
        XCTAssertEqual(sessions[0].status, .pending)
        XCTAssertEqual(sessions[0].status.label, "Waiting to start")
        // No subject on the joined Mail row — falls back to the shared copy.
        XCTAssertEqual(sessions[1].title, "Household mail")
        XCTAssertEqual(sessions[1].status, .active)
        XCTAssertEqual(startable.count, 1)
        XCTAssertEqual(startable[0].id, "m-9")
        XCTAssertEqual(startable[0].title, "Water bill")
        XCTAssertEqual(vm.discoverSubtitle, "2 happening now")
        XCTAssertNil(vm.live, "Discover frame stays up until a session is entered")
    }

    func test_activeFetchFailureSurfacesError() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(500, body: "{\"error\":\"boom\"}")],
            Self.drawerPath: [.status(200, body: Self.emptyDrawer)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()

        guard case .error = vm.discover else {
            return XCTFail("Expected error, got \(vm.discover)")
        }
    }

    // MARK: - Start / join

    func test_startPartyEntersLiveSessionWithRoster() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)],
            Self.createPath: [.status(200, body: Self.createdSession)],
            Self.occupantsPath: [.status(200, body: Self.twoOccupants)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.startParty(with: startable[0])

        guard case let .loaded(session) = vm.live else {
            return XCTFail("Expected a live session, got \(String(describing: vm.live))")
        }
        XCTAssertEqual(session.sessionId, "s-9")
        XCTAssertEqual(session.mailId, "m-9")
        // `/party/create` returns the bare session with no joined Mail row,
        // so the frame keeps the label the user just tapped.
        XCTAssertEqual(session.title, "Water bill")
        XCTAssertEqual(session.senderDisplay, "EBMUD")
        XCTAssertEqual(session.members.map(\.id), ["u-1", "u-2"])
        XCTAssertEqual(session.members[0].name, "Marcus Kovacs")
        XCTAssertEqual(session.members[0].roleLabel, "Owner")
        // Username fallback + underscore-free role label.
        XCTAssertEqual(session.members[1].name, "tess")
        XCTAssertEqual(session.members[1].roleLabel, "Restricted member")
        XCTAssertFalse(vm.isStarting)
    }

    func test_joinEntersLiveSessionAsActive() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: Self.twoSessions)],
            Self.drawerPath: [.status(200, body: Self.emptyDrawer)],
            Self.joinPath: [.status(
                200,
                body: "{\"session\":{\"id\":\"s-1\",\"mail_id\":\"m-1\",\"home_id\":\"h-1\",\"status\":\"active\"}}"
            )],
            Self.occupantsPath: [.status(200, body: Self.twoOccupants)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sessions, _) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.join(sessions[0])

        guard case let .loaded(session) = vm.live else {
            return XCTFail("Expected a live session, got \(String(describing: vm.live))")
        }
        XCTAssertEqual(session.sessionId, "s-1")
        XCTAssertEqual(session.status, .active)
        // `/party/join` also omits the joined Mail row — the card's own
        // label carries over rather than falling back to the unknown copy.
        XCTAssertEqual(session.title, "Property tax notice")
        XCTAssertEqual(session.senderDisplay, "Elm Park Assessor")
    }

    func test_expiredJoinDropsTheRowAndToasts() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: Self.twoSessions)],
            Self.drawerPath: [.status(200, body: Self.emptyDrawer)],
            Self.joinPath: [.status(400, body: "{\"error\":\"Session expired\"}")]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sessions, _) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.join(sessions[0])

        XCTAssertNil(vm.live, "A refused join must not open the live frame")
        XCTAssertNotNil(vm.toast)
        guard case let .loaded(remaining, _) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        XCTAssertEqual(remaining.map(\.id), ["s-2"])
    }

    func test_liveSessionWithNoRosterRendersEmpty() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)],
            Self.createPath: [.status(200, body: Self.createdSession)],
            Self.occupantsPath: [.status(200, body: Self.noOccupants)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.startParty(with: startable[0])

        guard case let .empty(session) = vm.live else {
            return XCTFail("Expected the empty roster frame, got \(String(describing: vm.live))")
        }
        XCTAssertTrue(session.members.isEmpty)
        XCTAssertEqual(session.sessionId, "s-9", "The party is live even with nobody to hand it to")
    }

    func test_rosterFailureSurfacesSessionError() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)],
            Self.createPath: [.status(200, body: Self.createdSession)],
            Self.occupantsPath: [.status(500, body: "{\"error\":\"boom\"}")]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.startParty(with: startable[0])

        guard case .error = vm.live else {
            return XCTFail("Expected the session error frame, got \(String(describing: vm.live))")
        }
        XCTAssertNil(vm.liveSession)
    }

    // MARK: - Decline

    func test_declineDropsTheRowAndOpensSolo() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: Self.twoSessions)],
            Self.drawerPath: [.status(200, body: Self.emptyDrawer)],
            Self.declinePath: [.status(
                200,
                body: "{\"message\":\"Declined. You can still open the item solo.\"}"
            )]
        ]
        var openedMailIds: [String] = []
        let vm = MailPartyViewModel(api: makeAPI()) { openedMailIds.append($0) }
        await vm.load()
        guard case let .loaded(sessions, _) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.decline(sessions[0])

        XCTAssertEqual(openedMailIds, ["m-1"], "Declining hands the item to the solo reader")
        XCTAssertEqual(vm.toast?.text, "Declined. You can still open the item solo.")
        guard case let .loaded(remaining, _) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        XCTAssertEqual(remaining.map(\.id), ["s-2"])
    }

    // MARK: - Reactions

    func test_reactionEchoCarriesTheServerTtl() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)],
            Self.createPath: [.status(200, body: Self.createdSession)],
            Self.occupantsPath: [.status(200, body: Self.twoOccupants)],
            Self.reactionPath: [.status(200, body: "{\"reaction\":\"🎉\",\"ttl\":5}")]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.startParty(with: startable[0])
        await vm.send(.celebrate)

        XCTAssertEqual(vm.reactionEcho?.glyph, "🎉")
        XCTAssertEqual(vm.reactionEcho?.ttlSeconds, 5)
        XCTAssertNil(vm.sendingReaction)
        vm.clearReactionEcho()
        XCTAssertNil(vm.reactionEcho)
    }

    func test_reactionIsIgnoredOutsideALiveSession() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        await vm.send(.love)

        XCTAssertNil(vm.reactionEcho)
        XCTAssertNil(vm.toast, "No request is made, so nothing can fail")
    }

    // MARK: - Assign

    func test_assignCompletesTheSessionAndReturnsToDiscover() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [
                .status(200, body: "{\"sessions\":[]}"),
                .status(200, body: "{\"sessions\":[]}")
            ],
            Self.drawerPath: [
                .status(200, body: Self.oneDrawerItem),
                .status(200, body: Self.emptyDrawer)
            ],
            Self.createPath: [.status(200, body: Self.createdSession)],
            Self.occupantsPath: [.status(200, body: Self.twoOccupants)],
            Self.assignPath: [.status(200, body: "{\"message\":\"Item assigned\",\"assignedTo\":\"u-2\"}")]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.startParty(with: startable[0])
        guard let session = vm.liveSession else {
            return XCTFail("Expected a live session")
        }
        await vm.assign(to: session.members[1])

        XCTAssertNil(vm.live, "A completed session closes back to discover")
        XCTAssertEqual(vm.toast?.text, "Item assigned")
        XCTAssertNil(vm.assigningMemberId)
        guard case .empty = vm.discover else {
            return XCTFail("Expected the refetched discover frame, got \(vm.discover)")
        }
    }

    func test_assignFailureKeepsTheSessionOpen() async {
        SequencedURLProtocol.routeResponses = [
            Self.activePath: [.status(200, body: "{\"sessions\":[]}")],
            Self.drawerPath: [.status(200, body: Self.oneDrawerItem)],
            Self.createPath: [.status(200, body: Self.createdSession)],
            Self.occupantsPath: [.status(200, body: Self.twoOccupants)],
            Self.assignPath: [.status(500, body: "{\"error\":\"boom\"}")]
        ]
        let vm = MailPartyViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, startable) = vm.discover else {
            return XCTFail("Expected loaded, got \(vm.discover)")
        }
        await vm.startParty(with: startable[0])
        guard let session = vm.liveSession else {
            return XCTFail("Expected a live session")
        }
        await vm.assign(to: session.members[0])

        guard case .loaded = vm.live else {
            return XCTFail("Expected the session to stay open, got \(String(describing: vm.live))")
        }
        XCTAssertNotNil(vm.toast)
        XCTAssertNil(vm.assigningMemberId)
    }
}
