//
//  MailboxRootViewModelTests.swift
//  PantopusTests
//
//  B.1 — state-projection coverage for the Mailbox root (drawer-tabs
//  hybrid). The repo's "snapshot" tests are design-reference PNG
//  tripwires that need a simulator render to generate; these assert the
//  same contract deterministically via the view-model's render states,
//  covering the three design frames (Me/Incoming, Biz/Counter,
//  Earn/Incoming-Empty) plus the preserve-tab and per-(drawer, tab)
//  count behaviours.
//
//  P1-B — the default init is now the live path
//  (`GET /api/mailbox/v2/drawers` + `/drawer/:drawer`). The sample
//  frames are driven through the `dataProvider` preview/test seam; a
//  second block exercises the live fetch via `SequencedURLProtocol`.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailboxRootViewModelTests: XCTestCase {
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

    /// Sample-backed VM — drives the documented preview/test seam offline.
    private func sampleVM(
        drawer: MailboxDrawer = .me,
        tab: MailboxTab = .incoming
    ) -> MailboxRootViewModel {
        MailboxRootViewModel(
            initialDrawer: drawer,
            initialTab: tab,
            dataProvider: MailboxRootSampleData.sections
        )
    }

    private func rows(_ state: ListOfRowsState) -> [RowModel] {
        guard case let .loaded(sections, _) = state else { return [] }
        return sections.flatMap(\.rows)
    }

    private func sectionHeaders(_ state: ListOfRowsState) -> [String] {
        guard case let .loaded(sections, _) = state else { return [] }
        return sections.compactMap(\.header)
    }

    // MARK: - Frame 01 · Me / Incoming (sample seam)

    func test_meIncoming_populatedFrame() async {
        let vm = sampleVM(drawer: .me, tab: .incoming)
        await vm.load()

        guard case .loaded = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(sectionHeaders(vm.state), ["Today", "Yesterday"])
        XCTAssertEqual(rows(vm.state).count, 5)
        XCTAssertEqual(rows(vm.state).first?.title, "Echo Pop arriving today by 8pm")
    }

    // MARK: - Frame 02 · Biz / Counter

    func test_bizCounter_populatedFrame() async {
        let vm = sampleVM(drawer: .business, tab: .counter)
        await vm.load()

        guard case .loaded = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(sectionHeaders(vm.state), ["Due this week", "Awaiting your response"])
        XCTAssertEqual(rows(vm.state).count, 5)
    }

    // MARK: - Frame 03 · Earn / Incoming (empty)

    func test_earnIncoming_emptyFrame() async {
        let vm = sampleVM(drawer: .earn, tab: .incoming)
        await vm.load()

        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected empty, got \(vm.state)")
        }
        XCTAssertEqual(content.headline, "No earn items yet")
        XCTAssertEqual(content.ctaTitle, "Open Earn dashboard")
    }

    func test_everyEarnTabIsEmpty() async {
        for tab in MailboxTab.allCases {
            let vm = sampleVM(drawer: .earn, tab: tab)
            await vm.load()
            guard case .empty = vm.state else {
                return XCTFail("Earn/\(tab.rawValue) should be empty, got \(vm.state)")
            }
        }
    }

    // MARK: - Drawer switch preserves the selected tab

    func test_drawerSwitchPreservesSelectedTab() async {
        let vm = sampleVM(drawer: .me, tab: .incoming)
        await vm.load()

        vm.selectTab(.counter)
        XCTAssertEqual(vm.currentTab, .counter)

        vm.selectDrawer(.business)
        XCTAssertEqual(vm.currentTab, .counter, "Drawer switch must keep the active tab")
        XCTAssertEqual(vm.selectedDrawer, .business)
        XCTAssertEqual(sectionHeaders(vm.state), ["Due this week", "Awaiting your response"])
    }

    func test_selectingTabRebuildsState() async {
        let vm = sampleVM(drawer: .me, tab: .incoming)
        await vm.load()
        XCTAssertEqual(sectionHeaders(vm.state), ["Today", "Yesterday"])

        vm.selectTab(.counter)
        XCTAssertEqual(sectionHeaders(vm.state), ["Awaiting your response"])
    }

    // MARK: - Per-(drawer, tab) unread counts (sample seam)

    func test_tabBadgesForMeDrawer() async {
        let vm = sampleVM(drawer: .me, tab: .incoming)
        await vm.load()

        XCTAssertEqual(vm.tabBadge(.incoming), 3)
        XCTAssertEqual(vm.tabBadge(.counter), 2)
        XCTAssertNil(vm.tabBadge(.vault), "Vault never shows an unread count")
    }

    func test_drawerBadgesAggregateUnread() {
        let vm = sampleVM()
        XCTAssertEqual(vm.drawerBadge(.me), 5)
        XCTAssertEqual(vm.drawerBadge(.home), 3)
        XCTAssertEqual(vm.drawerBadge(.earn), 0, "Earn has no mail, so no badge")
    }

    func test_unreadCountForBizCounter() {
        let vm = sampleVM()
        XCTAssertEqual(vm.unreadCount(drawer: .business, tab: .counter), 4)
    }

    // MARK: - FAB (compose)

    /// The FAB is the Mailbox's compose affordance and is present in every
    /// state, including empty — an empty mailbox is exactly when a user
    /// wants to write. (The old scan-line/map FAB moved to the overflow
    /// menu; it was the one hidden on empty.)
    func test_fabIsComposeAndShownInEveryState() async {
        let populated = sampleVM(drawer: .me, tab: .incoming)
        await populated.load()
        XCTAssertEqual(populated.fab?.accessibilityLabel, "Write a letter")

        let empty = sampleVM(drawer: .earn, tab: .incoming)
        await empty.load()
        XCTAssertEqual(empty.fab?.accessibilityLabel, "Write a letter")
    }

    func test_fabInvokesComposeHandler() async {
        let didOpenCompose = expectation(description: "compose opened")
        let vm = MailboxRootViewModel(
            initialDrawer: .me,
            initialTab: .incoming,
            onOpenCompose: { didOpenCompose.fulfill() },
            dataProvider: MailboxRootSampleData.sections
        )
        await vm.load()
        vm.fab?.handler()
        await fulfillment(of: [didOpenCompose], timeout: 1)
    }

    // MARK: - Trust override flows into the row chips

    func test_sampleRowCarriesPerItemTrust() async {
        let vm = sampleVM(drawer: .me, tab: .incoming)
        await vm.load()

        let coupon = rows(vm.state).first { $0.id == "me-in-3" }
        XCTAssertEqual(coupon?.chips?.last?.text, "Partial")
    }

    // MARK: - Seeded states

    func test_seededErrorStateSurfacesVerbatim() async {
        let vm = MailboxRootViewModel(seededState: .error(message: "Couldn't load mail."))
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
        XCTAssertEqual(message, "Couldn't load mail.")
    }

    func test_initialStateIsLoading() {
        let vm = MailboxRootViewModel()
        guard case .loading = vm.state else {
            return XCTFail("Expected loading before load(), got \(vm.state)")
        }
    }

    // MARK: - Live wiring (GET /drawers + /drawer/:drawer)

    private static let drawersBody = """
    {"drawers":[
      {"drawer":"personal","display_name":"Me","icon":"user","unread_count":3,"urgent_count":1,"last_item_at":null},
      {"drawer":"home","display_name":"Home","icon":"home","unread_count":2,"urgent_count":0,"last_item_at":null},
      {"drawer":"business","display_name":"Business","icon":"shopping-bag","unread_count":0,"urgent_count":0,"last_item_at":null},
      {"drawer":"earn","display_name":"Earn","icon":"megaphone","unread_count":0,"urgent_count":0,"last_item_at":null}
    ]}
    """

    /// `GET /api/mailbox/v2/pending` with an empty queue — `load()` polls it
    /// between `/drawers` and `/drawer/:drawer`.
    private static let emptyPendingBody = "{\"pending\":[]}"

    private static func drawerItem(id: String, title: String, trust: String) -> String {
        """
        {"id":"\(id)","type":"bill","mail_type":"bill","display_title":"\(title)",
         "preview_text":"Due soon","sender_business_name":"EBMUD","viewed":false,
         "archived":false,"starred":false,"tags":[],"priority":"normal",
         "created_at":"2026-01-01T00:00:00Z","sender_display":"EBMUD",
         "sender_trust":"\(trust)","package":null}
        """
    }

    func test_live_loadPopulatedRendersRowsFromDrawerEndpoint() async {
        let items = "\(Self.drawerItem(id: "m-1", title: "Water bill", trust: "verified_utility"))"
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(200, body: Self.emptyPendingBody),
            .status(200, body: "{\"mail\":[\(items)],\"total\":1,\"drawer\":\"personal\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        guard case .loaded = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows(vm.state).count, 1)
        XCTAssertEqual(rows(vm.state).first?.title, "Water bill")
        // Trust override flows from the wire `sender_trust`.
        XCTAssertEqual(rows(vm.state).first?.chips?.last?.text, "Verified")
        // Live list is a single unsectioned group (the backend doesn't group).
        XCTAssertEqual(sectionHeaders(vm.state), [])
    }

    func test_live_drawerBadgeReadsUnreadFromDrawersEndpoint() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(200, body: Self.emptyPendingBody),
            .status(200, body: "{\"mail\":[],\"total\":0,\"drawer\":\"personal\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        // `me` maps to the backend `personal` drawer.
        XCTAssertEqual(vm.drawerBadge(.me), 3)
        XCTAssertEqual(vm.drawerBadge(.home), 2)
        XCTAssertEqual(vm.drawerBadge(.business), 0)
        // The backend exposes no per-tab unread, so tab badges are nil live.
        XCTAssertNil(vm.tabBadge(.incoming))
    }

    func test_live_emptyDrawerTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(200, body: Self.emptyPendingBody),
            .status(200, body: "{\"mail\":[],\"total\":0,\"drawer\":\"personal\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected empty, got \(vm.state)")
        }
        XCTAssertEqual(content.headline, "No mail in Me → Incoming yet")
    }

    func test_live_listFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(200, body: Self.emptyPendingBody),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }

    func test_live_paginationSetsHasMoreWhenPageFull() async {
        // 25 items == pageSize → hasMore true.
        let page = (0..<25)
            .map { Self.drawerItem(id: "m-\($0)", title: "Item \($0)", trust: "verified_gov") }
            .joined(separator: ",")
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(200, body: Self.emptyPendingBody),
            .status(200, body: "{\"mail\":[\(page)],\"total\":40,\"drawer\":\"personal\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        guard case let .loaded(_, hasMore) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertTrue(hasMore, "A full page should signal more to load")
    }

    // MARK: - Pending-routing banner (GET /api/mailbox/v2/pending)

    func test_live_pendingRoutingCountDrivesBanner() async {
        let pending = """
        {"pending":[
          {"mail_id":"m-1","home_id":"h-1","recipient_name_raw":"M. Kovacs","Mail":{"subject":"Water bill"}},
          {"mail_id":"m-2","home_id":"h-1","recipient_name_raw":"Marcus K","Mail":{"subject":"Notice"}}
        ]}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(200, body: pending),
            .status(200, body: "{\"mail\":[],\"total\":0,\"drawer\":\"personal\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        XCTAssertEqual(vm.pendingRoutingCount, 2)
        XCTAssertEqual(vm.pendingRoutingLabel, "2 items need routing")
    }

    func test_live_pendingRoutingFailureLeavesBannerHidden() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.drawersBody),
            .status(500, body: "{\"error\":\"boom\"}"),
            .status(200, body: "{\"mail\":[],\"total\":0,\"drawer\":\"personal\"}")
        ]
        let vm = MailboxRootViewModel(api: makeAPI())
        await vm.load()

        XCTAssertEqual(vm.pendingRoutingCount, 0, "The banner is non-blocking chrome")
    }
}
