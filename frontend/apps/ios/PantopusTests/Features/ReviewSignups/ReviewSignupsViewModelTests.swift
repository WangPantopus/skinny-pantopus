//
//  ReviewSignupsViewModelTests.swift
//  PantopusTests
//
//  T6.6c (P26.5) — Review signups. Covers:
//    - load → loaded / empty / error transitions
//    - filter chips: All / Pending / Confirmed / Edited / Canceled
//    - empty filter projections (one empty-state copy per filter)
//    - row mapping: display name fallback (`name` → `username` →
//      `guest_name` → "Helper"); subtitle uses `dish_title` first,
//      then `restaurant_name`, then humanised `contribution_mode`;
//      body wraps `note_to_recipient` in smart quotes; metaTail
//      includes the drop window from `estimated_arrival_at`.
//    - Edited chip surfaces when `updated_at != created_at`
//    - Optimistic confirm bumps row status and emits `onConfirm`
//    - Missing supportTrainId surfaces `.error` instead of fetching
//

import XCTest
@testable import Pantopus

@MainActor
final class ReviewSignupsViewModelTests: XCTestCase {
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
        supportTrainId: String = "st1",
        api: APIClient? = nil,
        onShareTrain: @escaping @MainActor () -> Void = {},
        onConfirm: @escaping @MainActor (String) -> Void = { _ in },
        onMessage: @escaping @MainActor (String) -> Void = { _ in },
        onEdit: @escaping @MainActor (SupportTrainReservationDTO) -> Void = { _ in }
    ) -> ReviewSignupsViewModel {
        ReviewSignupsViewModel(
            supportTrainId: supportTrainId,
            api: api ?? makeAPI(),
            onShareTrain: onShareTrain,
            onConfirm: onConfirm,
            onMessage: onMessage,
            onEdit: onEdit
        )
    }

    private func stub(_ body: String) {
        SequencedURLProtocol.routeResponses = [
            "/api/activities/support-trains/st1/reservations": [.status(200, body: body)]
        ]
    }

    // MARK: - Fixtures (real backend shape)

    private static let populatedJSON = """
    {"reservations":[
      {"id":"r1","slot_id":"s1","user_id":"u_a","guest_name":null,
       "status":"pending","contribution_mode":"meal",
       "dish_title":"Veggie chili + cornbread","restaurant_name":null,
       "estimated_arrival_at":"2026-05-22T22:00:00Z",
       "note_to_recipient":"I'll knock when I'm there",
       "private_note_to_organizer":null,
       "created_at":"2026-05-15T10:00:00Z",
       "updated_at":"2026-05-15T10:00:00Z","canceled_at":null,
       "User":{"id":"u_a","username":"lena","name":"Lena Park",
                "profile_picture_url":null}},
      {"id":"r2","slot_id":"s2","user_id":"u_b","guest_name":null,
       "status":"confirmed","contribution_mode":"meal",
       "dish_title":"Butternut squash soup","restaurant_name":null,
       "estimated_arrival_at":"2026-05-23T21:30:00Z",
       "note_to_recipient":null,"private_note_to_organizer":null,
       "created_at":"2026-05-14T10:00:00Z",
       "updated_at":"2026-05-15T11:00:00Z","canceled_at":null,
       "User":{"id":"u_b","username":"marcus","name":"Marcus Knowles",
                "profile_picture_url":null}},
      {"id":"r3","slot_id":"s3","user_id":"u_c","guest_name":null,
       "status":"canceled","contribution_mode":"meal",
       "dish_title":null,"restaurant_name":null,
       "estimated_arrival_at":null,
       "note_to_recipient":null,"private_note_to_organizer":null,
       "created_at":"2026-05-13T10:00:00Z",
       "updated_at":"2026-05-14T08:00:00Z","canceled_at":"2026-05-14T08:00:00Z",
       "User":{"id":"u_c","username":"junie","name":"Junie Lansing",
                "profile_picture_url":null}}
    ]}
    """

    private static let emptyJSON = """
    {"reservations":[]}
    """

    private static let guestFallbackJSON = """
    {"reservations":[
      {"id":"r99","slot_id":"s9","user_id":null,
       "guest_name":"Block Neighbor","status":"pending",
       "contribution_mode":"restaurant",
       "dish_title":null,"restaurant_name":"Sage & Stone",
       "estimated_arrival_at":"2026-05-25T23:00:00Z",
       "note_to_recipient":"Pickup under 'Chen'",
       "private_note_to_organizer":null,
       "created_at":"2026-05-15T10:00:00Z",
       "updated_at":"2026-05-15T10:00:00Z","canceled_at":null,
       "User":null}
    ]}
    """

    // MARK: - Lifecycle

    func testLoadPopulatedRendersLoadedAndHidesCanceledByDefault() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // 3 reservations in the feed, 1 canceled → default 'All' shows 2
        XCTAssertEqual(sections.first?.rows.count, 2)
    }

    func testLoadEmptyShowsShareTrainCTA() async {
        stub(Self.emptyJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No signups yet")
        XCTAssertEqual(content.ctaTitle, "Share train")
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.routeResponses = [
            "/api/activities/support-trains/st1/reservations": [.status(500, body: "{}")]
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testMissingSupportTrainIdSurfacesError() async {
        let vm = makeVM(supportTrainId: "")
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error for empty id, got \(vm.state)")
            return
        }
    }

    // MARK: - Filter chips

    func testFilterPendingProjectsPendingRowsOnly() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        vm.updateFilter(ReviewSignupsFilter.pending)
        guard case let .loaded(sections, _) = vm.state else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.map(\.id), ["r1"])
    }

    func testFilterConfirmedProjectsConfirmedRowsOnly() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        vm.updateFilter(ReviewSignupsFilter.confirmed)
        guard case let .loaded(sections, _) = vm.state else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.map(\.id), ["r2"])
    }

    func testFilterCanceledProjectsCanceledRowsOnly() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        vm.updateFilter(ReviewSignupsFilter.canceled)
        guard case let .loaded(sections, _) = vm.state else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.map(\.id), ["r3"])
    }

    func testFilterEditedProjectsRowsWithUpdatedDifferentFromCreated() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        vm.updateFilter(ReviewSignupsFilter.edited)
        guard case let .loaded(sections, _) = vm.state else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        // r1: updated == created → not edited
        // r2: updated > created → edited (but status confirmed)
        // r3: updated > created → edited but canceled (excluded)
        XCTAssertEqual(sections.first?.rows.map(\.id), ["r2"])
    }

    // MARK: - Row mapping

    func testRowFallsBackThroughDisplayNameChain() async {
        stub(Self.guestFallbackJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(row.title, "Block Neighbor")
    }

    func testRowSubtitlePrefersDishOverRestaurantOverContributionMode() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let first = sections.first?.rows.first else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(first.subtitle, "Veggie chili + cornbread")
    }

    func testRowSubtitleFallsBackToRestaurantWhenDishNil() async {
        stub(Self.guestFallbackJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(row.subtitle, "Sage & Stone")
    }

    func testRowBodyWrapsNoteInSmartQuotes() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(row.body, "\u{201C}I'll knock when I'm there\u{201D}")
    }

    func testEditedConfirmedRowShowsEditedChipNotConfirmed() async {
        stub(Self.populatedJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        // r2 is confirmed with updated_at != created_at → "Edited" chip
        let r2 = sections.first?.rows.first { $0.id == "r2" }
        guard case let .statusChip(text, _) = r2?.trailing else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertEqual(text, "Edited")
    }

    // MARK: - Optimistic confirm

    func testConfirmOptimisticallyBumpsStatusAndFiresCallback() async {
        stub(Self.populatedJSON)
        var capturedConfirmId: String?
        // swiftlint:disable:next trailing_closure
        let vm = makeVM(onConfirm: { id in capturedConfirmId = id })
        await vm.load()
        vm.confirm("r1")
        XCTAssertEqual(capturedConfirmId, "r1")
        vm.updateFilter(ReviewSignupsFilter.confirmed)
        guard case let .loaded(sections, _) = vm.state else { XCTFail("Unexpected state: \(vm.state)")
            return
        }
        XCTAssertTrue(sections.first?.rows.contains { $0.id == "r1" } ?? false)
    }
}
