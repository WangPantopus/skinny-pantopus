//
//  GigComposeViewModelTests.swift
//  PantopusTests
//
//  Covers the A12.8 Post-a-Task wizard state machine: per-step validation
//  gates, forward/back navigation, preselect category, magic-post happy
//  path, submit error rollback, undo window, close-confirm dirty flag,
//  and the per-step chrome shape used by the snapshot baselines.
//

import XCTest
@testable import Pantopus

// swiftlint:disable force_unwrapping

// swiftlint:disable type_body_length file_length

@MainActor
final class GigComposeViewModelTests: XCTestCase {
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

    private func makeUploader() -> MultipartUploader {
        MultipartUploader(
            environment: .current,
            session: SequencedURLProtocol.makeSession()
        )
    }

    /// P6c — fresh draft queue over an ephemeral suite so tests never
    /// touch (or leak into) the real standard-defaults queue.
    private func makeQueue() -> GigDraftQueue {
        GigDraftQueue(defaults: UserDefaults(suiteName: "gig-draft-tests-\(UUID().uuidString)")!)
    }

    /// Centralised constructor that injects an "always online" stub (or
    /// a fixed offline one) plus an ephemeral draft queue.
    private func makeVM(
        initialState: GigComposeFormState = .empty,
        queue: GigDraftQueue? = nil,
        isOnline: @escaping @MainActor () -> Bool = { true }
    ) -> GigComposeViewModel {
        GigComposeViewModel(
            api: makeAPI(),
            uploader: makeUploader(),
            location: FixedLocationProvider(
                UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
            ),
            initialState: initialState,
            draftQueue: queue ?? makeQueue(),
            isOnlineProvider: isOnline
        )
    }

    private static let magicPostJSON = """
    {"message":"Task posted","gig":{
      "id":"gig_42","title":"Hang 3 shelves","undo_window_ms":10000,"can_undo":true
    },"nearby_helpers":12,"notified_count":7}
    """

    private func filledAtFillGaps() -> GigComposeFormState {
        GigComposeFormState(
            step: GigComposeStep.fillGaps.rawValue,
            category: .handyman,
            title: "Hang 3 shelves in the living room",
            description: "Need three IKEA Lack shelves mounted on drywall. I have studs marked.",
            photoIds: []
        )
    }

    private func filledAtReview() -> GigComposeFormState {
        let future = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400))
        return GigComposeFormState(
            step: GigComposeStep.review.rawValue,
            category: .handyman,
            title: "Hang 3 shelves in the living room",
            description: "Need three IKEA Lack shelves mounted on drywall. I have studs marked.",
            photoIds: [],
            budgetType: .fixed,
            budgetMin: "60",
            budgetMax: "",
            scheduleType: .oneTime,
            scheduledStartISO: future,
            locationMode: .yourAddress
        )
    }

    // MARK: - Initial chrome (Step 1 — Describe)

    func testInitialChromeReflectsDescribeStep() {
        let vm = makeVM()
        let chrome = vm.chrome
        XCTAssertEqual(chrome.title, "Post a task")
        XCTAssertEqual(chrome.primaryCTALabel, "Review & post →")
        XCTAssertEqual(chrome.primaryCTAIdentifier, "gigCompose.cta.reviewPost")
        XCTAssertFalse(chrome.primaryCTAEnabled, "CTA must be disabled until a category is detected.")
        XCTAssertEqual(chrome.leading, .close)
        XCTAssertEqual(chrome.progressLabel, .stepOf(current: 1, total: 4))
        XCTAssertTrue(chrome.showsProgressBar)
    }

    func testManualChromeNudgesUntilCategoryPicked() {
        let vm = makeVM()
        vm.setComposeMode(.manual)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Pick a category to continue")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.selectCategory(.handyman)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testPreselectFromRouteArgument() {
        // A preselected category lands on the manual picker so the
        // pre-chosen tile keeps Continue enabled.
        let preselected = GigComposeFormState(composeMode: .manual, category: .cleaning)
        let vm = makeVM(initialState: preselected)
        XCTAssertEqual(vm.form.category, .cleaning)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testCategoryFromRawKeyParsesKnownAndUnknownValues() {
        XCTAssertEqual(GigComposeCategory.from(rawKey: "handyman"), .handyman)
        XCTAssertEqual(GigComposeCategory.from(rawKey: "petcare"), .petcare)
        XCTAssertNil(GigComposeCategory.from(rawKey: nil))
        XCTAssertNil(GigComposeCategory.from(rawKey: ""), "Empty key must return nil so the user picks fresh.")
        XCTAssertNil(GigComposeCategory.from(rawKey: "all"), "The feed filter sentinel must not preselect a tile.")
        XCTAssertNil(GigComposeCategory.from(rawKey: "nope"))
    }

    // MARK: - Step 2 — Fill gaps validation

    func testFillGapsRequiresTitleAndDescriptionLengths() {
        let seed = GigComposeFormState(step: GigComposeStep.fillGaps.rawValue, category: .handyman)
        let vm = makeVM(initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Empty fields must block Continue.")
        vm.setTitle("1234")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Title shorter than the 5-char minimum must block.")
        vm.setTitle("Hang shelves")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Description shorter than the 20-char minimum must block.")
        vm.setDescription("Long enough description to clear the 20 char floor.")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testTitleCannotExceedMax() {
        let vm = makeVM(initialState: GigComposeFormState(step: GigComposeStep.fillGaps.rawValue, category: .handyman))
        let oversize = String(repeating: "a", count: GigComposeLimits.titleMax + 50)
        vm.setTitle(oversize)
        XCTAssertEqual(vm.form.title.count, GigComposeLimits.titleMax)
    }

    func testPhotoCapEnforcedOnAdd() async {
        let vm = makeVM(initialState: GigComposeFormState(step: GigComposeStep.fillGaps.rawValue, category: .handyman))
        for _ in 0..<GigComposeLimits.maxPhotos + 3 {
            vm.addPhotoData(Data([0x1]))
        }
        XCTAssertEqual(vm.attachments.count, GigComposeLimits.maxPhotos)
        // Let the kicked uploads settle (599 stub → .failed) so no task
        // outlives the test.
        await vm.awaitUploadsForTesting()
    }

    func testFillGapsAllowsUnsetScheduleAndLocation() {
        // A12.8 — When/Where are optional on Fill gaps; magic-post
        // defaults them ("flexible" + no location).
        let vm = makeVM(initialState: filledAtFillGaps())
        XCTAssertNil(vm.form.scheduleType)
        XCTAssertNil(vm.form.locationMode)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testFillGapsOneTimeScheduleRequiresFutureDate() {
        let vm = makeVM(initialState: filledAtFillGaps())
        vm.selectScheduleType(.oneTime)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "One-time without a date must block.")
        vm.setScheduledStart(Date().addingTimeInterval(-3600))
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Past dates must not satisfy the future-only rule.")
        vm.setScheduledStart(Date().addingTimeInterval(3600))
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testSelectingNonOneTimeClearsDate() {
        var seed = filledAtFillGaps()
        seed.scheduledStartISO = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
        let vm = makeVM(initialState: seed)
        vm.selectScheduleType(.flexible)
        XCTAssertNil(vm.form.scheduledStartISO, "Switching off one-time must clear the leftover date.")
    }

    func testFillGapsAPlaceRequiresCompleteAddress() {
        let vm = makeVM(initialState: filledAtFillGaps())
        vm.selectLocationMode(.aPlace)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.updatePlaceAddress(line1: "123 Main St", city: "Portland", state: "OR", zip: "97214")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Step 3 — Budget validation

    func testBudgetOffersEnablesContinueWithoutNumbers() {
        var seed = filledAtFillGaps()
        seed.step = GigComposeStep.budget.rawValue
        let vm = makeVM(initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.selectBudgetType(.offers)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled, "Open-to-bids must not require a numeric min.")
    }

    func testBudgetFixedRequiresPositiveMin() {
        var seed = filledAtFillGaps()
        seed.step = GigComposeStep.budget.rawValue
        let vm = makeVM(initialState: seed)
        vm.selectBudgetType(.fixed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.setBudgetMin("0")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.setBudgetMin("25")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testBudgetSanitizerStripsNonDigits() {
        let vm = makeVM()
        vm.setBudgetMin("$1,234.50abc")
        XCTAssertEqual(vm.form.budgetMin, "1234.50")
        vm.setBudgetMin("12.3.4")
        XCTAssertEqual(vm.form.budgetMin, "12.34", "Only one decimal point survives sanitisation.")
    }

    // MARK: - Step 4 — Review chrome + magic-post body

    func testReviewChromeAndBuildBody() {
        let vm = makeVM(initialState: filledAtReview())
        let chrome = vm.chrome
        XCTAssertEqual(chrome.primaryCTALabel, "Post task")
        XCTAssertEqual(chrome.leading, .back)
        let body = vm.buildMagicPostBody()
        XCTAssertNotNil(body)
        XCTAssertEqual(body?.draft.title, "Hang 3 shelves in the living room")
        XCTAssertEqual(body?.draft.payType, "fixed")
        XCTAssertEqual(body?.draft.budgetFixed, 60)
        XCTAssertEqual(body?.draft.scheduleType, "scheduled")
        XCTAssertEqual(body?.draft.category, "Handyman", "Category rides as the backend's spelled label.")
        XCTAssertEqual(body?.location?.mode, "home")
        XCTAssertEqual(body?.sourceFlow, "magic")
        XCTAssertNil(body?.beneficiaryUserId, "Personal identity posts with a null beneficiary.")
    }

    func testVirtualMapsToRemoteTaskFormat() {
        var seed = filledAtReview()
        seed.locationMode = .virtual
        let vm = makeVM(initialState: seed)
        let body = vm.buildMagicPostBody()
        XCTAssertEqual(body?.taskFormat, "remote")
        XCTAssertEqual(body?.location?.mode, "custom")
    }

    func testRecurringMapsToFlexibleWireValue() {
        var seed = filledAtReview()
        seed.scheduleType = .recurring
        seed.scheduledStartISO = nil
        let vm = makeVM(initialState: seed)
        XCTAssertEqual(vm.buildMagicPostBody()?.draft.scheduleType, "flexible")
    }

    func testManualPathPostsAsClassicWithTitleFallbackText() {
        var seed = filledAtReview()
        seed.composeMode = .manual
        seed.describeText = ""
        let vm = makeVM(initialState: seed)
        let body = vm.buildMagicPostBody()
        XCTAssertEqual(body?.sourceFlow, "classic")
        XCTAssertEqual(body?.text, "Hang 3 shelves in the living room", "Empty describe falls back to the title.")
        XCTAssertNil(body?.aiDraftJson, "Manual posts carry no AI draft echo.")
    }

    // MARK: - Forward / back navigation

    func testForwardAdvancesThroughSteps() async {
        let vm = makeVM()
        vm.setComposeMode(.manual)
        vm.selectCategory(.handyman)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .fillGaps)
        vm.setTitle("Hang 3 shelves")
        vm.setDescription("Need three IKEA Lack shelves mounted on drywall.")
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .budget)
        vm.selectBudgetType(.offers)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review)
    }

    func testBackPreservesData() async {
        let vm = makeVM()
        vm.setComposeMode(.manual)
        vm.selectCategory(.handyman)
        await vm.advanceForTesting()
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .describe)
        XCTAssertEqual(vm.form.category, .handyman, "Going back must not stomp the user's category pick.")
    }

    // MARK: - Submit happy path / error rollback

    func testSubmitPostsToMagicPostAndRecordsGigId() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.magicPostJSON)]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.createdGigId, "gig_42")
        XCTAssertEqual(vm.notifiedCount, 7)
        XCTAssertEqual(vm.nearbyHelpers, 12)
        XCTAssertEqual(vm.undoSecondsRemaining, 10, "Undo countdown starts at the response's window.")
        XCTAssertEqual(vm.chrome.primaryCTALabel, "View task")
        XCTAssertEqual(vm.chrome.secondaryCTA?.identifier, "composeGigDone")
        XCTAssertFalse(vm.chrome.showsProgressBar)
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/gigs/magic-post")
        XCTAssertEqual(request?.httpMethod, "POST")
    }

    func testSubmitErrorKeepsUserOnReview() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"down\"}")]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review)
        XCTAssertNotNil(vm.errorMessage)
    }

    func testSuccessPrimaryFiresOpenGigDetailEvent() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.magicPostJSON)]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.pendingEvent, .openGigDetail(gigId: "gig_42"))
    }

    func testSuccessSecondaryFiresDismissEvent() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.magicPostJSON)]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        vm.secondaryTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    // MARK: - Undo window

    func testUndoReturnsToReviewWithFormIntact() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: Self.magicPostJSON),
            .status(200, body: #"{"message":"Task undone","gigId":"gig_42"}"#)
        ]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success)
        await vm.undoPost()
        XCTAssertEqual(vm.currentStep, .review, "Undo lands back on Review with the form intact.")
        XCTAssertNil(vm.createdGigId)
        XCTAssertEqual(vm.undoSecondsRemaining, 0)
        XCTAssertEqual(vm.infoMessage, "Task undone")
        XCTAssertEqual(vm.form.title, "Hang 3 shelves in the living room")
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/gigs/gig_42/undo")
        XCTAssertEqual(request?.httpMethod, "POST")
    }

    func testUndoFailureClearsCountdownButStaysOnSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: Self.magicPostJSON),
            .status(400, body: #"{"error":"Undo window has expired"}"#)
        ]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        await vm.undoPost()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.undoSecondsRemaining, 0, "A refused undo kills the pill.")
        XCTAssertEqual(vm.createdGigId, "gig_42")
    }

    // MARK: - Close-confirm

    func testCloseOnEmptyStep1IsClean() {
        let vm = makeVM()
        XCTAssertFalse(vm.chrome.dirty)
    }

    func testCloseAfterSelectingCategoryIsDirty() {
        let vm = makeVM()
        vm.selectCategory(.handyman)
        XCTAssertTrue(vm.chrome.dirty, "Any entered data must trigger the discard confirm.")
    }

    func testCloseOnSuccessStepIsClean() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.magicPostJSON)]
        let vm = makeVM(initialState: filledAtReview())
        await vm.advanceForTesting()
        XCTAssertFalse(vm.chrome.dirty, "Success step must not gate dismiss with a discard confirm.")
    }

    // MARK: - Restore from SceneStorage

    func testRestoreCopiesSnapshotIntoEmptyForm() {
        let vm = makeVM()
        vm.restore(from: filledAtFillGaps())
        XCTAssertEqual(vm.currentStep, .fillGaps)
        XCTAssertEqual(vm.form.title, "Hang 3 shelves in the living room")
    }

    func testRestoreNoOpsOnceFormIsDirty() {
        let vm = makeVM(initialState: filledAtFillGaps())
        let other = GigComposeFormState(step: GigComposeStep.budget.rawValue, category: .cleaning, title: "X")
        vm.restore(from: other)
        XCTAssertEqual(vm.form.title, "Hang 3 shelves in the living room", "Restore must not stomp existing data.")
    }

    // MARK: - E.1 Composer picker sheets

    func testBuildBodyCarriesPickerSheetFields() throws {
        let deadline = ISO8601DateFormatter().string(from: Date().addingTimeInterval(172_800))
        let vm = makeVM(initialState: filledAtReview())
        vm.setDeadline(deadline)
        vm.setCancellationPolicy(.moderate)
        vm.setUrgent(true)
        vm.addTag("#Heavy Lifting")
        vm.addTag("weekend")
        let body = try XCTUnwrap(vm.buildMagicPostBody())
        XCTAssertEqual(body.draft.timeWindowEnd, deadline, "Deadline rides as the schedule window's end.")
        XCTAssertEqual(body.draft.cancellationPolicy, "standard", "Moderate maps onto the backend's standard tier.")
        XCTAssertTrue(body.draft.isUrgent)
        XCTAssertEqual(body.draft.tags, ["heavy-lifting", "weekend"])
    }

    func testBuildBodyOmitsPickerFieldsWhenUnset() throws {
        let body = try XCTUnwrap(makeVM(initialState: filledAtReview()).buildMagicPostBody())
        XCTAssertNil(body.draft.timeWindowEnd)
        XCTAssertNil(body.draft.cancellationPolicy)
        XCTAssertFalse(body.draft.isUrgent)
        XCTAssertNil(body.draft.tags)
    }

    // MARK: - G2 Delivery / pro-service module fields

    /// `delivery_errand` posts carry the flat pickup / drop-off columns.
    func testBuildBodyCarriesDeliveryModuleFields() throws {
        let vm = makeVM(initialState: filledAtReview())
        vm.updateForm { form in
            form.taskArchetype = "delivery_errand"
            form.deliveryDetails = GigDeliveryDetails(
                pickupAddress: "  12 Market St  ",
                pickupNotes: "Ask for John",
                dropoffAddress: "48 Rose Court",
                dropoffNotes: "",
                proofRequired: true
            )
        }
        let body = try XCTUnwrap(vm.buildMagicPostBody())
        XCTAssertEqual(body.draft.pickupAddress, "12 Market St", "Addresses are trimmed before sending.")
        XCTAssertEqual(body.draft.pickupNotes, "Ask for John")
        XCTAssertEqual(body.draft.dropoffAddress, "48 Rose Court")
        XCTAssertNil(body.draft.dropoffNotes, "Blank optional strings ride as null, matching RN.")
        XCTAssertEqual(body.draft.deliveryProofRequired, true)
        XCTAssertNil(body.draft.requiresLicense, "Pro columns stay absent on a delivery post.")
    }

    /// `pro_service_quote` posts carry the licence / insurance / scope /
    /// deposit columns, and the deposit amount is required once on.
    func testBuildBodyCarriesProServiceModuleFields() throws {
        let vm = makeVM(initialState: filledAtReview())
        vm.updateForm { form in
            form.taskArchetype = "pro_service_quote"
            form.proServiceDetails = GigProServiceDetails(
                requiresLicense: true,
                licenseType: "Licensed Plumber",
                requiresInsurance: true,
                scopeDescription: "Replace the water heater",
                depositRequired: true,
                depositAmount: "150"
            )
        }
        let body = try XCTUnwrap(vm.buildMagicPostBody())
        XCTAssertEqual(body.draft.requiresLicense, true)
        XCTAssertEqual(body.draft.licenseType, "Licensed Plumber")
        XCTAssertEqual(body.draft.requiresInsurance, true)
        XCTAssertEqual(body.draft.scopeDescription, "Replace the water heater")
        XCTAssertEqual(body.draft.depositRequired, true)
        XCTAssertEqual(body.draft.depositAmount, 150.0)
        XCTAssertNil(body.draft.pickupAddress, "Delivery columns stay absent on a pro post.")
    }

    func testDepositToggleWithoutAmountBlocksPosting() {
        let vm = makeVM(initialState: filledAtReview())
        vm.updateForm { form in
            form.taskArchetype = "pro_service_quote"
            form.proServiceDetails = GigProServiceDetails(depositRequired: true, depositAmount: "")
        }
        XCTAssertNil(vm.buildMagicPostBody(), "A deposit with no amount is incomplete.")
        vm.updateForm { $0.proServiceDetails?.depositAmount = "75" }
        XCTAssertNotNil(vm.buildMagicPostBody())
    }

    func testCancellationPolicyWireValues() {
        XCTAssertEqual(GigCancellationPolicy.flexible.wireValue, "flexible")
        XCTAssertEqual(GigCancellationPolicy.moderate.wireValue, "standard")
        XCTAssertEqual(GigCancellationPolicy.strict.wireValue, "strict")
    }

    func testNormalizeTagStripsHashLowercasesAndHyphenates() {
        XCTAssertEqual(GigComposeViewModel.normalizeTag("#Heavy Lifting"), "heavy-lifting")
        XCTAssertEqual(GigComposeViewModel.normalizeTag("  Truck  Needed "), "truck-needed")
        XCTAssertNil(GigComposeViewModel.normalizeTag("   "))
        XCTAssertNil(GigComposeViewModel.normalizeTag("#"))
    }

    func testAddTagCapsAtMaxAndDedupes() {
        let vm = makeVM()
        for index in 0..<(GigComposeLimits.maxTags + 3) {
            vm.addTag("tag\(index)")
        }
        XCTAssertEqual(vm.form.tags.count, GigComposeLimits.maxTags, "Tag list is capped at maxTags.")
        let before = vm.form.tags
        vm.addTag("#TAG0")
        XCTAssertEqual(vm.form.tags, before, "Duplicate (normalised) tags are ignored.")
    }

    func testToggleTagAddsThenRemoves() {
        let vm = makeVM()
        vm.toggleTag("#furniture")
        XCTAssertEqual(vm.form.tags, ["furniture"])
        vm.toggleTag("#furniture")
        XCTAssertTrue(vm.form.tags.isEmpty, "Toggling an existing tag removes it.")
    }

    func testPresentAndDismissPicker() {
        let vm = makeVM()
        XCTAssertNil(vm.activePickerSheet)
        vm.presentPicker(.tags)
        XCTAssertEqual(vm.activePickerSheet, .tags)
        vm.dismissPicker()
        XCTAssertNil(vm.activePickerSheet)
    }

    func testModulePromptTapRoutesToEditors() {
        let vm = makeVM()
        vm.handleModulePromptTap(.when)
        XCTAssertEqual(vm.activePickerSheet, .when)
        vm.handleModulePromptTap(.location)
        XCTAssertEqual(vm.activePickerSheet, .location)
        vm.handleModulePromptTap(.effort)
        XCTAssertEqual(vm.activePickerSheet, .effort)
        vm.handleModulePromptTap(.budget)
        XCTAssertEqual(vm.currentStep, .budget, "Budget row jumps straight to the Budget & mode step.")
    }

    func testUrgencyAndDeadlineCountTowardDirty() {
        let vm = makeVM()
        XCTAssertFalse(vm.chrome.dirty)
        vm.setUrgent(true)
        XCTAssertTrue(vm.chrome.dirty, "Setting urgent must trigger the discard confirm.")
    }

    // MARK: - G. Price benchmark (budget step)

    private static let benchmarkJSON = """
    {"benchmark":{
      "low":40,"median":60,"high":120,
      "basis":"Based on 18 completed handyman tasks",
      "comparable_count":18,"category":"handyman"
    }}
    """

    private func budgetStepState() -> GigComposeFormState {
        GigComposeFormState(
            step: GigComposeStep.budget.rawValue,
            category: .handyman,
            title: "Hang 3 shelves in the living room",
            description: "Need three IKEA Lack shelves mounted on drywall.",
            photoIds: []
        )
    }

    func testBenchmarkFetchPopulatesHintWithGeoScope() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.benchmarkJSON)]
        let vm = makeVM(initialState: budgetStepState())
        await vm.loadPriceBenchmark()
        XCTAssertEqual(vm.priceBenchmark?.low, 40)
        XCTAssertEqual(vm.priceBenchmark?.median, 60)
        XCTAssertEqual(vm.priceBenchmark?.high, 120)
        XCTAssertEqual(vm.priceBenchmark?.basis, "Based on 18 completed handyman tasks")
        let url = SequencedURLProtocol.capturedRequests.last?.url
        XCTAssertEqual(url?.path, "/api/gigs/price-benchmark")
        let components = url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }
        var query: [String: String] = [:]
        for item in components?.queryItems ?? [] {
            query[item.name] = item.value
        }
        XCTAssertEqual(query["category"], "handyman")
        XCTAssertEqual(query["lat"], "40.7484", "Cached device location geo-scopes the benchmark.")
        XCTAssertEqual(query["lng"], "-73.9857")
    }

    func testBenchmarkHiddenWhenNoComparables() async {
        let zero = """
        {"benchmark":{"low":20,"median":50,"high":90,"basis":"Estimated average","comparable_count":0,"category":"handyman"}}
        """
        SequencedURLProtocol.sequence = [.status(200, body: zero)]
        let vm = makeVM(initialState: budgetStepState())
        await vm.loadPriceBenchmark()
        XCTAssertNil(vm.priceBenchmark, "comparable_count == 0 hides the hint.")
    }

    func testBenchmarkHiddenWhenBenchmarkNull() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"benchmark":null}"#)]
        let vm = makeVM(initialState: budgetStepState())
        await vm.loadPriceBenchmark()
        XCTAssertNil(vm.priceBenchmark)
    }

    func testBenchmarkFailureIsSilent() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM(initialState: budgetStepState())
        await vm.loadPriceBenchmark()
        XCTAssertNil(vm.priceBenchmark)
        XCTAssertNil(vm.errorMessage, "A failed benchmark fetch never surfaces an error.")
    }

    func testBenchmarkSkippedWithoutCategory() async {
        let vm = makeVM()
        await vm.loadPriceBenchmark()
        XCTAssertNil(vm.priceBenchmark)
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.isEmpty,
            "No category → no benchmark roundtrip."
        )
    }

    func testBenchmarkCachedPerCategory() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.benchmarkJSON)]
        let vm = makeVM(initialState: budgetStepState())
        await vm.loadPriceBenchmark()
        await vm.loadPriceBenchmark()
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.count,
            1,
            "Re-entering the budget step with the same category doesn't refetch."
        )
        XCTAssertNotNil(vm.priceBenchmark)
    }

    // MARK: - P6c. Offline draft queue

    func testOfflineSubmitEnqueuesDraftAndStaysOnReview() async {
        let queue = makeQueue()
        let vm = makeVM(initialState: filledAtReview(), queue: queue) { false }
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review, "Offline submit must not leave the review step.")
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertEqual(queue.drafts.count, 1, "The full form snapshot lands in the pending-drafts queue.")
        XCTAssertEqual(queue.drafts.first?.form.title, "Hang 3 shelves in the living room")
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.isEmpty,
            "No network roundtrip happens while offline."
        )
    }

    func testRepeatedOfflineSubmitsReplaceTheQueuedDraft() async {
        let queue = makeQueue()
        let vm = makeVM(initialState: filledAtReview(), queue: queue) { false }
        await vm.advanceForTesting()
        vm.setTitle("Hang 4 shelves in the living room")
        await vm.advanceForTesting()
        XCTAssertEqual(queue.drafts.count, 1, "Re-submitting offline replaces this wizard's stash.")
        XCTAssertEqual(queue.drafts.first?.form.title, "Hang 4 shelves in the living room")
    }

    func testSuccessfulSubmitRemovesEarlierOfflineStash() async {
        var online = false
        let queue = makeQueue()
        let vm = makeVM(initialState: filledAtReview(), queue: queue) { online }
        await vm.advanceForTesting()
        XCTAssertEqual(queue.drafts.count, 1)
        online = true
        SequencedURLProtocol.sequence = [.status(201, body: Self.magicPostJSON)]
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertTrue(queue.drafts.isEmpty, "A successful post must clear the wizard's queued stash.")
    }

    func testSaveDraftConfirmedEnqueuesAndDismisses() {
        let queue = makeQueue()
        let vm = makeVM(queue: queue)
        vm.setComposeMode(.manual)
        vm.selectCategory(.handyman)
        vm.saveDraftConfirmed()
        XCTAssertEqual(queue.drafts.count, 1, "Close-confirm Save draft stashes even an incomplete form.")
        XCTAssertEqual(queue.drafts.first?.form.category, .handyman)
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    func testDraftQueueCapsAtFiveDrafts() {
        let queue = makeQueue()
        for index in 0..<(GigDraftQueue.maxDrafts + 2) {
            queue.enqueue(GigComposeFormState(title: "Draft \(index)"), replacing: nil)
        }
        XCTAssertEqual(queue.drafts.count, GigDraftQueue.maxDrafts)
        XCTAssertEqual(queue.drafts.first?.form.title, "Draft 2", "Oldest drafts fall off past the cap.")
    }

    func testConnectivityErrorClassification() {
        XCTAssertTrue(
            GigComposeViewModel.isConnectivityError(
                APIError.transport(underlying: URLError(.notConnectedToInternet))
            )
        )
        XCTAssertTrue(GigComposeViewModel.isConnectivityError(URLError(.timedOut)))
        XCTAssertFalse(
            GigComposeViewModel.isConnectivityError(APIError.server(status: 500, body: "{}")),
            "Server-side failures must not be parked as offline drafts."
        )
        XCTAssertFalse(GigComposeViewModel.isConnectivityError(APIError.unauthorized))
    }

    // MARK: - P6c. Persona switching (identity chip)

    private static let myBusinessesJSON = """
    {"businesses":[
      {"id":"seat-1","role_base":"owner","title":"Founder","joined_at":null,
       "business_user_id":"biz-user-1",
       "business":{"id":"biz-user-1","username":"acme","name":"Acme Plumbing","email":null,
                   "profile_picture_url":null,"account_type":"business","city":"Portland","state":"OR"},
       "profile":null},
      {"id":"seat-2","role_base":"staff","title":null,"joined_at":null,
       "business_user_id":"",
       "business":{"id":"","username":null,"name":"Ghost LLC","email":null,
                   "profile_picture_url":null,"account_type":"business","city":null,"state":null},
       "profile":null}
    ]}
    """

    func testLoadIdentitiesAddsBusinessesAndHidesUnpostableRows() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.myBusinessesJSON)]
        let vm = makeVM()
        await vm.loadIdentitiesIfNeeded()
        XCTAssertEqual(vm.identityOptions.count, 2, "Personal + the one postable business.")
        XCTAssertEqual(vm.identityOptions.first, .personal)
        XCTAssertEqual(vm.identityOptions.last?.beneficiaryUserId, "biz-user-1")
        XCTAssertEqual(vm.identityOptions.last?.label, "Acme Plumbing")
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.last?.url?.path,
            "/api/businesses/my-businesses"
        )
        await vm.loadIdentitiesIfNeeded()
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "Identity fetch is once per wizard.")
    }

    func testLoadIdentitiesFailureKeepsPersonalOnly() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.loadIdentitiesIfNeeded()
        XCTAssertEqual(vm.identityOptions, [.personal])
        XCTAssertNil(vm.errorMessage, "A failed identity fetch never surfaces an error.")
    }

    func testSelectBusinessIdentityRidesBeneficiaryUserId() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: Self.myBusinessesJSON)]
        let vm = makeVM(initialState: filledAtReview())
        await vm.loadIdentitiesIfNeeded()
        let business = try XCTUnwrap(vm.identityOptions.last)
        vm.selectIdentity(business)
        XCTAssertEqual(vm.form.beneficiaryUserId, "biz-user-1")
        XCTAssertEqual(vm.form.beneficiaryName, "Acme Plumbing")
        let body = try XCTUnwrap(vm.buildMagicPostBody())
        XCTAssertEqual(body.beneficiaryUserId, "biz-user-1", "Business identity posts on the business's behalf.")
        vm.selectIdentity(.personal)
        XCTAssertNil(vm.form.beneficiaryUserId)
        XCTAssertNil(vm.form.beneficiaryName)
        XCTAssertNil(vm.buildMagicPostBody()?.beneficiaryUserId)
    }

    func testRestoredStaleBeneficiaryResetsToPersonal() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.myBusinessesJSON)]
        var seed = filledAtReview()
        seed.beneficiaryUserId = "biz-user-gone"
        seed.beneficiaryName = "Old Biz"
        let vm = makeVM(initialState: seed)
        await vm.loadIdentitiesIfNeeded()
        XCTAssertNil(vm.form.beneficiaryUserId, "A beneficiary without a current seat falls back to Personal.")
        XCTAssertNil(vm.form.beneficiaryName)
    }
}
