//
//  LogMaintenanceFormViewModelTests.swift
//  PantopusTests
//
//  P2.9 — Covers `LogMaintenanceFormViewModel`'s projection + submit
//  paths across the four state-permutations the design pack calls out:
//   - minimal (title-only)
//   - full (every field populated)
//   - with-photos (photo slots filled)
//   - with-next-due (calendar reminder wiring)
//

import XCTest
@testable import Pantopus

@MainActor
final class LogMaintenanceFormViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        MaintenanceDraftStore.shared.clear()
    }

    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(
        mode: LogMaintenanceFormMode = .create,
        api: APIClient? = nil
    ) -> LogMaintenanceFormViewModel {
        let frozen = Self.fixedNow
        let store = MaintenanceDraftStore.shared
        return LogMaintenanceFormViewModel(
            homeId: "home-1",
            mode: mode,
            existing: nil,
            api: api ?? makeAPI(),
            draftStore: store
        ) { frozen }
    }

    // MARK: - Initial state (minimal)

    func test_minimal_initialState_disablesSubmit_andNotDirty() {
        let vm = makeVM()
        XCTAssertEqual(vm.title, "")
        XCTAssertFalse(vm.canSubmit)
        XCTAssertFalse(vm.isDirty)
        XCTAssertFalse(vm.nextDueEnabled)
        XCTAssertEqual(vm.photos.count, 0)
        XCTAssertNil(vm.receipt)
        XCTAssertEqual(vm.performedBy, .self)
        XCTAssertEqual(vm.recurrence, .none)
        XCTAssertEqual(vm.screenTitle, "Log maintenance")
        XCTAssertEqual(vm.submitLabel, "Log")
        XCTAssertEqual(vm.photoSlots.count, LogMaintenanceFormViewModel.maxPhotos)
    }

    func test_minimal_typingTitle_enablesSubmit_andMarksDirty() {
        let vm = makeVM()
        vm.title = "Fall HVAC tune-up"
        vm.recomputeDirty()
        XCTAssertTrue(vm.canSubmit)
        XCTAssertTrue(vm.isDirty)
    }

    // MARK: - Full submit (every field populated)

    func test_full_submit_postsExpectedBody_andCalendarReminder() async {
        SequencedURLProtocol.sequence = [
            // Maintenance POST → returns the new task id.
            .status(201, body: """
            {"task":{
              "id":"task-new",
              "home_id":"home-1",
              "task":"Fall HVAC tune-up",
              "vendor":"Riverside HVAC",
              "cost":185,
              "recurrence":"yearly",
              "due_date":"2026-11-01",
              "status":"completed"
            }}
            """),
            // Calendar POST → success, body ignored by the form VM.
            .status(201, body: """
            {"event":{
              "id":"ev-1",
              "home_id":"home-1",
              "event_type":"maintenance",
              "title":"Fall HVAC tune-up",
              "start_at":"2026-11-01T00:00:00Z"
            }}
            """)
        ]
        let vm = makeVM(api: makeAPI())
        vm.category = .hvac
        vm.title = "Fall HVAC tune-up"
        vm.performedBy = .contractor
        vm.performerName = "Riverside HVAC"
        vm.performerContact = "555-0142"
        vm.costText = "185"
        vm.notes = "Replaced filter, topped off coolant."
        vm.nextDueEnabled = true
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime]
        vm.nextDueDate = isoFormatter.date(from: "2026-11-01T00:00:00Z") ?? Self.fixedNow
        vm.recurrence = .yearly
        vm.recomputeDirty()
        XCTAssertTrue(vm.canSubmit)

        await vm.submit()

        // Submit produced a `created` event with the new task id.
        guard case let .created(taskId) = vm.pendingEvent else {
            XCTFail("Expected .created event, got \(String(describing: vm.pendingEvent))")
            return
        }
        XCTAssertEqual(taskId, "task-new")
        XCTAssertNil(vm.submitError)

        // Local draft was persisted with the extras backend doesn't store.
        let draft = MaintenanceDraftStore.shared.draft(for: taskId)
        XCTAssertNotNil(draft)
        XCTAssertEqual(draft?.category, .hvac)
        XCTAssertEqual(draft?.performedBy, .contractor)
        XCTAssertEqual(draft?.performerName, "Riverside HVAC")
        XCTAssertEqual(draft?.performerContact, "555-0142")
        XCTAssertEqual(draft?.notes, "Replaced filter, topped off coolant.")

        // Two requests went out — maintenance + calendar.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests[0].url?.path.hasSuffix("/maintenance") ?? false)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests[1].url?.path.hasSuffix("/events") ?? false)
    }

    func test_full_submitErrorSurfacesMessage() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeVM(api: makeAPI())
        vm.title = "Fall HVAC tune-up"
        await vm.submit()
        XCTAssertNil(vm.pendingEvent)
        XCTAssertNotNil(vm.submitError)
    }

    // MARK: - With photos (slot rendering)

    func test_withPhotos_slotsRenderUpToFour() {
        let vm = makeVM()
        // Add 5 photos — only 4 should land.
        for i in 0..<5 {
            vm.addPhoto(MaintenanceDraftFile(
                filename: "p\(i).jpg",
                mimeType: "image/jpeg",
                data: Data([UInt8(i)])
            ))
        }
        XCTAssertEqual(vm.photos.count, LogMaintenanceFormViewModel.maxPhotos)
        let slots = vm.photoSlots
        XCTAssertEqual(slots.count, LogMaintenanceFormViewModel.maxPhotos)
        XCTAssertTrue(slots.allSatisfy { $0.file != nil })
    }

    func test_withPhotos_removeShrinksSlots() {
        let vm = makeVM()
        let file = MaintenanceDraftFile(filename: "x.jpg", mimeType: "image/jpeg", data: Data())
        vm.addPhoto(file)
        XCTAssertEqual(vm.photos.count, 1)
        vm.removePhoto(id: file.id)
        XCTAssertEqual(vm.photos.count, 0)
        XCTAssertNil(vm.photoSlots[0].file)
    }

    // MARK: - With next-due (calendar reminder)

    func test_withNextDue_disabledByDefault() {
        let vm = makeVM()
        XCTAssertFalse(vm.nextDueEnabled)
    }

    func test_withNextDue_submitOnlyMaintenance_whenDueDisabled() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {"task":{
              "id":"task-2",
              "home_id":"home-1",
              "task":"Filter swap",
              "recurrence":"one_time",
              "status":"completed"
            }}
            """)
        ]
        let vm = makeVM(api: makeAPI())
        vm.title = "Filter swap"
        vm.nextDueEnabled = false
        await vm.submit()
        guard case .created = vm.pendingEvent else {
            XCTFail("Expected .created")
            return
        }
        // Only one network request — no calendar POST when next-due off.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    // MARK: - Edit mode

    func test_editMode_loadsExistingTaskAndRebuildsDirtyBaseline() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {
                "id":"task-edit",
                "home_id":"home-1",
                "task":"Quarterly pest treatment",
                "vendor":"Brooklyn Pest Co.",
                "cost":120,
                "recurrence":"quarterly",
                "due_date":"2026-08-01",
                "status":"scheduled"
              }
            ]}
            """)
        ]
        let vm = makeVM(mode: .edit(taskId: "task-edit"), api: makeAPI())
        XCTAssertEqual(vm.title, "")
        XCTAssertEqual(vm.screenTitle, "Edit maintenance")
        XCTAssertEqual(vm.submitLabel, "Save")

        await vm.loadIfNeeded()
        XCTAssertEqual(vm.title, "Quarterly pest treatment")
        XCTAssertEqual(vm.performerName, "Brooklyn Pest Co.")
        XCTAssertEqual(vm.recurrence, .quarterly)
        XCTAssertTrue(vm.nextDueEnabled)
        // Loading an existing task is not a dirty edit.
        XCTAssertFalse(vm.isDirty)
    }

    // MARK: - Cost parsing helpers

    func test_parseCost_handlesEmpty_andDecimals_andCurrencyChars() {
        XCTAssertNil(LogMaintenanceFormViewModel.parseCost(""))
        XCTAssertNil(LogMaintenanceFormViewModel.parseCost("   "))
        XCTAssertEqual(LogMaintenanceFormViewModel.parseCost("185"), Decimal(185))
        XCTAssertEqual(LogMaintenanceFormViewModel.parseCost("$185"), Decimal(185))
        XCTAssertEqual(LogMaintenanceFormViewModel.parseCost("1,250.75"), Decimal(string: "1250.75"))
    }

    // MARK: - Vendor inference (edit pre-fill)

    func test_inferPerformedBy_defaultsToSelfWhenVendorBlank() {
        XCTAssertEqual(LogMaintenanceFormViewModel.inferPerformedBy(vendor: nil), .self)
        XCTAssertEqual(LogMaintenanceFormViewModel.inferPerformedBy(vendor: ""), .self)
        XCTAssertEqual(LogMaintenanceFormViewModel.inferPerformedBy(vendor: "Riverside HVAC"), .contractor)
    }
}
