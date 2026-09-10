//
//  AddHouseholdTaskFormViewModelTests.swift
//  PantopusTests
//
//  P2.4 — covers `AddHouseholdTaskFormViewModel` (Add + Edit modes):
//   - initial pose: empty Add, prefilled Edit
//   - validation: title required + 80-char max, custom interval ≥ 1
//   - recurrence parsing round-trip (oneTime / daily / weekly /
//     monthly / custom INTERVAL=N)
//   - custom sub-form visibility flag
//   - submit happy path (POST in Add, PUT in Edit) with payload assertions
//   - submit error surface
//   - dirty / valid gating (Edit gates on dirty; Add does not)
//

import XCTest
@testable import Pantopus

private enum AddHouseholdTaskFormFixtures {
    static let collectionJSON = """
    {
      "tasks": [],
      "collection_capabilities": {
        "can_create": true
      },
      "task_session": {
        "home_id": "30000000-0000-4000-8000-000000000001",
        "actor_id": "30000000-0000-4000-8000-000000000002",
        "session_scope": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    }
    """

    static let occupantsJSON = """
    {
      "occupants": [
        {
          "id": "occ-1",
          "user_id": "30000000-0000-4000-8000-000000000002",
          "role": "owner",
          "is_active": true,
          "display_name": "Maria Kovács",
          "username": "mariak"
        },
        {
          "id": "occ-2",
          "user_id": "30000000-0000-4000-8000-000000000003",
          "role": "member",
          "is_active": true,
          "display_name": "Avery Park",
          "username": "averyp"
        }
      ],
      "pendingInvites": []
    }
    """

    static func tasksJSON(_ rule: String?, title: String = "Take out trash") -> String {
        let ruleField = rule.map { "\"\($0)\"" } ?? "null"
        return """
        {
          "task": {
              "id": "30000000-0000-4000-8000-000000000004",
              "home_id": "30000000-0000-4000-8000-000000000001",
              "task_type": "chore",
              "title": "\(title)",
              "description": "Tuesday curbside.",
              "assigned_to": "30000000-0000-4000-8000-000000000002",
              "due_at": "2026-06-01",
              "recurrence_rule": \(ruleField),
              "status": "open", "capabilities": {"can_edit": true}
            },
          "task_session": {
            "home_id": "30000000-0000-4000-8000-000000000001",
            "actor_id": "30000000-0000-4000-8000-000000000002",
            "session_scope": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          }
        }
        """
    }

    static let createdTaskJSON = """
    {
      "task": {
        "id": "30000000-0000-4000-8000-000000000005",
        "home_id": "30000000-0000-4000-8000-000000000001",
        "task_type": "chore",
        "title": "Wash dishes",
        "status": "open"
      },
      "replayed":false,
      "creation_receipt": {
        "home_id": "30000000-0000-4000-8000-000000000001",
        "actor_id": "30000000-0000-4000-8000-000000000002",
        "request_id": "30000000-0000-4000-8000-000000000006",
        "task_id": "30000000-0000-4000-8000-000000000005",
        "payload_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "created_at": "2026-09-10T12:00:00Z"
      },
      "task_session": {
        "home_id": "30000000-0000-4000-8000-000000000001",
        "actor_id": "30000000-0000-4000-8000-000000000002",
        "session_scope": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    }
    """

    static let updatedTaskJSON = """
    {
      "task": {
        "id": "30000000-0000-4000-8000-000000000004",
        "home_id": "30000000-0000-4000-8000-000000000001",
        "task_type": "chore",
        "title": "Take out trash (Tuesday)",
        "description": "Tuesday curbside.",
        "assigned_to": "30000000-0000-4000-8000-000000000002",
        "due_at": "2026-06-01",
        "recurrence_rule": "FREQ=WEEKLY",
        "status": "open", "capabilities": {"can_edit":true}
      },
      "task_session": {
        "home_id": "30000000-0000-4000-8000-000000000001",
        "actor_id": "30000000-0000-4000-8000-000000000002",
        "session_scope": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    }
    """
}

private struct CreateBody: Decodable {
    let task_type: String
    let title: String
    let description: String?
    let assigned_to: String?
    let due_at: String?
    let recurrence_rule: String?
}

private struct UpdateBody: Decodable {
    let title: String?
    let description: String?
    let assigned_to: String?
    let due_at: String?
    let recurrence_rule: String?
}

@MainActor
final class AddHouseholdTaskFormViewModelTests: XCTestCase {
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

    private func makeVM(taskId: String? = nil) -> AddHouseholdTaskFormViewModel {
        let api = makeAPI()
        return AddHouseholdTaskFormViewModel(
            homeId: "30000000-0000-4000-8000-000000000001",
            taskId: taskId,
            api: api,
            access: HomeTaskAccess(
                homeId: "30000000-0000-4000-8000-000000000001",
                api: api,
                actorId: "30000000-0000-4000-8000-000000000002"
            ) { "fixed-session" },
            store: CreationMemoryStore()
        ) { "30000000-0000-4000-8000-000000000006" }
    }

    // ── Initial pose ──────────────────────────────────────────

    func testAddMode_initialPoseHasOneTimeRecurrenceAndOtherCategory() {
        let vm = makeVM()
        XCTAssertFalse(vm.isEditing)
        XCTAssertEqual(vm.selectedRecurrence, .oneTime)
        XCTAssertEqual(vm.selectedCategory, .other)
        XCTAssertNil(vm.selectedAssigneeId)
        XCTAssertFalse(vm.showsCustomRecurrenceSubForm)
        XCTAssertNotNil(
            vm.fields[.title]?.error,
            "Empty title should fail required validator at seed."
        )
        XCTAssertFalse(vm.isValid)
    }

    func testEditMode_hydratesEveryFieldFromBackend() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.tasksJSON("FREQ=WEEKLY")),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM(taskId: "30000000-0000-4000-8000-000000000004")
        await vm.load()
        XCTAssertTrue(vm.isEditing)
        if case .editing = vm.state {} else { XCTFail("Expected .editing state after load.") }
        XCTAssertEqual(vm.fields[.title]?.value, "Take out trash")
        XCTAssertEqual(vm.fields[.notes]?.value, "Tuesday curbside.")
        XCTAssertEqual(vm.selectedAssigneeId, "30000000-0000-4000-8000-000000000002")
        XCTAssertEqual(vm.fields[.dueAt]?.value, "2026-06-01")
        XCTAssertEqual(vm.selectedRecurrence, .weekly)
        // Trash → category .cleaning per the inference table.
        XCTAssertEqual(vm.selectedCategory, .cleaning)
        // Hydration starts undirty (Edit mode).
        XCTAssertFalse(vm.isDirty)
        XCTAssertTrue(vm.isValid)
    }

    func testEditMode_missingTaskSurfacesError() async {
        SequencedURLProtocol.sequence = [
            .status(404, body: "{\"error\":\"Task unavailable\"}")
        ]
        let vm = makeVM(taskId: "30000000-0000-4000-8000-000000000004")
        await vm.load()
        if case let .error(message) = vm.state {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .error state when task is missing.")
        }
    }

    // ── Validators ─────────────────────────────────────────────

    func testTitleRequiredAndMaxLength80() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.update(.title, to: "")
        XCTAssertNotNil(vm.fields[.title]?.error)
        vm.update(.title, to: String(repeating: "a", count: 81))
        XCTAssertNotNil(vm.fields[.title]?.error)
        vm.update(.title, to: String(repeating: "a", count: 80))
        XCTAssertNil(vm.fields[.title]?.error)
        vm.update(.title, to: "Wash dishes")
        XCTAssertNil(vm.fields[.title]?.error)
    }

    func testCustomIntervalValidatorOnlyActiveOnCustomRecurrence() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectRecurrence(.weekly)
        vm.update(.customInterval, to: "abc")
        XCTAssertNil(
            vm.fields[.customInterval]?.error,
            "Custom validator should not fire when recurrence != .custom."
        )
        vm.selectRecurrence(.custom)
        vm.update(.customInterval, to: "abc")
        XCTAssertNotNil(vm.fields[.customInterval]?.error)
        vm.update(.customInterval, to: "0")
        XCTAssertNotNil(vm.fields[.customInterval]?.error)
        vm.update(.customInterval, to: "3")
        XCTAssertNil(vm.fields[.customInterval]?.error)
    }

    func testCustomSubFormVisibilityTracksRecurrencePicker() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.showsCustomRecurrenceSubForm)
        vm.selectRecurrence(.daily)
        XCTAssertFalse(vm.showsCustomRecurrenceSubForm)
        vm.selectRecurrence(.custom)
        XCTAssertTrue(vm.showsCustomRecurrenceSubForm)
        vm.selectRecurrence(.weekly)
        XCTAssertFalse(
            vm.showsCustomRecurrenceSubForm,
            "Sub-form should hide once the user picks a fixed cadence."
        )
    }

    // ── Recurrence round-trip ──────────────────────────────────

    func testParseRecurrence_returnsOneTimeForNilOrEmpty() {
        let nilResult = AddHouseholdTaskFormViewModel.parseRecurrence(nil)
        XCTAssertEqual(nilResult.recurrence, .oneTime)
        let emptyResult = AddHouseholdTaskFormViewModel.parseRecurrence("  ")
        XCTAssertEqual(emptyResult.recurrence, .oneTime)
    }

    func testParseRecurrence_freqOnlyRulesMapToSimpleOptions() {
        XCTAssertEqual(AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=DAILY").recurrence, .daily)
        XCTAssertEqual(AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=WEEKLY").recurrence, .weekly)
        XCTAssertEqual(AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=MONTHLY").recurrence, .monthly)
    }

    func testParseRecurrence_intervalGreaterThan1MapsToCustom() {
        let parsed = AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=DAILY;INTERVAL=3")
        XCTAssertEqual(parsed.recurrence, .custom)
        XCTAssertEqual(parsed.interval, 3)
        XCTAssertEqual(parsed.unit, .days)
    }

    // ── Submit happy path ─────────────────────────────────────

    func testAddMode_savePostsExpectedBodyAndSignalsDismiss() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(201, body: AddHouseholdTaskFormFixtures.createdTaskJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.update(.title, to: "Wash dishes")
        vm.selectCategory(.cleaning)
        vm.selectRecurrence(.weekly)
        vm.selectAssignee("30000000-0000-4000-8000-000000000002")
        vm.setDueDate(AddHouseholdTaskFormViewModel.parseISODay("2026-06-15"))
        vm.update(.notes, to: "After dinner.")

        let ok = await vm.save()
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.createdTaskId, "30000000-0000-4000-8000-000000000005")
        XCTAssertTrue(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.kind, .success)

        // Current collection + occupants, current collection recheck, exact POST.
        let captured = SequencedURLProtocol.capturedRequests
        XCTAssertEqual(captured.count, 4)
        let post = captured[3]
        XCTAssertEqual(post.httpMethod, "POST")
        XCTAssertEqual(post.url?.path, "/api/homes/30000000-0000-4000-8000-000000000001/tasks")
        let body = try decodedBody(CreateBody.self, from: post)
        XCTAssertEqual(body.title, "Wash dishes")
        XCTAssertEqual(body.task_type, "chore")
        XCTAssertEqual(body.assigned_to, "30000000-0000-4000-8000-000000000002")
        XCTAssertEqual(body.due_at, "2026-06-15")
        XCTAssertEqual(body.description, "After dinner.")
        XCTAssertEqual(body.recurrence_rule, "FREQ=WEEKLY")
    }

    func testEditMode_savePutsExpectedBody() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.tasksJSON(nil)),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.tasksJSON(nil)),
            .status(200, body: AddHouseholdTaskFormFixtures.updatedTaskJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.updatedTaskJSON)
        ]
        let vm = makeVM(taskId: "30000000-0000-4000-8000-000000000004")
        await vm.load()
        vm.update(.title, to: "Take out trash (Tuesday)")
        vm.selectRecurrence(.weekly)

        let ok = await vm.save()
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertTrue(vm.shouldDismiss)

        let captured = SequencedURLProtocol.capturedRequests
        // Initial task + occupants, task recheck, PUT, exact current task.
        XCTAssertEqual(captured.count, 5)
        let put = captured.first { $0.httpMethod == "PUT" }
        XCTAssertNotNil(put)
        XCTAssertEqual(put?.url?.path, "/api/homes/30000000-0000-4000-8000-000000000001/tasks/30000000-0000-4000-8000-000000000004")
        if let put {
            let body = try decodedBody(UpdateBody.self, from: put)
            XCTAssertEqual(body.title, "Take out trash (Tuesday)")
            XCTAssertEqual(body.recurrence_rule, "FREQ=WEEKLY")
            XCTAssertNil(body.description, "Untouched notes must not be resent.")
            XCTAssertNil(body.assigned_to, "Untouched assignment must not be resent.")
        }
    }

    func testAddMode_customRecurrenceBuildsIntervalRule() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(201, body: AddHouseholdTaskFormFixtures.createdTaskJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.update(.title, to: "Water plants")
        vm.selectCategory(.yardwork)
        vm.selectRecurrence(.custom)
        vm.selectCustomUnit(.days)
        vm.update(.customInterval, to: "3")

        _ = await vm.save()
        guard let request = SequencedURLProtocol.capturedRequests.last else {
            XCTFail("Expected a captured POST request.")
            return
        }
        XCTAssertEqual(request.httpMethod, "POST")
        let body = try decodedBody(CreateBody.self, from: request)
        XCTAssertEqual(body.recurrence_rule, "FREQ=DAILY;INTERVAL=3")
        XCTAssertEqual(body.task_type, "chore")
    }

    // ── Submit failure ────────────────────────────────────────

    func testSave_validationErrorShakesAndDoesNotFire() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        let before = vm.shakeTrigger
        let capturedBefore = SequencedURLProtocol.capturedRequests.count
        _ = await vm.save() // title is empty — must fail
        XCTAssertNotEqual(before, vm.shakeTrigger)
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.count,
            capturedBefore,
            "Invalid form must not fire a network request."
        )
    }

    func testSave_serverErrorSurfacesToast() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON),
            .status(500, body: "{\"error\":\"down\"}")
        ]
        let vm = makeVM()
        await vm.load()
        vm.update(.title, to: "Wash dishes")
        _ = await vm.save()
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertFalse(vm.shouldDismiss)
    }

    // ── Dirty gating ──────────────────────────────────────────

    func testEditMode_isDirtyTrueOnlyAfterEdit() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.tasksJSON("FREQ=DAILY")),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM(taskId: "30000000-0000-4000-8000-000000000004")
        await vm.load()
        XCTAssertFalse(vm.isDirty)
        vm.update(.title, to: "Take out trash NOW")
        XCTAssertTrue(vm.isDirty)
    }

    func testAddMode_isDirtyAlwaysTrueSoSaveCanFireOnFirstEdit() {
        let vm = makeVM()
        XCTAssertTrue(
            vm.isDirty,
            "Add mode treats every field as new so Save is reachable from the start."
        )
    }
}

// MARK: - Helpers

private func decodedBody<T: Decodable>(
    _ type: T.Type,
    from request: URLRequest
) throws -> T {
    let data: Data = if let body = request.httpBody {
        body
    } else if let stream = request.httpBodyStream {
        Data(reading: stream)
    } else {
        Data()
    }
    return try JSONDecoder().decode(type, from: data)
}

private extension Data {
    init(reading stream: InputStream) {
        var data = Data()
        stream.open()
        defer { stream.close() }
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        self = data
    }
}
