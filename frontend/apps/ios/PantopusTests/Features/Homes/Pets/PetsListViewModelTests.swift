//
//  PetsListViewModelTests.swift
//  PantopusTests
//
//  T5.2.1 — Pets list. Covers:
//    - load → loaded / empty / error transitions
//    - row mapping per species (palette + chip + thumbnail leading)
//    - optimistic delete + rollback on failure
//    - Add wizard handler inserts at top
//    - Edit wizard handler updates in place
//

import XCTest
@testable import Pantopus

@MainActor
final class PetsListViewModelTests: XCTestCase {
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

    private func makeVM(homeId: String = "home_1") -> PetsListViewModel {
        PetsListViewModel(homeId: homeId, api: makeAPI())
    }

    private static let twoPetsJSON = """
    {"pets":[
      {"id":"p1","home_id":"home_1","name":"Mango","species":"dog",
       "breed":"Golden Retriever","notes":"Allergic to chicken.","photo_url":null,
       "created_at":"2026-05-15T10:00:00Z"},
      {"id":"p2","home_id":"home_1","name":"Biscuit","species":"cat",
       "breed":"Maine Coon","notes":"Skittish.","photo_url":null,
       "created_at":"2026-05-15T09:00:00Z"}
    ]}
    """

    private static let emptyJSON = """
    {"pets":[]}
    """

    private static let vetPetJSON = """
    {"pets":[
      {"id":"p1","home_id":"home_1","name":"Mango","species":"dog",
       "breed":"Golden Retriever","notes":"Allergic to chicken.","photo_url":null,
       "vet_name":"Bay Area Animal Hospital","vet_phone":"(415) 555-0142",
       "created_at":"2026-05-15T10:00:00Z"}
    ]}
    """

    func testVetContactRendersAsAChip() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.vetPetJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(
            sections.first?.rows.first?.chips?.first?.text,
            "Bay Area Animal Hospital · (415) 555-0142"
        )
    }

    func testRowsWithoutVetContactCarryNoChipRow() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPetsJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertNil(sections.first?.rows.first?.chips)
    }

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No pets yet")
        XCTAssertEqual(content.icon, .pawPrint)
        XCTAssertEqual(content.ctaTitle, "Add a pet")
    }

    func testLoadPopulatedTransitionsToLoaded() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPetsJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections.first?.rows.count, 2)
        XCTAssertEqual(hasMore, false)
        XCTAssertEqual(sections.first?.rows.first?.title, "Mango")
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLoadIsIdempotentAfterLoaded() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPetsJSON),
            // Second response would only fire if `load()` refetched. The VM
            // must short-circuit so this stays in the queue.
            .status(200, body: Self.emptyJSON)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.load()
        XCTAssertEqual(SequencedURLProtocol.sequence.count, 1)
    }

    // MARK: - Row mapping

    func testRowMappingDogUsesDogPalette() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPetsJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let mango = sections.first?.rows.first
        XCTAssertEqual(mango?.title, "Mango")
        XCTAssertEqual(mango?.subtitle, "Golden Retriever")
        XCTAssertEqual(mango?.body, "Allergic to chicken.")
        XCTAssertEqual(mango?.inlineChip?.text, "Dog")
        guard case let .thumbnail(_, size) = mango?.leading else {
            XCTFail("Expected thumbnail leading")
            return
        }
        XCTAssertEqual(size, .large)
        if case .kebab = mango?.trailing {
            // OK
        } else {
            XCTFail("Expected kebab trailing")
        }
    }

    func testRowMappingCatUsesCatPalette() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPetsJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let biscuit = sections.first?.rows.last
        XCTAssertEqual(biscuit?.title, "Biscuit")
        XCTAssertEqual(biscuit?.inlineChip?.text, "Cat")
    }

    func testRowMappingPhotoUrlSwitchesToRemoteThumbnail() async {
        let json = """
        {"pets":[{"id":"p1","home_id":"home_1","name":"Mango","species":"dog",
          "breed":null,"notes":null,"photo_url":"https://example.com/mango.jpg",
          "created_at":"2026-05-15T10:00:00Z"}]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first,
              case let .thumbnail(image, _) = row.leading else {
            XCTFail("Expected thumbnail leading")
            return
        }
        guard case .url = image else {
            XCTFail("Expected url thumbnail when photo_url is set")
            return
        }
    }

    func testRowMappingUnknownSpeciesFallsBackToOtherPalette() async {
        let json = """
        {"pets":[{"id":"p1","home_id":"home_1","name":"Hopper","species":"rabbit",
          "breed":null,"notes":null,"photo_url":null,
          "created_at":"2026-05-15T10:00:00Z"}]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected one row")
            return
        }
        // Rabbit collapses to the `Other` palette per the design.
        XCTAssertEqual(row.inlineChip?.text, "Rabbit")
        XCTAssertEqual(PetSpecies.parse("rabbit").palette.icon, .pawPrint)
    }

    // MARK: - Mutations

    func testHandleCreatedInsertsAtTop() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyJSON)]
        let vm = makeVM()
        await vm.load()
        let newPet = PetDTO(
            id: "p_new",
            homeId: "home_1",
            name: "Pickle",
            species: "bird",
            breed: nil
        )
        vm.handleCreated(newPet)
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected pet at top after handleCreated")
            return
        }
        XCTAssertEqual(row.title, "Pickle")
    }

    func testHandleUpdatedReplacesInPlace() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPetsJSON)]
        let vm = makeVM()
        await vm.load()
        let updated = PetDTO(
            id: "p1",
            homeId: "home_1",
            name: "Mango (updated)",
            species: "dog",
            breed: "Labrador"
        )
        vm.handleUpdated(updated)
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = sections.first?.rows.first { $0.id == "p1" }
        XCTAssertEqual(row?.title, "Mango (updated)")
        XCTAssertEqual(row?.subtitle, "Labrador")
    }

    func testDeleteOptimisticallyRemovesRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPetsJSON),
            .status(200, body: "{\"message\":\"Pet deleted\"}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.deletePet(petId: "p1")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after delete")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertNil(sections.first?.rows.first { $0.id == "p1" })
    }

    func testDeleteFailureRollsBack() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPetsJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.deletePet(petId: "p1")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after rollback")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
        XCTAssertNotNil(sections.first?.rows.first { $0.id == "p1" })
    }

    // MARK: - Chrome

    func testFABIsSecondaryCreate() {
        let vm = makeVM()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.icon, .plusCircle)
        XCTAssertEqual(fab.accessibilityLabel, "Add a pet")
        if case .secondaryCreate = fab.variant {
            // OK
        } else {
            XCTFail("Expected .secondaryCreate FAB variant")
        }
    }

    func testNoTopBarActionByDesign() {
        let vm = makeVM()
        // Design ships both a top-bar plus and a FAB. Spec says "if both,
        // pick FAB" — we drop the top-bar plus on mobile.
        XCTAssertNil(vm.topBarAction)
    }

    func testCachedPetLookupAfterLoad() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPetsJSON)]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.cachedPet(withId: "p1")?.name, "Mango")
        XCTAssertNil(vm.cachedPet(withId: "p_missing"))
    }
}
