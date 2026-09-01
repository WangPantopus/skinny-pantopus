//
//  MaintenanceListViewModelTests.swift
//  PantopusTests
//
//  Covers the Maintenance VM (T6.3b / P10):
//    - four-state transitions (loading / empty / error / loaded)
//    - 6-state chip derivation (scheduled / dueSoon / overdue /
//      inProgress / completed / cancelled)
//    - per-status projection (chip text + subtitle + inlineChip +
//      highlight)
//    - task-category inference from task title
//    - banner summary projection (overdue + YTD spend + next-up)
//    - tab filtering across the new chip set
//    - FAB variant + tint
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class MaintenanceListViewModelTests: XCTestCase {
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

    /// Frozen "now" — 2026-05-15T12:00:00Z — so chip derivation +
    /// subtitle formatting are deterministic.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM(api: APIClient? = nil) -> MaintenanceListViewModel {
        let frozen = Self.fixedNow
        // swiftlint:disable trailing_closure
        return MaintenanceListViewModel(
            homeId: "home-1",
            api: api ?? makeAPI(),
            now: { frozen }
        )
        // swiftlint:enable trailing_closure
    }

    private func makeTask(
        id: String = "t",
        task: String = "HVAC tune-up",
        vendor: String? = "Riverside HVAC",
        cost: Decimal? = 185,
        recurrence: String = "yearly",
        dueDate: String? = "2026-05-25T08:00:00Z",
        status: String = "scheduled"
    ) -> MaintenanceTaskDTO {
        MaintenanceTaskDTO(
            id: id,
            homeId: "home-1",
            task: task,
            vendor: vendor,
            cost: cost,
            recurrence: recurrence,
            dueDate: dueDate,
            status: status
        )
    }

    // MARK: - Four states

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"tasks\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No maintenance logged yet")
        XCTAssertEqual(content.ctaTitle, "Log maintenance")
    }

    func testErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadedMapsRowToAmountWithChip() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {
                "id":"m1",
                "home_id":"home-1",
                "task":"Fall HVAC tune-up",
                "vendor":"Riverside HVAC",
                "cost":"185",
                "recurrence":"yearly",
                "due_date":"2026-05-25T08:00:00Z",
                "status":"scheduled"
              }
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections.first?.rows.count, 1)
        guard let row = sections.first?.rows.first else {
            XCTFail("Expected first row")
            return
        }
        XCTAssertEqual(row.id, "m1")
        XCTAssertEqual(row.title, "Fall HVAC tune-up")
        guard case let .amountWithChip(amount, chipText, _, _) = row.trailing else {
            XCTFail("Expected amountWithChip trailing, got \(String(describing: row.trailing))")
            return
        }
        XCTAssertEqual(amount, "$185")
        XCTAssertEqual(chipText, "Scheduled")
    }

    // MARK: - Chip derivation

    func testChipCancelledWins() {
        let task = makeTask(dueDate: "2026-05-01T00:00:00Z", status: "cancelled")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .cancelled)
    }

    func testChipCompletedWins() {
        let task = makeTask(dueDate: "2030-01-01T00:00:00Z", status: "completed")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .completed)
    }

    func testChipInProgressWhenStatusSet() {
        let task = makeTask(status: "in_progress")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .inProgress)
    }

    func testChipOverdueWhenScheduledAndDuePast() {
        let task = makeTask(dueDate: "2026-05-01T00:00:00Z", status: "scheduled")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .overdue)
    }

    func testChipDueSoonWhenScheduledAndWithinSevenDays() {
        // fixedNow = 2026-05-15; 6 days out = 2026-05-21 → dueSoon
        let task = makeTask(dueDate: "2026-05-21T00:00:00Z", status: "scheduled")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .dueSoon)
    }

    func testChipScheduledWhenBeyondSevenDays() {
        let task = makeTask(dueDate: "2026-05-30T00:00:00Z", status: "scheduled")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .scheduled)
    }

    func testChipScheduledWhenNoDueDate() {
        let task = makeTask(dueDate: nil, status: "scheduled")
        XCTAssertEqual(MaintenanceListViewModel.chipStatus(for: task, now: Self.fixedNow), .scheduled)
    }

    // MARK: - Projection

    func testProjectionScheduledSubtitle() {
        let projection = MaintenanceListViewModel.project(
            task: makeTask(
                task: "Fall HVAC tune-up",
                vendor: "Riverside HVAC",
                cost: 185,
                recurrence: "yearly",
                dueDate: "2026-05-30T08:00:00Z",
                status: "scheduled"
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Scheduled")
        XCTAssertEqual(projection.chipVariant, .info)
        XCTAssertEqual(projection.subtitle, "Riverside HVAC · Yearly")
        XCTAssertEqual(projection.amount, "$185")
        XCTAssertEqual(projection.category, .hvac)
    }

    func testProjectionDIYRendersZeroCostAsDIY() {
        let projection = MaintenanceListViewModel.project(
            task: makeTask(
                task: "Smoke & CO alarm test",
                vendor: nil,
                cost: 0,
                recurrence: "quarterly",
                dueDate: "2026-05-30T08:00:00Z",
                status: "scheduled"
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.amount, "DIY")
        XCTAssertEqual(projection.subtitle, "Self-managed · Quarterly")
        XCTAssertEqual(projection.category, .safety)
    }

    func testProjectionOverdueChipAndHighlight() {
        let projection = MaintenanceListViewModel.project(
            task: makeTask(dueDate: "2026-05-01T00:00:00Z", status: "scheduled"),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Overdue")
        XCTAssertEqual(projection.chipVariant, .error)
        XCTAssertEqual(projection.status, .overdue)
        XCTAssertEqual(projection.inlineChip?.text, "Was due May 1")
    }

    func testProjectionCompletedRendersSuccessChip() {
        let projection = MaintenanceListViewModel.project(
            task: makeTask(cost: 240, status: "completed"),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Completed")
        XCTAssertEqual(projection.chipVariant, .success)
        XCTAssertEqual(projection.amount, "$240")
    }

    func testProjectionCancelledMutedHighlight() {
        let projection = MaintenanceListViewModel.project(
            task: makeTask(status: "cancelled"),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Cancelled")
        XCTAssertEqual(projection.chipVariant, .neutral)
        XCTAssertEqual(projection.highlight, .muted)
    }

    // MARK: - Category inference

    func testCategoryHvacFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Fall HVAC tune-up"), .hvac)
        XCTAssertEqual(MaintenanceCategory.from(task: "Replace furnace filter"), .hvac)
        XCTAssertEqual(MaintenanceCategory.from(task: "Air condition service"), .hvac)
    }

    func testCategoryPlumbingFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Fix kitchen faucet leak"), .plumbing)
        XCTAssertEqual(MaintenanceCategory.from(task: "Plumber visit"), .plumbing)
        XCTAssertEqual(MaintenanceCategory.from(task: "Service water heater"), .plumbing)
    }

    func testCategoryElectricalFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Electrical panel inspection"), .electrical)
        XCTAssertEqual(MaintenanceCategory.from(task: "Replace bedroom outlet"), .electrical)
    }

    func testCategoryGutterFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Gutter clean — front + back"), .gutter)
        XCTAssertEqual(MaintenanceCategory.from(task: "Clear downspout"), .gutter)
    }

    func testCategoryChimneyFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Chimney sweep + inspection"), .chimney)
        XCTAssertEqual(MaintenanceCategory.from(task: "Fireplace cleaning"), .chimney)
    }

    func testCategoryPestFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Quarterly pest treatment"), .pest)
        XCTAssertEqual(MaintenanceCategory.from(task: "Termite inspection"), .pest)
    }

    func testCategorySafetyFromTitle() {
        XCTAssertEqual(MaintenanceCategory.from(task: "Smoke & CO alarm test"), .safety)
        XCTAssertEqual(MaintenanceCategory.from(task: "Fire extinguisher check"), .safety)
    }

    func testCategoryGenericFallback() {
        XCTAssertEqual(MaintenanceCategory.from(task: nil), .generic)
        XCTAssertEqual(MaintenanceCategory.from(task: ""), .generic)
        XCTAssertEqual(MaintenanceCategory.from(task: "Unrelated chore"), .generic)
    }

    // MARK: - Banner

    func testBannerSummaryCountsOverdueAndYTDSpend() {
        let tasks = [
            // Overdue (status=scheduled + past due) — counts to overdueCount + scheduledCount
            makeTask(id: "t-overdue", task: "Quarterly pest treatment", cost: 120, dueDate: "2026-05-01T00:00:00Z", status: "scheduled"),
            // Scheduled in the future — counts to scheduledCount
            makeTask(id: "t-soon", task: "Fall HVAC tune-up", cost: 185, dueDate: "2026-05-20T08:00:00Z", status: "scheduled"),
            // Completed this year ($240) — counts to YTD spend
            MaintenanceTaskDTO(
                id: "t-done",
                homeId: "home-1",
                task: "Gutter clean",
                cost: 240,
                status: "completed",
                updatedAt: "2026-02-10T00:00:00Z"
            ),
            // Cancelled — excluded entirely
            makeTask(id: "t-cancelled", cost: 99, status: "cancelled")
        ]
        let summary = MaintenanceListViewModel.summarize(tasks: tasks, now: Self.fixedNow)
        XCTAssertEqual(summary.overdueCount, 1)
        XCTAssertEqual(summary.ytdSpendLabel, "$240")
        XCTAssertTrue(summary.hasContent)
    }

    func testBannerSummaryAllClear() {
        let tasks = [
            // Future task only.
            makeTask(id: "t-future", task: "Replace filters", cost: 25, dueDate: "2026-06-01T08:00:00Z", status: "scheduled")
        ]
        let summary = MaintenanceListViewModel.summarize(tasks: tasks, now: Self.fixedNow)
        XCTAssertEqual(summary.overdueCount, 0)
        XCTAssertNil(summary.ytdSpendLabel)
        XCTAssertNotNil(summary.scheduledSubtitle)
    }

    // MARK: - Tab filtering

    func testScheduledTabIncludesEverythingExceptCompletedAndCancelled() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {
                "id":"a",
                "home_id":"home-1",
                "task":"Scheduled future",
                "status":"scheduled",
                "due_date":"2026-06-01T00:00:00Z",
                "recurrence":"yearly"
              },
              {
                "id":"b",
                "home_id":"home-1",
                "task":"Scheduled overdue",
                "status":"scheduled",
                "due_date":"2026-05-01T00:00:00Z",
                "recurrence":"yearly"
              },
              {"id":"c","home_id":"home-1","task":"In progress now","status":"in_progress","recurrence":"yearly"},
              {"id":"d","home_id":"home-1","task":"Completed","status":"completed","recurrence":"yearly"},
              {"id":"e","home_id":"home-1","task":"Cancelled","status":"cancelled","recurrence":"yearly"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MaintenanceTab.scheduled.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        let ids = Set(sections.flatMap { $0.rows.map(\.id) })
        XCTAssertEqual(ids, ["a", "b", "c"])
    }

    func testCompletedTabIncludesOnlyCompleted() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {"id":"a","home_id":"home-1","task":"Done","status":"completed","recurrence":"yearly"},
              {"id":"b","home_id":"home-1","task":"Open","status":"scheduled","due_date":"2026-06-01T00:00:00Z","recurrence":"yearly"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MaintenanceTab.completed.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        let ids = sections.flatMap { $0.rows.map(\.id) }
        XCTAssertEqual(ids, ["a"])
    }

    func testAllTabExcludesCancelled() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {"id":"a","home_id":"home-1","task":"Done","status":"completed","recurrence":"yearly"},
              {"id":"b","home_id":"home-1","task":"Open","status":"scheduled","due_date":"2026-06-01T00:00:00Z","recurrence":"yearly"},
              {"id":"c","home_id":"home-1","task":"Cancelled","status":"cancelled","recurrence":"yearly"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MaintenanceTab.all.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        let ids = Set(sections.flatMap { $0.rows.map(\.id) })
        XCTAssertEqual(ids, ["a", "b"])
    }

    // MARK: - FAB + top-bar action

    func testFabIsCanonicalCreateWithHomeTint() {
        let vm = makeVM()
        let fab = vm.fab
        XCTAssertNotNil(fab)
        XCTAssertEqual(fab?.icon, .plus)
        XCTAssertEqual(fab?.tint, .home)
    }

    func testTopBarActionIsNilByDesign() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction)
    }
}
