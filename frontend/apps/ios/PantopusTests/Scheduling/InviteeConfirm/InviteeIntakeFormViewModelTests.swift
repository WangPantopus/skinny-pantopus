//
//  InviteeIntakeFormViewModelTests.swift
//  PantopusTests
//
//  Stream I6 — D1 Intake form view-model. Drives `GET /api/public/book/:slug`
//  with a stubbed 200 (event type + questions) / paused body and asserts the
//  schema-driven validation + the draft hand-off to D2.
//

import XCTest
@testable import Pantopus

@MainActor
final class InviteeIntakeFormViewModelTests: XCTestCase {
    private let slug = "ada"
    private let eventTypeSlug = "intro"
    private let start = "2026-06-17T16:30:00Z"
    private let tz = "America/Los_Angeles"

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        InviteeBookingDraftStore.shared.clear(slug: slug, eventTypeSlug: eventTypeSlug, start: start)
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(pushed: @escaping @MainActor (SchedulingRoute) -> Void = { _ in }) -> InviteeIntakeFormViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return InviteeIntakeFormViewModel(
            slug: slug,
            eventTypeSlug: eventTypeSlug,
            start: start,
            tz: tz,
            prefill: nil,
            push: pushed,
            client: client
        )
    }

    private var activeBody: String {
        """
        {"page":{"slug":"ada","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"},
        "status":"active",
        "eventTypes":[{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video",
        "questions":[
        {"id":"q1","label":"What should we cover?","field_type":"textarea","required":true,"sort_order":0},
        {"id":"q2","label":"Phone number","field_type":"phone","required":true,"sort_order":1},
        {"id":"q3","label":"How did you hear about us?","field_type":"select",
        "options":["A friend","Search"],"required":false,"sort_order":2}
        ]}]}
        """
    }

    func testLoadsEventTypeAndQuestions() async {
        SequencedURLProtocol.sequence = [.status(200, body: activeBody)]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .ready)
        XCTAssertEqual(viewModel.eventType?.name, "Intro call")
        XCTAssertEqual(viewModel.questions.count, 3)
    }

    func testPausedPageIsUnavailableNotError() async {
        let body = #"{"page":{"slug":"ada","owner_type":"user"},"status":"paused","eventTypes":[]}"#
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .unavailable = viewModel.state else {
            return XCTFail("expected .unavailable, got \(viewModel.state)")
        }
    }

    func testValidationRequiresNameEmailAndRequiredQuestions() async {
        SequencedURLProtocol.sequence = [.status(200, body: activeBody)]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertFalse(viewModel.isValid)

        viewModel.firstName = "Maya"
        viewModel.lastName = "Chen"
        viewModel.email = "maya.chen@gmail.com"
        XCTAssertFalse(viewModel.isValid, "required questions still unanswered")

        viewModel.setText("q1", "Walk through the Q3 rollout.")
        viewModel.setText("q2", "(415) 555-0142")
        XCTAssertTrue(viewModel.isValid)
    }

    func testInvalidEmailSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(200, body: activeBody)]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.email = "maya.chen@"
        viewModel.markTouched("email")
        XCTAssertEqual(viewModel.emailError, "Enter a valid email address")
    }

    func testReviewBookingStoresDraftAndPushesReviewRoute() async {
        var pushed: [SchedulingRoute] = []
        SequencedURLProtocol.sequence = [.status(200, body: activeBody)]
        let viewModel = makeViewModel { pushed.append($0) }
        await viewModel.load()
        viewModel.firstName = "Maya"
        viewModel.lastName = "Chen"
        viewModel.email = "maya.chen@gmail.com"
        viewModel.setText("q1", "Walk through the Q3 rollout.")
        viewModel.setText("q2", "(415) 555-0142")

        viewModel.reviewBooking()

        XCTAssertEqual(pushed, [.inviteeReviewConfirm(slug: slug, eventTypeSlug: eventTypeSlug, start: start, tz: tz)])
        let context = InviteeBookingDraftStore.shared.context(slug: slug, eventTypeSlug: eventTypeSlug, start: start)
        XCTAssertEqual(context?.draft.fullName, "Maya Chen")
        XCTAssertEqual(context?.draft.email, "maya.chen@gmail.com")
    }
}
