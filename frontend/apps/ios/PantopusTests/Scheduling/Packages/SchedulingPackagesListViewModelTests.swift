//
//  SchedulingPackagesListViewModelTests.swift
//  PantopusTests
//
//  G8 · Stream I15. Drives the packages-list view-model against stubbed
//  responses keyed by route path.
//

import XCTest
@testable import Pantopus

@MainActor
final class SchedulingPackagesListViewModelTests: XCTestCase {
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

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingPackagesListViewModel {
        SchedulingPackagesListViewModel(
            owner: .business(id: "biz1"),
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    // swiftlint:disable line_length
    private let mixed = #"""
    {"packages":[
      {"id":"pk1","owner_type":"business","owner_id":"biz1","name":"5-session cleaning","sessions_count":5,"price_cents":22000,"currency":"USD","is_active":true,"created_at":"2026-06-10T00:00:00Z","sold_count":12},
      {"id":"pk2","owner_type":"business","owner_id":"biz1","name":"Summer 4-pack","sessions_count":4,"price_cents":16000,"currency":"USD","is_active":false,"created_at":"2026-06-09T00:00:00Z","sold_count":0}
    ]}
    """#
    // swiftlint:enable line_length

    func testLoadedSplitsActiveAndArchived() async {
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: mixed)],
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.activePackages.map(\.id), ["pk1"])
        XCTAssertEqual(model.archivedPackages.map(\.id), ["pk2"])
        XCTAssertTrue(model.paymentsConnected)
        let subtitle = model.subtitle(for: model.activePackages[0])
        XCTAssertTrue(subtitle.contains("5 sessions"))
        XCTAssertTrue(subtitle.contains("220"))
        XCTAssertTrue(subtitle.contains("44"))
    }

    func testSoldLabelReflectsPurchaseCount() async {
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: mixed)],
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)]
        ])
        await model.load()
        // pk1 has 12 issued credits → "· 12 sold"; pk2 has 0 → hidden.
        XCTAssertEqual(model.activePackages[0].soldCount, 12)
        XCTAssertEqual(model.soldLabel(for: model.activePackages[0]), "· 12 sold")
        XCTAssertNil(model.soldLabel(for: model.archivedPackages[0]))
    }

    func testSoldLabelNilWhenCountAbsent() async {
        // create/update responses omit `sold_count`; decode must not fail and the label hides.
        // swiftlint:disable:next line_length
        let body = #"{"packages":[{"id":"pk9","owner_type":"business","owner_id":"biz1","name":"No-count pack","sessions_count":3,"price_cents":9000,"currency":"USD","is_active":true,"created_at":"2026-06-08T00:00:00Z"}]}"#
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: body)],
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertNil(model.activePackages[0].soldCount)
        XCTAssertNil(model.soldLabel(for: model.activePackages[0]))
    }

    func testEmptyShowsPayoutsGateWhenUnconnected() async {
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: #"{"packages":[]}"#)],
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":false}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertTrue(model.activePackages.isEmpty)
        XCTAssertTrue(model.showsPayoutsGate)
    }

    func testEmptyNoGateWhenConnected() async {
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: #"{"packages":[]}"#)],
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)]
        ])
        await model.load()
        XCTAssertFalse(model.showsPayoutsGate)
    }

    func testErrorPhaseOnFailure() async {
        let model = vm(["/api/scheduling/packages": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }

    func testArchiveReloadsList() async {
        // swiftlint:disable:next line_length
        let archivedAfter = #"{"packages":[{"id":"pk1","owner_type":"business","owner_id":"biz1","name":"5-session cleaning","sessions_count":5,"price_cents":22000,"currency":"USD","is_active":false,"created_at":"2026-06-10T00:00:00Z"}]}"#
        // swiftlint:disable:next line_length
        let activeFirst = #"{"packages":[{"id":"pk1","owner_type":"business","owner_id":"biz1","name":"5-session cleaning","sessions_count":5,"price_cents":22000,"currency":"USD","is_active":true,"created_at":"2026-06-10T00:00:00Z"}]}"#
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: activeFirst), .status(200, body: archivedAfter)],
            "/api/scheduling/packages/pk1": [.status(200, body: #"{"ok":true}"#)],
            "/api/scheduling/payments/status": [.status(200, body: #"{"applicable":true,"connected":true}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.activePackages.map(\.id), ["pk1"])
        await model.archive(model.activePackages[0])
        XCTAssertTrue(model.activePackages.isEmpty)
        XCTAssertEqual(model.archivedPackages.map(\.id), ["pk1"])
    }

    func testComingSoonWhenFlagOff() async {
        // Only meaningful when the scheme doesn't force the env override on.
        guard ProcessInfo.processInfo.environment["SCHEDULING_PAID_ENABLED"] == nil else { return }
        SchedulingFeatureFlags.paidEnabled = false
        let model = vm(["/api/scheduling/packages": [.status(200, body: #"{"packages":[]}"#)]])
        await model.load()
        XCTAssertEqual(model.phase, .comingSoon)
    }
}
