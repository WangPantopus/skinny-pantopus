//
//  GigComposeMagicTests.swift
//  PantopusTests
//
//  A12.8 — Magic Task step-1 behaviour: the magic-draft backend parse
//  (success mapping, keyword fallback on failure, short-input skip,
//  advance-time prefill incl. module objects), compose-mode toggling,
//  the mode-aware CTA gate + secondary CTA, live module prompts, entity
//  highlight ranges, engagement-mode inference, the templates library,
//  and a structural render of both design frames.
//

import SwiftUI
import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class GigComposeMagicTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeVM(_ state: GigComposeFormState = .empty) -> GigComposeViewModel {
        GigComposeViewModel(
            api: APIClient(
                environment: .current,
                session: SequencedURLProtocol.makeSession(),
                retryPolicy: .none
            ),
            uploader: MultipartUploader(
                environment: .current,
                session: SequencedURLProtocol.makeSession()
            ),
            location: FixedLocationProvider(
                UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
            ),
            initialState: state
        ) { true }
    }

    // MARK: - Default entry

    func testDefaultComposeModeIsMagic() {
        XCTAssertEqual(makeVM().form.composeMode, .magic)
    }

    // MARK: - Magic draft (POST /api/gigs/magic-draft)

    private static let magicDraftJSON = """
    {
      "draft": {
        "title": "Mount TV on living room wall",
        "description": "Mount a 55-inch TV on drywall, cables hidden if possible.",
        "category": "Handyman",
        "task_archetype": "home_service",
        "pay_type": "fixed",
        "budget_fixed": 120,
        "hourly_rate": null,
        "estimated_hours": 2,
        "budget_range": {"min": 90, "max": 150},
        "schedule_type": "scheduled",
        "location_mode": "home",
        "privacy_level": "exact_after_accept",
        "tags": ["indoor", "tv-mount"],
        "is_urgent": false,
        "attachments_suggested": true,
        "logistics_details": {"workerCount": 1, "heavyLifting": false, "stairsInfo": "none"}
      },
      "confidence": 0.91,
      "fieldConfidence": {"title": 0.95, "category": 0.9},
      "clarifyingQuestion": "Do you already have a wall mount bracket?",
      "source": "ai",
      "elapsed": 420
    }
    """

    func testMagicDraftSuccessMapsCategoryArchetypeAndQuestion() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.magicDraftJSON)]
        let text = "Need someone to mount my TV this weekend"
        // Seed via initial state (not setDescribeText) so no background
        // debounce task races the direct parse call.
        let vm = makeVM(GigComposeFormState(describeText: text))
        await vm.parseDescribe(text)
        XCTAssertEqual(vm.form.detectedArchetype, .handyman, "Backend category string maps onto the compose enum.")
        XCTAssertEqual(vm.form.category, .handyman)
        XCTAssertEqual(vm.form.taskArchetype, "home_service", "task_archetype is mirrored for module groups.")
        XCTAssertEqual(vm.clarifyingQuestion, "Do you already have a wall mount bracket?")
        XCTAssertEqual(vm.draftConfidence, 0.91, "Top-level confidence is stashed for the magic-post echo.")
        XCTAssertFalse(vm.isParsingDraft, "Loading flag resets once the parse settles.")
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/gigs/magic-draft")
        XCTAssertEqual(request?.httpMethod, "POST")
    }

    func testMagicDraftPrefillsFormOnAdvance() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.magicDraftJSON)]
        let text = "Need someone to mount my TV this weekend"
        let vm = makeVM(GigComposeFormState(describeText: text))
        await vm.parseDescribe(text)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .fillGaps)
        XCTAssertEqual(vm.form.title, "Mount TV on living room wall")
        XCTAssertEqual(vm.form.description, "Mount a 55-inch TV on drywall, cables hidden if possible.")
        XCTAssertEqual(vm.form.budgetType, .fixed)
        XCTAssertEqual(vm.form.budgetMin, "120", "budget_fixed wins the min field for fixed pay.")
        XCTAssertEqual(vm.form.budgetMax, "150", "budget_range.max fills the optional ceiling.")
        XCTAssertEqual(vm.form.scheduleType, .oneTime, "Backend \"scheduled\" cleanly maps to one-time.")
        XCTAssertEqual(vm.form.tags, ["indoor", "tv-mount"])
        XCTAssertEqual(vm.form.estimatedHours, "2", "estimated_hours prefills the effort field.")
        XCTAssertEqual(vm.form.logisticsDetails?.workerCount, 1, "Draft module objects ride into the form.")
        XCTAssertEqual(vm.form.logisticsDetails?.stairsInfo, "none")
    }

    func testMagicDraftPrefillSkipsUserEditedFields() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.magicDraftJSON)]
        let text = "Need someone to mount my TV this weekend"
        let vm = makeVM(GigComposeFormState(describeText: text))
        await vm.parseDescribe(text)
        // User typed a title and picked open-to-offers before advancing.
        vm.setTitle("My own title for this")
        vm.selectBudgetType(.offers)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.form.title, "My own title for this", "Prefill must not stomp user input.")
        XCTAssertEqual(vm.form.budgetType, .offers, "User's offers pick survives the draft's fixed pay type.")
        XCTAssertEqual(vm.form.budgetMin, "", "No draft numbers bleed into a user-chosen budget type.")
        XCTAssertEqual(
            vm.form.description,
            "Mount a 55-inch TV on drywall, cables hidden if possible.",
            "Untouched fields still prefill."
        )
    }

    func testMagicDraftFailureFallsBackToKeywordMatcher() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"down\"}")]
        let text = "Assemble an IKEA desk this Saturday morning"
        let vm = makeVM(GigComposeFormState(describeText: text))
        await vm.parseDescribe(text)
        XCTAssertEqual(vm.form.detectedArchetype, .handyman, "Keyword matcher still detects on request failure.")
        XCTAssertNil(vm.clarifyingQuestion)
        XCTAssertNil(vm.magicDraft, "A failed parse leaves nothing to prefill.")
        XCTAssertFalse(vm.isParsingDraft)
    }

    func testShortDescribeSkipsBackendAndUsesKeywords() async {
        // No stubbed responses on purpose — a network call would surface
        // as a 599 capture.
        let text = "clean apartment"
        let vm = makeVM(GigComposeFormState(describeText: text))
        await vm.parseDescribe(text)
        XCTAssertEqual(vm.form.detectedArchetype, .cleaning)
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.isEmpty,
            "Fewer than 3 words must not hit /api/gigs/magic-draft."
        )
    }

    func testStaleParseResultIsIgnored() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.magicDraftJSON)]
        let vm = makeVM(GigComposeFormState(describeText: "walk my dog every morning"))
        await vm.parseDescribe("Need someone to mount my TV") // stale snapshot
        XCTAssertNil(vm.form.detectedArchetype, "Stale snapshots must not apply.")
        XCTAssertNil(vm.magicDraft)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty, "Stale snapshots never hit the network.")
    }

    func testBackendCategoryMapping() {
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Handyman"), .handyman)
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Pet Care"), .petcare)
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Child Care"), .childcare)
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Tech Support"), .tech)
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Grocery Pickup"), .delivery)
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Gardening"), .other, "Unknown buckets land on Other.")
        XCTAssertEqual(GigComposeCategory.from(backendCategory: "Other"), .other)
        XCTAssertNil(GigComposeCategory.from(backendCategory: nil))
        XCTAssertNil(GigComposeCategory.from(backendCategory: " "), "Blank category defers to the keyword fallback.")
    }

    // MARK: - Deterministic detection

    func testDetectArchetypeKeywordMap() {
        XCTAssertEqual(GigComposeViewModel.detectArchetype(from: "Help me move boxes Saturday"), .moving)
        XCTAssertEqual(GigComposeViewModel.detectArchetype(from: "Assemble an IKEA desk"), .handyman)
        XCTAssertEqual(GigComposeViewModel.detectArchetype(from: "Deep clean my apartment"), .cleaning)
        XCTAssertEqual(GigComposeViewModel.detectArchetype(from: "Walk my dog twice a day"), .petcare)
        XCTAssertEqual(GigComposeViewModel.detectArchetype(from: "Need a math tutor"), .tutoring)
        XCTAssertEqual(GigComposeViewModel.detectArchetype(from: "My wifi router needs setup"), .tech)
        XCTAssertNil(GigComposeViewModel.detectArchetype(from: "hi"))
        XCTAssertNil(GigComposeViewModel.detectArchetype(from: "something totally unrelated zzz"))
    }

    func testApplyDetectionMirrorsIntoCategory() {
        let vm = makeVM()
        vm.setDescribeText("Need someone to assemble an IKEA desk this Saturday")
        // Apply synchronously rather than waiting on the debounce.
        vm.applyDetection(for: vm.form.describeText)
        XCTAssertEqual(vm.form.detectedArchetype, .handyman)
        XCTAssertEqual(vm.form.category, .handyman)
    }

    func testApplyDetectionIgnoresStaleText() {
        let vm = makeVM()
        vm.setDescribeText("clean my place")
        vm.applyDetection(for: "an older snapshot") // stale → no-op
        XCTAssertNil(vm.form.detectedArchetype)
    }

    func testDescribeTextCappedAtMax() {
        let vm = makeVM()
        vm.setDescribeText(String(repeating: "a", count: GigComposeLimits.describeMax + 100))
        XCTAssertEqual(vm.form.describeText.count, GigComposeLimits.describeMax)
    }

    // MARK: - Entity highlight ranges

    func testHighlightRangesCoverMoneyTimeAndKeywords() {
        let text = "Assemble an IKEA desk Saturday morning, budget $120, takes 2 hours"
        let ranges = magicHighlightRanges(text: text, draft: nil)
        let snippets = ranges.map { String(text[$0]).lowercased() }
        XCTAssertTrue(snippets.contains("$120"), "Dollar amounts highlight. Got: \(snippets)")
        XCTAssertTrue(snippets.contains("2 hours"), "Numbers glued to hour words highlight. Got: \(snippets)")
        XCTAssertTrue(snippets.contains("saturday"), "Day words highlight. Got: \(snippets)")
        XCTAssertTrue(snippets.contains("morning"), "Time-of-day words highlight. Got: \(snippets)")
        XCTAssertTrue(snippets.contains("assemble"), "Detected-category keywords highlight. Got: \(snippets)")
        XCTAssertTrue(snippets.contains("ikea"), "All matching keywords highlight. Got: \(snippets)")
    }

    func testHighlightRangesAreSortedAndNonOverlapping() {
        let text = "Move moving boxes Saturday for $40-60"
        let ranges = magicHighlightRanges(text: text, draft: nil)
        for (left, right) in zip(ranges, ranges.dropFirst()) {
            XCTAssertLessThanOrEqual(left.upperBound, right.lowerBound, "Ranges must be merged + sorted.")
        }
    }

    func testHighlightRangesEmptyForEmptyText() {
        XCTAssertTrue(magicHighlightRanges(text: "", draft: nil).isEmpty)
    }

    // MARK: - CTA gate

    func testMagicCTAGatedOnDetection() {
        let vm = makeVM()
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Magic CTA is disabled before an archetype is detected.")
        vm.setDescribeText("Assemble an IKEA desk")
        vm.applyDetection(for: vm.form.describeText)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled, "Detection enables Review & post.")
    }

    func testManualCTAGatedOnCategory() {
        let vm = makeVM()
        vm.setComposeMode(.manual)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.selectCategory(.cleaning)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testManualPickerUsesEightConcreteArchetypes() {
        XCTAssertEqual(GigComposeCategory.manualPickerCases.count, 8)
        XCTAssertFalse(GigComposeCategory.manualPickerCases.contains(.other))
    }

    // MARK: - Mode toggle via secondary CTA

    func testMagicStepExposesPickCategorySecondary() {
        let vm = makeVM()
        XCTAssertEqual(vm.chrome.secondaryCTA?.identifier, "gigCompose.cta.pickCategory")
        XCTAssertEqual(vm.chrome.secondaryCTA?.icon, .layoutGrid)
    }

    func testSecondaryTapSwitchesToManual() {
        let vm = makeVM()
        vm.secondaryTapped()
        XCTAssertEqual(vm.form.composeMode, .manual)
    }

    func testManualStepHasNoSecondaryCTA() {
        let vm = makeVM()
        vm.setComposeMode(.manual)
        XCTAssertNil(vm.chrome.secondaryCTA, "Manual picker's back-to-magic affordance is an in-content banner.")
    }

    // MARK: - Engagement tiles (schedule mirror)

    func testEngagementTilesMirrorIntoScheduleType() {
        let vm = makeVM()
        XCTAssertEqual(vm.form.engagementTile, .oneTime)

        vm.selectEngagementMode(.recurring)
        XCTAssertEqual(vm.form.engagementTile, .recurring)
        XCTAssertEqual(vm.form.scheduleType, .recurring)

        vm.selectEngagementMode(.openEnded)
        XCTAssertEqual(vm.form.engagementTile, .openEnded)
        XCTAssertEqual(vm.form.scheduleType, .flexible)

        vm.selectEngagementMode(.oneTime)
        XCTAssertEqual(vm.form.engagementTile, .oneTime)
        XCTAssertNil(vm.form.scheduleType, "One-time clears the recurring/flexible leftover so When re-prompts.")
    }

    // MARK: - Backend engagement-mode inference

    func testInferEngagementModeRules() {
        XCTAssertEqual(
            GigComposeViewModel.inferEngagementMode(archetype: "pro_service_quote", scheduleType: "asap", isUrgent: true),
            .quotes,
            "Pro-quote archetype always wins."
        )
        XCTAssertEqual(
            GigComposeViewModel.inferEngagementMode(archetype: "quick_help", scheduleType: "asap", isUrgent: false),
            .instantAccept
        )
        XCTAssertEqual(
            GigComposeViewModel.inferEngagementMode(archetype: "home_service", scheduleType: "scheduled", isUrgent: true),
            .instantAccept,
            "Urgent (non-pro) tasks instant-accept."
        )
        XCTAssertEqual(
            GigComposeViewModel.inferEngagementMode(archetype: "home_service", scheduleType: "scheduled", isUrgent: false),
            .curatedOffers
        )
        XCTAssertEqual(
            GigComposeViewModel.inferEngagementMode(archetype: nil, scheduleType: nil, isUrgent: false),
            .curatedOffers
        )
    }

    func testEffectiveEngagementModeHonorsOverride() {
        let vm = makeVM()
        XCTAssertEqual(vm.effectiveEngagementMode, .curatedOffers, "Default inference with no archetype.")
        vm.selectEngagementOverride(.quotes)
        XCTAssertEqual(vm.effectiveEngagementMode, .quotes, "Explicit override wins over inference.")
    }

    // MARK: - Live module prompts

    func testModulePromptsReflectLiveFormState() {
        let future = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400))
        let vm = makeVM(
            GigComposeFormState(
                detectedArchetype: .handyman,
                category: .handyman,
                photoIds: [],
                budgetType: .fixed,
                budgetMin: "80",
                budgetMax: "120",
                scheduleType: .oneTime,
                scheduledStartISO: future,
                locationMode: .yourAddress,
                estimatedHours: "2"
            )
        )
        let prompts = vm.modulePrompts
        XCTAssertEqual(prompts.count, 5)
        XCTAssertEqual(prompts.map(\.key), [.when, .location, .effort, .photos, .budget])
        XCTAssertEqual(prompts.filter(\.isFilled).count, 4, "Everything but Photos is filled.")
        XCTAssertEqual(prompts.first { !$0.isFilled }?.key, .photos)
        XCTAssertEqual(prompts.first { !$0.isFilled }?.value, "Recommended for better bids")
        XCTAssertEqual(prompts.first { $0.key == .effort }?.value, "~2 hours")
        XCTAssertEqual(prompts.first { $0.key == .budget }?.value, "$80–120")
        XCTAssertEqual(prompts.first { $0.key == .location }?.value, "Your saved address")
    }

    func testModulePromptsAllNeededOnEmptyForm() {
        let vm = makeVM()
        XCTAssertTrue(vm.modulePrompts.allSatisfy { !$0.isFilled }, "Empty form → all five rows prompt.")
    }

    // MARK: - Templates library

    private static let templatesJSON = """
    {"templates":[
      {"id":"mount_tv","label":"Mount TV","icon":"📺",
       "template":{"title":"Mount TV on wall","category":"Handyman","tags":["indoor"],
                   "pay_type":"fixed","schedule_type":"today"}},
      {"id":"dog_walk","label":"Dog walking","icon":"🐕",
       "template":{"title":"Dog walking needed","category":"Pet Care","tags":["outdoor"],
                   "pay_type":"fixed","schedule_type":"today"}}
    ]}
    """

    func testTemplatesLoadOncePerSession() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.templatesJSON)]
        let vm = makeVM()
        await vm.loadTemplatesIfNeeded()
        await vm.loadTemplatesIfNeeded()
        XCTAssertEqual(vm.templates.count, 2)
        XCTAssertEqual(vm.templates.first?.id, "mount_tv")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "Templates are cached per session.")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/gigs/templates/library")
    }

    func testTemplatesFailureIsSilent() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.loadTemplatesIfNeeded()
        XCTAssertTrue(vm.templates.isEmpty)
        XCTAssertNil(vm.errorMessage, "A failed templates fetch never surfaces an error.")
    }

    func testApplyTemplateSeedsDescribeText() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.templatesJSON)]
        let vm = makeVM()
        await vm.loadTemplatesIfNeeded()
        guard let template = vm.templates.first else { return XCTFail("Expected a template") }
        vm.applyTemplate(template)
        XCTAssertEqual(vm.form.describeText, "Mount TV on wall", "Chip tap seeds the describe field.")
    }

    // MARK: - Structural render of both frames

    func testMagicPopulatedFrameRenders() {
        let state = GigComposeFormState(
            composeMode: .magic,
            describeText: "Assemble an IKEA desk this Saturday morning",
            detectedArchetype: .handyman,
            category: .handyman,
            scheduleType: .flexible,
            taskArchetype: "home_service"
        )
        assertRenders(GigComposeWizardView(viewModel: makeVM(state)) { _ in })
    }

    func testManualPickerFrameRenders() {
        let state = GigComposeFormState(composeMode: .manual)
        assertRenders(GigComposeWizardView(viewModel: makeVM(state)) { _ in })
    }

    func testFillGapsFrameRenders() {
        let state = GigComposeFormState(
            step: GigComposeStep.fillGaps.rawValue,
            category: .handyman,
            title: "Mount TV on wall",
            description: "Mount a 55-inch TV on drywall, cables hidden.",
            taskArchetype: "home_service"
        )
        assertRenders(GigComposeWizardView(viewModel: makeVM(state)) { _ in })
    }

    private func assertRenders(_ view: some View, file: StaticString = #filePath, line: UInt = #line) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 820))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 820)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
