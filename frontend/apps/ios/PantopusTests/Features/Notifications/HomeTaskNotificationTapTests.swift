import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskNotificationTapTests: XCTestCase {
    private let home = "51000000-0000-4000-8000-000000000001"
    private let task = "51000000-0000-4000-8000-000000000002"
    private let actor = "51000000-0000-4000-8000-000000000003"
    private var selection: XCTestExpectation?

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        DeepLinkRouter.bindSignedInUserIDProvider { self.actor }
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInUserIDProvider(nil)
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    private func model(
        identity: @escaping () -> String?,
        recipient: String? = nil,
        context: String = "personal",
        isRead: Bool = true,
        onSelect: @escaping @MainActor () -> Void = {}
    ) -> NotificationsViewModel {
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let notification: [String: Any] = [
            "id": "synthetic-note",
            "type": "task_assigned",
            "user_id": recipient ?? actor,
            "context": context,
            "is_read": isRead,
            "link": "/app/homes/legacy/dashboard?tab=tasks",
            "metadata": ["home_id": home, "task_id": task]
        ]
        let data: [String: Any] = [
            "notifications": [notification],
            "unreadCount": 0,
            "hasMore": false
        ]
        let json = try? JSONSerialization.data(withJSONObject: data)
        SequencedURLProtocol.sequence = [.status(200, body: json.flatMap { String(data: $0, encoding: .utf8) } ?? "{}")]
        return NotificationsViewModel(
            api: api,
            onSelect: { [weak self] _ in
                onSelect()
                self?.selection?.fulfill()
            },
            taskScope: HomeClaimSessionScope(api: api, identity: identity),
            taskActorId: actor
        )
    }

    private func tap(_ model: NotificationsViewModel, allowed: Bool = true) async throws {
        guard case let .loaded(sections, _) = model.state else { return XCTFail("Notification list did not load") }
        let row = try XCTUnwrap(sections.first?.rows.first)
        let selected = expectation(description: "Task notification selection")
        selected.isInverted = !allowed
        selection = selected
        row.onTap()
        await fulfillment(of: [selected], timeout: allowed ? 1 : 0.05)
        selection = nil
    }

    func testInAppTaskTapUsesExactMetadataInsteadOfLegacyDashboardLink() async throws {
        let model = model { "opening" }
        await model.load()
        try await tap(model)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeTask(homeId: home, taskId: task))
    }

    func testRetainedTaskRowCannotRouteAfterSessionReplacement() async throws {
        var identity: String? = "opening"
        let model = model { identity }
        await model.load()
        identity = "replacement"
        try await tap(model, allowed: false)
        XCTAssertNil(DeepLinkRouter.shared.pending)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testWrongRecipientOrAudienceContextCannotUsePersonalTaskRoute() async throws {
        for (recipient, context) in [(task, "personal"), (actor, "audience")] {
            let model = model(identity: { "opening" }, recipient: recipient, context: context)
            await model.load()
            try await tap(model, allowed: false)
            XCTAssertNil(DeepLinkRouter.shared.pending)
        }
    }

    func testSessionReplacementBeforeQueuedMarkReadCannotIssueRequest() async throws {
        var identity: String? = "opening"
        let replaceSession = { identity = "replacement" }
        let model = model(identity: { identity }, isRead: false, onSelect: replaceSession)
        await model.load()
        try await tap(model)
        await Task.yield()
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeTask(homeId: home, taskId: task))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testMarkReadPreservesExactTaskMetadataForLaterTap() async throws {
        let model = model(identity: { "opening" }, isRead: false)
        await model.load()
        SequencedURLProtocol.sequence = [.status(200, body: "{\"success\":true}")]
        await model.markRead(id: "synthetic-note")
        try await tap(model)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeTask(homeId: home, taskId: task))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }
}
