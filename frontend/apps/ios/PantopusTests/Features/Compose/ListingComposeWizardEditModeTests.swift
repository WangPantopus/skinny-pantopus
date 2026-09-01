//
//  ListingComposeWizardEditModeTests.swift
//  PantopusTests
//
//  Edit-mode behavior for the Snap & Sell listing-compose flow.
//

import XCTest
@testable import Pantopus

@MainActor
final class ListingComposeWizardEditModeTests: ListingComposeWizardViewModelTestCase {
    func testEditModeChromeShowsEditTitle() {
        let vm = makeEditVM()
        XCTAssertTrue(vm.isEditMode)
        XCTAssertEqual(vm.chrome.title, "Edit listing")
        XCTAssertEqual(vm.editingListingId, "listing_42")
    }

    func testEditModeReviewStepCTAReads_SaveChanges() {
        var seed = readyToSubmit()
        seed.title = "Mid-century walnut credenza"
        seed.category = .goods
        seed.condition = .likeNew
        let vm = makeEditVM(initialState: seed)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Save changes")
    }

    func testEditPrefillProjectsListingDTOIntoForm() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editListingDetailJSON)
        ]
        let vm = makeEditVM()
        await vm.loadExistingIfNeeded()
        XCTAssertEqual(vm.form.title, "Mid-century walnut credenza")
        XCTAssertEqual(vm.form.category, .goods)
        XCTAssertEqual(vm.form.condition, .likeNew)
        XCTAssertEqual(vm.form.priceKind, .fixed)
        XCTAssertEqual(vm.form.priceAmount, "420")
        XCTAssertEqual(vm.form.bodyText, "Solid walnut, four sliding doors, dovetail joinery.")
        XCTAssertEqual(vm.form.photos.count, 2)
        XCTAssertEqual(vm.form.locationKind, .meetPoint)
        XCTAssertEqual(vm.form.locationLabel, "Lincoln Park bandshell")
        // jumpToStep default → land on review so the user can scan +
        // tap Save changes immediately.
        XCTAssertEqual(vm.currentStep, .review)
    }

    func testEditPrefillJumpsToPriceStepWhenRequested() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editListingDetailJSON)
        ]
        let vm = makeEditVM(jumpToStep: .price)
        await vm.loadExistingIfNeeded()
        XCTAssertEqual(vm.currentStep, .price, "Entry point requested price step.")
        XCTAssertEqual(vm.form.priceAmount, "420")
    }

    func testEditPrefillIsNoOpWhenFormAlreadyDirty() async {
        var seed = ListingComposeFormState.empty
        seed.title = "User-edited title"
        seed.photos = [ListingComposePhoto(token: "user_photo")]
        let vm = makeEditVM(initialState: seed)
        // No sequence stubbed — the fetch must not be attempted.
        await vm.loadExistingIfNeeded()
        XCTAssertEqual(vm.form.title, "User-edited title")
    }

    func testEditPrefillFreeListingMapsToFreeCategory() async {
        let json = """
        {"listing":{
          "id":"listing_free",
          "title":"Free moving boxes",
          "is_free":true,
          "category":"free_stuff",
          "layer":"goods",
          "listing_type":"free_item",
          "status":"active"
        }}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = makeEditVM(listingId: "listing_free")
        await vm.loadExistingIfNeeded()
        XCTAssertEqual(vm.form.category, .free)
        XCTAssertEqual(vm.form.priceKind, .free)
        XCTAssertEqual(vm.form.priceAmount, "")
    }

    func testEditPrefillWantedListingMapsToWantedCategory() async {
        let json = """
        {"listing":{
          "id":"listing_w",
          "title":"Looking for a sewing machine",
          "is_free":false,
          "category":"furniture",
          "layer":"goods",
          "listing_type":"wanted_request",
          "status":"active"
        }}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = makeEditVM(listingId: "listing_w")
        await vm.loadExistingIfNeeded()
        XCTAssertEqual(vm.form.category, .wanted)
    }

    func testEditPrefillSurfacesErrorOnFetchFailure() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeEditVM()
        await vm.loadExistingIfNeeded()
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertEqual(vm.form, .empty, "Form stays empty so retry can re-fetch.")
    }

    func testEditSubmitFiresPATCHAndEmitsListingUpdated() async {
        // Two-call sequence: prefill GET then update PATCH.
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editListingDetailJSON),
            .status(200, body: Self.updateListingJSON)
        ]
        let vm = makeEditVM()
        await vm.loadExistingIfNeeded()
        XCTAssertEqual(vm.currentStep, .review)
        await vm.advanceForTesting() // .review → submit
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.createdListingId, "listing_42")
        // Success step CTAs adapt to edit mode.
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Back to listing")
        XCTAssertEqual(vm.chrome.secondaryCTA?.identifier, "listingComposeEditDone")
        // Primary tap on success emits `.listingUpdated`, not `.openListingDetail`.
        await vm.advanceForTesting()
        XCTAssertEqual(vm.pendingEvent, .listingUpdated(listingId: "listing_42"))
    }

    func testEditSubmitErrorKeepsUserOnReviewWithErrorBanner() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editListingDetailJSON),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeEditVM()
        await vm.loadExistingIfNeeded()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review)
        XCTAssertNotNil(vm.errorMessage)
    }

    func testEditModeIsAlwaysDirtyPreSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editListingDetailJSON)
        ]
        let vm = makeEditVM()
        await vm.loadExistingIfNeeded()
        XCTAssertTrue(vm.chrome.dirty, "Edit mode warns on close so the user doesn't lose intent.")
    }

    func testEditModeSecondaryTapEmitsListingUpdated() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editListingDetailJSON),
            .status(200, body: Self.updateListingJSON)
        ]
        let vm = makeEditVM()
        await vm.loadExistingIfNeeded()
        await vm.advanceForTesting() // submit
        XCTAssertEqual(vm.currentStep, .success)
        vm.secondaryTapped()
        XCTAssertEqual(vm.pendingEvent, .listingUpdated(listingId: "listing_42"))
    }

    func testEditModeRestoreFromSceneStorageIsNoOp() {
        let vm = makeEditVM()
        var snap = ListingComposeFormState.empty
        snap.title = "From scene storage"
        vm.restore(from: snap)
        XCTAssertEqual(vm.form.title, "", "Edit mode never consumes the create-draft snapshot.")
    }
}
