//
//  NewMessageViewModelTests.swift
//  PantopusTests
//
//  T6.6b P25 — New Message contact picker. Covers:
//    - load → loaded (Connections + Recent populated)
//    - load → empty (no connections, no recents, no search)
//    - load → error (both backend fetches fail)
//    - search filters Connections + Recent by name and runs the
//      `/api/users/search` endpoint once the query reaches 2 chars
//    - row mapping (verified flag, identity badge, locality, sub
//      text) for each of the three projections
//    - tap row → emits a `NewMessageDestination` to the host
//

import XCTest
@testable import Pantopus

@MainActor
final class NewMessageViewModelTests: XCTestCase {
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

    private func makeVM(
        api: APIClient? = nil,
        onSelect: @escaping @MainActor (NewMessageDestination) -> Void = { _ in }
    ) -> NewMessageViewModel {
        NewMessageViewModel(api: api ?? makeAPI(), onSelect: onSelect)
    }

    private typealias StubResponse = SequencedURLProtocol.Response

    private func stubInitial(
        accepted: StubResponse,
        unified: StubResponse
    ) {
        SequencedURLProtocol.routeResponses = [
            "/api/relationships": [accepted],
            "/api/chat/unified-conversations": [unified]
        ]
    }

    private static let acceptedJSON = """
    {"relationships":[
      {"id":"r1","status":"accepted",
       "created_at":"2026-05-12T10:00:00Z",
       "accepted_at":"2026-05-12T11:00:00Z",
       "direction":"received",
       "other_user":{"id":"u_a","username":"maria","name":"Maria Kovacs",
                      "first_name":"Maria","last_name":"Kovacs",
                      "profile_picture_url":null,"city":"Elm Park","state":"OR"}}
    ]}
    """

    private static let acceptedEmptyJSON = """
    {"relationships":[]}
    """

    private static let unifiedJSON = """
    {"conversations":[
      {"_type":"conversation","other_participant_id":"u_b",
       "other_participant_name":"Sofia Romero",
       "other_participant_identity":{"identity_kind":"personal","verified":true},
       "last_message_at":"2026-05-15T10:00:00Z",
       "total_unread":0,"topics":[]}
    ]}
    """

    private static let unifiedEmptyJSON = """
    {"conversations":[]}
    """

    private static let searchJSON = """
    {"users":[
      {"id":"u_c","username":"anika","name":"Anika Reyes",
       "profilePicture":null,"city":"Elm Park","state":"OR",
       "accountType":"individual"},
      {"id":"u_d","username":"bigtree","name":"Big Tree Handyman",
       "profilePicture":null,"city":"Elm Park","state":"OR",
       "accountType":"business"}
    ]}
    """

    // MARK: - Lifecycle

    func testLoadShowsBothPopulatedSections() async {
        stubInitial(
            accepted: .status(200, body: Self.acceptedJSON),
            unified: .status(200, body: Self.unifiedJSON)
        )
        let viewModel = makeVM()
        await viewModel.load()
        guard case let .loaded(sections) = viewModel.state else {
            XCTFail("expected loaded, got \(viewModel.state)")
            return
        }
        XCTAssertEqual(sections.map(\.id), [.connections, .recent])
        XCTAssertEqual(sections[0].rows.first?.name, "Maria Kovacs")
        XCTAssertEqual(sections[0].rows.first?.locality, "Elm Park, OR")
        XCTAssertTrue(sections[0].rows.first?.verified ?? false)
        XCTAssertEqual(sections[1].rows.first?.name, "Sofia Romero")
        XCTAssertEqual(sections[1].rows.first?.identity, .personal)
    }

    func testLoadAllEmptyTransitionsToEmptyPivot() async {
        stubInitial(
            accepted: .status(200, body: Self.acceptedEmptyJSON),
            unified: .status(200, body: Self.unifiedEmptyJSON)
        )
        let viewModel = makeVM()
        await viewModel.load()
        if case .empty = viewModel.state {} else {
            XCTFail("expected empty, got \(viewModel.state)")
        }
    }

    func testBothFetchesFailingFlipsToError() async {
        stubInitial(
            accepted: .status(500, body: ""),
            unified: .status(500, body: "")
        )
        let viewModel = makeVM()
        await viewModel.load()
        if case .error = viewModel.state {} else {
            XCTFail("expected error, got \(viewModel.state)")
        }
    }

    func testOnlyConnectionsFailingKeepsRecentVisible() async {
        stubInitial(
            accepted: .status(500, body: ""),
            unified: .status(200, body: Self.unifiedJSON)
        )
        let viewModel = makeVM()
        await viewModel.load()
        guard case let .loaded(sections) = viewModel.state else {
            XCTFail("expected loaded, got \(viewModel.state)")
            return
        }
        XCTAssertEqual(sections.map(\.id), [.recent])
    }

    // MARK: - Search

    func testSearchFiltersConnectionsByName() async {
        stubInitial(
            accepted: .status(200, body: Self.acceptedJSON),
            unified: .status(200, body: Self.unifiedJSON)
        )
        let viewModel = makeVM()
        await viewModel.load()
        viewModel.updateSearch("Maria")
        guard case let .loaded(sections) = viewModel.state else {
            XCTFail("expected loaded after search, got \(viewModel.state)")
            return
        }
        // Connections filter keeps Maria; Recent (Sofia) is dropped.
        XCTAssertEqual(sections.first?.id, .connections)
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.name, "Maria Kovacs")
        XCTAssertFalse(sections.contains { $0.id == .recent })
    }

    func testSearchTriggersDirectoryFetchAndShowsAllVerified() async throws {
        SequencedURLProtocol.routeResponses = [
            "/api/relationships": [.status(200, body: Self.acceptedEmptyJSON)],
            "/api/chat/unified-conversations": [.status(200, body: Self.unifiedEmptyJSON)],
            "/api/users/search": [.status(200, body: Self.searchJSON)]
        ]
        let viewModel = makeVM()
        await viewModel.load()
        viewModel.updateSearch("Reyes")
        // Wait past the 280ms debounce + network completion.
        try await Task.sleep(nanoseconds: 600_000_000)
        guard case let .loaded(sections) = viewModel.state else {
            XCTFail("expected loaded after debounced search, got \(viewModel.state)")
            return
        }
        XCTAssertEqual(sections.map(\.id), [.allVerified])
        let rows = sections.first?.rows ?? []
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows.first?.name, "Anika Reyes")
        XCTAssertEqual(rows.last?.identity, .business)
    }

    func testShortSearchKeepsAllVerifiedHidden() async {
        stubInitial(
            accepted: .status(200, body: Self.acceptedJSON),
            unified: .status(200, body: Self.unifiedEmptyJSON)
        )
        let viewModel = makeVM()
        await viewModel.load()
        viewModel.updateSearch("M")
        guard case let .loaded(sections) = viewModel.state else {
            XCTFail("expected loaded, got \(viewModel.state)")
            return
        }
        XCTAssertFalse(sections.contains { $0.id == .allVerified })
    }

    // MARK: - Row mapping (pure projections)

    func testRowForConnectionProjectsVerifiedPersonal() {
        let user = RelationshipUserDTO(
            id: "u_x",
            username: "test",
            name: "Test User",
            firstName: "Test",
            lastName: "User",
            profilePictureURL: nil,
            city: "Elm Park",
            state: "OR"
        )
        let viewModel = makeVM()
        let rel = makeRelationship(id: "r_x", otherUser: user, acceptedAt: "2026-05-12T11:00:00Z")
        let row = viewModel.rowForConnection(rel)
        XCTAssertNotNil(row)
        XCTAssertEqual(row?.userId, "u_x")
        XCTAssertEqual(row?.name, "Test User")
        XCTAssertEqual(row?.initials, "TU")
        XCTAssertEqual(row?.locality, "Elm Park, OR")
        XCTAssertEqual(row?.identity, .personal)
        XCTAssertTrue(row?.verified ?? false)
    }

    func testRowForVerifiedProjectsBusinessIdentity() {
        let dto = UserSearchResultDTO(
            id: "u_biz",
            username: nil,
            name: "Big Tree Handyman",
            profilePicture: nil,
            city: "Elm Park",
            state: "OR",
            accountType: "business"
        )
        let row = makeVM().rowForVerified(dto)
        XCTAssertEqual(row.identity, .business)
        XCTAssertEqual(row.locality, "Elm Park, OR")
    }

    // MARK: - Selection

    func testTapRowEmitsDestination() {
        let expectation = expectation(description: "selection emitted")
        let viewModel = makeVM { destination in
            XCTAssertEqual(destination.userId, "u_z")
            XCTAssertEqual(destination.displayName, "Pat")
            expectation.fulfill()
        }
        let row = NewMessageContactRow(
            id: "x",
            userId: "u_z",
            name: "Pat",
            initials: "P",
            locality: nil,
            sub: nil,
            subIcon: nil,
            verified: true,
            identity: .personal
        )
        viewModel.tap(row: row)
        wait(for: [expectation], timeout: 1.0)
    }

    // MARK: - Helpers

    private func makeRelationship(
        id: String,
        otherUser: RelationshipUserDTO,
        acceptedAt: String?
    ) -> RelationshipDTO {
        let json = """
        {"id":"\(id)","status":"accepted","created_at":"2026-05-12T10:00:00Z",
         "accepted_at":\(acceptedAt.map { "\"\($0)\"" } ?? "null"),
         "direction":"received",
         "other_user":{"id":"\(otherUser.id)","username":\(otherUser.username.map { "\"\($0)\"" } ?? "null"),
                        "name":\(otherUser.name.map { "\"\($0)\"" } ?? "null"),
                        "first_name":\(otherUser.firstName.map { "\"\($0)\"" } ?? "null"),
                        "last_name":\(otherUser.lastName.map { "\"\($0)\"" } ?? "null"),
                        "profile_picture_url":null,
                        "city":\(otherUser.city.map { "\"\($0)\"" } ?? "null"),
                        "state":\(otherUser.state.map { "\"\($0)\"" } ?? "null")}}
        """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(RelationshipDTO.self, from: Data(json.utf8))
    }
}
