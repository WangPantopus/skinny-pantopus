//
//  MaintenanceDetailViewModelTests.swift
//  PantopusTests
//
//  P2.9 — Covers `MaintenanceDetailViewModel`'s load / refresh / delete
//  paths and the four state-permutations the detail screen renders.
//

import XCTest
@testable import Pantopus

@MainActor
final class MaintenanceDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        MaintenanceDraftStore.shared.clear()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(taskId: String = "task-1", api: APIClient? = nil) -> MaintenanceDetailViewModel {
        MaintenanceDetailViewModel(
            homeId: "home-1",
            taskId: taskId,
            api: api ?? makeAPI()
        )
    }

    // MARK: - Loading → Loaded (minimal)

    func test_minimal_load_returnsLoadedState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {
                "id":"task-1",
                "home_id":"home-1",
                "task":"Filter swap",
                "recurrence":"one_time",
                "status":"completed"
              }
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(task) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(task.id, "task-1")
        XCTAssertEqual(task.task, "Filter swap")
    }

    // MARK: - Loading → Loaded (full + draft)

    func test_full_loadMergesDraftStorePhotos() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {
                "id":"task-2",
                "home_id":"home-1",
                "task":"Fall HVAC tune-up",
                "vendor":"Riverside HVAC",
                "cost":185,
                "recurrence":"yearly",
                "due_date":"2026-11-01",
                "status":"completed"
              }
            ]}
            """)
        ]
        MaintenanceDraftStore.shared.upsert(
            MaintenanceDraft(
                category: .hvac,
                performedBy: .contractor,
                performerName: "Riverside HVAC",
                performerContact: "555-0142",
                notes: "Replaced filter, topped off coolant.",
                photos: [
                    MaintenanceDraftFile(filename: "a.jpg", mimeType: "image/jpeg", data: Data([0xFF])),
                    MaintenanceDraftFile(filename: "b.jpg", mimeType: "image/jpeg", data: Data([0xFE]))
                ],
                receipt: MaintenanceDraftFile(
                    filename: "receipt.pdf",
                    mimeType: "application/pdf",
                    data: Data([0x25, 0x50, 0x44, 0x46])
                )
            ),
            for: "task-2"
        )
        let vm = makeVM(taskId: "task-2")
        await vm.load()
        XCTAssertNotNil(vm.draft)
        XCTAssertEqual(vm.draft?.photos.count, 2)
        XCTAssertEqual(vm.draft?.receipt?.filename, "receipt.pdf")
        XCTAssertEqual(vm.draft?.notes, "Replaced filter, topped off coolant.")
    }

    // MARK: - Error → retry

    func test_load_returnsErrorWhenTaskMissing() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"tasks\":[]}")
        ]
        let vm = makeVM(taskId: "missing")
        await vm.load()
        guard case let .error(message) = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
        XCTAssertTrue(message.contains("no longer available"))
    }

    func test_load_returnsErrorWhenServerFails() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeVM()
        await vm.load()
        if case .error = vm.state { return }
        XCTFail("Expected .error")
    }

    // MARK: - Delete

    func test_delete_clearsDraftAndSurfacesSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {"id":"task-3","home_id":"home-1","task":"Pest","recurrence":"one_time","status":"completed"}
            ]}
            """),
            // DELETE returns 204 with empty body — APIClient's
            // void overload handles this.
            .status(204, body: "")
        ]
        MaintenanceDraftStore.shared.upsert(
            MaintenanceDraft(category: .pest, performerName: "Brooklyn Pest Co."),
            for: "task-3"
        )
        var deleteCallbackHit = false
        let vm = MaintenanceDetailViewModel(
            homeId: "home-1",
            taskId: "task-3",
            api: makeAPI()
        ) { Task { @MainActor in deleteCallbackHit = true } }
        await vm.load()
        XCTAssertNotNil(MaintenanceDraftStore.shared.draft(for: "task-3"))

        await vm.delete()
        XCTAssertNil(vm.actionError)
        XCTAssertNil(MaintenanceDraftStore.shared.draft(for: "task-3"))
        // The callback dispatches off `MainActor.run` — give it a tick.
        await Task.yield()
        XCTAssertTrue(deleteCallbackHit)
    }

    func test_delete_surfacesServerError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {"id":"task-4","home_id":"home-1","task":"X","recurrence":"one_time","status":"completed"}
            ]}
            """),
            .status(403, body: "{\"error\":\"No permission\"}")
        ]
        let vm = makeVM(taskId: "task-4")
        await vm.load()
        await vm.delete()
        XCTAssertNotNil(vm.actionError)
    }
}
