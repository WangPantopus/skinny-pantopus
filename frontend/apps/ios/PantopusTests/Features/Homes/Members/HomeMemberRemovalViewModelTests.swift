import XCTest
@testable import Pantopus

@MainActor
private final class RemovalFaultStore: PendingHomeMemberRemovalStoring {
    var saved: PendingHomeMemberRemoval?
    var failLoad = false
    var failOriginal = false
    var failProof = false
    var loseClearReply = false
    var originalSaved: ((PendingHomeMemberRemoval) throws -> Void)?
    func load(scope: HomeCreationScope) throws -> PendingHomeMemberRemoval? {
        guard !failLoad, saved == nil || saved?.matches(scope) == true else { throw HomeMemberRemovalError.storage }
        return saved
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeMemberRemoval?, next: PendingHomeMemberRemoval?) throws {
        guard try load(scope: scope) == expected else { throw HomeMemberRemovalError.changed }
        if expected == nil && next != nil && failOriginal { throw HomeMemberRemovalError.storage }
        if next?.outcome != nil && failProof { throw HomeMemberRemovalError.storage }
        saved = next
        if expected == nil, let next { try originalSaved?(next) }
        if next == nil && loseClearReply { throw HomeMemberRemovalError.storage }
    }
}

@MainActor
final class HomeMemberRemovalViewModelTests: XCTestCase {
    private let home = "ddc25300-0000-4000-8000-000000000003"
    private let actor = "ddc25300-0000-4000-8000-000000000001"
    private let targetId = "ddc25300-0000-4000-8000-000000000002"
    private let occupancy = "ddc25300-0000-4000-8000-000000000004"
    private let token = String(repeating: "b", count: 64)
    private let base = "/api/homes/member-removals"
    private var liveScope = String(repeating: "c", count: 64)
    private var managers: [AuthManager] = []
    private var directories: [URL] = []
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
        liveScope = String(repeating: "c", count: 64)
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
        .object(["actor_id": .string(actor), "session_scope": .string(liveScope)])
    }

    private var target: HomeMemberRemovalTarget {
        .init(homeId: home, userId: targetId)
    }

    private var context: JSONValue {
        .object([
            "home_id": .string(home), "target_user_id": .string(targetId), "occupancy_id": .string(occupancy),
            "action": .string("remove"), "decision_token": .string(token), "session": session,
            "home": .object(["id": .string(home), "name": .string("Reviewed Home")]),
            "target": .object([
                "id": .string(targetId), "name": .null, "username": .string("reviewed_member"), "role_base": .string("member"),
                "is_self": .bool(false), "is_active": .bool(true), "verification_status": .string("verified"),
                "start_at": .string("2026-09-12T00:00:00Z"), "end_at": .null, "access_start_at": .null, "access_end_at": .null
            ])
        ])
    }

    private func stub(_ path: String, _ value: JSONValue, status: Int = 200) throws {
        URLProtocolStub.stubs.removeAll { $0.pathSuffix == path }
        let text = try XCTUnwrap(String(data: HomeMemberRemovalValidation.encode(value), encoding: .utf8))
        URLProtocolStub.stub(path: path, response: .json(text, status: status))
    }

    private func makeAPI(retries: RetryPolicy = .none) async throws -> APIClient {
        let api = APIClient(environment: .current, session: TestSession.make(), retryPolicy: retries)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("removal-auth-" + UUID().uuidString)
        directories.append(directory)
        let manager = AuthManager(
            store: InMemorySecureStore(), apiClient: api, installMarker: InstallMarker(directory: directory), allowSecureEnclave: false
        )
        managers.append(manager)
        let login = Fixtures.loginJSON(sessionId: "removal-unit", expiresAt: Int(Date().timeIntervalSince1970) + 3600)
            .replacingOccurrences(of: "u_123", with: actor)
        URLProtocolStub.stub(path: "/api/users/login", response: .json(login))
        try await manager.signIn(email: "alice@example.com", password: "synthetic-password")
        await manager.awaitBackgroundWork()
        try stub(base + "/session", .object(["session": session]))
        try stub(base + "/context", context)
        try stub(base + "/commands", .object(["state": .string("error"), "code": .string("MEMBER_REMOVAL_UNAVAILABLE")]), status: 503)
        return api
    }

    private func model(_ store: RemovalFaultStore) async throws -> HomeMemberRemovalViewModel {
        let api = try await makeAPI()
        let model = HomeMemberRemovalViewModel(target: target, api: api, store: store)
        await model.open()
        return model
    }

    private func receipt(_ original: PendingHomeMemberRemoval, state: String = "completed", code: String? = nil) -> JSONValue {
        var fields = original.fields.filter { $0.key != "request_id" }
        fields["state"] = .string(state)
        fields["completed_at"] = state == "completed" ? .string("2026-09-13T00:00:00Z") : .null
        fields["code"] = code.map(JSONValue.string) ?? .null
        fields["status"] = code.flatMap { HomeMemberRemovalValidation.rejections[$0] }.map { .number(Double($0)) } ?? .null
        fields["session"] = session
        fields["command"] = .object([
            "actor_id": .string(actor), "request_id": .string(original.requestId),
            "created_at": .string("2026-09-13T00:00:00Z"), "updated_at": .string("2026-09-13T00:00:00Z")
        ])
        return .object(fields)
    }

    private func submit(_ model: HomeMemberRemovalViewModel) async throws {
        let review = try XCTUnwrap(model.context)
        await model.submit(reviewedToken: review.token, lifetime: model.generation)
    }

    private var posts: [URLRequest] {
        URLProtocolStub.capturedRequests.filter { $0.url?.path == base + "/commands" && $0.httpMethod == "POST" }
    }
}

extension HomeMemberRemovalViewModelTests {
    func testReviewAndLocalCancellationIssueNoMembershipMutation() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        XCTAssertTrue(model.canSubmit)
        XCTAssertEqual(try HomeMemberRemovalValidation.targetLabel(XCTUnwrap(model.context).summary), "reviewed_member")
        model.suspend()
        XCTAssertNil(store.saved)
        XCTAssertTrue(posts.isEmpty)
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.httpMethod == "DELETE" })
    }

    func testOriginalWriteFailureAndCorruptLoadCannotPermitDispatchOrReplacement() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        store.failOriginal = true
        try await submit(model)
        XCTAssertNil(store.saved)
        XCTAssertFalse(model.canSubmit)
        XCTAssertTrue(posts.isEmpty)
        store.failLoad = true
        await model.open()
        XCTAssertFalse(model.opened)
        XCTAssertNil(model.context)
        XCTAssertNotNil(model.errorMessage)
    }

    func testLostReplyColdUnknownStatusAndExplicitRetryKeepExactOriginalBytes() async throws {
        let store = RemovalFaultStore()
        let first = try await model(store)
        try await submit(first)
        let original = try XCTUnwrap(store.saved)
        let originalBytes = try XCTUnwrap(posts.first?.authTestBodyData())
        first.suspend()
        liveScope = String(repeating: "d", count: 64)
        let api = try await makeAPI()
        let reopened = HomeMemberRemovalViewModel(api: api, store: store)
        try stub(
            base + "/commands/" + original.requestId,
            .object(["state": .string("unknown"), "code": .string("MEMBER_REMOVAL_NOT_FOUND"), "session": session]),
            status: 404
        )
        await reopened.open()
        XCTAssertEqual(reopened.pending, original)
        XCTAssertFalse(reopened.canAcknowledge)
        XCTAssertEqual(posts.count, 1)
        try stub(base + "/commands", receipt(original))
        await reopened.recover(.retry, requestId: original.requestId, lifetime: reopened.generation)
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(posts.last?.authTestBodyData(), originalBytes)
        XCTAssertEqual(reopened.pending?.outcome?.state, "completed")
        XCTAssertNil(reopened.pending?.outcome?.fields["session"])
    }

    func testPostDoesNotInheritLegacyDeleteTransientRetries() async throws {
        let store = RemovalFaultStore()
        let api = try await makeAPI(retries: .default)
        let model = HomeMemberRemovalViewModel(target: target, api: api, store: store)
        await model.open()
        try await submit(model)
        XCTAssertEqual(posts.count, 1)
        XCTAssertNotNil(store.saved)
        XCTAssertNil(store.saved?.outcome)
    }

    func testUnseenCancellationBindsOriginalAndCannotUndoCompletion() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        try stub(base + "/commands/" + original.requestId + "/cancel", receipt(original, state: "cancelled"))
        await model.recover(.cancel, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(model.pending?.outcome?.state, "cancelled")
        let request = try XCTUnwrap(URLProtocolStub.capturedRequests.last { $0.url?.path.hasSuffix("/cancel") == true })
        let body = try JSONDecoder().decode(JSONValue.self, from: XCTUnwrap(request.authTestBodyData()))
        XCTAssertEqual(body, .object(original.fields.filter { $0.key != "request_id" }))
        XCTAssertEqual(posts.count, 1)
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.httpMethod == "DELETE" })
        let acknowledged = await model.acknowledge(requestId: original.requestId)
        XCTAssertNotNil(acknowledged)
        XCTAssertNil(store.saved)
    }

    func testKnownProofWriteFailureRepairsWithoutAnotherPostAndLostClearReplyReconciles() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        store.failProof = true
        store.originalSaved = { try self.stub(self.base + "/commands", self.receipt($0)) }
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        XCTAssertNil(original.outcome)
        XCTAssertFalse(model.canAcknowledge)
        model.suspend()
        await model.open()
        store.failProof = false
        await model.recover(.cancel, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(model.pending?.outcome?.state, "completed")
        XCTAssertEqual(posts.count, 1)
        XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.url?.path.hasSuffix("/cancel") == true })
        store.loseClearReply = true
        let acknowledged = await model.acknowledge(requestId: original.requestId)
        XCTAssertNotNil(acknowledged)
        XCTAssertNil(store.saved)
    }

    func testRetirementBeforeDispatchPreservesOriginalAndStaleConfirmationCannotSubmit() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        let oldGeneration = model.generation
        model.suspend()
        await model.open()
        await model.submit(reviewedToken: token, lifetime: oldGeneration)
        XCTAssertTrue(posts.isEmpty)
        store.originalSaved = { _ in model.suspend() }
        try await submit(model)
        XCTAssertNotNil(store.saved)
        XCTAssertTrue(posts.isEmpty)
        XCTAssertNil(model.pending)
    }

    func testAnotherHomeRecoversOriginalWithoutPreparingNewTarget() async throws {
        let store = RemovalFaultStore()
        let first = try await model(store)
        try await submit(first)
        let original = try XCTUnwrap(store.saved)
        first.suspend()
        let other = HomeMemberRemovalTarget(homeId: "ddc25300-0000-4000-8000-000000000009", userId: actor)
        let api = try await makeAPI()
        let second = HomeMemberRemovalViewModel(target: other, api: api, store: store)
        let readsBefore = URLProtocolStub.capturedRequests.filter { $0.url?.path == base + "/context" }.count
        await second.open()
        XCTAssertTrue(second.recoveringAnotherTarget)
        XCTAssertEqual(second.pending?.bodyData, original.bodyData)
        XCTAssertFalse(second.canSubmit)
        XCTAssertEqual(URLProtocolStub.capturedRequests.filter { $0.url?.path == base + "/context" }.count, readsBefore)
    }

    func testLogoutHidesOriginalAndBlocksRetryWithoutErasingIt() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        URLProtocolStub.stub(path: "/api/users/logout", response: .json("{}"))
        let manager = try XCTUnwrap(managers.last)
        await manager.signOut()
        await manager.awaitBackgroundWork()
        XCTAssertFalse(model.isCurrent)
        XCTAssertNil(model.pending)
        await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(store.saved, original)
        XCTAssertEqual(posts.count, 1)
    }

    func testServerSessionChangeRetiresScreenWithoutErasingOriginal() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        try stub(base + "/commands/" + original.requestId, .object(["code": .string("SESSION_SCOPE_CHANGED")]), status: 409)
        await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
        XCTAssertFalse(model.isCurrent)
        XCTAssertNil(model.pending)
        XCTAssertEqual(store.saved, original)
    }

    func testDurableRejectionRemainsAcknowledgableWithoutCurrentManagerAccess() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        store.originalSaved = { original in
            try self.stub(
                self.base + "/commands",
                self.receipt(original, state: "rejected", code: "MEMBERS_MANAGE_REQUIRED"),
                status: 403
            )
        }
        try await submit(model)
        let original = try XCTUnwrap(model.pending)
        XCTAssertEqual(original.outcome?.state, "rejected")
        XCTAssertTrue(model.canAcknowledge)
        try stub(
            base + "/context",
            .object(["state": .string("error"), "code": .string("MEMBERS_MANAGE_REQUIRED"), "session": session]),
            status: 403
        )
        let acknowledged = await model.acknowledge(requestId: original.requestId)
        XCTAssertNotNil(acknowledged)
        XCTAssertEqual(posts.count, 1)
    }

    func testCompetingPreparedScreenCannotReplaceSavedOriginal() async throws {
        let store = RemovalFaultStore()
        let api = try await makeAPI()
        let first = HomeMemberRemovalViewModel(target: target, api: api, store: store)
        let second = HomeMemberRemovalViewModel(target: target, api: api, store: store)
        await first.open()
        await second.open()
        var competing: Task<Void, Never>?
        store.originalSaved = { _ in competing = Task { await second.submit(reviewedToken: self.token, lifetime: second.generation) } }
        try await submit(first)
        await competing?.value
        XCTAssertEqual(posts.count, 1)
        let original = try XCTUnwrap(store.saved)
        XCTAssertNotNil(second.errorMessage)
        await second.submit(reviewedToken: token, lifetime: second.generation)
        XCTAssertEqual(store.saved, original)
        XCTAssertEqual(posts.count, 1)
    }

    func testHTTPStatusSessionAndMismatchedReceiptNeverBecomeAcknowledgableProof() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        var wrongIdentity = try XCTUnwrap(receipt(original).dictValue)
        wrongIdentity["target_user_id"] = .string(actor)
        var wrongSession = try XCTUnwrap(receipt(original).dictValue)
        wrongSession["session"] = .object(["actor_id": .string(actor), "session_scope": .string(String(repeating: "d", count: 64))])
        var readReplay = try XCTUnwrap(receipt(original).dictValue)
        readReplay["replayed"] = .bool(true)
        let cases: [(JSONValue, Int)] = [
            (receipt(original), 403),
            (receipt(original, state: "rejected", code: "MEMBER_NOT_FOUND"), 200),
            (.object(wrongIdentity), 200), (.object(wrongSession), 200), (.object(readReplay), 200)
        ]
        for (value, status) in cases {
            try stub(base + "/commands/" + original.requestId, value, status: status)
            await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
            XCTAssertEqual(store.saved, original)
            XCTAssertFalse(model.canAcknowledge)
            XCTAssertNotNil(model.errorMessage)
        }
        XCTAssertEqual(posts.count, 1)
    }

    func testMalformedSessionReadRetainsOriginalWithoutRetiringAuthenticatedAccount() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        try stub(base + "/session", .object(["session": .bool(false)]))
        await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
        XCTAssertTrue(model.isCurrent)
        XCTAssertEqual(store.saved, original)
        XCTAssertEqual(posts.count, 1)
        XCTAssertNotNil(model.errorMessage)
    }

    func testSettingsSelfLeaveUsesProtectedReviewAndAcknowledgesOnlyItsOwnCompletedOriginal() async throws {
        let store = RemovalFaultStore()
        let api = try await makeAPI()
        var ownContext = try XCTUnwrap(context.dictValue)
        ownContext["target_user_id"] = .string(actor)
        var ownTarget = try XCTUnwrap(ownContext["target"]?.dictValue)
        ownTarget["id"] = .string(actor)
        ownTarget["is_self"] = .bool(true)
        ownTarget["username"] = .string("signed_in_member")
        ownContext["target"] = .object(ownTarget)
        try stub(base + "/context", .object(ownContext))
        let leave = LeaveHomeViewModel(homeId: home, api: api, store: store)
        await leave.removal.open()
        XCTAssertTrue(leave.removal.canSubmit)
        let request = try XCTUnwrap(URLProtocolStub.capturedRequests.last { $0.url?.path == base + "/context" })
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: XCTUnwrap(request.authTestBodyData())), .object([
            "home_id": .string(home), "target_user_id": .string(actor)
        ]))
        XCTAssertTrue(posts.isEmpty)
        store.originalSaved = { try self.stub(self.base + "/commands", self.receipt($0)) }
        try await submit(leave.removal)
        let completed = try XCTUnwrap(store.saved)
        XCTAssertTrue(leave.acknowledgedSelfRemoval(completed))
        var rejected = completed
        rejected.outcome = HomeMemberRemovalOutcome(value: receipt(completed, state: "rejected", code: "TRANSFER_REQUIRED")).projected()
        XCTAssertFalse(leave.acknowledgedSelfRemoval(rejected))
        XCTAssertFalse(leave.acknowledgedSelfRemoval(nil))
        let otherHome = LeaveHomeViewModel(homeId: "ddc25300-0000-4000-8000-000000000009", api: api, store: store)
        XCTAssertFalse(otherHome.acknowledgedSelfRemoval(completed))
        XCTAssertEqual(posts.count, 1)
        XCTAssertFalse(URLProtocolStub.capturedRequests
            .contains { $0.httpMethod == "DELETE" || $0.url?.path.hasSuffix("/move-out") == true })
    }

    func testReservedPendingProofCanRecoverAfterTerminalPersistenceFailure() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        store.originalSaved = { try self.stub(self.base + "/commands", self.receipt($0, state: "pending")) }
        try await submit(model)
        let original = try XCTUnwrap(store.saved)
        XCTAssertEqual(original.outcome?.state, "pending")
        XCTAssertFalse(model.canAcknowledge)
        try stub(base + "/commands/" + original.requestId, receipt(original))
        store.failProof = true
        await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(store.saved, original)
        XCTAssertFalse(model.canAcknowledge)
        store.failProof = false
        let readCount = URLProtocolStub.capturedRequests.count
        await model.recover(.cancel, requestId: original.requestId, lifetime: model.generation)
        XCTAssertEqual(store.saved?.outcome?.state, "completed")
        XCTAssertTrue(model.canAcknowledge)
        XCTAssertEqual(URLProtocolStub.capturedRequests.count, readCount)
        XCTAssertEqual(posts.count, 1)
    }

    func testLogoutImmediatelyRetiresPreparedIdentityBeforeViewLifecycleCallback() async throws {
        let store = RemovalFaultStore()
        let model = try await model(store)
        XCTAssertNotNil(model.context)
        URLProtocolStub.stub(path: "/api/users/logout", response: .json("{}"))
        let manager = try XCTUnwrap(managers.last)
        await manager.signOut()
        await manager.awaitBackgroundWork()
        XCTAssertFalse(model.isCurrent)
        XCTAssertNil(model.context, "The getter itself must hide the prior account review")
        XCTAssertFalse(model.canSubmit)
        XCTAssertNil(store.saved)
        XCTAssertTrue(posts.isEmpty)
    }
}
