//
//  InviteeReviewConfirmViewModelTests.swift
//  PantopusTests
//
//  Stream I6 — D2 Review & Confirm view-model. Seeds the draft store, then drives
//  `POST /api/public/book/:slug/:eventTypeSlug` with stubbed 201 (manageToken) /
//  409 (slot conflict) bodies and asserts the confirmed-route hand-off and the
//  409 → slot-taken recovery.
//

import XCTest
@testable import Pantopus

@MainActor
final class InviteeReviewConfirmViewModelTests: XCTestCase {
    private let slug = "ada"
    private let eventTypeSlug = "intro"
    private let start = "2026-06-17T16:30:00Z"
    private let tz = "America/Los_Angeles"

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        seedDraft()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        InviteeBookingDraftStore.shared.clear(slug: slug, eventTypeSlug: eventTypeSlug, start: start)
        super.tearDown()
    }

    private func seedDraft() {
        let json = """
        {"page":{"slug":"ada","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"},
        "status":"active",
        "eventTypes":[{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video"}]}
        """
        guard let data = json.data(using: .utf8),
              let view = try? JSONDecoder().decode(PublicBookView.self, from: data),
              let eventType = view.eventTypes.first else {
            return XCTFail("could not seed draft fixture")
        }
        let draft = InviteeBookingDraft(firstName: "Maya", lastName: "Chen", email: "maya.chen@gmail.com")
        InviteeBookingDraftStore.shared.set(InviteeReviewContext(
            slug: slug,
            eventTypeSlug: eventTypeSlug,
            start: start,
            tz: tz,
            eventType: eventType,
            page: view.page,
            draft: draft
        ))
    }

    private func makeViewModel(pushed: @escaping @MainActor (SchedulingRoute) -> Void = { _ in }) -> InviteeReviewConfirmViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return InviteeReviewConfirmViewModel(
            slug: slug, eventTypeSlug: eventTypeSlug, start: start, tz: tz, push: pushed, client: client
        )
    }

    func testLoadReadsDraftFromStore() async {
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .ready)
        XCTAssertEqual(viewModel.summary.eventName, "Intro call")
        XCTAssertFalse(viewModel.needsDetails)
    }

    func testConfirmPushesConfirmedAndRestoresReady() async {
        var pushed: [SchedulingRoute] = []
        let createBody = """
        {"booking":{"id":"b1","status":"confirmed","start_at":"2026-06-17T16:30:00Z","end_at":"2026-06-17T17:00:00Z"},
        "eventType":{"id":"et1","name":"Intro call","slug":"intro"},
        "page":{"confirmation_message":"See you soon","timezone":"America/Los_Angeles"},
        "manageToken":"mt_abc123","clientSecret":null}
        """
        SequencedURLProtocol.sequence = [.status(201, body: createBody)]
        let viewModel = makeViewModel { pushed.append($0) }
        await viewModel.load()
        await viewModel.confirm()

        XCTAssertEqual(pushed, [.inviteeConfirmed(manageToken: "mt_abc123")])
        // D3's Done/X pops back onto this screen: it must not stay frozen in
        // the .confirming shimmer after a successful push.
        XCTAssertEqual(viewModel.state, .ready)
    }

    func testConflictSurfacesSlotTakenWithAlternatives() async {
        var pushed: [SchedulingRoute] = []
        let conflictBody = """
        {"error":"SLOT_TAKEN","message":"This time was just taken",
        "alternatives":[{"start":"2026-06-17T17:00:00Z","end":"2026-06-17T17:30:00Z","startLocal":"2026-06-17T10:00:00"}]}
        """
        SequencedURLProtocol.sequence = [.status(409, body: conflictBody)]
        let viewModel = makeViewModel { pushed.append($0) }
        await viewModel.load()
        await viewModel.confirm()

        XCTAssertTrue(pushed.isEmpty, "no navigation on conflict")
        XCTAssertEqual(viewModel.state, .ready)
        XCTAssertTrue(viewModel.slotTakenActive)
        XCTAssertEqual(viewModel.slotTakenAlternatives.count, 1)
        XCTAssertEqual(viewModel.slotTakenAlternatives.first?.start, "2026-06-17T17:00:00Z")
    }
}
