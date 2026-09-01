//
//  ManageTrainViewModelTests.swift
//  PantopusTests
//
//  A13.13 — covers the Manage train VM. `load()` projects the seeded
//  fixture (offline) or the live `GET /:id` payload; draft mutations stay
//  in-memory; `Send update` / `Close & thank` optimistically mutate local
//  state and fire `POST /:id/updates` / `POST /:id/complete`. Mirrors the
//  Android `ManageTrainViewModelTest` so the state machines stay in
//  lock-step across platforms.
//

import XCTest
@testable import Pantopus

@MainActor
final class ManageTrainViewModelTests: XCTestCase {
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

    /// Offline VM seeded with the design fixture (no `load()` network).
    private func makeVM(content: ManageTrainContent = ManageTrainSampleData.active) -> ManageTrainViewModel {
        ManageTrainViewModel(trainId: ManageTrainSampleData.trainId, api: makeAPI(), content: content)
    }

    func testLoadProjectsActiveFixture() async {
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.title, "Meals for the Murphy family")
        XCTAssertTrue(content.isActive)
        XCTAssertEqual(content.slotFillValue, "18/21")
        XCTAssertEqual(content.helpersValue, "12")
        XCTAssertEqual(content.daysLeftValue, "9d")
        XCTAssertEqual(content.dropoutValue, "1")
        XCTAssertEqual(content.organizeRows.map(\.id), ["edit-dates", "invite", "analytics"])
        XCTAssertEqual(content.closeRow.id, "close")
        XCTAssertTrue(content.closeRow.isDestructive)
    }

    func testInitialDraftMirrorsContent() async {
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.draftMessage.isEmpty, "Active fixture seeds a typed draft")
        XCTAssertEqual(vm.selectedAudienceId, "all")
        XCTAssertTrue(vm.pushToPhones)
        XCTAssertTrue(vm.canSendUpdate)
    }

    func testCharacterCapClampsOversizeInput() async {
        let vm = makeVM()
        await vm.load()
        let oversized = String(repeating: "x", count: manageTrainMessageMaxChars + 50)
        vm.updateDraftMessage(oversized)
        XCTAssertEqual(vm.draftMessage.count, manageTrainMessageMaxChars)
        XCTAssertEqual(vm.characterCount, manageTrainMessageMaxChars)
    }

    func testEmptyDraftDisablesSend() async {
        let vm = makeVM()
        await vm.load()
        vm.updateDraftMessage("   \n  ")
        XCTAssertFalse(vm.canSendUpdate, "Whitespace-only draft is not sendable")
    }

    func testSelectAudienceUpdatesSelection() async {
        let vm = makeVM()
        await vm.load()
        vm.selectAudience("upcoming")
        XCTAssertEqual(vm.selectedAudienceId, "upcoming")
    }

    func testSelectAudienceRejectsUnknownId() async {
        let vm = makeVM()
        await vm.load()
        vm.selectAudience("does-not-exist")
        XCTAssertEqual(vm.selectedAudienceId, "all", "Unknown ids are dropped")
    }

    func testSendUpdateClearsDraftAndFlashesToast() async {
        SequencedURLProtocol.sequence = [.status(201, body: "{\"id\":\"u1\"}")]
        let vm = makeVM()
        await vm.load()
        XCTAssertNil(vm.toast)
        await vm.sendUpdate()
        XCTAssertEqual(vm.draftMessage, "")
        XCTAssertNotNil(vm.toast, "Send fires the helpers toast")
        XCTAssertTrue(vm.toast?.contains("12") == true)
    }

    func testShowAndHideCloseSheet() async {
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.sheetMode, .hidden)
        vm.showCloseSheet()
        XCTAssertEqual(vm.sheetMode, .closing)
        vm.hideCloseSheet()
        XCTAssertEqual(vm.sheetMode, .hidden)
    }

    func testConfirmCloseFlipsTrainAndFiresToast() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"id\":\"t\",\"status\":\"completed\"}")]
        let vm = makeVM()
        await vm.load()
        vm.showCloseSheet()
        await vm.confirmClose()
        XCTAssertEqual(vm.sheetMode, .closed)
        if case let .loaded(content) = vm.state {
            XCTAssertFalse(content.isActive, "Confirm close flips the train chip to Closed")
        } else {
            XCTFail("Expected .loaded after confirmClose")
        }
        XCTAssertNotNil(vm.toast)
    }

    // MARK: - Live detail fetch → manage stats

    func testLoadFetchesDetailAndDerivesStats() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {
              "id":"t9","title":"Meals for the Reyes family","status":"active",
              "slots":[
                {"id":"s1","slot_date":"2025-12-01","slot_label":"Dinner","status":"full","filled_count":1,"capacity":1},
                {"id":"s2","slot_date":"2025-12-02","slot_label":"Dinner","status":"full","filled_count":1,"capacity":1},
                {"id":"s3","slot_date":"2025-12-03","slot_label":"Dinner","status":"open","filled_count":0,"capacity":1},
                {"id":"s4","slot_date":"2025-12-04","slot_label":"Dinner","status":"open","filled_count":0,"capacity":1}
              ],
              "my_reservations":[],"updates":[],"organizers":[]
            }
            """)
        ]
        let vm = ManageTrainViewModel(trainId: "t9", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.trainId, "t9")
        XCTAssertEqual(content.title, "Meals for the Reyes family")
        XCTAssertTrue(content.isActive)
        XCTAssertEqual(content.slotsTotal, 4)
        XCTAssertEqual(content.slotsFilled, 2)
        XCTAssertEqual(content.slotsOpen, 2)
        XCTAssertEqual(content.slotFillValue, "2/4")
        // Organize rows are static affordances even off live data.
        XCTAssertEqual(content.organizeRows.map(\.id), ["edit-dates", "invite", "analytics"])
    }

    func testLoadServerErrorSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = ManageTrainViewModel(trainId: "t9", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }

    func testSampleDataActiveFixtureMatchesDesignCopy() {
        let content = ManageTrainSampleData.active
        XCTAssertEqual(content.close.mealsDelivered, "18")
        XCTAssertEqual(content.close.neighborsHelped, "12")
        XCTAssertEqual(content.close.coverageDays, "12d")
        XCTAssertTrue(content.close.recipientQuote.contains("Theo"))
        XCTAssertEqual(content.audienceChips.first?.label, "All helpers")
        XCTAssertEqual(content.audienceChips.first?.count, "12")
    }
}
