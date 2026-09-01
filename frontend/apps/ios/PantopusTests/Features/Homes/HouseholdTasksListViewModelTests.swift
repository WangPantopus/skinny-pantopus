//
//  HouseholdTasksListViewModelTests.swift
//  PantopusTests
//
//  Covers the Household tasks VM (T6.3c / P11):
//    - four-state transitions (load → loaded / empty / error)
//    - tab filtering (Active / Done / Recurring) — including the 30-day
//      rolling window on Done and the `recurrence_rule != nil` rule on
//      Recurring (which deviates from the prompt's `template_id != nil`
//      spec — `template_id` doesn't exist on the live `HomeTask` schema)
//    - row projection (chip / subtitle / leading variant by assignee)
//    - banner summary projection (due today + overdue)
//    - chore-category inference from title
//    - human recurrence rendering
//    - optimistic toggleDone() roll-back on failure
//

import XCTest
@testable import Pantopus

@MainActor
final class HouseholdTasksListViewModelTests: XCTestCase {
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

    /// Fixed "now" so chip derivation + subtitle formatting are deterministic.
    /// 2026-05-15 noon UTC.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM(api: APIClient? = nil) -> HouseholdTasksListViewModel {
        let frozen = Self.fixedNow
        return HouseholdTasksListViewModel(
            homeId: "home-1",
            api: api ?? makeAPI()
        ) { frozen }
    }

    private func makeTask(
        id: String = "t",
        title: String = "Take out trash",
        status: String = "open",
        taskType: String = "chore",
        assignedTo: String? = nil,
        dueAt: String? = nil,
        recurrenceRule: String? = nil,
        completedAt: String? = nil,
        updatedAt: String? = nil
    ) -> HomeTaskDTO {
        HomeTaskDTO(
            id: id,
            homeId: "home-1",
            taskType: taskType,
            title: title,
            description: nil,
            assignedTo: assignedTo,
            dueAt: dueAt,
            recurrenceRule: recurrenceRule,
            status: status,
            priority: "medium",
            completedAt: completedAt,
            createdBy: "u",
            createdAt: "2026-05-01T00:00:00Z",
            updatedAt: updatedAt
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
        XCTAssertEqual(content.headline, "No tasks yet")
        XCTAssertEqual(content.ctaTitle, "Add a task")
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

    func testLoadedResponseMapsRowsToCircularActionTrailingOnActive() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {"id":"t1","home_id":"home-1","task_type":"chore","title":"Vacuum living room",
               "status":"open","due_at":"2026-05-15T18:00:00Z","created_by":"u"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections[0].rows.count, 1)
        let row = sections[0].rows[0]
        XCTAssertEqual(row.id, "t1")
        XCTAssertEqual(row.title, "Vacuum living room")
        // Active trailing = the checkbox + trash pair. RN puts a trash
        // affordance on every task row, so the round-checkbox now shares
        // the trailing with a destructive icon action.
        guard case let .iconActions(primary, secondary) = row.trailing else {
            XCTFail("Expected iconActions trailing on Active tab, got \(row.trailing)")
            return
        }
        XCTAssertEqual(primary.icon, .circle)
        XCTAssertEqual(primary.accessibilityLabel, "Mark done")
        XCTAssertEqual(secondary.icon, .trash)
        XCTAssertEqual(secondary.accessibilityLabel, "Delete task")
        // Unassigned → leading should be the category typeIcon (cleaning).
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected typeIcon leading on unassigned row, got \(row.leading)")
            return
        }
        XCTAssertEqual(icon, .sparkles)
    }

    func testAssignedRowRendersAvatarLeading() {
        let projection = HouseholdTasksListViewModel.project(
            task: makeTask(assignedTo: "user-abcd1234"),
            now: Self.fixedNow
        )
        XCTAssertTrue(projection.isAssigned)
        XCTAssertNotNil(projection.assigneeLabel)
        XCTAssertTrue(projection.subtitle.contains("Assigned to"))
    }

    // MARK: - Tab filtering

    func testActiveTabIncludesOpenAndInProgress() {
        let open = makeTask(id: "t1", status: "open")
        let inProgress = makeTask(id: "t2", status: "in_progress")
        XCTAssertTrue(HouseholdTasksListViewModel.passes(open, tab: .active, now: Self.fixedNow))
        XCTAssertTrue(HouseholdTasksListViewModel.passes(inProgress, tab: .active, now: Self.fixedNow))
    }

    func testActiveTabExcludesDoneAndCanceled() {
        let done = makeTask(id: "t3", status: "done")
        let canceled = makeTask(id: "t4", status: "canceled")
        XCTAssertFalse(HouseholdTasksListViewModel.passes(done, tab: .active, now: Self.fixedNow))
        XCTAssertFalse(HouseholdTasksListViewModel.passes(canceled, tab: .active, now: Self.fixedNow))
    }

    func testDoneTabRestrictsTo30DayWindow() {
        // fixedNow = 2026-05-15. 20 days back = 2026-04-25 (in window).
        let recent = makeTask(id: "t1", status: "done", completedAt: "2026-04-25T00:00:00Z")
        XCTAssertTrue(HouseholdTasksListViewModel.passes(recent, tab: .done, now: Self.fixedNow))
        // 40 days back = 2026-04-05 (out of window).
        let old = makeTask(id: "t2", status: "done", completedAt: "2026-04-05T00:00:00Z")
        XCTAssertFalse(HouseholdTasksListViewModel.passes(old, tab: .done, now: Self.fixedNow))
    }

    func testRecurringTabUsesRecurrenceRuleField() {
        // Per the prompt the spec calls for `template_id != nil` but the
        // live HomeTask schema has no such column; recurrence is the
        // RRULE-ish `recurrence_rule` text. Empty/whitespace ⇒ not recurring.
        let oneOff = makeTask(id: "t1", status: "open", recurrenceRule: nil)
        let recurring = makeTask(id: "t2", status: "open", recurrenceRule: "FREQ=WEEKLY;BYDAY=TU")
        let blank = makeTask(id: "t3", status: "open", recurrenceRule: "")
        XCTAssertFalse(HouseholdTasksListViewModel.passes(oneOff, tab: .recurring, now: Self.fixedNow))
        XCTAssertTrue(HouseholdTasksListViewModel.passes(recurring, tab: .recurring, now: Self.fixedNow))
        XCTAssertFalse(HouseholdTasksListViewModel.passes(blank, tab: .recurring, now: Self.fixedNow))
    }

    // MARK: - Row projection

    func testActiveOverdueRowSurfacesErrorChip() {
        let task = makeTask(dueAt: "2026-05-12T00:00:00Z") // 3 days late
        let projection = HouseholdTasksListViewModel.project(task: task, now: Self.fixedNow)
        XCTAssertEqual(projection.chipVariant, .error)
        XCTAssertTrue(projection.chipText?.contains("late") ?? false)
        XCTAssertNil(projection.highlight)
    }

    func testActiveDueTodayRowSurfacesWarningChip() {
        let task = makeTask(dueAt: "2026-05-15T22:00:00Z")
        let projection = HouseholdTasksListViewModel.project(task: task, now: Self.fixedNow)
        XCTAssertEqual(projection.chipText, "Today")
        XCTAssertEqual(projection.chipVariant, .warning)
    }

    func testActiveDueTomorrowRowSurfacesWarningChip() {
        let task = makeTask(dueAt: "2026-05-16T22:00:00Z")
        let projection = HouseholdTasksListViewModel.project(task: task, now: Self.fixedNow)
        XCTAssertEqual(projection.chipText, "Tomorrow")
        XCTAssertEqual(projection.chipVariant, .warning)
    }

    func testActiveDueLaterThisWeekRowSurfacesNeutralChip() {
        // 4 days out — should be a neutral weekday chip.
        let task = makeTask(dueAt: "2026-05-19T22:00:00Z")
        let projection = HouseholdTasksListViewModel.project(task: task, now: Self.fixedNow)
        XCTAssertEqual(projection.chipVariant, .neutral)
        XCTAssertFalse(projection.chipText?.isEmpty ?? true)
    }

    func testDoneRowSurfacesDoneByInSubtitleAndMutedHighlight() {
        let task = makeTask(
            status: "done",
            assignedTo: "user-aaaa1111",
            completedAt: "2026-05-15T10:00:00Z" // 2 hours before fixedNow
        )
        let projection = HouseholdTasksListViewModel.project(task: task, now: Self.fixedNow)
        XCTAssertTrue(projection.subtitle.starts(with: "Done by "))
        XCTAssertTrue(projection.subtitle.contains("2h ago"))
        XCTAssertEqual(projection.highlight, .muted)
    }

    func testCanceledRowRendersNeutralChipAndMutedHighlight() {
        let task = makeTask(status: "canceled")
        let projection = HouseholdTasksListViewModel.project(task: task, now: Self.fixedNow)
        XCTAssertEqual(projection.chipText, "Canceled")
        XCTAssertEqual(projection.chipVariant, .neutral)
        XCTAssertEqual(projection.highlight, .muted)
    }

    // MARK: - Banner summary

    func testBannerSummaryCountsOverdueAndDueToday() {
        let tasks = [
            makeTask(id: "t1", status: "open", dueAt: "2026-05-13T00:00:00Z"), // overdue
            makeTask(id: "t2", status: "open", dueAt: "2026-05-12T00:00:00Z"), // overdue
            makeTask(id: "t3", status: "open", dueAt: "2026-05-15T18:00:00Z"), // today
            makeTask(id: "t4", status: "open", dueAt: "2026-05-20T00:00:00Z"), // later
            makeTask(id: "t5", status: "done", dueAt: "2026-05-15T00:00:00Z") // done — ignored
        ]
        let summary = HouseholdTasksListViewModel.summarize(tasks: tasks, now: Self.fixedNow)
        XCTAssertEqual(summary.overdueCount, 2)
        XCTAssertEqual(summary.dueTodayCount, 1)
        XCTAssertTrue(summary.hasContent)
    }

    func testBannerHasContentFalseWhenAllFuture() {
        let tasks = [
            makeTask(id: "t1", status: "open", dueAt: "2026-05-20T00:00:00Z")
        ]
        let summary = HouseholdTasksListViewModel.summarize(tasks: tasks, now: Self.fixedNow)
        XCTAssertFalse(summary.hasContent)
    }

    // MARK: - Category inference

    func testCategoryInferenceCleaningFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Vacuum living room"), .cleaning)
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Mop the kitchen floor"), .cleaning)
    }

    func testCategoryInferenceTrashFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Take out trash"), .trash)
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Recycling pickup"), .trash)
    }

    func testCategoryInferenceKitchenFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Empty the dishwasher"), .kitchen)
    }

    func testCategoryInferenceLaundryFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Do the laundry"), .laundry)
    }

    func testCategoryInferenceYardFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Water plants on the porch"), .yard)
    }

    func testCategoryInferencePetFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Walk the dog"), .pet)
    }

    func testCategoryInferenceErrandFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Costco run"), .errand)
    }

    func testCategoryInferenceKidsFromTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Pack lunchboxes for school"), .kids)
    }

    func testCategoryInferenceFallsBackToOther() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: "Random thing"), .other)
        XCTAssertEqual(HouseholdTaskCategory.from(title: nil), .other)
    }

    func testCategoryInferenceUsesTaskTypeHintForBlankTitle() {
        XCTAssertEqual(HouseholdTaskCategory.from(title: nil, taskType: "shopping"), .errand)
    }

    // MARK: - Recurrence rendering

    func testHumanRecurrenceParsesWeeklyByDay() {
        XCTAssertEqual(
            HouseholdTasksListViewModel.humanRecurrence(rule: "FREQ=WEEKLY;BYDAY=TU"),
            "Weekly · Tue"
        )
    }

    func testHumanRecurrenceParsesDaily() {
        XCTAssertEqual(HouseholdTasksListViewModel.humanRecurrence(rule: "FREQ=DAILY"), "Daily")
    }

    func testHumanRecurrencePassesThroughHumanString() {
        XCTAssertEqual(
            HouseholdTasksListViewModel.humanRecurrence(rule: "Every 3 days"),
            "Every 3 days"
        )
    }

    func testHumanRecurrenceNilForEmpty() {
        XCTAssertNil(HouseholdTasksListViewModel.humanRecurrence(rule: nil))
        XCTAssertNil(HouseholdTasksListViewModel.humanRecurrence(rule: ""))
    }

    // MARK: - Optimistic toggle

    func testToggleDoneRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            // Initial load
            .status(200, body: """
            {"tasks":[
              {"id":"t1","home_id":"home-1","task_type":"chore","title":"Vacuum",
               "status":"open","due_at":"2026-05-15T18:00:00Z","created_by":"u"}
            ]}
            """),
            // PUT toggle fails
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.toggleDone(taskId: "t1")
        // After roll-back the row should still be on the Active tab as open.
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded after roll-back")
            return
        }
        XCTAssertEqual(sections[0].rows.count, 1)
        XCTAssertEqual(sections[0].rows[0].id, "t1")
    }

    // MARK: - Tab counts

    func testTabCountsReflectStatusBuckets() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"tasks":[
              {"id":"t1","home_id":"home-1","task_type":"chore","title":"Trash",
               "status":"open","recurrence_rule":"FREQ=WEEKLY;BYDAY=TU","created_by":"u"},
              {"id":"t2","home_id":"home-1","task_type":"chore","title":"Vacuum",
               "status":"open","created_by":"u"},
              {"id":"t3","home_id":"home-1","task_type":"chore","title":"Dishwasher",
               "status":"done","completed_at":"2026-05-14T10:00:00Z","created_by":"u"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let tabs = vm.tabs
        XCTAssertEqual(tabs[0].count, 2) // active: t1, t2
        XCTAssertEqual(tabs[1].count, 1) // done: t3
        XCTAssertEqual(tabs[2].count, 1) // recurring: t1
    }
}
