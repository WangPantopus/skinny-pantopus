//
//  MailDayViewModelTests.swift
//  PantopusTests
//
//  A13.16 — state-projection coverage for the My Mail Day view-model.
//  Asserts the two design frames (populated mid-afternoon + empty
//  "nothing new") project cleanly, the ProgressRing counters add up, and
//  the 5-second undo countdown ticks down through `tickUndo()`.
//
//  P3F: `load()` now reads `GET /api/mailbox/v2/mailday/today`. The fixture
//  projection tests drive a stubbed `APIClient` whose GET fails so the
//  view-model falls back to the `variant` sample (the offline baseline),
//  keeping these assertions data-source-agnostic. The networked happy
//  path (live mapping, accept-rollback, finish) is covered separately.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailDayViewModelTests: XCTestCase {
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

    /// VM whose `load()` GET fails, falling back to the `variant` fixture.
    private func makeSeededVM(variant: MailDayVariant) -> MailDayViewModel {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        return MailDayViewModel(variant: variant, api: makeAPI())
    }

    // MARK: - Populated frame (fixture fallback)

    func test_populated_projectsContentAndCounters() async {
        let vm = makeSeededVM(variant: .populated)
        await vm.load()

        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated, got \(vm.state)")
        }
        XCTAssertEqual(content.unreviewed.count, 2)
        XCTAssertEqual(content.reviewed.count, 6)
        XCTAssertEqual(vm.total, 8)
        XCTAssertEqual(vm.done, 6)
        XCTAssertEqual(vm.remaining, 2)
        XCTAssertEqual(vm.routedCount, 4)
        XCTAssertEqual(vm.junkedCount, 1)
        XCTAssertEqual(vm.returnedCount, 1)
    }

    func test_populated_finishDayDisabledUntilEmpty() async {
        let vm = makeSeededVM(variant: .populated)
        await vm.load()
        XCTAssertFalse(vm.canFinishDay, "Should be disabled while 2 pieces still pending")
    }

    func test_populated_latestRowCarriesUndoCountdown() async {
        let vm = makeSeededVM(variant: .populated)
        await vm.load()

        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated")
        }
        XCTAssertEqual(content.reviewed.first?.undoCountdown, 5)
        XCTAssertNil(
            content.reviewed.dropFirst().first?.undoCountdown,
            "Only the latest reviewed row should carry the countdown"
        )
    }

    // MARK: - Undo countdown ticking

    func test_tickUndo_decrementsLatest() async {
        let vm = makeSeededVM(variant: .populated)
        await vm.load()

        vm.tickUndo()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated")
        }
        XCTAssertEqual(content.reviewed.first?.undoCountdown, 4)
    }

    func test_tickUndo_clearsAtZero() async {
        let vm = makeSeededVM(variant: .populated)
        await vm.load()

        for _ in 0..<5 {
            vm.tickUndo()
        }
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated")
        }
        XCTAssertNil(content.reviewed.first?.undoCountdown, "Should clear once seconds hit 0")
    }

    func test_tickUndo_noOpWhenNoCountdown() async {
        let vm = makeSeededVM(variant: .empty)
        await vm.load()

        vm.tickUndo() // should not crash
        guard case .empty = vm.state else {
            return XCTFail("Tick on empty should leave .empty intact")
        }
    }

    // MARK: - Accept suggestion

    func test_acceptSuggestion_movesUnreviewedToReviewed() async {
        // GET fails → populated fixture; route POST succeeds.
        SequencedURLProtocol.sequence = [.status(500, body: "{}"), .status(200, body: "{}")]
        let vm = MailDayViewModel(variant: .populated, api: makeAPI())
        await vm.load()

        guard case let .populated(initial) = vm.state else {
            return XCTFail("Expected .populated")
        }
        let target = initial.unreviewed[0]
        await vm.acceptSuggestion(for: target.id)

        guard case let .populated(updated) = vm.state else {
            return XCTFail("Expected .populated after accept")
        }
        XCTAssertEqual(updated.unreviewed.count, 1)
        XCTAssertEqual(updated.reviewed.count, 7)
        XCTAssertEqual(updated.reviewed.first?.id, target.id)
        XCTAssertEqual(updated.reviewed.first?.action, .routed)
        XCTAssertEqual(updated.reviewed.first?.undoCountdown, 5)
    }

    func test_acceptSuggestion_clearsPriorCountdown() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}"), .status(200, body: "{}")]
        let vm = MailDayViewModel(variant: .populated, api: makeAPI())
        await vm.load()

        guard case let .populated(initial) = vm.state else {
            return XCTFail("Expected .populated")
        }
        let target = initial.unreviewed[0]
        await vm.acceptSuggestion(for: target.id)

        guard case let .populated(updated) = vm.state else {
            return XCTFail("Expected .populated after accept")
        }
        XCTAssertEqual(
            updated.reviewed.dropFirst().compactMap(\.undoCountdown),
            [],
            "Older rows lose their countdown when a newer action arrives"
        )
    }

    func test_acceptSuggestion_rollsBackOnFailure() async {
        // GET fails → populated fixture; route POST fails → revert.
        SequencedURLProtocol.sequence = [.status(500, body: "{}"), .status(500, body: "{}")]
        let vm = MailDayViewModel(variant: .populated, api: makeAPI())
        await vm.load()

        guard case let .populated(initial) = vm.state else {
            return XCTFail("Expected .populated")
        }
        let target = initial.unreviewed[0]
        await vm.acceptSuggestion(for: target.id)

        guard case let .populated(updated) = vm.state else {
            return XCTFail("Expected .populated after rollback")
        }
        XCTAssertEqual(updated.unreviewed.count, 2, "A failed route must restore the piece")
        XCTAssertEqual(updated.reviewed.count, 6)
    }

    // MARK: - Empty frame (fixture fallback)

    func test_empty_projectsRecapAndNudges() async {
        let vm = makeSeededVM(variant: .empty)
        await vm.load()

        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertEqual(content.unreviewed.count, 0)
        XCTAssertEqual(content.reviewed.count, 0)
        XCTAssertEqual(content.streakDays, 12)
        XCTAssertEqual(content.lastScanLabel, "9h ago")
        XCTAssertEqual(content.yesterdayRecap?.segments.count, 4)
        XCTAssertEqual(content.setupNudges.count, 2)
    }

    // MARK: - Scan callback

    func test_requestScan_invokesCallback() async {
        var scanCalls = 0
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = MailDayViewModel(variant: .empty, api: makeAPI()) {
            scanCalls += 1
        }
        await vm.load()

        vm.requestScan()
        vm.requestScan()
        XCTAssertEqual(scanCalls, 2)
    }

    // MARK: - Live networking

    func test_load_mapsLiveDayFrame() async {
        let json = """
        {"date_label":"Thu · Oct 9","streak_days":12,"last_scan_label":"22 min ago",
        "unreviewed":[{"id":"u1","kind":"bill","label":"Con Edison","sender":"Con Edison · NY",
        "suggested_name":"Maria Kovács","suggested_avatar":"personal_sky","confidence_percent":94,
        "secondary_label":"Other"}],
        "reviewed":[{"id":"r1","kind":"magazine","label":"New Yorker","action":"routed",
        "routed_to":"Marcus","routed_tint":"household_home","when_label":"2 min ago","undo_countdown":5}],
        "yesterday_recap":null,"setup_nudges":[]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = MailDayViewModel(variant: .empty, api: makeAPI())
        await vm.load()

        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated from live data, got \(vm.state)")
        }
        XCTAssertEqual(content.streakDays, 12)
        XCTAssertEqual(content.unreviewed.first?.kind, .bill)
        XCTAssertEqual(content.unreviewed.first?.suggestedAvatar, .personalSky)
        XCTAssertEqual(content.unreviewed.first?.confidencePercent, 94)
        XCTAssertEqual(content.reviewed.first?.action, .routed)
        XCTAssertEqual(content.reviewed.first?.routedTint, .householdHome)
        XCTAssertEqual(content.reviewed.first?.undoCountdown, 5)
    }

    func test_finishDay_reflectsBumpedStreak() async {
        // A fully-reviewed day (no unreviewed) is populated + finishable.
        let today = """
        {"date_label":"Thu · Oct 9","streak_days":12,"last_scan_label":"1 min ago",
        "unreviewed":[],
        "reviewed":[{"id":"r1","kind":"bill","label":"Con Ed","action":"routed",
        "routed_to":"Maria","routed_tint":"person_primary","when_label":"1 min ago","undo_countdown":null}],
        "yesterday_recap":null,"setup_nudges":[]}
        """
        let finish = """
        {"streak_days":13,"pieces":1,"routed_count":1,"junked_count":0,"returned_count":0}
        """
        SequencedURLProtocol.sequence = [.status(200, body: today), .status(200, body: finish)]
        let vm = MailDayViewModel(variant: .empty, api: makeAPI())
        await vm.load()
        XCTAssertTrue(vm.canFinishDay)

        await vm.finishDay()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated after finish")
        }
        XCTAssertEqual(content.streakDays, 13, "Finish bumps the streak server-side")
    }
}
