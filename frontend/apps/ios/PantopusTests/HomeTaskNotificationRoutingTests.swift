import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskNotificationRoutingTests: XCTestCase {
    private let home = "50000000-0000-4000-8000-000000000001"
    private let task = "50000000-0000-4000-8000-000000000002"
    private let actor = "50000000-0000-4000-8000-000000000003"

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

    func testDetailMountKeepsReadAliveAcrossLoadingAndContentChanges() async throws {
        let home = "10000000-0000-4000-8000-000000000001"
        let actor = "10000000-0000-4000-8000-000000000002"
        let task = "10000000-0000-4000-8000-000000000101"
        let body = """
        {"task":{"id":"\(task)","home_id":"\(home)","task_type":"chore","title":"Exact saved task",
        "status":"open","capabilities":{"can_edit":true,"can_complete":true,"can_delete":true,"can_upload":false}},
        "task_session":{"home_id":"\(home)","actor_id":"\(actor)","session_scope":"\(String(repeating: "a", count: 64))"}}
        """
        SequencedURLProtocol.sequence = [.status(200, body: body, gate: "detail-render")]
        let access = HomeTaskAccess(
            homeId: home,
            api: APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            actorId: actor
        ) { "hosted-detail-session" }
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access)
        let host = UIHostingController(rootView: NavigationStack {
            HouseholdTaskDetailView(homeId: home, taskId: task, viewModel: vm)
        })
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer {
            window.isHidden = true
            window.rootViewController = nil
        }
        for _ in 0..<100 {
            if !SequencedURLProtocol.capturedRequests.isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        // Keep the response pending while SwiftUI renders its loading branch.
        try await Task.sleep(for: .milliseconds(100))
        host.view.layoutIfNeeded()
        XCTAssertTrue(SequencedURLProtocol.release("detail-render"), "Rendering loading must not cancel the read")
        for _ in 0..<100 {
            if vm.task != nil || vm.error != nil { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        try await Task.sleep(for: .milliseconds(100))
        XCTAssertEqual(vm.task?.id, task, "Rendering content must not suspend the detail model")
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.loading)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET"])
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

    func testSavedTaskReplacesAddAndRetainsDetailThroughNavigationCompletion() async throws {
        let model = TaskCreationNavigationModel()
        let host = UIHostingController(rootView: TaskCreationNavigationView(model: model)
            .environment(\.scenePhase, .active))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer {
            window.isHidden = true
            window.rootViewController = nil
        }
        guard try await waitFor({ model.rootAppeared }) else { return XCTFail("Root did not mount") }
        host.view.layoutIfNeeded()
        guard try await waitFor({ navigationController(in: host) != nil }) else {
            return XCTFail("Navigation host did not become ready; journey was not exercised")
        }
        let navigation = try XCTUnwrap(navigationController(in: host))
        model.path.append(.homeTasks(homeId: model.home))
        guard try await waitFor({ model.list.fab != nil && navigation.transitionCoordinator == nil }) else {
            return XCTFail("Tasks did not finish opening")
        }
        await model.list.requestCreate()
        guard try await waitFor({ model.formReady && navigation.transitionCoordinator == nil }) else {
            return XCTFail("Real Add form did not finish opening")
        }
        model.form.update(.title, to: "Wash dishes")
        let saved = await model.form.save()
        XCTAssertTrue(saved)
        guard try await waitFor({
            model.path.last == .householdTaskDetail(homeId: model.home, taskId: model.task)
                && SequencedURLProtocol.capturedRequests.contains { $0.url?.path == model.detailPath }
        }) else { return XCTFail("Save did not open/request its detail") }
        host.view.layoutIfNeeded()
        XCTAssertTrue(SequencedURLProtocol.release("created-detail"), "Detail read was canceled during arrival")
        guard try await waitFor({ model.details.allSatisfy { !$0.loading } && navigation.transitionCoordinator == nil }) else {
            return XCTFail("Detail did not settle")
        }
        host.view.layoutIfNeeded()
        await Task.yield()
        XCTAssertEqual(model.details.compactMap { $0.task?.id }, [model.task], "Exactly one surviving detail must retain the saved task")
        XCTAssertNil(model.details.first { $0.task?.id == model.task }?.error)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }.count, 1)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == model.detailPath }.count, 1)
        model.path.removeLast()
        XCTAssertEqual(model.path.last, .homeTasks(homeId: model.home))
    }

    private func waitFor(_ condition: () -> Bool) async throws -> Bool {
        for _ in 0..<100 {
            if condition() { return true }
            try await Task.sleep(for: .milliseconds(10))
        }
        return condition()
    }

    private func navigationController(in controller: UIViewController) -> UINavigationController? {
        if let navigation = controller as? UINavigationController { return navigation }
        return controller.children.lazy.compactMap { self.navigationController(in: $0) }.first
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

/// Retains the real list and form while exercising the same route replacement
/// as HubTabRoot, using the existing form fixtures and in-memory request store.
@MainActor
private final class TaskCreationNavigationModel: ObservableObject {
    @Published var path = RouteStack<HubRoute>()
    @Published var rootAppeared = false
    let home = "30000000-0000-4000-8000-000000000001"
    let actor = "30000000-0000-4000-8000-000000000002"
    let task = "30000000-0000-4000-8000-000000000005"
    private let api: APIClient
    let form: AddHouseholdTaskFormViewModel
    private(set) var details: [HouseholdTaskDetailViewModel] = []
    lazy var list = HouseholdTasksListViewModel(
        homeId: home,
        onAddTask: { [weak self] in
            guard let self else { return }
            path.append(.addHouseholdTask(homeId: home))
        },
        access: HomeTaskAccess(homeId: home, api: api, actorId: actor) { "creation-navigation-session" }
    )

    var detailPath: String {
        "/api/homes/\(home)/tasks/\(task)"
    }

    var formReady: Bool {
        if case .editing = form.state, case .loaded = form.assigneeReadState { return true }
        return false
    }

    init() {
        let collection = SequencedURLProtocol.Response.status(200, body: AddHouseholdTaskFormFixtures.collectionJSON)
        let response = AddHouseholdTaskFormFixtures.tasksJSON(nil, title: "Wash dishes")
            .replacingOccurrences(of: "30000000-0000-4000-8000-000000000004", with: task)
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/homes/\(home)/tasks": Array(repeating: collection, count: 4)
                + [.status(201, body: AddHouseholdTaskFormFixtures.createdTaskJSON)]
                + Array(repeating: collection, count: 4),
            "/api/homes/\(home)/occupants": [.status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)],
            "/api/homes/\(home)/tasks/\(task)": [.status(200, body: response, gate: "created-detail")]
        ])
        api = APIClient(environment: .current, session: session, retryPolicy: .none)
        form = AddHouseholdTaskFormViewModel(
            homeId: home,
            api: api,
            access: HomeTaskAccess(homeId: home, api: api, actorId: actor) { "creation-navigation-session" },
            store: CreationMemoryStore()
        ) { "30000000-0000-4000-8000-000000000006" }
    }

    func makeDetail() -> HouseholdTaskDetailViewModel {
        // Like the production initializer, construct a fresh candidate per view
        // value; SwiftUI keeps the model belonging to the mounted State identity.
        let detail = HouseholdTaskDetailViewModel(
            homeId: home,
            taskId: task,
            access: HomeTaskAccess(homeId: home, api: api, actorId: actor) { "creation-navigation-session" }
        )
        details.append(detail)
        return detail
    }

    func created(_ taskId: String) {
        var destinationPath = path
        if !destinationPath.isEmpty { destinationPath.removeLast() }
        destinationPath.append(.householdTaskDetail(homeId: home, taskId: taskId))
        path = destinationPath
    }
}

private struct TaskCreationNavigationView: View {
    @ObservedObject var model: TaskCreationNavigationModel

    var body: some View {
        NavigationStack(path: Binding(
            get: { model.path.navigationPath },
            set: { model.path.replaceNavigationPath($0) }
        )) {
            Text("Home").onAppear { model.rootAppeared = true }
                .navigationDestination(for: HubRoute.self) { route in
                    destination(route)
                        .modifier(OwnHeaderBar(drawsOwnHeader: HubTabRoot.drawsOwnHeader(route)))
                }
        }
    }

    @ViewBuilder
    private func destination(_ route: HubRoute) -> some View {
        switch route {
        case .homeTasks:
            HouseholdTasksListView(viewModel: model.list, isActive: model.path.last == route)
        case .addHouseholdTask:
            AddHouseholdTaskFormView(
                homeId: model.home,
                viewModel: model.form,
                onClose: { model.path.removeLast() },
                onCreated: model.created
            )
        case .householdTaskDetail:
            HouseholdTaskDetailView(homeId: model.home, taskId: model.task, viewModel: model.makeDetail())
                .id(route)
        default:
            EmptyView()
        }
    }
}
