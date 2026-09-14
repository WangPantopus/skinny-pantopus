import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskNotificationRoutingTests: XCTestCase {
    private let home = "50000000-0000-4000-8000-000000000001"
    private let task = "50000000-0000-4000-8000-000000000002"
    private let actor = "50000000-0000-4000-8000-000000000003"

    override func setUp() {
        super.setUp()
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

    func testAssignmentAndCompletionMetadataResolveExactTaskBeforeLegacyLink() throws {
        for type in ["task_assigned", "task_completed"] {
            let path = try XCTUnwrap(HomeTaskNotificationRoute.pushPath([
                "type": type, "home_id": home, "task_id": task, "link": "/app/homes/legacy/dashboard?tab=tasks"
            ]))
            DeepLinkRouter.shared.handle(path: path)
            XCTAssertEqual(DeepLinkRouter.shared.pending, .homeTask(homeId: home, taskId: task))
        }
    }

    func testNestedMetadataAndUppercaseUUIDsHaveOneCanonicalPath() {
        let uppercaseHome = "ABCDEF00-0000-4000-8000-000000000001"
        let uppercaseTask = "ABCDEF00-0000-4000-8000-000000000002"
        let path = HomeTaskNotificationRoute.pushPath([
            "type": "TASK_ASSIGNED", "metadata": ["home_id": uppercaseHome, "task_id": uppercaseTask]
        ])
        XCTAssertEqual(path, "/app/homes/\(uppercaseHome.lowercased())/tasks/\(uppercaseTask.lowercased())")
    }

    func testUnrelatedOrMalformedMetadataCannotSelectTask() {
        XCTAssertNil(HomeTaskNotificationRoute.path(type: "persona_post", homeId: home, taskId: task))
        XCTAssertNil(HomeTaskNotificationRoute.path(type: "task_assigned", homeId: "not-a-home", taskId: task))
        XCTAssertNil(HomeTaskNotificationRoute.path(type: "task_completed", homeId: home, taskId: nil))
        XCTAssertNil(HomeTaskNotificationRoute.pushPath(["type": "task_assigned", "home_id": home, "task_id": 42]))
    }

    func testCanonicalCustomAndHTTPSPathsResolveExactTask() throws {
        for path in ["pantopus://homes/\(home)/tasks/\(task)", "https://pantopus.app/app/homes/\(home)/tasks/\(task)"] {
            let url = try XCTUnwrap(URL(string: path))
            XCTAssertEqual(DeepLinkRouter.shared.resolve(url: url), .homeTask(homeId: home, taskId: task))
        }
    }

    func testMalformedTaskPathDoesNotFallBackToAnUnrelatedHome() throws {
        for suffix in ["tasks", "tasks/invalid", "tasks/\(task)/edit"] {
            let url = try XCTUnwrap(URL(string: "pantopus://homes/\(home)/\(suffix)"))
            guard case .unknown = DeepLinkRouter.shared.resolve(url: url) else { return XCTFail("Malformed task route accepted") }
        }
    }

    func testLegacyDashboardLinkStillRoutesToDashboard() {
        DeepLinkRouter.shared.handle(path: "/app/homes/\(home)/dashboard?tab=tasks")
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeDashboard(id: home))
    }

    func testTaskArrivalSurvivesConsumptionUntilExactContentArrival() {
        DeepLinkRouter.shared.handle(path: "/app/homes/\(home)/tasks/\(task)")
        XCTAssertNotNil(DeepLinkRouter.shared.consume())
        XCTAssertNotNil(PendingDeepLinkStore.peek())
        DeepLinkRouter.shared.completeHomeTaskArrival(homeId: home, taskId: actor)
        XCTAssertNotNil(PendingDeepLinkStore.peek())
        DeepLinkRouter.shared.completeHomeTaskArrival(homeId: home, taskId: task)
        XCTAssertNil(PendingDeepLinkStore.peek())
    }

    func testSignedOutTaskWaitsForLoginAndReplaysSameHomeAndTask() throws {
        DeepLinkRouter.bindSignedInUserIDProvider { nil }
        DeepLinkRouter.shared.handle(path: "/app/homes/\(home)/tasks/\(task)")
        XCTAssertNil(DeepLinkRouter.shared.pending)
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation)
        let saved = try XCTUnwrap(PendingDeepLinkStore.take(userID: actor))
        DeepLinkRouter.bindSignedInUserIDProvider { self.actor }
        DeepLinkRouter.shared.handle(path: saved)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeTask(homeId: home, taskId: task))
        XCTAssertNotNil(PendingDeepLinkStore.peek())
    }

    func testSavedTaskCannotReplayUnderAReplacementAccount() {
        DeepLinkRouter.shared.handle(path: "/app/homes/\(home)/tasks/\(task)")
        DeepLinkRouter.shared.clearPending()
        XCTAssertNil(PendingDeepLinkStore.take(userID: task))
        XCTAssertNil(PendingDeepLinkStore.peek())
    }

    func testOnlyPlaceStackOwnsTaskNotification() {
        let destination = DeepLinkRouter.Destination.homeTask(homeId: home, taskId: task)
        XCTAssertTrue(HubTabRoot.ownsDeepLink(destination, tab: .place))
        XCTAssertFalse(HubTabRoot.ownsDeepLink(destination, tab: .mail))
        XCTAssertFalse(HubTabRoot.ownsDeepLink(destination, tab: .today))
        XCTAssertFalse(HubTabRoot.ownsDeepLink(destination, tab: .nearby))
    }

    func testHeterogeneousMetadataDoesNotBreakNotificationDecoding() throws {
        for metadata in ["[]", "42", "\"other\"", "{\"other\":true,\"home_id\":42}"] {
            let data = Data("{\"id\":\"synthetic\",\"metadata\":\(metadata)}".utf8)
            let note = try JSONDecoder().decode(NotificationDTO.self, from: data)
            XCTAssertNil(note.metadata?.homeId)
            XCTAssertNil(note.metadata?.taskId)
        }
    }
}
