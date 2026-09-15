//
//  MyTasksMagicTaskTests.swift
//  PantopusTests
//

import XCTest
@testable import Pantopus

@MainActor
final class MyTasksMagicTaskTests: XCTestCase {
    private struct FormatCase {
        let raw: String
        let label: String
        let icon: PantopusIcon
    }

    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    func testMagicTaskRowUsesMagicArchetypeTileAndOverline() {
        let dto = makeGig(
            id: "mt1",
            status: "open",
            bidCount: 0,
            sourceFlow: "magic",
            taskArchetype: "home_service"
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.archetypeOverline, "Mount & install")
        if case .magicArchetypeTile = row.leading {
            // pass
        } else {
            XCTFail("Magic task row should use magicArchetypeTile leading variant")
        }
    }

    func testNonMagicTaskRowKeepsCategoryGradientIconAndNoOverline() {
        let dto = makeGig(
            id: "cl1",
            status: "open",
            bidCount: 0,
            sourceFlow: "classic",
            taskArchetype: "home_service"
        )
        let row = renderRow(for: dto)
        XCTAssertNil(row.archetypeOverline)
        if case .categoryGradientIcon = row.leading {
            // pass
        } else {
            XCTFail("Non-magic row should use categoryGradientIcon")
        }
    }

    func testMagicTaskRowWithUnknownArchetypeFallsBackToGeneralOverline() {
        let dto = makeGig(
            id: "mt2",
            status: "open",
            sourceFlow: "magic",
            taskArchetype: nil
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.archetypeOverline, "Magic task")
    }

    func testEngagementModeBadgeRendersForAllFourFormats() {
        let cases = [
            FormatCase(raw: "in_person", label: "In person", icon: .mapPin),
            FormatCase(raw: "drop_off", label: "Drop-off", icon: .package),
            FormatCase(raw: "remote", label: "Remote", icon: .monitor),
            FormatCase(raw: "hybrid", label: "Hybrid", icon: .shuffle)
        ]

        for formatCase in cases {
            let dto = makeGig(
                id: "mode-\(formatCase.raw)",
                status: "open",
                bidCount: 1,
                sourceFlow: "magic",
                taskArchetype: "general",
                taskFormat: formatCase.raw
            )
            let row = renderRow(for: dto)
            // Status chip is always first; mode chip is appended second.
            XCTAssertEqual(row.chips?.count, 2, "mode \(formatCase.raw) missing chip")
            let modeChip = row.chips?[1]
            XCTAssertEqual(modeChip?.text, formatCase.label, "mode \(formatCase.raw) wrong label")
            XCTAssertEqual(modeChip?.icon, formatCase.icon, "mode \(formatCase.raw) wrong icon")
            if case .custom = modeChip?.tint {
                // pass
            } else {
                XCTFail("mode chip for \(formatCase.raw) should use custom tint, not status")
            }
        }
    }

    func testEngagementModeBadgeOmittedWhenTaskFormatIsNil() {
        let dto = makeGig(
            id: "no-mode",
            status: "open",
            bidCount: 1,
            sourceFlow: "classic",
            taskArchetype: nil,
            taskFormat: nil
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.chips?.count, 1)
    }

    func testEngagementModeBadgeOmittedForUnknownTaskFormat() {
        let dto = makeGig(
            id: "weird-mode",
            status: "open",
            bidCount: 1,
            sourceFlow: "magic",
            taskArchetype: "general",
            taskFormat: "telepathy"
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.chips?.count, 1)
    }

    func testArchetypeOverlineTruncatesAtTwentyFourChars() {
        let archetypeWithLongLabel = MyTasksArchetype.from(rawArchetype: "home_service")
        XCTAssertEqual(archetypeWithLongLabel.overlineLabel, "Mount & install")
        XCTAssertLessThanOrEqual(archetypeWithLongLabel.overlineLabel.count, 24)
    }

    func testIsMagicTaskTrueWhenSourceFlowIsMagicCaseInsensitive() {
        XCTAssertTrue(isMagicTask(makeGig(id: "1", status: "open", sourceFlow: "magic")))
        XCTAssertTrue(isMagicTask(makeGig(id: "2", status: "open", sourceFlow: "MAGIC")))
        XCTAssertFalse(isMagicTask(makeGig(id: "3", status: "open", sourceFlow: "classic")))
        XCTAssertFalse(isMagicTask(makeGig(id: "4", status: "open", sourceFlow: nil)))
    }

    private func renderRow(for dto: MyGigDTO) -> RowModel {
        let status = MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow)
        let projection = MyTasksViewModel.GigProjection(
            dto: dto,
            tab: MyTasksViewModel.tabFor(status: status),
            status: status,
            footer: MyTasksViewModel.footerFor(status: status, bidCount: dto.bidCount ?? 0)
        )
        return MyTasksViewModel.row(
            projection: projection,
            now: Self.fixedNow,
            callbacks: MyTasksViewModel.RowCallbacks()
        )
    }

    private func makeGig(
        id: String,
        status: String,
        bidCount: Int = 0,
        sourceFlow: String? = nil,
        taskArchetype: String? = nil,
        taskFormat: String? = nil
    ) -> MyGigDTO {
        MyGigDTO(
            id: id,
            title: "Test gig",
            price: 100,
            category: "handyman",
            status: status,
            createdAt: "2026-05-13T09:00:00Z",
            updatedAt: "2026-05-15T10:00:00Z",
            userId: "u_me",
            bidCount: bidCount,
            sourceFlow: sourceFlow,
            taskArchetype: taskArchetype,
            taskFormat: taskFormat
        )
    }
}

@MainActor
final class MyTasksLifetimeTests: XCTestCase {
    private func lifetimeAPI() -> (APIClient, AuthManager) {
        SequencedURLProtocol.reset()
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: api, allowSecureEnclave: false)
        auth.setState(.signedIn(UserDTO(id: "u_me", email: "owner@example.invalid", displayName: nil, avatarURL: nil)))
        auth.setAccessToken("synthetic-my-tasks-token")
        auth.setSessionMetadata(id: "original-session", context: nil, expiresAt: nil)
        return (api, auth)
    }

    func testLoadedTasksDisappearWhenOwnerSignsOut() async {
        let (api, auth) = lifetimeAPI()
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body:
                #"{"gigs":[{"id":"g1","title":"Private task","status":"open","user_id":"u_me"}]}"#
            )
        ]
        let vm = MyTasksViewModel(api: api)
        await vm.load()
        guard case .loaded = vm.state else { return XCTFail("Expected original list") }
        auth.setState(.signedOut)
        if case .loaded = vm.state { XCTFail("Retired owner's tasks remain visible") }
        XCTAssertEqual(vm.tabs.compactMap(\.count).reduce(0, +), 0)
        XCTAssertNil(vm.banner)
    }

    func testHeldConfirmationDoesNotNavigateIntoANewSession() async throws {
        let (api, auth) = lifetimeAPI()
        let before = #"{"id":"g1","title":"Work","status":"completed","user_id":"u_me","completion_review":"loaded-review"}"#
        let dto = try JSONDecoder().decode(MyGigDTO.self, from: Data(before.utf8))
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [.status(200, body: "{\"gigs\":[\(before)]}")],
            "/api/gigs/g1/complete": [.status(503, body: "{}", delay: 0.5)]
        ]
        var opened = 0
        let onOpen: @MainActor (MyGigDTO) -> Void = { _ in opened += 1 }
        let vm = MyTasksViewModel(api: api, onOpenTask: onOpen)
        await vm.load()
        let pending = Task { await vm.markComplete(dto) }
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.contains(where: { $0.url?.path == "/api/gigs/g1/complete" }) { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/complete" })
        auth.setSessionMetadata(id: "replacement-session", context: nil, expiresAt: nil)
        await pending.value
        XCTAssertEqual(opened, 0)
    }

    func testRetiredConfirmationStaysQuietAfterSameSessionReentry() async throws {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state }
        let before = #"{"id":"g1","title":"Work","status":"completed","user_id":"u_me","completion_review":"loaded-review"}"#
        let dto = try JSONDecoder().decode(MyGigDTO.self, from: Data(before.utf8))
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [
                .status(200, body: "{\"gigs\":[\(before)]}"),
                .status(200, body: "{\"gigs\":[\(before)]}")
            ],
            "/api/gigs/g1/complete": [.status(503, body: "{}", delay: 0.5)]
        ]
        var opened = 0
        let onOpen: @MainActor (MyGigDTO) -> Void = { _ in opened += 1 }
        let vm = MyTasksViewModel(api: api, onOpenTask: onOpen)
        await vm.load()
        let pending = Task { await vm.markComplete(dto) }
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.contains(where: { $0.url?.path == "/api/gigs/g1/complete" }) { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/complete" })
        vm.retire()
        await vm.load()
        await pending.value
        XCTAssertEqual(opened, 0)
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/gigs/my-gigs").count, 2)
        XCTAssertEqual(vm.tabs.first { $0.id == MyTasksTab.active }?.count, 1)
    }

    func testOldRowCannotNavigateAfterReentryButNewRowCan() async throws {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state }
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [
                .status(
                    200,
                    body:
                    #"{"gigs":[{"id":"g1","title":"Private task","status":"open","user_id":"u_me"}]}"#
                ),
                .status(200, body: #"{"gigs":[{"id":"g1","title":"Private task","status":"open","user_id":"u_me"}]}"#)
            ]
        ]
        var opened = 0
        let onOpen: @MainActor (MyGigDTO) -> Void = { _ in opened += 1 }
        let vm = MyTasksViewModel(api: api, onOpenTask: onOpen)
        await vm.load()
        guard case let .loaded(oldSections, _) = vm.state else { return XCTFail("Expected original list") }
        vm.retire()
        await vm.load()
        oldSections.first?.rows.first?.onTap()
        try await Task.sleep(for: .milliseconds(20))
        XCTAssertEqual(opened, 0)
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected fresh list") }
        sections.first?.rows.first?.onTap()
        try await Task.sleep(for: .milliseconds(20))
        XCTAssertEqual(opened, 1)
    }

    func testHeldReadCannotPopulateReplacementSessionAndFreshEntryLoads() async throws {
        let (api, auth) = lifetimeAPI()
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [
                .status(200, body: #"{"gigs":[{"id":"old","title":"Old","status":"open"}]}"#, delay: 0.5),
                .status(200, body: #"{"gigs":[{"id":"new","title":"New","status":"open"}]}"#)
            ]
        ]
        let vm = MyTasksViewModel(api: api)
        let pending = Task { await vm.load() }
        for _ in 0..<100 {
            if !SequencedURLProtocol.captured(path: "/api/gigs/my-gigs").isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/gigs/my-gigs").count, 1)
        auth.setSessionMetadata(id: "replacement-session", context: nil, expiresAt: nil)
        await pending.value
        if case .loaded = vm.state { XCTFail("Old private response was adopted") }
        await vm.load()
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/gigs/my-gigs").count, 1)
        let reopened = MyTasksViewModel(api: api)
        await reopened.load()
        guard case let .loaded(sections, _) = reopened.state else { return XCTFail("Expected new session list") }
        XCTAssertEqual(sections.first?.rows.first?.id, "new")
    }

    func testRebookHistoryDisappearsWhenOwnerSignsOut() async {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state }
        SequencedURLProtocol.sequence = [.status(200, body: #"{"rebookable":[{"id":"old","title":"Private history"}]}"#)]
        let rail = RebookRailViewModel(api: api)
        await rail.load()
        XCTAssertTrue(rail.isVisible)
        auth.setState(.signedOut)
        XCTAssertFalse(rail.isVisible)
        XCTAssertTrue(rail.items.isEmpty)
    }

    func testHeldRebookReadCannotPopulateReplacementSession() async throws {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state }
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"rebookable":[{"id":"old","title":"Private history"}]}"#, delay: 0.5)
        ]
        let rail = RebookRailViewModel(api: api)
        let pending = Task { await rail.load() }
        for _ in 0..<100 {
            if !SequencedURLProtocol.captured(path: "/api/gigs/rebookable").isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/gigs/rebookable").count, 1)
        auth.setSessionMetadata(id: "replacement-session", context: nil, expiresAt: nil)
        await pending.value
        XCTAssertFalse(rail.isVisible)
        XCTAssertTrue(rail.items.isEmpty)
    }

    func testFailedBoostCannotRestoreAListReplacedByRefresh() async throws {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state
            SequencedURLProtocol.release("my-tasks-boost")
        }
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [
                .status(200, body: #"{"gigs":[{"id":"old","title":"Old","status":"open"}]}"#),
                .status(200, body: #"{"gigs":[{"id":"new","title":"New","status":"open"}]}"#)
            ],
            "/api/gigs/old/boost": [.status(503, body: "{}", gate: "my-tasks-boost")]
        ]
        let vm = MyTasksViewModel(api: api)
        await vm.load()
        let pending = Task { await vm.boost(MyGigDTO(id: "old", title: "Old", status: "open")) }
        for _ in 0..<100 {
            if !SequencedURLProtocol.captured(path: "/api/gigs/old/boost").isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/gigs/old/boost").count, 1)
        await vm.refresh()
        guard case let .loaded(fresh, _) = vm.state else { return XCTFail("Expected fresh list") }
        XCTAssertEqual(fresh.first?.rows.first?.id, "new")
        XCTAssertTrue(SequencedURLProtocol.release("my-tasks-boost"))
        await pending.value
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected fresh list after failure") }
        XCTAssertEqual(sections.first?.rows.first?.id, "new")
    }

    func testRebookRefreshKeepsNewestHistory() async throws {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state
            SequencedURLProtocol.release("rebook-old")
        }
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/rebookable": [
                .status(200, body: #"{"rebookable":[{"id":"old"}]}"#, gate: "rebook-old"),
                .status(200, body: #"{"rebookable":[{"id":"new"}]}"#)
            ]
        ]
        let rail = RebookRailViewModel(api: api)
        let pending = Task { await rail.load() }
        for _ in 0..<100 {
            if !SequencedURLProtocol.captured(path: "/api/gigs/rebookable").isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        await rail.refresh()
        XCTAssertEqual(rail.items.first?.id, "new")
        XCTAssertTrue(SequencedURLProtocol.release("rebook-old"))
        await pending.value
        XCTAssertEqual(rail.items.first?.id, "new")
    }

    func testRetiredRebookActionStaysQuietAfterReentry() async {
        let (api, auth) = lifetimeAPI()
        defer { _ = auth.state }
        let response = SequencedURLProtocol.Response.status(200, body: #"{"rebookable":[{"id":"g1"}]}"#)
        SequencedURLProtocol.sequence = [response, response]
        let rail = RebookRailViewModel(api: api)
        await rail.load()
        guard let gig = rail.items.first else { return XCTFail("Expected history") }
        var opened = 0
        let old = rail.rebookAction(gig) { _ in opened += 1 }
        rail.retire()
        XCTAssertFalse(rail.isVisible)
        await rail.load()
        old()
        XCTAssertEqual(opened, 0)
        rail.rebookAction(gig) { _ in opened += 1 }()
        XCTAssertEqual(opened, 1)
    }
}
