//
//  TokenAcceptViewModelTests.swift
//  PantopusTests
//
//  Covers the T3.5 Token / Accept VM resolver + accept/decline paths
//  for all three invite types (home invite, business seat, guest
//  pass), plus the expired and not-found branches.
//

// Shared session/protected-store fixtures cover all invitation types and delayed replies.
// swiftlint:disable file_length

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

    private func makeAPI(session: URLSession = TestSession.make()) async throws -> APIClient {
        let client = APIClient(
            environment: .current,
            session: session,
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

@MainActor
extension TokenAcceptViewModelTests {
    private static let leaseToken = String(repeating: "a", count: 64)
    private static let leasePreviewJSON = """
    {"home":{"id":"ddc24300-0000-4000-8000-000000000003",
     "name":"Existing rental",
     "city":"Test"},
     "invitation":{"status":"pending",
     "proposed_start":"2026-09-15T00:00:00+00:00",
     "proposed_end":"2027-09-15T00:00:00+00:00",
     "expires_at":"2099-01-01T00:00:00+00:00"},
     "account_email":"alice@example.com"}
    """
    private static let leaseReceiptJSON = """
    {"lease":{"id":"ddc24300-0000-4000-8000-000000000006",
     "home_id":"ddc24300-0000-4000-8000-000000000003",
     "primary_resident_user_id":"ddc24300-0000-4000-8000-000000000001",
     "state":"active"},
     "occupancy":{"id":"ddc24300-0000-4000-8000-000000000005",
     "home_id":"ddc24300-0000-4000-8000-000000000003",
     "user_id":"ddc24300-0000-4000-8000-000000000001",
     "is_active":true,
     "verification_status":"verified"}}
    """

    func testLeaseLinkUsesOnlyRecipientPreviewAndRequiresExplicitAcceptance() async throws {
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
        let vm = try await TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: makeAPI())
        await vm.load()
        guard case let .ready(offer) = vm.state else { return XCTFail("Expected existing invitation frame") }
        XCTAssertEqual(offer.inviteType, .leaseInvite)
        XCTAssertEqual(offer.identityChip.label, "alice@example.com")
        XCTAssertEqual(offer.benefits, ["Starts: 2026-09-15", "Ends: 2027-09-15"])
        XCTAssertEqual(offer.secondaryCtaLabel, "Not now")
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.url?.absoluteString.contains(Self.leaseToken) == true })
        let requests = URLProtocolStub.capturedRequests.filter { $0.url?.path.contains("invite") == true }
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.httpMethod, "POST")
        XCTAssertEqual(requests.first?.url?.path, "/api/v1/tenant/preview-invite")
    }

    func testLeaseAcceptanceRequiresMatchingCurrentMembership() async throws {
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
        URLProtocolStub.stub(path: "/api/v1/tenant/accept-invite", response: .json(Self.leaseReceiptJSON))
        let vm = try await TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: makeAPI())
        await vm.load()
        await vm.accept()
        guard case let .accepted(offer, message) = vm.state else { return XCTFail("Expected confirmed receipt") }
        XCTAssertEqual(offer.inviteType, .leaseInvite)
        XCTAssertEqual(message, "Your lease acceptance is saved.")
    }

    func testLeaseNotNowClosesWithoutAcceptanceOrDeclinePost() async throws {
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
        var closed = false
        let vm = try await TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: makeAPI()) { closed = true }
        await vm.load()
        await vm.decline()
        XCTAssertTrue(closed)
        XCTAssertFalse(URLProtocolStub.capturedRequests
            .contains { $0.url?.path.contains("accept-invite") == true || $0.url?.path.contains("decline") == true })
    }

    func testLeaseLostAcceptanceReplyCanRecheckAndRetryOriginalProof() async throws {
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", responses: [
            .json(Self.leasePreviewJSON), .json(Self.leasePreviewJSON.replacingOccurrences(of: "pending", with: "accepted"))
        ])
        URLProtocolStub.stub(path: "/api/v1/tenant/accept-invite", responses: [.json("{}", status: 503), .json(Self.leaseReceiptJSON)])
        let vm = try await TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: makeAPI())
        await vm.load()
        await vm.accept()
        guard case .error = vm.state else { return XCTFail("Lost reply must not claim acceptance") }
        await vm.load()
        guard case let .ready(offer) = vm.state else { return XCTFail("Expected current preview") }
        XCTAssertEqual(offer.primaryCtaLabel, "Check saved acceptance")
        XCTAssertEqual(URLProtocolStub.capturedRequests.filter { $0.url?.path == "/api/v1/tenant/accept-invite" }.count, 1)
        await vm.accept()
        guard case .accepted = vm.state else { return XCTFail("Expected recovered acceptance") }
    }

    func testLeasePreviewDenialOrFailureNeverShowsAnOffer() async throws {
        let api = try await makeAPI()
        for status in [403, 404, 410, 503] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json("{}", status: status))
            let vm = TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: api)
            await vm.load()
            if status == 410 {
                guard case .expired = vm.state else { return XCTFail("Closed invitation should be terminal") }
            } else {
                guard case .error = vm.state else { return XCTFail("Denied/unavailable preview must hide details") }
            }
            await vm.accept()
            XCTAssertEqual(URLProtocolStub.capturedRequests.count, 1)
        }
    }

    func testLeasePreviewRejectsWrongAccountAndInvalidScope() async throws {
        let api = try await makeAPI()
        for body in [
            Self.leasePreviewJSON.replacingOccurrences(of: "alice@example.com", with: "other@example.com"),
            Self.leasePreviewJSON.replacingOccurrences(of: "ddc24300-0000-4000-8000-000000000003", with: "invalid"),
            Self.leasePreviewJSON.replacingOccurrences(of: "2027-09-15", with: "2025-09-15"),
            Self.leasePreviewJSON.replacingOccurrences(of: "pending", with: "revoked")
        ] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(body))
            let vm = TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: api)
            await vm.load()
            guard case .error = vm.state else { return XCTFail("Invalid preview must not offer acceptance") }
        }
    }

    func testLeaseAcceptanceRejectsMismatchedHomeActorOrInactiveMembership() async throws {
        let api = try await makeAPI()
        for body in [
            Self.leaseReceiptJSON.replacingOccurrences(
                of: "ddc24300-0000-4000-8000-000000000003",
                with: "ddc24300-0000-4000-8000-000000000099"
            ),
            Self.leaseReceiptJSON.replacingOccurrences(
                of: "ddc24300-0000-4000-8000-000000000001",
                with: "ddc24300-0000-4000-8000-000000000099"
            ),
            Self.leaseReceiptJSON.replacingOccurrences(of: "true", with: "false"),
            Self.leaseReceiptJSON.replacingOccurrences(of: "verified", with: "provisional")
        ] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
            URLProtocolStub.stub(path: "/api/v1/tenant/accept-invite", response: .json(body))
            let vm = TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: api)
            await vm.load()
            await vm.accept()
            guard case .error = vm.state else { return XCTFail("Invalid acceptance receipt must not report success") }
        }
    }

    func testLeaseCloseRetiresLoadedOfferAndCannotAccept() async throws {
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
        let vm = try await TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: makeAPI())
        await vm.load()
        vm.close()
        await vm.accept()
        guard case .loading = vm.state else { return XCTFail("Close must clear old offer") }
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.url?.path == "/api/v1/tenant/accept-invite" })
    }
}

private final class LeaseInvitationDelayedProtocol: URLProtocol {
    private nonisolated(unsafe) static var path = ""
    private nonisolated(unsafe) static var pending: [LeaseInvitationDelayedProtocol] = []
    private static let lock = NSLock()
    static func hold(_ target: String) {
        lock.lock()
        defer { lock.unlock() }
        path = target
        pending = []
    }

    static var hasPending: Bool {
        lock.lock()
        defer { lock.unlock() }
        return !pending.isEmpty
    }

    static func release(_ body: String) {
        lock.lock()
        let replies = pending
        pending = []
        path = ""
        lock.unlock()
        for instance in replies {
            guard let url = instance.request.url,
                  let response = HTTPURLResponse(
                      url: url,
                      statusCode: 200,
                      httpVersion: nil,
                      headerFields: ["Content-Type": "application/json"]
                  ) else { continue }
            instance.client?.urlProtocol(instance, didReceive: response, cacheStoragePolicy: .notAllowed)
            instance.client?.urlProtocol(instance, didLoad: Data(body.utf8))
            instance.client?.urlProtocolDidFinishLoading(instance)
        }
    }

    override static func canInit(with request: URLRequest) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return request.url?.path == path
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        Self.lock.lock()
        Self.pending.append(self)
        Self.lock.unlock()
    }

    override func stopLoading() {}
}

@MainActor
extension TokenAcceptViewModelTests {
    private func delayedLeaseAPI() async throws -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [LeaseInvitationDelayedProtocol.self, URLProtocolStub.self]
        return try await makeAPI(session: URLSession(configuration: config))
    }

    private func waitForLeaseReply() async throws {
        for _ in 0..<500 {
            if LeaseInvitationDelayedProtocol.hasPending { return }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTFail("Expected a held lease request")
        throw APIError.invalidResponse
    }

    func testDeliveredLeasePreviewAfterCloseCannotRestorePrivateOffer() async throws {
        let api = try await delayedLeaseAPI()
        LeaseInvitationDelayedProtocol.hold("/api/v1/tenant/preview-invite")
        defer { LeaseInvitationDelayedProtocol.release(Self.leasePreviewJSON) }
        let vm = TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: api)
        let pending = Task { await vm.load() }
        try await waitForLeaseReply()
        vm.close()
        LeaseInvitationDelayedProtocol.release(Self.leasePreviewJSON)
        await pending.value
        guard case .loading = vm.state else { return XCTFail("Closed offer must stay retired") }
        await vm.accept()
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.url?.path == "/api/v1/tenant/accept-invite" })
    }

    func testDeliveredLeaseAcceptanceAfterCloseCannotReportSuccess() async throws {
        let api = try await delayedLeaseAPI()
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
        let vm = TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: api)
        await vm.load()
        LeaseInvitationDelayedProtocol.hold("/api/v1/tenant/accept-invite")
        defer { LeaseInvitationDelayedProtocol.release(Self.leaseReceiptJSON) }
        let pending = Task { await vm.accept() }
        try await waitForLeaseReply()
        vm.close()
        LeaseInvitationDelayedProtocol.release(Self.leaseReceiptJSON)
        await pending.value
        guard case .loading = vm.state else { return XCTFail("Closed acceptance must stay retired") }
    }

    func testDeliveredLeaseAcceptanceAfterSignOutCannotReportSuccess() async throws {
        let api = try await delayedLeaseAPI()
        URLProtocolStub.stub(path: "/api/v1/tenant/preview-invite", response: .json(Self.leasePreviewJSON))
        let vm = TokenAcceptViewModel(token: Self.leaseToken, leaseInvitation: true, api: api)
        await vm.load()
        LeaseInvitationDelayedProtocol.hold("/api/v1/tenant/accept-invite")
        defer { LeaseInvitationDelayedProtocol.release(Self.leaseReceiptJSON) }
        let pending = Task { await vm.accept() }
        try await waitForLeaseReply()
        await api.authProvider?.signOut()
        LeaseInvitationDelayedProtocol.release(Self.leaseReceiptJSON)
        await pending.value
        if case .accepted = vm.state { XCTFail("An old account cannot publish acceptance") }
    }

    func testLeaseProofBodiesStayAuthenticatedAndOffURLs() throws {
        for endpoint in [
            TokenAcceptEndpoints.leaseInvite(token: Self.leaseToken),
            TokenAcceptEndpoints.acceptLeaseInvite(token: Self.leaseToken)
        ] {
            XCTAssertEqual(endpoint.method, .post)
            XCTAssertTrue(endpoint.authenticated)
            XCTAssertTrue(endpoint.query.isEmpty)
            XCTAssertFalse(endpoint.path.contains(Self.leaseToken))
            let body = try XCTUnwrap(endpoint.body)
            let fields = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(body)) as? [String: String])
            XCTAssertEqual(fields, ["token": Self.leaseToken])
        }
    }
}
