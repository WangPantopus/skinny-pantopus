import XCTest
@testable import Pantopus

@MainActor
private final class SenderFaultStore: PendingHomeInvitationSenderStoring {
    var saved: PendingHomeInvitationSender?
    var failOriginal = false
    var failProof = false
    var loseClearReply = false
    var failLoad = false
    var originalSaved: ((PendingHomeInvitationSender) throws -> Void)?
    func load(scope: HomeCreationScope) throws -> PendingHomeInvitationSender? {
        guard !failLoad, saved == nil || saved?.matches(scope) == true else { throw HomeInvitationSenderError.storage }
        return saved
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeInvitationSender?, next: PendingHomeInvitationSender?) throws {
        guard try load(scope: scope) == expected else { throw HomeInvitationSenderError.changed }
        if expected == nil && next != nil && failOriginal { throw HomeInvitationSenderError.storage }
        if next?.outcome != nil && failProof { throw HomeInvitationSenderError.storage }
        saved = next
        if expected == nil, let next { try originalSaved?(next) }
        if next == nil && loseClearReply { throw HomeInvitationSenderError.storage }
    }
}

@MainActor
final class InviteMemberWizardViewModelTests: XCTestCase {
    private let home = "ddc24300-0000-4000-8000-000000000003"
    private let actor = "ddc24300-0000-4000-8000-000000000001"
    private let invitation = "ddc24300-0000-4000-8000-000000000002"
    private let decisionToken = String(repeating: "b", count: 64)
    private let base = "/api/homes/invitations/sender"
    private var managers: [AuthManager] = []
    private var directories: [URL] = []
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    override func tearDown() {
        managers.removeAll()
        for directory in directories {
            try? FileManager.default.removeItem(at: directory)
        }
        directories.removeAll()
        super.tearDown()
    }

    private var session: JSONValue {
        .object(["actor_id": .string(actor), "session_scope": .string(String(repeating: "c", count: 64))])
    }

    private func json(_ value: JSONValue) throws -> String {
        try XCTUnwrap(String(data: HomeInvitationSenderValidation.encode(value), encoding: .utf8))
    }

    private func makeAPI() async throws -> APIClient {
        let api = APIClient(environment: .current, session: TestSession.make(), retryPolicy: .none)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sender-auth-" + UUID().uuidString)
        directories.append(directory)
        let manager = AuthManager(
            store: InMemorySecureStore(),
            apiClient: api,
            installMarker: InstallMarker(directory: directory),
            allowSecureEnclave: false
        )
        managers.append(manager)
        let login = Fixtures.loginJSON(sessionId: "sender-unit", expiresAt: Int(Date().timeIntervalSince1970) + 3600)
            .replacingOccurrences(of: "u_123", with: actor)
        URLProtocolStub.stub(path: "/api/users/login", response: .json(login))
        try await manager.signIn(email: "alice@example.com", password: "synthetic-password")
        await manager.awaitBackgroundWork()
        try URLProtocolStub.stub(path: base + "/session", response: .json(json(.object(["session": session]))))
        return api
    }

    private func model(
        _ store: SenderFaultStore,
        action: HomeInvitationSenderAction = .create
    ) async throws -> InviteMemberWizardViewModel {
        let api = try await makeAPI()
        let target = HomeInvitationSenderTarget(action: action, invitationId: action == .create ? nil : invitation)
        let model = InviteMemberWizardViewModel(homeId: home, target: target, api: api, store: store)
        let preview: JSONValue = action == .create ? .null : .object([
            "id": .string(invitation), "home_id": .string(home), "status": .string("pending"),
            "proposed_role": .string("guest"), "proposed_role_base": .string("member"),
            "proposed_preset_key": action == .resend ? .string("household_member") : .null,
            "invitee_email": .string("recipient@example.invalid")
        ])
        let context: JSONValue = .object([
            "home_id": .string(home),
            "action": .string(action.rawValue),
            "decision_token": .string(decisionToken),
            "invitation": preview,
            "session": session
        ])
        try URLProtocolStub.stub(path: base + "/context", response: .json(json(context)))
        await model.open()
        if action == .create { model.email = "recipient@example.invalid"
            model.message = "Original note"
            await model.prepare()
        }
        return model
    }

    private func receipt(_ original: PendingHomeInvitationSender, state: String = "completed", action: String? = nil) -> JSONValue {
        let delivered = state == "completed" && original.action != .withdraw
        var row: [String: JSONValue] = [
            "home_id": .string(original.homeId),
            "invitation_id": state == "completed" || original.action != .create ? .string(invitation) : .null,
            "action": action.map(JSONValue.string) ?? original.fields["action"] ?? .null,
            "decision_token": original.fields["decision_token"] ?? .null, "state": .string(state), "session": session,
            "command": .object([
                "actor_id": .string(actor),
                "request_id": .string(original.requestId),
                "created_at": .string("2026-09-12T00:00:00Z"),
                "updated_at": .string("2026-09-12T00:00:00Z")
            ]),
            "delivery": .object([
                "email": .string(delivered ? "unconfirmed" : "not_requested"),
                "in_app": .string(delivered ? "saved" : "not_requested")
            ])
        ]
        if state == "rejected" { row["code"] = .string("INVITE_SENDER_CHANGED") }
        return .object(row)
    }

    private func submit(_ model: InviteMemberWizardViewModel) async throws {
        let context = try XCTUnwrap(model.context)
        await model.submit(reviewedToken: context.token, lifetime: model.generation)
    }

    private var commandPosts: [URLRequest] {
        URLProtocolStub.capturedRequests.filter { $0.url?.path == base + "/commands" && $0.httpMethod == "POST" }
    }

    func testReviewDoesNotSubmitAndSavedCreationShowsTruthfulDelivery() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        XCTAssertTrue(commandPosts.isEmpty)
        store.originalSaved = { original in
            try URLProtocolStub.stub(path: self.base + "/commands", response: .json(self.json(self.receipt(original)), status: 201))
        }
        try await submit(model)
        let original = try XCTUnwrap(model.pending)
        XCTAssertEqual(original.outcome?.state, "completed")
        XCTAssertEqual(original.recipient, "recipient@example.invalid")
        XCTAssertEqual(commandPosts.count, 1)
        XCTAssertEqual(commandPosts.first?.authTestBodyData(), original.bodyData)
        XCTAssertTrue(original.outcome?.deliveryMessage.contains("Email delivery is unconfirmed") == true)
        XCTAssertTrue(original.outcome?.deliveryMessage.contains("push delivery is not confirmed") == true)
        XCTAssertFalse(model.canPrepare)
    }

    func testProtectedWriteFailurePreventsPostAndDoesNotOfferReplacement() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        store.failOriginal = true
        try await submit(model)
        XCTAssertTrue(commandPosts.isEmpty)
        XCTAssertFalse(model.canPrepare)
        XCTAssertNotNil(model.errorMessage)
    }

    func testLostReplyColdReadFailureAndRetryRetainExactOriginalBytes() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        let firstBytes = try XCTUnwrap(commandPosts.first?.authTestBodyData())
        model.suspend()
        await model.open()
        XCTAssertEqual(model.pending?.bodyData, original.bodyData)
        XCTAssertNotNil(model.errorMessage)
        try URLProtocolStub.stub(path: base + "/commands", response: .json(json(receipt(original))))
        await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(model.pending?.outcome?.state, "completed")
        XCTAssertEqual(commandPosts.count, 2)
        XCTAssertEqual(commandPosts.last?.authTestBodyData(), firstBytes)
    }

    func testUnseenCancellationDoesNotCreateOrWithdrawInvitation() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        try URLProtocolStub.stub(
            path: base + "/commands/" + original.requestId + "/cancel",
            response: .json(json(receipt(original, state: "cancelled")))
        )
        await model.recover(.cancel, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(model.pending?.outcome?.state, "cancelled")
        XCTAssertEqual(commandPosts.count, 1)
        let cancel = try XCTUnwrap(URLProtocolStub.capturedRequests.last { $0.url?.path.hasSuffix("/cancel") == true })
        let body = try XCTUnwrap(cancel.authTestJSONBody())
        XCTAssertNil(body["request_id"])
        XCTAssertEqual(body["token"] as? String, original.token)
        XCTAssertEqual(body["action"] as? String, "create")
        let acknowledged = await model.acknowledge(requestId: original.requestId)
        XCTAssertNotNil(acknowledged)
        XCTAssertNil(store.saved)
    }

    func testProofWriteFailureRepairsWithoutAnotherPostAndLostClearReplyReconciles() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        store.failProof = true
        store.originalSaved = { original in
            try URLProtocolStub.stub(path: self.base + "/commands", response: .json(self.json(self.receipt(original))))
        }
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        XCTAssertNil(original.outcome)
        store.failProof = false
        await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(model.pending?.outcome?.state, "completed")
        XCTAssertEqual(commandPosts.count, 1)
        store.loseClearReply = true
        let acknowledged = await model.acknowledge(requestId: original.requestId)
        XCTAssertNotNil(acknowledged)
        XCTAssertNil(store.saved)
    }

    func testBackgroundRetiresPreparedConfirmation() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        let context = try XCTUnwrap(model.context)
        let lifetime = model.generation
        model.suspend()
        await model.open()
        await model.submit(reviewedToken: context.token, lifetime: lifetime)
        XCTAssertTrue(commandPosts.isEmpty)
        XCTAssertNil(store.saved)
    }

    func testChangedFormCannotSubmitAnEarlierReview() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        model.email = "other@example.invalid"
        try await submit(model)
        XCTAssertTrue(commandPosts.isEmpty)
        XCTAssertNil(store.saved)
    }

    func testMismatchedReceiptCannotBecomeTerminalProof() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        store.originalSaved = { original in
            try URLProtocolStub.stub(path: self.base + "/commands", response: .json(self.json(self.receipt(original, action: "withdraw"))))
        }
        try await submit(model)
        XCTAssertNil(model.pending?.outcome)
        XCTAssertNotNil(model.errorMessage)
        XCTAssertFalse(model.canAcknowledge)
    }

    func testWithdrawalTargetsInvitationAndNeverDeletesMembership() async throws {
        let store = SenderFaultStore()
        let model = try await model(store, action: .withdraw)
        store.originalSaved = { original in
            try URLProtocolStub.stub(path: self.base + "/commands", response: .json(self.json(self.receipt(original))))
        }
        try await submit(model)
        let original = try XCTUnwrap(model.pending)
        XCTAssertEqual(original.invitationId, invitation)
        XCTAssertEqual(original.fields["token"], .null)
        XCTAssertEqual(original.review.dictValue?["proposed_preset_key"], .null)
        XCTAssertEqual(original.outcome?.state, "completed")
        XCTAssertFalse(URLProtocolStub.capturedRequests
            .contains { $0.httpMethod == "DELETE" || $0.url?.path.contains("/members/") == true })
    }

    func testResendUsesInvitationIdentityAndProtectedDistinctCapability() async throws {
        let store = SenderFaultStore()
        let model = try await model(store, action: .resend)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        XCTAssertEqual(original.invitationId, invitation)
        XCTAssertNil(original.fields["payload"])
        XCTAssertEqual(original.review.dictValue?["proposed_preset_key"], .string("household_member"))
        XCTAssertTrue(HomeClaimReviewSnapshot.validToken(original.token))
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.url?.path == "/api/homes/" + home + "/invite" })
    }
}

@MainActor
extension InviteMemberWizardViewModelTests {
    func testAnotherHomeRestoresTheOriginalInsteadOfReplacingIt() async throws {
        let store = SenderFaultStore()
        let first = try await model(store)
        try await submit(first)
        let original = try XCTUnwrap(store.saved)
        first.suspend()
        let api = try await makeAPI()
        let second = InviteMemberWizardViewModel(homeId: "ddc24300-0000-4000-8000-000000000009", api: api, store: store)
        await second.open()
        XCTAssertEqual(second.pending?.bodyData, original.bodyData)
        XCTAssertFalse(second.canPrepare)
        XCTAssertEqual(commandPosts.count, 1)
    }

    func testLogoutRetiresVisibilityAndSubmissionWithoutErasingProtectedOriginal() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        let manager = try XCTUnwrap(managers.last)
        URLProtocolStub.stub(path: "/api/users/logout", response: .json("{}"))
        await manager.signOut()
        XCTAssertFalse(model.isCurrent)
        XCTAssertNil(model.pending)
        await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(store.saved?.bodyData, original.bodyData)
        XCTAssertEqual(commandPosts.count, 1)
    }

    func testUnreadableProtectedStorageCannotBeTreatedAsNoOriginal() async throws {
        let store = SenderFaultStore()
        store.failLoad = true
        let model = try await model(store)
        XCTAssertFalse(model.canPrepare)
        XCTAssertTrue(commandPosts.isEmpty)
        XCTAssertNotNil(model.errorMessage)
    }

    func testRejectedPreparedTermsRemainAcknowledgable() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        store.originalSaved = { original in
            try URLProtocolStub.stub(
                path: self.base + "/commands",
                response: .json(self.json(self.receipt(original, state: "rejected")), status: 409)
            )
        }
        try await submit(model)
        XCTAssertEqual(model.pending?.outcome?.state, "rejected")
        XCTAssertTrue(model.canAcknowledge)
        XCTAssertFalse(model.canPrepare)
    }

    func testInvitationSharingNeverCrossesEnvironmentAndRequiresOriginalCapability() throws {
        let token = String(repeating: "a", count: 64)
        func link(_ api: String, _ web: String?) throws -> URL? {
            try HomeInvitationShareURL.make(token: token, apiOrigin: XCTUnwrap(URL(string: api)), configuredWebOrigin: web)
        }
        XCTAssertEqual(try link("https://api.pantopus.app", "https://pantopus.com")?.host, "pantopus.com")
        XCTAssertEqual(try link("https://staging-api.pantopus.com", "https://staging.pantopus.com")?.host, "staging.pantopus.com")
        XCTAssertEqual(try link("http://127.0.0.1:18084", "http://127.0.0.1:18080")?.port, 18080)
        XCTAssertNil(try link("http://127.0.0.1:18084", "https://pantopus.com"))
        XCTAssertNil(try link("https://staging-api.pantopus.com", "https://pantopus.com"))
        XCTAssertNil(try link("https://api.pantopus.app", "https://staging.pantopus.com"))
        XCTAssertNil(try link("https://unknown.example", "https://pantopus.com"))
        XCTAssertNil(try link("https://api.pantopus.app", "https://pantopus.com/?redirect=other"))
        XCTAssertNil(try link("https://api.pantopus.app", nil))
    }
}

@MainActor
extension InviteMemberWizardViewModelTests {
    private var expiredSenderRow: JSONValue {
        .object([
            "id": .string(invitation),
            "home_id": .string(home),
            "status": .string("pending"),
            "invitee_user_id": .string(actor),
            "invitee_email": .null,
            "proposed_role": .string("member"),
            "created_at": .string("2026-01-01T00:00:00Z"),
            "expires_at": .string("2026-01-02T00:00:00Z"),
            "invitee": .object(["id": .string(actor), "name": .string("Reviewed recipient"), "username": .string("recipient")])
        ])
    }

    func testSenderListKeepsExpiredRowsAndDistinctProfileWithCurrentSession() async throws {
        let api = try await makeAPI()
        try URLProtocolStub.stub(path: "/api/homes/" + home + "/invitations", response: .json(json(.object([
            "session": session, "invitations": .array([expiredSenderRow])
        ]))))
        let rows = try await HomeInvitationSenderListLoader.load(homeId: home, api: api)
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows.first?.name, "Reviewed recipient (@recipient)")
        XCTAssertEqual(rows.first?.expiresAt, "2026-01-02T00:00:00Z")
        let request = URLProtocolStub.capturedRequests.last { $0.url?.path == "/api/homes/" + home + "/invitations" }
        XCTAssertEqual(request?.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), String(repeating: "c", count: 64))
    }

    func testSenderListRejectsMalformedAndWrongHomeRowsInsteadOfEmptySuccess() async throws {
        let api = try await makeAPI()
        var wrong = expiredSenderRow.dictValue ?? [:]
        wrong["home_id"] = .string("ddc24300-0000-4000-8000-000000000009")
        try URLProtocolStub.stub(path: "/api/homes/" + home + "/invitations", response: .json(json(.object([
            "session": session, "invitations": .array([.object(wrong)])
        ]))))
        do { _ = try await HomeInvitationSenderListLoader.load(homeId: home, api: api)
            XCTFail("Wrong-Home rows must fail the current list")
        } catch { XCTAssertNotNil(error as? HomeInvitationSenderError) }
    }

    func testSenderListRejectsOtherAccountReceiptAndWrongProfileIdentity() async throws {
        let api = try await makeAPI()
        try URLProtocolStub.stub(path: "/api/homes/" + home + "/invitations", response: .json(json(.object([
            "session": .object(["actor_id": .string(invitation), "session_scope": .string(String(repeating: "c", count: 64))]),
            "invitations": .array([expiredSenderRow])
        ]))))
        do { _ = try await HomeInvitationSenderListLoader.load(homeId: home, api: api)
            XCTFail("Other-account receipts must not appear")
        } catch { XCTAssertNotNil(error as? HomeInvitationSenderError) }
        var wrongProfile = expiredSenderRow.dictValue ?? [:]
        wrongProfile["invitee_user_id"] = .string(invitation)
        XCTAssertNil(HomeInvitationSenderListLoader.invitation(.object(wrongProfile), homeId: home))
    }

    func testHistoricalReceiptNeedsFreshSharingCheckAndFailureOrBackgroundRetiresLink() async throws {
        let store = SenderFaultStore()
        let model = try await model(store)
        store.originalSaved = { original in
            try URLProtocolStub.stub(path: self.base + "/commands", response: .json(self.json(self.receipt(original))))
        }
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        XCTAssertNil(model.shareURL)
        URLProtocolStub.stubs.removeAll { $0.pathSuffix == base + "/context" }
        let context: JSONValue = .object([
            "home_id": .string(home),
            "action": .string("resend"),
            "decision_token": .string(decisionToken),
            "session": session,
            "invitation": .object([
                "id": .string(invitation),
                "home_id": .string(home),
                "status": .string("pending"),
                "proposed_role": .string("member"),
                "proposed_preset_key": .string("household_member"),
                "expires_at": .null
            ])
        ])
        try URLProtocolStub.stub(path: base + "/context", response: .json(json(context)))
        await model.checkSharing(requestId: original.requestId)
        XCTAssertTrue(model.sharingChecked)
        XCTAssertNotNil(model.shareURL)
        XCTAssertLessThanOrEqual(try XCTUnwrap(model.sharingExpiresAt).timeIntervalSinceNow, 60)
        let checks = URLProtocolStub.capturedRequests.filter { $0.url?.path == base + "/context" }.count
        let shared = await model.prepareShare(requestId: original.requestId, lifetime: model.generation)
        XCTAssertNotNil(shared)
        XCTAssertEqual(URLProtocolStub.capturedRequests.filter { $0.url?.path == base + "/context" }.count, checks + 1)
        XCTAssertEqual(commandPosts.count, 1, "Checking sharing must not resend delivery")
        model.suspend()
        XCTAssertNil(model.shareURL)
        await model.open()
        XCTAssertFalse(model.sharingChecked)
        await model.checkSharing(requestId: original.requestId)
        XCTAssertNotNil(model.shareURL)
        URLProtocolStub.stubs.removeAll { $0.pathSuffix == base + "/context" }
        URLProtocolStub.stub(path: base + "/context", response: .json("{\"code\":\"INVITE_EXPIRED\"}", status: 410))
        await model.checkSharing(requestId: original.requestId)
        XCTAssertNil(model.shareURL)
        XCTAssertNotNil(model.errorMessage)
        XCTAssertEqual(model.pending?.outcome?.state, "completed")
        XCTAssertEqual(commandPosts.count, 1)
    }

    func testImpossibleDeliveryProofAndMalformedDatesAreRejected() async throws {
        let store = SenderFaultStore()
        let model = try await model(store, action: .withdraw)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        for state in ["completed", "pending", "cancelled", "rejected"] {
            var response = receipt(original, state: state).dictValue ?? [:]
            response["delivery"] = .object(["email": .string("provider_accepted"), "in_app": .string("saved")])
            XCTAssertFalse(HomeInvitationSenderOutcome(value: .object(response)).matches(original))
        }
        var malformed = expiredSenderRow.dictValue ?? [:]
        malformed["expires_at"] = .string("unparseable")
        XCTAssertFalse(HomeInvitationSenderValidation.summary(malformed))
        XCTAssertNil(HomeInvitationSenderListLoader.invitation(.object(malformed), homeId: home))
    }

    func testEffectiveBaseRoleAndHouseholdApprovalDisplayPreserveRawReview() async throws {
        var row = expiredSenderRow.dictValue ?? [:]
        row["proposed_role"] = .string("guest")
        row["proposed_role_base"] = .string("member")
        row["proposed_preset_key"] = .string("access_request:approved-request")
        XCTAssertTrue(HomeInvitationSenderValidation.summary(row))
        XCTAssertEqual(HomeInvitationSenderValidation.effectiveRole(row), "member")
        XCTAssertEqual(HomeInvitationSenderListLoader.invitation(.object(row), homeId: home)?.role, "member")
        XCTAssertEqual(HomeInvitationSenderValidation.presetLabel(row["proposed_preset_key"]?.stringValue), "Household approval")
        row["proposed_role_base"] = .null
        XCTAssertEqual(HomeInvitationSenderValidation.effectiveRole(row), "guest")
        let store = SenderFaultStore()
        let model = try await model(store, action: .resend)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        XCTAssertEqual(original.review.dictValue?["proposed_role"], .string("guest"))
        XCTAssertEqual(original.review.dictValue?["proposed_role_base"], .string("member"))
        XCTAssertTrue(original.matches(original.scope))
    }
}
