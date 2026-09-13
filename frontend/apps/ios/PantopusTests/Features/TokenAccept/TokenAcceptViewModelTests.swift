//
//  TokenAcceptViewModelTests.swift
//  PantopusTests
//
//  Covers the T3.5 Token / Accept VM resolver + accept/decline paths
//  for all three invite types (home invite, business seat, guest
//  pass), plus the expired and not-found branches.
//

import XCTest
@testable import Pantopus

@MainActor
final class TokenAcceptViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    private var testManagers: [AuthManager] = []
    private var markerDirectories: [URL] = []

    override func tearDown() {
        testManagers.removeAll()
        for directory in markerDirectories {
            try? FileManager.default.removeItem(at: directory)
        }
        markerDirectories.removeAll()
        super.tearDown()
    }

    private func makeAPI() async throws -> APIClient {
        let client = APIClient(
            environment: .current,
            session: TestSession.make(),
            retryPolicy: .none
        )
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("invitation-auth-" + UUID().uuidString)
        markerDirectories.append(directory)
        let manager = AuthManager(
            store: InMemorySecureStore(),
            apiClient: client,
            installMarker: InstallMarker(directory: directory),
            allowSecureEnclave: false
        )
        testManagers.append(manager)
        let login = Fixtures.loginJSON(sessionId: "invitation-unit", expiresAt: Int(Date().timeIntervalSince1970) + 3600)
            .replacingOccurrences(of: "u_123", with: "ddc24300-0000-4000-8000-000000000001")
        URLProtocolStub.stub(path: "/api/users/login", response: .json(login))
        try await manager.signIn(email: "alice@example.com", password: "synthetic-password")
        await manager.awaitBackgroundWork()
        return client
    }

    // The resolver hits 3 GETs in parallel. Path-keyed stubs keep the
    // tests deterministic regardless of request scheduling.

    private static let homeInviteJSON = """
    {
      "invitation": {
        "id": "ddc24300-0000-4000-8000-000000000002", "status": "pending",
        "proposed_role": "member",
        "invitee_email": "alice@example.com",
        "expires_at": null, "created_at": "2026-09-12T00:00:00Z"
      },
      "home": {"id": "ddc24300-0000-4000-8000-000000000003", "name": "412 Elm St", "city": "Portland, OR", "home_type": "single_family"},
      "inviter": {"name": "Maya K.", "username": "mayak", "profilePicture": null}
    }
    """

    private static let businessSeatJSON = """
    {
      "seat_id": "ddc24300-0000-4000-8000-000000000004",
      "business": {"id": "b1", "username": "bridge", "name": "Bridge Builders LLC"},
      "display_name": "Alice — Account Manager",
      "role_base": "manager",
      "invite_email": "alice@example.com",
      "created_at": "2026-05-14T08:00:00Z"
    }
    """

    private static let guestPassJSON = """
    {
      "pass": {
        "label": "Marie's place",
        "kind": "weekend_stay",
        "custom_title": null,
        "expires_at": "2026-05-22T18:00:00Z",
        "home_name": "Marie's place",
        "welcome_message": "Wifi is on the fridge — make yourself at home."
      },
      "sections": {}
    }
    """

    // MARK: - Home invite

    func testHomeInviteResolves() async throws {
        URLProtocolStub.stub(path: "/api/homes/invitations/token/demo", response: .json(Self.homeInviteJSON))
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        XCTAssertNotNil(vm.homeDecision)
        XCTAssertFalse(URLProtocolStub.capturedRequests
            .contains { $0.httpMethod == "POST" && $0.url?.path.contains("/api/homes/") == true })
    }

    func testHomeInviteRequiresProtectedReviewedDecision() async throws {
        URLProtocolStub.stub(path: "/api/homes/invitations/token/demo", response: .json(Self.homeInviteJSON))
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        await vm.accept()
        await vm.decline()
        XCTAssertNotNil(vm.homeDecision)
        XCTAssertFalse(URLProtocolStub.capturedRequests
            .contains { $0.httpMethod == "POST" && $0.url?.path.contains("/api/homes/") == true })
    }

    func testHomeInviteExpired() async throws {
        URLProtocolStub.stub(
            path: "/api/homes/invitations/token/demo",
            response: .json("""
            {"invitation":{"id":"ddc24300-0000-4000-8000-000000000002","status":"expired"},"expired":true,"alreadyUsed":false}
            """)
        )
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        XCTAssertNotNil(vm.homeDecision)
    }

    func testHomeInviteAlreadyUsed() async throws {
        URLProtocolStub.stub(
            path: "/api/homes/invitations/token/demo",
            response: .json("""
            {"invitation":{"id":"ddc24300-0000-4000-8000-000000000002","status":"accepted"},"alreadyUsed":true,"expired":false}
            """)
        )
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        XCTAssertNotNil(vm.homeDecision)
    }

    // MARK: - Business seat

    func testBusinessSeatResolves() async throws {
        URLProtocolStub.stub(path: "/api/businesses/seats/invite-details", response: .json(Self.businessSeatJSON))
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .ready(offer) = vm.state else {
            XCTFail("Expected .ready, got \(vm.state)")
            return
        }
        XCTAssertEqual(offer.inviteType, .businessSeat)
        XCTAssertEqual(offer.invitationId, "ddc24300-0000-4000-8000-000000000004")
        XCTAssertEqual(offer.roleOffered, "Manager")
        XCTAssertTrue(offer.venue.contains("Bridge"))
        XCTAssertTrue(offer.primaryCtaLabel.contains("Bridge"))
    }

    func testBusinessSeatAcceptSucceeds() async throws {
        URLProtocolStub.stub(path: "/api/businesses/seats/invite-details", response: .json(Self.businessSeatJSON))
        URLProtocolStub.stub(
            path: "/api/businesses/seats/accept-invite",
            response: .json("""
            {"message":"Invite accepted","seat_id":"s1","business_user_id":"b1","role_base":"manager"}
            """)
        )
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        await vm.accept()
        guard case let .accepted(offer, _) = vm.state else {
            XCTFail("Expected .accepted")
            return
        }
        XCTAssertEqual(offer.inviteType, .businessSeat)
    }

    // MARK: - Guest pass

    func testGuestPassResolves() async throws {
        URLProtocolStub.stub(path: "/api/homes/guest/demo", response: .json(Self.guestPassJSON))
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .ready(offer) = vm.state else {
            XCTFail("Expected .ready, got \(vm.state)")
            return
        }
        XCTAssertEqual(offer.inviteType, .guestPass)
        XCTAssertNil(offer.invitationId) // guest passes don't expose an id here
        XCTAssertTrue(offer.venue.contains("Marie"))
        XCTAssertEqual(offer.primaryCtaLabel, "View guest pass")
        XCTAssertTrue(offer.benefits.contains { $0.contains("Wifi") })
    }

    func testGuestPassAcceptIsLocalNoPostNeeded() async throws {
        URLProtocolStub.stub(path: "/api/homes/guest/demo", response: .json(Self.guestPassJSON))
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        let postCountBeforeAccept = URLProtocolStub.capturedRequests.filter { $0.httpMethod == "POST" }.count
        await vm.accept()
        guard case .accepted = vm.state else {
            XCTFail("Expected .accepted (local-only)")
            return
        }
        XCTAssertEqual(URLProtocolStub.capturedRequests.filter { $0.httpMethod == "POST" }.count, postCountBeforeAccept)
    }

    // MARK: - Resolver edge cases

    func testAllNotFoundFallsToExpired() async throws {
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .expired(message) = vm.state else {
            XCTFail("Expected .expired when all three resolvers 404")
            return
        }
        XCTAssertFalse(message.isEmpty)
    }

    func testUnavailableHomePreviewOffersRetry() async throws {
        URLProtocolStub.stub(path: "/api/homes/invitations/token/demo", response: .json("{}", status: 503))
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else { return XCTFail("Unavailable preview must offer retry") }
        XCTAssertNil(vm.homeDecision)
    }

    func testFailedBusinessDeclineDoesNotDismiss() async throws {
        URLProtocolStub.stub(path: "/api/businesses/seats/invite-details", response: .json(Self.businessSeatJSON))
        URLProtocolStub.stub(path: "/api/businesses/seats/decline-invite", response: .json("{}", status: 503))
        var dismissed = false
        let vm = try await TokenAcceptViewModel(token: "demo", api: makeAPI()) { dismissed = true }
        await vm.load()
        await vm.decline()
        guard case .error = vm.state else { return XCTFail("Failed decline must remain recoverable") }
        XCTAssertFalse(dismissed)
    }

    // MARK: - Projection helpers

    func testHumanRoleConvertsSnakeToTitleCase() {
        XCTAssertEqual(TokenAcceptViewModel.humanRole("co_owner"), "Co owner")
        XCTAssertEqual(TokenAcceptViewModel.humanRole("renter"), "Renter")
        XCTAssertEqual(TokenAcceptViewModel.humanRole("admin"), "Admin")
    }

    func testSeatBenefitsForAdminIncludeInviteCopy() {
        let adminBenefits = TokenAcceptViewModel.seatBenefits(role: "admin")
        XCTAssertTrue(adminBenefits.contains { $0.contains("Invite teammates") })
        let memberBenefits = TokenAcceptViewModel.seatBenefits(role: "member")
        XCTAssertFalse(memberBenefits.contains { $0.contains("Invite teammates") })
    }
}

@MainActor
private final class InvitationFaultStore: PendingHomeInvitationDecisionStoring {
    var saved: PendingHomeInvitationDecision?
    var failOriginal = false
    var failProof = false
    var loseClearReply = false
    var originalSaved: ((PendingHomeInvitationDecision) throws -> Void)?

    func load(scope: HomeCreationScope) throws -> PendingHomeInvitationDecision? {
        guard saved == nil || saved?.matches(scope) == true else { throw HomeInvitationDecisionError.storage }
        return saved
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeInvitationDecision?, next: PendingHomeInvitationDecision?) throws {
        guard try load(scope: scope) == expected else { throw HomeInvitationDecisionError.changed }
        if next != nil, expected == nil, failOriginal { throw HomeInvitationDecisionError.storage }
        if next?.outcome != nil, failProof { throw HomeInvitationDecisionError.storage }
        saved = next
        if let next, expected == nil { try originalSaved?(next) }
        if next == nil, loseClearReply { throw HomeInvitationDecisionError.storage }
    }
}

@MainActor
extension TokenAcceptViewModelTests {
    private func decisionModel(_ store: InvitationFaultStore) async throws -> HomeInvitationDecisionViewModel {
        let api = try await makeAPI()
        let session: [String: Any] = [
            "actor_id": "ddc24300-0000-4000-8000-000000000001", "session_scope": String(repeating: "c", count: 64)
        ]
        let preview = try JSONSerialization.jsonObject(with: Data(Self.homeInviteJSON.utf8))
        let context: [String: Any] = [
            "home_id": "ddc24300-0000-4000-8000-000000000003",
            "invitation_id": "ddc24300-0000-4000-8000-000000000002", "decision_token": String(repeating: "b", count: 64),
            "session": session, "preview": preview
        ]
        func json(_ object: [String: Any]) throws -> String {
            try XCTUnwrap(String(bytes: JSONSerialization.data(withJSONObject: object), encoding: .utf8))
        }
        try URLProtocolStub.stub(path: "/api/homes/invitations/decisions/session", response: .json(json(["session": session])))
        try URLProtocolStub.stub(path: "/api/homes/invitations/token/demo/decision-context", response: .json(json(context)))
        store.originalSaved = { draft in
            var result = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(draft.body)) as? [String: Any])
            result.removeValue(forKey: "token")
            result.removeValue(forKey: "request_id")
            result["state"] = "completed"
            result["occupancy_id"] = "ddc24300-0000-4000-8000-000000000005"
            result["current_access"] = "not_checked"
            result["session"] = session
            result["command"] = [
                "actor_id": draft.scope.actorId, "request_id": draft.requestId,
                "created_at": "2026-09-12T00:00:00Z", "updated_at": "2026-09-12T00:00:00Z"
            ]
            try URLProtocolStub.stub(path: "/api/homes/invitations/decisions", response: .json(json(result)))
        }
        return HomeInvitationDecisionViewModel(token: "demo", api: api, store: store)
    }

    func testProtectedOriginalWriteFailureBlocksDecisionPost() async throws {
        let store = InvitationFaultStore()
        store.failOriginal = true
        let model = try await decisionModel(store)
        await model.open()
        let context = try XCTUnwrap(model.context)
        await model.decide(.accept, reviewedToken: context.decisionToken, lifetime: model.generation)
        XCTAssertNil(store.saved)
        XCTAssertNotNil(model.error)
        XCTAssertFalse(model.canDecide)
        XCTAssertFalse(URLProtocolStub.capturedRequests
            .contains { $0.httpMethod == "POST" && $0.url?.path == "/api/homes/invitations/decisions" })
    }

    func testProofWriteRepairNeedsNoSecondPostAndLostClearReplyReconciles() async throws {
        let store = InvitationFaultStore()
        store.failProof = true
        let model = try await decisionModel(store)
        await model.open()
        let context = try XCTUnwrap(model.context)
        await model.decide(.accept, reviewedToken: context.decisionToken, lifetime: model.generation)
        let original = try XCTUnwrap(store.saved)
        XCTAssertNil(original.outcome)
        XCTAssertNotNil(model.error)
        XCTAssertFalse(model.canAcknowledge)
        store.failProof = false
        URLProtocolStub.stub(path: "/api/homes/invitations/decisions", response: .json("{}", status: 503))
        await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(store.saved?.outcome?.state, "completed")
        XCTAssertTrue(model.canAcknowledge)
        XCTAssertEqual(
            URLProtocolStub.capturedRequests.filter { $0.httpMethod == "POST" && $0.url?.path == "/api/homes/invitations/decisions" }.count,
            1
        )
        store.loseClearReply = true
        let acknowledged = await model.acknowledge(requestId: original.requestId)
        XCTAssertEqual(acknowledged?.requestId, original.requestId)
        XCTAssertNil(store.saved)
        XCTAssertNil(model.pending)
    }
}
