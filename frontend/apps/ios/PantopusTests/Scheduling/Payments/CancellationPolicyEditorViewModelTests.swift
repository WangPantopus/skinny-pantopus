//
//  CancellationPolicyEditorViewModelTests.swift
//  PantopusTests
//
//  G14 · Stream I14. Drives the cancellation-policy editor against stubbed
//  booking-page / event-type responses: preset parsing, custom-object parsing,
//  the page-level vs per-service encodings, preset → refund_policy mapping, and
//  the save round-trip (PUT booking-page / PUT event-types/:id).
//

import XCTest
@testable import Pantopus

@MainActor
final class CancellationPolicyEditorViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func client(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingClient {
        SchedulingClient(client: APIClient(
            session: SequencedURLProtocol.makeSession(routeResponses: routes),
            retryPolicy: .none
        ))
    }

    private func pageVM(_ routes: [String: [SequencedURLProtocol.Response]]) -> CancellationPolicyEditorViewModel {
        CancellationPolicyEditorViewModel(
            owner: .business(id: "biz1"),
            eventTypeId: nil,
            push: { _ in },
            client: client(routes)
        )
    }

    /// A booking-page response carrying the given `cancellation_policy` JSON.
    private func page(_ policy: String) -> String {
        """
        {"page":{"id":"p1","owner_type":"business","slug":"acme",
        "is_live":true,"is_paused":false,"cancellation_policy":\(policy)}}
        """
    }

    func testLoadPagePreset() async {
        let model = pageVM(["/api/scheduling/booking-page": [.status(200, body: page("\"Strict\""))]])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.selectedPreset, .strict)
        XCTAssertEqual(model.previewText, "No refund once the booking is confirmed.")
    }

    func testLoadPageCustomObject() async {
        let custom = """
        {"preset":"custom","free_cancel_window_min":2880,"refund_after_pct":25,
        "deposit_non_refundable":false,"no_show":"no_charge"}
        """
        let model = pageVM(["/api/scheduling/booking-page": [.status(200, body: page(custom))]])
        await model.load()
        XCTAssertEqual(model.selectedPreset, .custom)
        XCTAssertEqual(model.customCutoffHours, 48)
        XCTAssertEqual(model.customRefundPct, 25)
        XCTAssertFalse(model.depositNonRefundable)
        XCTAssertEqual(model.noShowMode, .noCharge)
    }

    func testSelectUpdatesPreviewAndDefaults() async {
        let model = pageVM(["/api/scheduling/booking-page": [.status(200, body: page("\"Flexible\""))]])
        await model.load()
        XCTAssertEqual(model.selectedPreset, .flexible)
        model.select(.moderate)
        XCTAssertEqual(model.customCutoffHours, 48)
        XCTAssertEqual(model.customRefundPct, 50)
        XCTAssertEqual(model.previewText, "50% refund up to 48 hours before. After that, no refund.")
    }

    func testPagePolicyEncoding() async {
        let model = pageVM(["/api/scheduling/booking-page": [.status(200, body: page("\"Flexible\""))]])
        await model.load()
        model.select(.strict)
        XCTAssertEqual(model.pagePolicyValue(), .string("Strict"))

        model.select(.custom)
        model.customCutoffHours = 24
        model.customRefundPct = 50
        model.depositNonRefundable = true
        model.noShowMode = .chargeFull
        guard case let .object(dict) = model.pagePolicyValue() else { return XCTFail("expected object") }
        XCTAssertEqual(dict["free_cancel_window_min"], .number(1440))
        XCTAssertEqual(dict["refund_after_pct"], .number(50))
        XCTAssertEqual(dict["deposit_non_refundable"], .bool(true))
        XCTAssertEqual(dict["no_show"], .string("charge_full"))
    }

    func testRefundPolicyMapping() async {
        let model = pageVM(["/api/scheduling/booking-page": [.status(200, body: page("\"Flexible\""))]])
        await model.load()
        model.select(.flexible)
        XCTAssertEqual(model.refundPolicyValue, "full")
        model.select(.moderate)
        XCTAssertEqual(model.refundPolicyValue, "partial")
        model.select(.strict)
        XCTAssertEqual(model.refundPolicyValue, "none")
        model.select(.custom)
        model.customRefundPct = 0
        model.depositNonRefundable = false
        XCTAssertEqual(model.refundPolicyValue, "none")
        model.customRefundPct = 100
        model.depositNonRefundable = false
        XCTAssertEqual(model.refundPolicyValue, "full")
        model.customRefundPct = 40
        model.depositNonRefundable = true
        XCTAssertEqual(model.refundPolicyValue, "deposit_only")
    }

    func testSavePageRoundTrips() async {
        let routes: [String: [SequencedURLProtocol.Response]] = [
            "/api/scheduling/booking-page": [
                .status(200, body: page("\"Flexible\"")),
                .status(200, body: page("\"Strict\""))
            ]
        ]
        let model = pageVM(routes)
        await model.load()
        model.select(.strict)
        await model.save()
        XCTAssertTrue(model.didSave)
        XCTAssertNil(model.saveError)
    }

    func testLoadEventTypeDerivesPreset() async {
        let eventType = """
        {"eventType":{"id":"et1","name":"Consult","slug":"consult","durations":[30],
        "cancellation_window_min":2880,"refund_policy":"partial",
        "deposit_refundable":true,"price_cents":5000}}
        """
        let model = CancellationPolicyEditorViewModel(
            owner: .business(id: "biz1"),
            eventTypeId: "et1",
            push: { _ in },
            client: client(["/api/scheduling/event-types/et1": [.status(200, body: eventType)]])
        )
        await model.load()
        XCTAssertEqual(model.selectedPreset, .moderate)
        XCTAssertEqual(model.refundPolicyValue, "partial")
    }

    func testSaveEventTypeRoundTrips() async {
        let eventType = """
        {"eventType":{"id":"et1","name":"Consult","slug":"consult","durations":[30],
        "cancellation_window_min":1440,"refund_policy":"full","price_cents":5000}}
        """
        let routes: [String: [SequencedURLProtocol.Response]] = [
            "/api/scheduling/event-types/et1": [
                .status(200, body: eventType),
                .status(200, body: eventType)
            ]
        ]
        let model = CancellationPolicyEditorViewModel(
            owner: .business(id: "biz1"),
            eventTypeId: "et1",
            push: { _ in },
            client: client(routes)
        )
        await model.load()
        model.select(.strict)
        await model.save()
        XCTAssertTrue(model.didSave)
    }

    func testLoadFailureSurfacesError() async {
        let model = pageVM(["/api/scheduling/booking-page": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
