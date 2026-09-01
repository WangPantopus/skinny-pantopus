//
//  AddEventFormViewModelTests.swift
//  PantopusTests
//
//  P2.7 — Add Event form VM tests. Covers validation (title required,
//  end ≥ start, all-day clears the end), POST happy path, edit-mode
//  hydration + PUT, and the snapshot-test poses
//  (empty / all-day / with-attendees / recurring).
//

import XCTest
@testable import Pantopus

@MainActor
final class AddEventFormViewModelTests: XCTestCase {
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

    private func makeVM(
        api: APIClient? = nil,
        editing: CalendarEventDTO? = nil,
        prefilledCategory: CalendarEventCategory? = nil
    ) -> AddEventFormViewModel {
        AddEventFormViewModel(
            homeId: "home-1",
            editingEvent: editing,
            prefilledCategory: prefilledCategory,
            prefilledStart: Self.fixedStart,
            api: api ?? makeAPI()
        )
    }

    private static let fixedStart: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: "2025-10-12T16:00:00Z") ?? Date(timeIntervalSince1970: 1_760_270_400)
    }()

    private static let occupantsBody = """
    {"occupants":[
      {"id":"o1","user_id":"u1","is_active":true,"display_name":"Maria Patel","username":"maria"},
      {"id":"o2","user_id":"u2","is_active":true,"display_name":"John Patel","username":"john"},
      {"id":"o3","user_id":"u3","is_active":true,"display_name":"Ava Patel","username":"ava"}
    ],"pendingInvites":[]}
    """

    // MARK: - Empty pose

    func testInitialStateIsCleanInvalidAndEmpty() {
        let vm = makeVM()
        XCTAssertFalse(vm.isDirty)
        XCTAssertFalse(vm.isValid)
        XCTAssertEqual(vm.category, .generic)
        XCTAssertFalse(vm.allDay)
        // Design FrameCreate prefills "Ends" at start + 1h (matches Android).
        XCTAssertEqual(vm.endDate, Self.fixedStart.addingTimeInterval(3600))
        XCTAssertEqual(vm.recurrence, .none)
        // Stream I10: a fresh event preselects the 10-minute reminder.
        XCTAssertEqual(vm.reminderOffsets, [.tenMin])
        XCTAssertFalse(vm.requestRsvp)
        XCTAssertTrue(vm.selectedAttendeeIds.isEmpty)
        XCTAssertEqual(vm.screenTitle, "New event")
        XCTAssertEqual(vm.commitLabel, "Save")
    }

    // MARK: - Validation

    func testTitleRequiredGatesSubmit() {
        let vm = makeVM()
        XCTAssertFalse(vm.isValid)
        vm.updateField(.title, to: "  ")
        XCTAssertFalse(vm.isValid)
        vm.updateField(.title, to: "Soccer game")
        XCTAssertTrue(vm.isValid)
    }

    func testEndBeforeStartFlagsError() {
        let vm = makeVM()
        vm.updateField(.title, to: "Soccer game")
        vm.endDate = Self.fixedStart.addingTimeInterval(-3600)
        XCTAssertFalse(vm.isValid)
        XCTAssertNotNil(vm.endError)
    }

    func testEndAfterStartIsValid() {
        let vm = makeVM()
        vm.updateField(.title, to: "Soccer game")
        vm.endDate = Self.fixedStart.addingTimeInterval(3600)
        XCTAssertTrue(vm.isValid)
        XCTAssertNil(vm.endError)
    }

    func testAllDayHidesAndClearsEnd() {
        let vm = makeVM()
        vm.updateField(.title, to: "Mom's birthday")
        vm.endDate = Self.fixedStart.addingTimeInterval(3600)
        XCTAssertNotNil(vm.endDate)
        vm.allDay = true
        XCTAssertNil(vm.endDate)
        // Coming off all-day re-seeds a 9 AM start so the time picker
        // isn't a midnight surprise.
        vm.allDay = false
        let comps = Calendar.current.dateComponents([.hour], from: vm.startDate)
        XCTAssertEqual(comps.hour, 9)
    }

    // MARK: - With-attendees pose

    func testLoadOccupantsPopulatesAttendees() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.occupantsBody)
        ]
        let vm = makeVM(api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.attendees.count, 3)
        XCTAssertEqual(vm.attendees.first?.displayName, "Maria Patel")
        XCTAssertEqual(vm.attendees.first?.initials, "MP")
    }

    func testToggleAttendeeFlipsSelection() {
        let vm = makeVM()
        vm.toggleAttendee("u1")
        XCTAssertTrue(vm.selectedAttendeeIds.contains("u1"))
        vm.toggleAttendee("u1")
        XCTAssertFalse(vm.selectedAttendeeIds.contains("u1"))
    }

    // MARK: - Recurring pose

    func testRecurrenceMappingToRRULE() {
        XCTAssertEqual(AddEventRecurrence.weekly.rrule, "FREQ=WEEKLY")
        XCTAssertEqual(AddEventRecurrence.yearly.rrule, "FREQ=YEARLY")
        XCTAssertEqual(AddEventRecurrence.monthly.rrule, "FREQ=MONTHLY")
        XCTAssertEqual(AddEventRecurrence.daily.rrule, "FREQ=DAILY")
        XCTAssertNil(AddEventRecurrence.none.rrule)
    }

    func testRecurrenceFromRRULERoundTrip() {
        XCTAssertEqual(AddEventRecurrence.from(rrule: "FREQ=WEEKLY;BYDAY=SU"), .weekly)
        XCTAssertEqual(AddEventRecurrence.from(rrule: "FREQ=YEARLY"), .yearly)
        XCTAssertEqual(AddEventRecurrence.from(rrule: nil), .none)
        XCTAssertEqual(AddEventRecurrence.from(rrule: ""), .none)
    }

    // MARK: - Submit (create happy path)

    func testCreateSubmitPostsRequestAndYieldsCreatedEvent() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.occupantsBody),
            .status(201, body: """
            {"event":{"id":"e1","home_id":"home-1","event_type":"social",
             "title":"Soccer game · Ava","start_at":"2025-10-12T16:00:00Z"}}
            """)
        ]
        let vm = makeVM(api: makeAPI())
        await vm.load()
        vm.updateField(.title, to: "Soccer game · Ava")
        vm.category = .social
        vm.recurrence = .weekly
        vm.reminderOffsets = [.oneHour]
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        guard case let .created(id) = vm.pendingEvent else {
            XCTFail("Expected .created, got \(String(describing: vm.pendingEvent))")
            return
        }
        XCTAssertEqual(id, "e1")
        XCTAssertEqual(vm.toast?.text, "Event added.")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testCreateSubmitBlocksOnInvalidTitle() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.occupantsBody)
        ]
        let vm = makeVM(api: makeAPI())
        await vm.load()
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
        // No POST should have hit the wire.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testCreateSubmitMapsBackendError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.occupantsBody),
            .status(400, body: "{\"error\":\"event_type, title, and start_at are required\"}")
        ]
        let vm = makeVM(api: makeAPI())
        await vm.load()
        vm.updateField(.title, to: "Soccer game")
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - Edit-mode hydration + PUT

    func testEditingHydratesFromDTO() {
        let dto = CalendarEventDTO(
            id: "e1",
            homeId: "home-1",
            eventType: "social",
            title: "Soccer game · Ava",
            description: "Bring water",
            startAt: "2025-10-12T16:00:00Z",
            endAt: "2025-10-12T17:30:00Z",
            locationNotes: "Riverside Field 3",
            recurrenceRule: "FREQ=WEEKLY",
            assignedTo: ["u1", "u3"],
            alertsEnabled: true
        )
        let vm = makeVM(editing: dto)
        XCTAssertTrue(vm.isEditing)
        XCTAssertEqual(vm.screenTitle, "Edit event")
        XCTAssertEqual(vm.commitLabel, "Save")
        XCTAssertEqual(vm.fields[.title]?.value, "Soccer game · Ava")
        XCTAssertEqual(vm.fields[.location]?.value, "Riverside Field 3")
        XCTAssertEqual(vm.fields[.notes]?.value, "Bring water")
        XCTAssertEqual(vm.category, .social)
        XCTAssertEqual(vm.recurrence, .weekly)
        // alerts_enabled with no reminders array hydrates to a single 10-min.
        XCTAssertEqual(vm.reminderOffsets, [.tenMin])
        XCTAssertEqual(vm.selectedAttendeeIds, ["u1", "u3"])
        XCTAssertFalse(vm.allDay)
        XCTAssertNotNil(vm.endDate)
        XCTAssertFalse(vm.isDirty)
        XCTAssertTrue(vm.isValid)
    }

    func testEditingAllDayHydratesAllDayPose() {
        // Backend stores all-day as midnight UTC + nil end.
        let dto = CalendarEventDTO(
            id: "e2",
            homeId: "home-1",
            eventType: "birthday",
            title: "Mom turns 62",
            startAt: "2025-10-14T00:00:00Z",
            endAt: nil,
            recurrenceRule: "FREQ=YEARLY",
            assignedTo: ["u1", "u2", "u3"],
            alertsEnabled: false
        )
        let vm = makeVM(editing: dto)
        XCTAssertTrue(vm.allDay)
        XCTAssertNil(vm.endDate)
        XCTAssertEqual(vm.recurrence, .yearly)
        XCTAssertTrue(vm.reminderOffsets.isEmpty)
    }

    func testEditingDirtyTracksMutations() {
        let dto = CalendarEventDTO(
            id: "e1",
            homeId: "home-1",
            eventType: "social",
            title: "Soccer game",
            startAt: "2025-10-12T16:00:00Z"
        )
        let vm = makeVM(editing: dto)
        XCTAssertFalse(vm.isDirty)
        vm.updateField(.title, to: "Soccer game · Ava")
        XCTAssertTrue(vm.isDirty)
    }

    func testEditSubmitPUTsAndYieldsUpdatedEvent() async {
        let dto = CalendarEventDTO(
            id: "e1",
            homeId: "home-1",
            eventType: "social",
            title: "Soccer game",
            startAt: "2025-10-12T16:00:00Z"
        )
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.occupantsBody),
            .status(200, body: """
            {"event":{"id":"e1","home_id":"home-1","event_type":"social",
             "title":"Soccer game · Ava","start_at":"2025-10-12T16:00:00Z"}}
            """)
        ]
        let vm = makeVM(api: makeAPI(), editing: dto)
        await vm.load()
        vm.updateField(.title, to: "Soccer game · Ava")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        guard case let .updated(id) = vm.pendingEvent else {
            XCTFail("Expected .updated, got \(String(describing: vm.pendingEvent))")
            return
        }
        XCTAssertEqual(id, "e1")
    }

    // MARK: - Wire shape

    func testCreateRequestNullsLocationWhenEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.occupantsBody),
            .status(201, body: """
            {"event":{"id":"e1","home_id":"home-1","event_type":"generic",
             "title":"X","start_at":"2025-10-12T16:00:00Z"}}
            """)
        ]
        let vm = makeVM(api: makeAPI())
        await vm.load()
        vm.updateField(.title, to: "X")
        _ = await vm.submit()
        // Two requests captured — occupants GET and the event POST.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
        guard let posted = SequencedURLProtocol.capturedRequests.last else {
            XCTFail("Missing captured request")
            return
        }
        let body = Self.bodyData(from: posted)
        guard !body.isEmpty,
              let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any]
        else {
            XCTFail("Missing request body")
            return
        }
        XCTAssertEqual(json["event_type"] as? String, "generic")
        XCTAssertEqual(json["title"] as? String, "X")
        // Optional fields are omitted by Swift's synthesized Encodable
        // when nil; the backend's `|| null` fallback treats null and
        // missing the same way, so either form is acceptable.
        XCTAssertNil(json["location_notes"] as? String)
        XCTAssertNil(json["assigned_to"] as? [String])
    }

    /// `URLProtocol`-stubbed sessions strip `httpBody` and expose it as
    /// `httpBodyStream`; drain the stream so assertions don't flake.
    private static func bodyData(from request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
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
        return data
    }
}
