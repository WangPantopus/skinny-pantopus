//
//  ListingComposeWizardViewModelTests.swift
//  PantopusTests
//
//  Covers the Snap & Sell state machine: photo grid operations, validation
//  gating across the six steps, submit happy path + error rollback, and
//  the success-step CTA wiring.
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class ListingComposeWizardViewModelTests: ListingComposeWizardViewModelTestCase {
    // MARK: - Chrome shape

    func testInitialChromeIsPhotosStep() {
        let vm = makeVM()
        let chrome = vm.chrome
        XCTAssertEqual(chrome.title, "List an item")
        XCTAssertFalse(chrome.primaryCTAEnabled, "Continue is disabled until ≥1 photo is added.")
        XCTAssertEqual(chrome.primaryCTALabel, "Review suggestions")
        XCTAssertEqual(chrome.leading, .close)
        XCTAssertEqual(chrome.progressLabel, .stepOf(current: 1, total: 3))
    }

    func testProgressLabelOnEachStep() {
        for step in ListingComposeStep.allCases where step != .success {
            var seed = ListingComposeFormState.empty
            seed.entryMode = .manual
            seed.step = step.rawValue
            let vm = makeVM(initialState: seed)
            if let number = step.stepNumber {
                XCTAssertEqual(vm.chrome.progressLabel, .stepOf(current: number, total: 6))
                XCTAssertTrue(vm.chrome.showsProgressBar)
            }
        }
    }

    // MARK: - Photo step

    func testPhotoStepRequiresAtLeastOnePhoto() {
        let vm = makeVM()
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.addPhoto(token: "photo_a")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testAddingPhotosUntilCapIsReached() {
        let vm = makeVM()
        for index in 0..<10 {
            vm.addPhoto(token: "photo_\(index)")
        }
        XCTAssertEqual(vm.form.photos.count, ListingComposeFormState.maxPhotos)
    }

    func testRemovePhotoById() {
        let vm = makeVM()
        vm.addPhoto(token: "a")
        vm.addPhoto(token: "b")
        guard let firstId = vm.form.photos.first?.id else { return XCTFail("no photo") }
        vm.removePhoto(id: firstId)
        XCTAssertEqual(vm.form.photos.count, 1)
        XCTAssertEqual(vm.form.photos.first?.token, "b")
    }

    func testMovePhotoChangesHero() {
        let vm = makeVM()
        vm.addPhoto(token: "a")
        vm.addPhoto(token: "b")
        vm.addPhoto(token: "c")
        XCTAssertEqual(vm.heroPhoto?.token, "a")
        vm.movePhoto(from: 2, to: 0)
        XCTAssertEqual(vm.heroPhoto?.token, "c")
    }

    func testMakeHeroPromotesToZero() {
        let vm = makeVM()
        vm.addPhoto(token: "a")
        vm.addPhoto(token: "b")
        vm.addPhoto(token: "c")
        guard let secondId = vm.form.photos.dropFirst().first?.id else { return XCTFail("no photo") }
        vm.makeHero(id: secondId)
        XCTAssertEqual(vm.heroPhoto?.token, "b")
    }

    func testMakeHeroIsNoOpForFirstSlot() {
        let vm = makeVM()
        vm.addPhoto(token: "a")
        vm.addPhoto(token: "b")
        guard let firstId = vm.form.photos.first?.id else { return XCTFail("no photo") }
        vm.makeHero(id: firstId)
        XCTAssertEqual(vm.heroPhoto?.token, "a")
    }

    func testSkipToManualPreservesOriginalPhotoGridPath() {
        let vm = makeVM()
        XCTAssertTrue(vm.isCameraCaptureStep)
        vm.skipToManualPhotoEditor()
        XCTAssertEqual(vm.form.entryMode, .manual)
        XCTAssertFalse(vm.isCameraCaptureStep)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue")
    }

    func testCameraCaptureAnalyzesPhotosAndAppliesAIDraft() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.visionDraftJSON)]
        let vm = makeVM()
        vm.captureSnapPhoto(Self.fakeJPEG)
        vm.captureSnapPhoto(Self.fakeJPEG)
        vm.captureSnapPhoto(Self.fakeJPEG)
        XCTAssertEqual(vm.form.photos.count, 3)
        XCTAssertEqual(vm.form.title, "", "Suggestions arrive from the vision draft, not capture.")

        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .titleCategory)
        XCTAssertTrue(vm.isSnapReviewStep)
        XCTAssertTrue(vm.aiDraftApplied)
        XCTAssertEqual(vm.form.title, "Sage green velvet sofa")
        XCTAssertEqual(vm.form.category, .goods)
        XCTAssertEqual(vm.form.backendCategory, "furniture")
        XCTAssertEqual(vm.form.condition, .good)
        XCTAssertEqual(vm.form.priceKind, .fixed)
        XCTAssertEqual(vm.form.priceAmount, "280", "Comp median wins over the draft's point price.")
        XCTAssertEqual(vm.form.priceSuggestion?.comparableCount, 47)
        XCTAssertEqual(vm.form.locationKind, .savedAddress)
        XCTAssertTrue(vm.form.deliveryEnabled)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Post listing")
        XCTAssertEqual(vm.chrome.secondaryCTA?.identifier, "listingComposeSaveDraft")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testVisionDraftFailureKeepsReviewEditable() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"AI_UNAVAILABLE\"}")]
        let vm = makeVM()
        vm.captureSnapPhoto(Self.fakeJPEG)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .titleCategory)
        XCTAssertTrue(vm.isSnapReviewStep)
        XCTAssertFalse(vm.aiDraftApplied)
        XCTAssertNotNil(vm.errorMessage, "Failure surfaces a fill-manually notice.")
        XCTAssertEqual(vm.form.locationKind, .savedAddress, "Review still seeds the location default.")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Empty fields keep Post disabled until filled.")
    }

    func testVisionDraftRunsOncePerSession() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.visionDraftJSON)]
        let vm = makeVM()
        vm.captureSnapPhoto(Self.fakeJPEG)
        await vm.advanceForTesting()
        XCTAssertTrue(vm.aiDraftApplied)
        vm.leadingTapped() // back to camera
        XCTAssertEqual(vm.currentStep, .photos)
        // No second stub queued — a re-run would 404 the sequence.
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .titleCategory)
        XCTAssertTrue(vm.aiDraftApplied)
    }

    func testSnapReviewPrimarySubmitsListingAndUploadsPhotos() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.visionDraftJSON),
            .status(201, body: Self.createListingJSON),
            .status(200, body: Self.listingMediaUploadJSON)
        ]
        let vm = makeVM()
        vm.captureSnapPhoto(Self.fakeJPEG)
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.createdListingId, "listing_42")
        XCTAssertNil(vm.errorMessage, "Photo upload succeeded — no notice.")
    }

    func testSnapReviewPhotoUploadFailureStillSucceedsWithNotice() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.visionDraftJSON),
            .status(201, body: Self.createListingJSON),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeVM()
        vm.captureSnapPhoto(Self.fakeJPEG)
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success, "Listing exists — upload failure is non-blocking.")
        XCTAssertNotNil(vm.errorMessage)
    }

    func testSnapReviewSaveDraftDismisses() async {
        let vm = makeVM()
        // Token-only photo (no bytes) — analysis is skipped, no stub needed.
        vm.addPhoto(token: "snap_angle_1")
        await vm.advanceForTesting()
        XCTAssertTrue(vm.isSnapReviewStep)
        vm.secondaryTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    // MARK: - Title + category

    func testTitleCategoryGate() {
        var seed = ListingComposeFormState.empty
        seed.entryMode = .manual
        seed.step = ListingComposeStep.titleCategory.rawValue
        seed.photos = [ListingComposePhoto(token: "p")]
        let vm = makeVM(initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Title and category both required.")
        vm.setTitle("Hi")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Title under 5 chars must fail.")
        vm.setTitle("Moving boxes — bundle of 18")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Title alone is not enough — category must be set.")
        vm.setCategory(.goods)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testTitleMaxLength() {
        var seed = ListingComposeFormState.empty
        seed.entryMode = .manual
        seed.step = ListingComposeStep.titleCategory.rawValue
        seed.photos = [ListingComposePhoto(token: "p")]
        let vm = makeVM(initialState: seed)
        vm.setCategory(.goods)
        vm.setTitle(String(repeating: "a", count: 81))
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Title over 80 chars must fail.")
        vm.setTitle(String(repeating: "a", count: 80))
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testFreeCategoryPicksPriceKindFree() {
        let vm = makeVM()
        vm.setCategory(.free)
        XCTAssertEqual(vm.form.priceKind, .free)
    }

    func testWantedCategoryClearsConditionAndSkipsConditionGate() {
        var seed = ListingComposeFormState.empty
        seed.step = ListingComposeStep.conditionDescription.rawValue
        seed.photos = [ListingComposePhoto(token: "p")]
        seed.title = "Looking for a sewing machine"
        seed.category = .wanted
        seed.bodyText = "Anything in working order would be great — thank you, neighbors!"
        let vm = makeVM(initialState: seed)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled, "Wanted skips the condition requirement.")
    }

    // MARK: - Condition + description

    func testDescriptionMinLength() {
        var seed = ListingComposeFormState.empty
        seed.step = ListingComposeStep.conditionDescription.rawValue
        seed.photos = [ListingComposePhoto(token: "p")]
        seed.title = "Moving boxes — bundle of 18"
        seed.category = .goods
        seed.condition = .likeNew
        let vm = makeVM(initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Empty description must fail.")
        vm.setBody("Short body.")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Description under 20 chars must fail.")
        vm.setBody("Lightly used, perfect for a one-bedroom move across town.")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testConditionRequiredForGoods() {
        var seed = ListingComposeFormState.empty
        seed.step = ListingComposeStep.conditionDescription.rawValue
        seed.photos = [ListingComposePhoto(token: "p")]
        seed.title = "Moving boxes — bundle of 18"
        seed.category = .goods
        seed.bodyText = "Lightly used, perfect for a one-bedroom move across town."
        let vm = makeVM(initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Condition required for goods.")
        vm.setCondition(.likeNew)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Price step

    func testFixedPriceRequiresPositiveAmount() {
        var seed = ListingComposeFormState.empty
        seed.step = ListingComposeStep.price.rawValue
        let vm = makeVM(initialState: seed)
        vm.setPriceKind(.fixed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Empty amount must fail.")
        vm.setPriceAmount("0")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Zero must fail.")
        vm.setPriceAmount("25")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testFreePriceKindIsAlwaysValid() {
        var seed = ListingComposeFormState.empty
        seed.step = ListingComposeStep.price.rawValue
        let vm = makeVM(initialState: seed)
        vm.setPriceKind(.free)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testPriceAmountFiltersToDecimal() {
        let vm = makeVM()
        vm.setPriceAmount("abc12.5")
        XCTAssertEqual(vm.form.priceAmount, "12.5")
        vm.setPriceAmount("12.3.4")
        // Two-decimal-separator input is rejected — last valid value sticks.
        XCTAssertEqual(vm.form.priceAmount, "12.5")
    }

    // MARK: - Location step

    func testLocationRequiresSelection() {
        var seed = ListingComposeFormState.empty
        seed.step = ListingComposeStep.location.rawValue
        let vm = makeVM(initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.setLocationKind(.savedAddress)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Submit happy path

    func testSubmitAdvancesToSuccessAndRecordsListingId() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.createListingJSON)]
        let vm = makeVM(initialState: readyToSubmit())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.createdListingId, "listing_42")
        XCTAssertEqual(vm.chrome.primaryCTALabel, "View listing")
        XCTAssertEqual(vm.chrome.secondaryCTA?.identifier, "listingComposeBackToMarketplace")
        XCTAssertFalse(vm.chrome.showsProgressBar, "Success step hides the progress bar.")
    }

    func testSubmitErrorKeepsUserOnReview() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"server\"}")]
        let vm = makeVM(initialState: readyToSubmit())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review)
        XCTAssertNotNil(vm.errorMessage)
    }

    func testSubmitOfflineSurfacesInlineError() async {
        let vm = ListingComposeWizardViewModel(
            api: makeAPI(),
            initialState: readyToSubmit()
        ) { false }
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review, "Offline submit stays on review.")
        XCTAssertEqual(
            vm.errorMessage,
            "You're offline. Try again when you're back online."
        )
    }

    // MARK: - Success step CTAs

    func testSuccessPrimaryEmitsOpenListingEvent() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.createListingJSON)]
        let vm = makeVM(initialState: readyToSubmit())
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.pendingEvent, .openListingDetail(listingId: "listing_42"))
    }

    func testSuccessSecondaryEmitsDismiss() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.createListingJSON)]
        let vm = makeVM(initialState: readyToSubmit())
        await vm.advanceForTesting()
        vm.secondaryTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    // MARK: - Close-confirm

    func testCloseOnEmptyStep1IsClean() {
        let vm = makeVM()
        XCTAssertFalse(vm.chrome.dirty)
    }

    func testCloseOnDirtyStep1RequiresConfirm() {
        let vm = makeVM()
        vm.addPhoto(token: "a")
        XCTAssertTrue(vm.chrome.dirty)
    }

    func testCloseOnSuccessIsClean() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.createListingJSON)]
        let vm = makeVM(initialState: readyToSubmit())
        await vm.advanceForTesting()
        XCTAssertFalse(vm.chrome.dirty)
    }

    // MARK: - Restore

    func testRestoreCopiesSnapshotIntoEmptyForm() {
        let vm = makeVM()
        vm.restore(from: readyToSubmit())
        XCTAssertEqual(vm.form.title, "Moving boxes — bundle of 18")
        // Local photo bytes never persist to SceneStorage, so the dead
        // tokens are dropped and the wizard rewinds to capture.
        XCTAssertTrue(vm.form.photos.isEmpty)
        XCTAssertEqual(vm.currentStep, .photos)
    }

    func testRestoreKeepsRemotePhotosAndStep() {
        var snapshot = readyToSubmit()
        snapshot.photos = [ListingComposePhoto(token: "https://example.com/a.jpg")]
        let vm = makeVM()
        vm.restore(from: snapshot)
        XCTAssertEqual(vm.currentStep, .review)
        XCTAssertEqual(vm.form.photos.count, 1)
    }

    func testRestoreNoOpsOnceFormIsDirty() {
        let vm = makeVM()
        vm.addPhoto(token: "existing")
        vm.restore(from: readyToSubmit())
        XCTAssertEqual(vm.form.photos.count, 1)
        XCTAssertEqual(vm.form.photos.first?.token, "existing")
    }

    // MARK: - Back navigation

    func testBackOnTitleStepGoesToPhotos() {
        var seed = ListingComposeFormState.empty
        seed.entryMode = .manual
        seed.step = ListingComposeStep.titleCategory.rawValue
        seed.photos = [ListingComposePhoto(token: "p")]
        let vm = makeVM(initialState: seed)
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .photos)
    }
}
