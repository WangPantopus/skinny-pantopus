//
//  NotificationsViewModelTests.swift
//  PantopusTests
//
//  T5.1 — Notifications V2. Covers:
//    - load → loaded / empty / error transitions
//    - tab switching (All / Unread) refetches with `?unread=true`
//    - mark-read + mark-all-read optimistic + rollback
//    - row mapping per type (icon + chip variant + tile colours)
//    - date bucketing across midnight + timezone + "no today" cases
//    - relative-time formatting
//    - empty Unread CTA re-keys back to the All tab
//

import XCTest
@testable import Pantopus

// swiftlint:disable file_length type_body_length

private let notificationsTestsUTC = TimeZone(secondsFromGMT: 0) ?? .current

@MainActor
final class NotificationsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        _ = DeepLinkRouter.shared.consume()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let utc = notificationsTestsUTC

    /// Fixed clock + calendar so date-bucketing tests are deterministic.
    /// 2026-05-15 12:00:00 UTC — Friday.
    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = notificationsTestsUTC
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private static let utcCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = notificationsTestsUTC
        return cal
    }()

    private func makeVM(api: APIClient? = nil) -> NotificationsViewModel {
        NotificationsViewModel(
            api: api ?? makeAPI(),
            now: { Self.fixedNow },
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        )
    }

    private static let twoUnreadJSON = """
    {"notifications":[
      {"id":"n1","type":"reply","title":"Maria replied",
       "body":"Sounds great","icon":null,"link":"/post/p_1","is_read":false,
       "created_at":"2026-05-15T10:00:00Z","user_id":"u_me"},
      {"id":"n2","type":"gig","title":"New gig",
       "body":"$80 gig 0.4mi","icon":null,"link":"/gig/g_1","is_read":false,
       "created_at":"2026-05-15T09:00:00Z","user_id":"u_me"}
    ],"unreadCount":2,"hasMore":false}
    """

    private static let emptyJSON = """
    {"notifications":[],"unreadCount":0,"hasMore":false}
    """

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToAllTabEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "All caught up")
        XCTAssertEqual(vm.unreadCount, 0)
        XCTAssertNotNil(vm.topBarAction)
        XCTAssertEqual(vm.topBarAction?.isEnabled, false)
    }

    func testLoadPopulatedTransitionsToLoaded() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoUnreadJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
        XCTAssertEqual(vm.unreadCount, 2)
        XCTAssertEqual(vm.topBarAction?.isEnabled, true)
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error")
            return
        }
    }

    // MARK: - Tabs

    func testTabsExposeAllUnreadAndReadWithCounts() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoUnreadJSON)]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs.count, 3)
        XCTAssertEqual(vm.tabs[0].id, NotificationsTab.all)
        XCTAssertEqual(vm.tabs[1].id, NotificationsTab.unread)
        XCTAssertEqual(vm.tabs[2].id, NotificationsTab.read)
        XCTAssertEqual(vm.tabs[0].label, "All")
        XCTAssertEqual(vm.tabs[1].label, "Unread")
        XCTAssertEqual(vm.tabs[2].label, "Read")
        XCTAssertEqual(vm.tabs[0].count, 2)
        XCTAssertEqual(vm.tabs[1].count, 2)
        XCTAssertEqual(vm.tabs[2].count, 0, "Both fixture rows are unread")
        XCTAssertEqual(vm.selectedTab, NotificationsTab.all)
    }

    func testSelectingUnreadTabRefetchesWithUnreadFilter() async {
        let unreadOnlyJSON = """
        {"notifications":[
          {"id":"n1","type":"reply","title":"Unread only",
           "body":"hi","icon":null,"link":null,"is_read":false,
           "created_at":"2026-05-15T10:00:00Z","user_id":"u_me"}
        ],"unreadCount":1,"hasMore":false}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(200, body: unreadOnlyJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = NotificationsTab.unread
        let tabState = await Self.waitForState(vm) { state in
            guard case let .loaded(sections, _) = state else { return false }
            return sections.flatMap(\.rows).count == 1
        }
        XCTAssertEqual(vm.selectedTab, NotificationsTab.unread)
        guard case let .loaded(sections, _) = tabState else {
            XCTFail("Expected .loaded after tab switch")
            return
        }
        XCTAssertEqual(sections.flatMap(\.rows).count, 1)
    }

    func testEmptyUnreadCTASwitchesBackToAllTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(200, body: Self.emptyJSON),
            .status(200, body: Self.twoUnreadJSON)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = NotificationsTab.unread
        let unreadState = await Self.waitForState(vm) { state in
            if case .empty = state { return true }
            return false
        }
        guard case let .empty(content) = unreadState else {
            XCTFail("Expected .empty unread state")
            return
        }
        XCTAssertEqual(content.ctaTitle, "View all notifications")
        content.onCTA?()
        _ = await Self.waitForState(vm) { state in
            guard vm.selectedTab == NotificationsTab.all else { return false }
            if case .loaded = state { return true }
            return false
        }
        XCTAssertEqual(vm.selectedTab, NotificationsTab.all)
    }

    // MARK: - Mark read

    func testMarkReadFlipsRowAndPersists() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(200, body: "{\"ok\":true}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.markRead(id: "n1")
        XCTAssertEqual(vm.unreadCount, 1)
    }

    func testMarkReadRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.markRead(id: "n1")
        XCTAssertEqual(vm.unreadCount, 2)
    }

    func testMarkAllReadClearsUnreadAndDisablesAction() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(200, body: "{\"count\":0}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.markAllRead()
        XCTAssertEqual(vm.unreadCount, 0)
        XCTAssertEqual(vm.topBarAction?.isEnabled, false)
    }

    func testMarkAllReadRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.markAllRead()
        XCTAssertEqual(vm.unreadCount, 2)
        XCTAssertEqual(vm.topBarAction?.isEnabled, true)
    }

    // MARK: - Row projection per type

    func testRowMappingForReplyTypeUsesPersonalChipAndMessageCircleIcon() {
        let dto = makeDTO(id: "n", type: "reply", isRead: false)
        let row = NotificationsViewModel.row(
            dto: dto,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) {}
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected typeIcon leading")
            return
        }
        XCTAssertEqual(icon, .messageCircle)
        XCTAssertEqual(row.chips?.first?.icon, .messageCircle)
        XCTAssertEqual(row.chips?.first?.text, "Reply")
        if case let .status(variant) = row.chips?.first?.tint {
            XCTAssertEqual(variant, .personal)
        } else {
            XCTFail("Expected status chip tint")
        }
    }

    func testRowMappingForMentionUsesBusinessAndAtSign() {
        assertRowTypeMapping(rawType: "mention", expectedIcon: .atSign, expectedVariant: .business)
    }

    func testRowMappingForClaimUsesSuccessAndBadgeCheck() {
        assertRowTypeMapping(rawType: "claim", expectedIcon: .badgeCheck, expectedVariant: .success)
    }

    func testRowMappingForGigUsesWarningAndBriefcase() {
        assertRowTypeMapping(rawType: "gig", expectedIcon: .briefcase, expectedVariant: .warning)
    }

    func testRowMappingForListingUsesHomeAndTag() {
        assertRowTypeMapping(rawType: "listing", expectedIcon: .tag, expectedVariant: .home)
    }

    func testRowMappingForSafetyUsesErrorAndShieldAlert() {
        assertRowTypeMapping(rawType: "safety", expectedIcon: .shieldAlert, expectedVariant: .error)
    }

    func testRowMappingForSystemUsesNeutralAndInfo() {
        assertRowTypeMapping(rawType: "system", expectedIcon: .info, expectedVariant: .neutral)
    }

    func testRowMappingForUnknownTypeFallsBackToSystem() {
        assertRowTypeMapping(
            rawType: "definitely_not_a_known_type",
            expectedIcon: .info,
            expectedVariant: .neutral
        )
    }

    /// Strict per-type assertion — fails loudly if the row's `leading` is
    /// not a `.typeIcon` or the chip tint is not a `.status` variant.
    private func assertRowTypeMapping(
        rawType: String,
        expectedIcon: PantopusIcon,
        expectedVariant: StatusChipVariant,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        let dto = makeDTO(id: "n", type: rawType)
        let row = NotificationsViewModel.row(
            dto: dto,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) {}
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected .typeIcon leading for \(rawType)", file: file, line: line)
            return
        }
        XCTAssertEqual(icon, expectedIcon, file: file, line: line)
        guard let chip = row.chips?.first else {
            XCTFail("Expected at least one chip for \(rawType)", file: file, line: line)
            return
        }
        XCTAssertEqual(chip.icon, expectedIcon, file: file, line: line)
        guard case let .status(variant) = chip.tint else {
            XCTFail("Expected status-tinted chip for \(rawType)", file: file, line: line)
            return
        }
        XCTAssertEqual(variant, expectedVariant, file: file, line: line)
    }

    func testUnreadRowGetsUnreadHighlight() {
        let dto = makeDTO(id: "n", type: "reply", isRead: false)
        let row = NotificationsViewModel.row(
            dto: dto,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) {}
        XCTAssertEqual(row.highlight, .unread)
    }

    func testReadRowHasNoHighlight() {
        let dto = makeDTO(id: "n", type: "reply", isRead: true)
        let row = NotificationsViewModel.row(
            dto: dto,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) {}
        XCTAssertNil(row.highlight)
    }

    // MARK: - Date bucketing

    func testMakeSectionsBucketsTodayAndEarlier() {
        let dtos = [
            makeDTO(id: "today", createdAt: "2026-05-15T08:00:00Z"),
            makeDTO(id: "yesterday", createdAt: "2026-05-14T20:00:00Z"),
            makeDTO(id: "tuesday", createdAt: "2026-05-12T20:00:00Z")
        ]
        let sections = NotificationsViewModel.makeSections(
            dtos,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) { _ in }
        XCTAssertEqual(sections.count, 2)
        XCTAssertEqual(sections[0].header, "Today")
        XCTAssertEqual(sections[0].rows.map(\.id), ["today"])
        XCTAssertEqual(sections[1].header, "Earlier")
        XCTAssertEqual(sections[1].rows.map(\.id), ["yesterday", "tuesday"])
    }

    func testMakeSectionsOmitsTodayWhenNoTodayItems() {
        let dtos = [
            makeDTO(id: "y", createdAt: "2026-05-14T08:00:00Z"),
            makeDTO(id: "w", createdAt: "2026-05-10T08:00:00Z")
        ]
        let sections = NotificationsViewModel.makeSections(
            dtos,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) { _ in }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].header, "Earlier")
    }

    func testMakeSectionsCrossesMidnightByCalendarNotByElapsedTime() {
        // 25 hours before fixedNow (12:00 UTC May 15) is 11:00 May 14 —
        // still "Earlier" because it's a different calendar day.
        let dtos = [makeDTO(id: "n", createdAt: "2026-05-14T11:00:00Z")]
        let sections = NotificationsViewModel.makeSections(
            dtos,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) { _ in }
        XCTAssertEqual(sections.first?.header, "Earlier")
    }

    func testMakeSectionsRespectsLocalTimezone() throws {
        // 2026-05-15T01:00:00Z is 17:00 May 14 in PST. Under PST it's
        // "Earlier"; under UTC it's "Today".
        let dtos = [makeDTO(id: "n", createdAt: "2026-05-15T01:00:00Z")]
        let pst = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        var pstCal = Calendar(identifier: .gregorian)
        pstCal.timeZone = pst
        let pstSections = NotificationsViewModel.makeSections(
            dtos,
            now: Self.fixedNow,
            calendar: pstCal,
            timeZone: pst
        ) { _ in }
        XCTAssertEqual(pstSections.first?.header, "Earlier")
        let utcSections = NotificationsViewModel.makeSections(
            dtos,
            now: Self.fixedNow,
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        ) { _ in }
        XCTAssertEqual(utcSections.first?.header, "Today")
    }

    // MARK: - Relative time

    func testRelativeTimeFormatting() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = Self.utc
        XCTAssertEqual(
            NotificationsViewModel.formatRelativeTime(
                "2026-05-15T11:55:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "5m"
        )
        XCTAssertEqual(
            NotificationsViewModel.formatRelativeTime(
                "2026-05-15T09:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "3h"
        )
        XCTAssertEqual(
            NotificationsViewModel.formatRelativeTime(
                "2026-05-14T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "Yesterday"
        )
        XCTAssertEqual(
            NotificationsViewModel.formatRelativeTime(
                "2026-05-12T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "Tue"
        )
        XCTAssertEqual(
            NotificationsViewModel.formatRelativeTime(
                "2026-04-20T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "Apr 20"
        )
    }

    // MARK: - Refresh

    func testRefreshHitsListAgain() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoUnreadJSON),
            .status(200, body: Self.emptyJSON)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.refresh()
        if case .empty = vm.state { /* ok */ } else {
            XCTFail("Expected .empty after server cleared the list")
        }
    }

    // MARK: - Helpers

    private func makeDTO(
        id: String,
        type: String? = "reply",
        isRead: Bool = false,
        createdAt: String = "2026-05-15T10:00:00Z",
        title: String? = "Title",
        body: String? = "Body"
    ) -> NotificationDTO {
        NotificationDTO(
            id: id,
            userId: "u_me",
            type: type,
            title: title,
            body: body,
            icon: nil,
            link: "/post/p_\(id)",
            isRead: isRead,
            createdAt: createdAt,
            context: nil
        )
    }

    private static func waitForState(
        _ vm: NotificationsViewModel,
        timeoutNanoseconds: UInt64 = 1_000_000_000,
        predicate: (ListOfRowsState) -> Bool
    ) async -> ListOfRowsState? {
        let pollNanoseconds: UInt64 = 20_000_000
        var elapsed: UInt64 = 0
        while elapsed <= timeoutNanoseconds {
            if predicate(vm.state) {
                return vm.state
            }
            try? await Task.sleep(nanoseconds: pollNanoseconds)
            elapsed += pollNanoseconds
        }
        return nil
    }
}
