import XCTest
@testable import Pantopus

@MainActor
final class HomeResidencyProgressTests: XCTestCase {
    private let home = "ddc24100-0000-4000-8000-000000000601"
    private let request = "ddc24100-0000-4000-8000-000000009001"

    private func api(_ routes: [String: [SequencedURLProtocol.Response]]) -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none)
    }

    private func page(cursor: String? = nil, items: Bool = true) -> String {
        let row = """
        {"id":"\(request)","home_id":"\(home)","submitted_address":"12 Example St, 3B","claimed_role":"renter",
         "status":"verified","created_at":null,"updated_at":null,"reviewed_at":null}
        """
        return "{\"requests\":[\(items ? row : "")],\"next_cursor\":\(cursor.map { "\"\($0)\"" } ?? "null")}"
    }

    func testPersonalHistorySurvivesFailedHomeReadWithoutGrantingNavigation() async throws {
        var openedHome = false
        let model = MyHomesListViewModel(
            api: api([
                "/api/homes/my-homes": [.status(503, body: "{}")],
                "/api/homes/my-residency": [.status(200, body: page())]
            ]),
            identity: { "residency-tests" },
            onOpenHome: { _ in openedHome = true }
        )
        await model.load()
        guard case let .loaded(sections, _) = model.state else { return XCTFail("Personal history must remain available") }
        let history = try XCTUnwrap(sections.first { $0.id == "residency-history" })
        let row = try XCTUnwrap(history.rows.first)
        XCTAssertEqual(row.title, "12 Example St, 3B")
        XCTAssertEqual(row.subtitle, "Review recorded")
        XCTAssertEqual(row.footer?.actions.first?.title, "Check residency status")
        XCTAssertNil(model.banner)
        row.onTap()
        await Task.yield()
        XCTAssertFalse(openedHome, "Historical approval cannot open the shared Home")
        XCTAssertTrue(sections.contains { $0.id == "homes-error" })
        model.suspend()
        guard case .loading = model.state else { return XCTFail("Retiring the screen must remove personal history") }
    }

    func testFailedNextPageRemainsExplicitlyRetryableWithoutDroppingHistory() async {
        let model = MyHomesListViewModel(
            api: api([
                "/api/homes/my-homes": [.status(200, body: "{\"homes\":[]}")],
                "/api/homes/my-residency": [.status(200, body: page(cursor: request))],
                "/api/homes/my-residency?after=\(request)": [.status(503, body: "{}"), .status(200, body: page(items: false))]
            ]),
            identity: { "residency-tests" },
            onOpenHome: { _ in }
        )
        await model.load()
        await model.loadMoreIfNeeded()
        guard case let .loaded(sections, autoLoad) = model.state else { return XCTFail("Keep the accepted first page") }
        XCTAssertFalse(autoLoad, "An unavailable page must not produce an automatic retry loop")
        XCTAssertEqual(sections.first?.rows.map(\.id), ["residency-request_" + request, "residency-retry"])
        await model.loadMoreIfNeeded()
        guard case let .loaded(recovered, _) = model.state else { return XCTFail("Retry must recover") }
        XCTAssertEqual(recovered.first?.rows.map(\.id), ["residency-request_" + request])
    }

    func testLateApprovedStatusIsRetiredWhenSessionChanges() async throws {
        let json = """
        {"home_id":"\(home)","request":null,"current_access":"shared","next_step":"home"}
        """
        var identity: String? = "first-account"
        let model = HomeResidencyProgressViewModel(
            homeId: home,
            api: api(["/api/homes/\(home)/my-residency": [.status(200, body: json, delay: 0.1)]])
        ) { identity }
        let read = Task { await model.refresh() }
        try await Task.sleep(for: .milliseconds(20))
        identity = "second-account"
        model.suspend()
        await read.value
        XCTAssertNil(model.progress)
        XCTAssertFalse(model.permits(.home))
        await model.refresh()
        XCTAssertNotNil(model.error)
        XCTAssertFalse(model.permits(.home))
    }
}
