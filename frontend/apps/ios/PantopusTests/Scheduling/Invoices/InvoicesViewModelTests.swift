//
//  InvoicesViewModelTests.swift
//  PantopusTests
//
//  G12 / G13 · Stream I15. Invoices list (grouping, totals, Stripe gate) and
//  invoice detail (line-item parse, send).
//

import XCTest
@testable import Pantopus

@MainActor
final class InvoicesViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = true
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = false
        super.tearDown()
    }

    private func session(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingClient {
        SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none))
    }

    // MARK: List

    private func listVM(_ routes: [String: [SequencedURLProtocol.Response]]) -> InvoicesListViewModel {
        InvoicesListViewModel(owner: .business(id: "biz1"), push: { _ in }, client: session(routes))
    }

    // swiftlint:disable line_length
    private let invoices = #"""
    {"invoices":[
      {"id":"inv1","business_user_id":"biz1","recipient_user_id":"u9","total_cents":22000,"currency":"USD","created_at":"2026-06-12T10:00:00Z"},
      {"id":"inv2","business_user_id":"biz1","recipient_user_id":"u8","total_cents":8000,"currency":"USD","created_at":"2026-06-10T10:00:00Z"}
    ]}
    """#
    // swiftlint:enable line_length

    func testListLoadedGroupsAndSums() async {
        let model = listVM([
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)],
            "/api/scheduling/invoices": [.status(200, body: invoices)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.invoices.count, 2)
        XCTAssertEqual(model.sections.count, 2)
        XCTAssertEqual(model.collectedMonthLabel, "2")
        XCTAssertTrue(model.outstandingLabel.contains("300"))
        XCTAssertTrue(model.reference(model.invoices[0]).hasPrefix("INV-"))
    }

    func testListGateWhenUnconnectedAndEmpty() async {
        let model = listVM([
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":false}"#)],
            "/api/scheduling/invoices": [.status(200, body: #"{"invoices":[]}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .gate)
    }

    func testListEmptyWhenConnected() async {
        let model = listVM([
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)],
            "/api/scheduling/invoices": [.status(200, body: #"{"invoices":[]}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testListErrorPhase() async {
        let model = listVM([
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)],
            "/api/scheduling/invoices": [.status(500, body: #"{"error":"boom"}"#)]
        ])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }

    // MARK: Detail

    private func detailVM(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingInvoiceDetailViewModel {
        SchedulingInvoiceDetailViewModel(owner: .business(id: "biz1"), invoiceId: "inv1", push: { _ in }, client: session(routes))
    }

    private let detail = #"""
    {"invoice":{"id":"inv1","business_user_id":"biz1","recipient_user_id":"u9","total_cents":64285,"currency":"USD",
      "line_items":[{"description":"Haircut · 45 min","quantity":1,"total_cents":4800},{"name":"5-session package","total_cents":22000}],
      "created_at":"2026-06-04T00:00:00Z"}}
    """#

    func testDetailLoadedParsesLineItems() async {
        let model = detailVM(["/api/scheduling/invoices/inv1": [.status(200, body: detail)]])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.lineItems.count, 2)
        XCTAssertEqual(model.lineItems[0].label, "Haircut · 45 min")
        XCTAssertTrue(model.totalLabel.contains("642"))
        XCTAssertTrue(model.reference.hasPrefix("INV-"))
    }

    func testDetailSendShowsToast() async {
        let model = detailVM([
            "/api/scheduling/invoices/inv1": [.status(200, body: detail)],
            "/api/scheduling/invoices/inv1/send": [.status(200, body: #"{"ok":true}"#)]
        ])
        await model.load()
        await model.send()
        XCTAssertTrue(model.showSentToast)
    }

    func testDetailErrorPhase() async {
        let model = detailVM(["/api/scheduling/invoices/inv1": [.status(404, body: #"{"error":"not found"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
