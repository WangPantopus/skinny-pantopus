import XCTest
@testable import Pantopus

@MainActor
extension AddHouseholdTaskFormViewModelTests {
    func testTextBindingsReadLiveValuesBetweenRenderPassesAndRespectSuspension() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        for (field, intended) in [
            (AddHouseholdTaskField.title, "Shared household task"),
            (.notes, "Simple household notes"),
            (.customInterval, "12")
        ] {
            let binding = vm.textBinding(for: field)
            binding.wrappedValue = ""
            // Keep one binding, as the text system does while several input
            // events arrive before SwiftUI recomputes the containing View.
            for character in intended {
                binding.wrappedValue += String(character)
            }
            XCTAssertEqual(binding.wrappedValue, intended)
            XCTAssertEqual(vm.fields[field]?.value, intended)
        }
        let notes = vm.textBinding(for: .notes)
        vm.suspend()
        notes.wrappedValue = "Retired write"
        XCTAssertEqual(notes.wrappedValue, "Simple household notes")
    }

    func testUnavailableRosterDoesNotClaimEmptyOrBlockUnassignedTask() async {
        for status in [403, 503] {
            SequencedURLProtocol.reset()
            SequencedURLProtocol.sequence = [
                .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
                .status(status, body: "{\"error\":\"Member list unavailable\"}")
            ]
            let vm = makeVM()
            await vm.load()
            if case .editing = vm.state {} else { XCTFail("Task permission is independently verified") }
            // A refused roster (403) is expected for a private setup or an ordinary member, and the
            // viewer can still take the task; only an unexpected failure says the list is unavailable.
            XCTAssertEqual(vm.assigneeReadState, status == 403 ? .loaded : .unavailable)
            XCTAssertEqual(
                vm.assigneeStatusMessage,
                status == 403 ? nil
                    : "Household members couldn't be loaded. You can take this task yourself or leave it unassigned."
            )
            XCTAssertEqual(vm.assignableMembers.map(\.displayName), ["Me"])
            XCTAssertNil(vm.selectedAssigneeId)
            vm.update(.title, to: "A household task")
            XCTAssertTrue(vm.isValid)
        }
    }

    func testRosterRefreshRetiresCachedMembersAndOnlyVerifiedEmptyClaimsEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.occupantsJSON),
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(503, body: "{}"),
            .status(200, body: AddHouseholdTaskFormFixtures.collectionJSON),
            .status(200, body: "{\"occupants\":[],\"pendingInvites\":[]}")
        ]
        let vm = makeVM()
        XCTAssertEqual(vm.assigneeReadState, .loading)
        XCTAssertEqual(vm.assigneeStatusMessage, "Checking household members…")
        await vm.load()
        XCTAssertEqual(vm.assignableMembers.first?.displayName, "Me")
        XCTAssertGreaterThan(vm.assignableMembers.count, 1)
        XCTAssertNil(vm.assigneeStatusMessage)
        await vm.refresh()
        // The cached roster is retired; only the viewer's own "Me" stays assignable.
        XCTAssertEqual(vm.assignableMembers.map(\.displayName), ["Me"])
        XCTAssertEqual(vm.assigneeReadState, .unavailable)
        await vm.refresh()
        XCTAssertEqual(vm.assigneeReadState, .loaded)
        XCTAssertEqual(vm.assignableMembers.map(\.displayName), ["Me"])
        XCTAssertNil(vm.assigneeStatusMessage)
        vm.suspend()
        XCTAssertEqual(vm.assigneeReadState, .loading)
    }
}
