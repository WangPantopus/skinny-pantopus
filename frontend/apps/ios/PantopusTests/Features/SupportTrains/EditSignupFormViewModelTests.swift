//
//  EditSignupFormViewModelTests.swift
//  PantopusTests
//
//  P3.7 — Edit Signup form. Covers:
//    - prefill: contribution / drop-off time / dietary notes seed
//      from the source reservation
//    - dirty/valid bookkeeping (Save disabled until a real change)
//    - contribution-mode label & wire-field swap (takeout → restaurant)
//    - drop-off time validator rejects nonsense, accepts HH:mm
//    - successful save patches the shared store, fires `onSaved`, and
//      flips `shouldDismiss` after the toast holds
//

import XCTest
@testable import Pantopus

@MainActor
final class EditSignupFormViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SupportTrainReservationsStore.shared.reset()
        SequencedURLProtocol.reset()
    }

    // MARK: - Fixtures

    private func makeReservation(
        mode: String = "cook",
        dish: String? = "Veggie chili",
        restaurant: String? = nil,
        arrival: String? = "2026-05-22T22:00:00Z",
        privateNote: String? = nil
    ) -> SupportTrainReservationDTO {
        SupportTrainReservationDTO(
            id: "r1",
            slotId: "s1",
            userId: "u1",
            guestName: nil,
            status: "pending",
            contributionMode: mode,
            dishTitle: dish,
            restaurantName: restaurant,
            estimatedArrivalAt: arrival,
            noteToRecipient: "Knock when you arrive.",
            privateNoteToOrganizer: privateNote,
            createdAt: "2026-05-15T10:00:00Z",
            updatedAt: "2026-05-15T10:00:00Z",
            canceledAt: nil,
            helper: SupportTrainHelperDTO(
                id: "u1",
                username: "lena",
                name: "Lena Park",
                profilePictureUrl: nil
            )
        )
    }

    private func makeAPI() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    /// The organizer PATCH answers with the saved reservation; the form only
    /// patches the store and calls back after that reply.
    private func savedReservationJSON(
        mode: String = "cook",
        dish: String? = "Veggie chili",
        restaurant: String? = nil,
        privateNote: String? = nil
    ) -> String {
        func field(_ value: String?) -> String {
            value.map { "\"\($0)\"" } ?? "null"
        }
        return """
        {"id":"r1","slot_id":"s1","user_id":"u1","status":"pending",
         "contribution_mode":"\(mode)","dish_title":\(field(dish)),"restaurant_name":\(field(restaurant)),
         "estimated_arrival_at":"2026-05-22T22:00:00Z","note_to_recipient":"Knock when you arrive.",
         "private_note_to_organizer":\(field(privateNote)),
         "created_at":"2026-05-15T10:00:00Z","updated_at":"2026-05-15T10:05:00Z"}
        """
    }

    private func sentBody() throws -> [String: Any] {
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.last)
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let read = stream.read(&buffer, maxLength: buffer.count)
                if read <= 0 { break }
                data.append(buffer, count: read)
            }
        }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: - Prefill

    func testPrefillSeedsContributionFromDishTitleForCookMode() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation(mode: "cook"))
        XCTAssertEqual(vm.fields[.contribution]?.value, "Veggie chili")
        XCTAssertEqual(vm.contributionLabel, "Meal description")
        XCTAssertFalse(vm.contributionMapsToRestaurant)
    }

    func testPrefillSeedsContributionFromRestaurantForTakeoutMode() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation(
            mode: "takeout",
            dish: nil,
            restaurant: "Sweetgreen"
        ))
        XCTAssertEqual(vm.fields[.contribution]?.value, "Sweetgreen")
        XCTAssertEqual(vm.contributionLabel, "Restaurant")
        XCTAssertTrue(vm.contributionMapsToRestaurant)
    }

    func testPrefillSeedsDropoffTimeFromIso() {
        // 2026-05-22T22:00Z → wall-clock time depends on the device
        // time zone — assert only that the field is non-empty and
        // matches the HH:mm shape.
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        let value = vm.fields[.dropoffTime]?.value ?? ""
        XCTAssertTrue(
            value.range(of: #"^\d{2}:\d{2}$"#, options: .regularExpression) != nil,
            "Expected HH:mm, got '\(value)'"
        )
    }

    func testPrefillSeedsDietaryNotesFromPrivateNote() {
        let vm = EditSignupFormViewModel(
            supportTrainId: "st1",
            reservation: makeReservation(privateNote: "Strictly vegetarian.")
        )
        XCTAssertEqual(vm.fields[.dietaryNotes]?.value, "Strictly vegetarian.")
    }

    // MARK: - Dirty / valid

    func testInitialStateIsCleanButValid() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        XCTAssertFalse(vm.isDirty, "A pristine prefill is clean.")
        XCTAssertTrue(vm.isValid, "Prefilled values are valid by construction.")
    }

    func testEditingContributionFlipsDirty() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        vm.update(.contribution, to: "Veggie chili + cornbread")
        XCTAssertTrue(vm.isDirty)
        XCTAssertTrue(vm.isValid)
    }

    func testTooLongContributionMarksInvalid() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        vm.update(.contribution, to: String(repeating: "x", count: 201))
        XCTAssertNotNil(vm.fields[.contribution]?.error)
        XCTAssertFalse(vm.isValid)
    }

    // MARK: - Drop-off time validator

    func testDropoffTimeRejectsGarbage() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        vm.update(.dropoffTime, to: "two pm")
        XCTAssertNotNil(vm.fields[.dropoffTime]?.error)
        XCTAssertFalse(vm.isValid)
    }

    func testDropoffTimeAcceptsHHmm() {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        vm.update(.dropoffTime, to: "18:30")
        XCTAssertNil(vm.fields[.dropoffTime]?.error)
        XCTAssertTrue(vm.isValid)
    }

    // MARK: - Save → store

    func testSavePatchesStoreAndFiresCallback() async {
        let store = SupportTrainReservationsStore.shared
        var captured: SupportTrainReservationDTO?
        let reply = savedReservationJSON(dish: "Veggie chili + cornbread", privateNote: "Strictly vegetarian.")
        SequencedURLProtocol.sequence = [.status(200, body: reply)]
        let vm = EditSignupFormViewModel(
            supportTrainId: "st1",
            reservation: makeReservation(),
            store: store,
            api: makeAPI()
        ) { captured = $0 }
        vm.update(.contribution, to: "Veggie chili + cornbread")
        vm.update(.dropoffTime, to: "18:30")
        vm.update(.dietaryNotes, to: "Strictly vegetarian.")
        let ok = await vm.save()
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.httpMethod, "PATCH")
        XCTAssertEqual(try sentBody()["dish_title"] as? String, "Veggie chili + cornbread")
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertEqual(captured?.id, "r1")
        XCTAssertEqual(captured?.dishTitle, "Veggie chili + cornbread")
        XCTAssertEqual(captured?.privateNoteToOrganizer, "Strictly vegetarian.")
        // The store should now expose the patch for the list to consume.
        let patch = store.consumePatch(forId: "r1")
        XCTAssertEqual(patch?.dishTitle, "Veggie chili + cornbread")
    }

    func testSaveMapsContributionToRestaurantForTakeoutMode() async {
        let reply = savedReservationJSON(mode: "takeout", dish: nil, restaurant: "Sage & Stone")
        SequencedURLProtocol.sequence = [.status(200, body: reply)]
        let vm = EditSignupFormViewModel(
            supportTrainId: "st1",
            reservation: makeReservation(mode: "takeout", dish: nil, restaurant: "Sweetgreen"),
            api: makeAPI()
        )
        vm.update(.contribution, to: "Sage & Stone")
        let ok = await vm.save()
        XCTAssertTrue(ok)
        let body = try? sentBody()
        XCTAssertEqual(body?["restaurant_name"] as? String, "Sage & Stone")
        XCTAssertNil(body?["dish_title"] as? String)
        let patch = SupportTrainReservationsStore.shared.consumePatch(forId: "r1")
        XCTAssertEqual(patch?.restaurantName, "Sage & Stone")
        XCTAssertNil(patch?.dishTitle)
    }

    func testSaveFlipsShouldDismissAfterToastBeat() async {
        SequencedURLProtocol.sequence = [.status(200, body: savedReservationJSON(dish: "Tofu stir-fry"))]
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation(), api: makeAPI())
        vm.update(.contribution, to: "Tofu stir-fry")
        await vm.save()
        XCTAssertTrue(vm.shouldDismiss)
        vm.acknowledgeDismiss()
        XCTAssertFalse(vm.shouldDismiss)
    }

    func testSaveWithInvalidFieldShakesAndShortCircuits() async {
        let vm = EditSignupFormViewModel(supportTrainId: "st1", reservation: makeReservation())
        vm.update(.dropoffTime, to: "midnight-ish")
        let shakeBefore = vm.shakeTrigger
        let ok = await vm.save()
        XCTAssertFalse(ok)
        XCTAssertGreaterThan(vm.shakeTrigger, shakeBefore)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - Store revision

    func testStoreRevisionBumpsOnEachPatch() {
        let store = SupportTrainReservationsStore.shared
        let before = store.revision
        store.apply(makeReservation())
        XCTAssertEqual(store.revision, before &+ 1)
        store.apply(makeReservation(dish: "Different"))
        XCTAssertEqual(store.revision, before &+ 2)
    }

    func testConsumePatchRemovesIt() {
        let store = SupportTrainReservationsStore.shared
        store.apply(makeReservation())
        XCTAssertNotNil(store.consumePatch(forId: "r1"))
        XCTAssertNil(store.consumePatch(forId: "r1"), "Patch should be consumed exactly once.")
    }
}
