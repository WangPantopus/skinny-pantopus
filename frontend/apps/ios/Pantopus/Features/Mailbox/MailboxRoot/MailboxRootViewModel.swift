// swiftlint:disable file_length type_body_length

import Observation
import SwiftUI

/// The four mailbox drawers. `business` carries the "Biz" short label
/// per the design; `earn` (B.1) is new.
public enum MailboxDrawer: String, CaseIterable, Hashable, Sendable, Identifiable {
    case me
    case home
    case business
    case earn

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .me: "Me"
        case .home: "Home"
        case .business: "Biz"
        case .earn: "Earn"
        }
    }

    /// Drawer chip icon (Lucide-backed). `circle-dollar-sign` in the JSX
    /// maps to the nearest in-set glyph, `dollarSign`.
    public var icon: PantopusIcon {
        switch self {
        case .me: .user
        case .home: .home
        case .business: .briefcase
        case .earn: .dollarSign
        }
    }

    /// Fill tint when the chip is the active drawer. Me/Home/Biz use their
    /// identity-pillar colour; Earn (not an identity pillar) uses the
    /// primary tint — matching the JSX `DrawerPill` active treatment and
    /// the Earn empty-state hero.
    public var accent: Color {
        switch self {
        case .me: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .earn: Theme.Color.primary600
        }
    }

    /// Backend drawer key for `GET /api/mailbox/v2/drawer/:drawer`. The
    /// route validates `['personal', 'home', 'business', 'earn']`
    /// (`backend/routes/mailboxV2.js:286`); the UI's `me` drawer is the
    /// backend's `personal` drawer.
    public var backendKey: String {
        switch self {
        case .me: "personal"
        case .home: "home"
        case .business: "business"
        case .earn: "earn"
        }
    }
}

/// The three tabs within a drawer.
public enum MailboxTab: String, CaseIterable, Hashable, Sendable, Identifiable {
    case incoming
    case counter
    case vault

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .incoming: "Incoming"
        case .counter: "Counter"
        case .vault: "Vault"
        }
    }
}

@Observable
@MainActor
public final class MailboxRootViewModel: ListOfRowsDataSource {
    public let title = "Mailbox"

    /// Active drawer. Changing it preserves the selected tab (B.1
    /// acceptance) and reloads the list for the new (drawer, tab) combo.
    public private(set) var selectedDrawer: MailboxDrawer {
        didSet { if oldValue != selectedDrawer { handleSelectionChange() } }
    }

    /// `ListOfRowsDataSource` tab id (holds a `MailboxTab` raw value). The
    /// shell's own tab strip is suppressed (`tabs == []`) — the segmented
    /// bar renders in the `customHeader` — but this stays the single
    /// source of truth for the active tab so drawer switches preserve it.
    public var selectedTab: String {
        didSet { if oldValue != selectedTab { handleSelectionChange() } }
    }

    /// Empty: the segmented tab bar is rendered by `MailboxRootHeader` in
    /// the shell's custom-header slot, not by the shell's tab strip.
    public let tabs: [ListOfRowsTab] = []

    public private(set) var state: ListOfRowsState = .loading

    public var topBarAction: TopBarAction? {
        TopBarAction(icon: .search, accessibilityLabel: "Search mail") { [weak self] in
            Task { @MainActor in self?.onOpenSearch() }
        }
    }

    /// Compose FAB — the canonical create action of the Mailbox, opening
    /// the four-moment Ceremonial Mail wizard (Porch Call → Address It →
    /// Write It → Seal & Send). Mirrors RN's compose FAB
    /// (`src/app/mailbox/index.tsx:300-307`).
    ///
    /// Shown in **every** state, including empty: an empty mailbox is
    /// exactly when a user wants to write. The design's
    /// `mode !== 'empty'` guard applied to the old scan-line FAB, which
    /// now lives in the top-bar overflow menu ("Find a mailbox") so the
    /// map surface stays reachable.
    public var fab: FABAction? {
        FABAction(
            icon: .pencil,
            accessibilityLabel: "Write a letter",
            variant: .canonicalCreate
        ) { [weak self] in
            Task { @MainActor in self?.onOpenCompose() }
        }
    }

    /// Count of mail sitting in `MailRoutingQueue` unresolved — drives the
    /// "N items need routing" banner. `0` hides the banner.
    /// Source: `GET /api/mailbox/v2/pending` (`backend/routes/mailboxV2.js:612`).
    public private(set) var pendingRoutingCount: Int = 0

    /// Banner copy — RN `src/app/mailbox/index.tsx:183-185`.
    public var pendingRoutingLabel: String {
        "\(pendingRoutingCount) item\(pendingRoutingCount == 1 ? "" : "s") need routing"
    }

    // MARK: - Header inputs

    public var drawers: [MailboxDrawer] {
        MailboxDrawer.allCases
    }

    public var mailTabs: [MailboxTab] {
        MailboxTab.allCases
    }

    public var currentTab: MailboxTab {
        MailboxTab(rawValue: selectedTab) ?? .incoming
    }

    /// Unread badge for a drawer chip — total unread across its three tabs.
    /// Live path reads the per-drawer `unread_count` from
    /// `GET /api/mailbox/v2/drawers`; the sample path counts unviewed rows
    /// across the fixture's three tabs.
    public func drawerBadge(_ drawer: MailboxDrawer) -> Int {
        if sampleProvider != nil {
            return MailboxTab.allCases.reduce(0) { $0 + unreadCount(drawer: drawer, tab: $1) }
        }
        return drawerUnread[drawer.backendKey] ?? 0
    }

    /// Per-(drawer, tab) unread count for the segmented bar. Vault renders
    /// no count (saved mail isn't "unread"); a zero count hides the badge.
    /// The live backend exposes per-*drawer* unread only (no per-tab
    /// breakdown), so the wired path returns `nil` for every tab — the
    /// drawer-chip badge carries the unread signal instead.
    public func tabBadge(_ tab: MailboxTab) -> Int? {
        guard sampleProvider != nil, tab != .vault else { return nil }
        let count = unreadCount(drawer: selectedDrawer, tab: tab)
        return count > 0 ? count : nil
    }

    /// Sample-projection helper — counts unviewed rows for a (drawer, tab)
    /// in the injected fixture. Returns `0` on the live path (badges there
    /// come from `GET /drawers`).
    public func unreadCount(drawer: MailboxDrawer, tab: MailboxTab) -> Int {
        guard let sampleProvider else { return 0 }
        return sampleProvider(drawer, tab).reduce(0) { running, section in
            running + section.items.filter { !$0.item.viewed }.count
        }
    }

    // MARK: - Dependencies

    private let api: APIClient
    private let onOpenMail: (String) -> Void
    private let onOpenSearch: @MainActor () -> Void
    private let onOpenMap: @MainActor () -> Void
    let onOpenMailDay: @MainActor () -> Void
    /// A10.11 — opens the Earn dashboard. Surfaced as the Earn-drawer
    /// empty-state CTA (the drawer is intentionally always-empty, so it
    /// acts as the launchpad into the standalone Earn surface).
    private let onOpenEarn: @MainActor () -> Void
    /// A14.8 — settings-menu entry for the Vacation hold screen. The
    /// Mailbox root top bar surfaces a `…` overflow that opens a menu
    /// containing this entry (more settings can land later).
    private let onOpenVacationHoldHandler: @MainActor () -> Void
    /// A17.11 — top-bar gift affordance opening the Stamps wallet.
    private let onOpenStampsHandler: @MainActor () -> Void
    /// A17.14 — overflow-menu "Scan an item" entry. The scan/add affordance
    /// that opens the Unboxing scan-capture flow.
    private let onOpenUnboxingHandler: @MainActor () -> Void
    /// A17.4 — overflow-menu entry for the Community mail feed.
    private let onOpenCommunityHandler: @MainActor () -> Void
    /// Home Records — overflow-menu entry for the linked-asset hub.
    private let onOpenRecordsHandler: @MainActor () -> Void
    /// A17.12 — overflow-menu "Mail tasks" entry. Opens the mail-linked
    /// task list (`GET /api/mailbox/v2/p3/tasks`).
    private let onOpenMailTasksHandler: @MainActor () -> Void
    /// Compose FAB — opens the Ceremonial Mail wizard.
    private let onOpenCompose: @MainActor () -> Void
    /// "N items need routing" banner — opens the disambiguation queue.
    private let onOpenRoutingQueueHandler: @MainActor () -> Void
    /// Overflow-menu "Mail party" entry. Opens the Family Mail Party
    /// surface (`GET /api/mailbox/v2/p2/party/active` and friends).
    private let onOpenMailPartyHandler: @MainActor () -> Void
    /// Preview/test seam. Non-nil → sample mode: the screen projects this
    /// fixture and never touches the network. Nil → live mode (production).
    private let sampleProvider: ((MailboxDrawer, MailboxTab) -> [MailboxSampleSection])?
    /// When set, `load()` surfaces this state verbatim — lets previews and
    /// tests pin the loading / error frames.
    private let seededState: ListOfRowsState?

    // MARK: - Live paging state

    private let pageSize = 25
    private var offset = 0
    private var hasMore = false
    private var loadedMail: [DrawerItemsResponse.DrawerMail] = []
    private var isLoadingPage = false
    /// Bumped on every combo reload so a late in-flight page from a
    /// previous (drawer, tab) is discarded instead of clobbering the
    /// current view.
    private var loadGeneration = 0
    /// Per-drawer unread counts from `GET /api/mailbox/v2/drawers`, keyed
    /// by the backend drawer key (`personal` / `home` / `business` / `earn`).
    private var drawerUnread: [String: Int] = [:]

    /// Production initializer — uses the shared API client. Kept free of
    /// any `APIClient` parameter so it can stay `public` (the client type
    /// and `.shared` are module-internal).
    public convenience init(
        initialDrawer: MailboxDrawer = .me,
        initialTab: MailboxTab = .incoming,
        onOpenMail: @escaping (String) -> Void = { _ in },
        onOpenSearch: @escaping @MainActor () -> Void = {},
        onOpenMap: @escaping @MainActor () -> Void = {},
        onOpenMailDay: @escaping @MainActor () -> Void = {},
        onOpenEarn: @escaping @MainActor () -> Void = {},
        onOpenVacationHold: @escaping @MainActor () -> Void = {},
        onOpenStamps: @escaping @MainActor () -> Void = {},
        onOpenUnboxing: @escaping @MainActor () -> Void = {},
        onOpenCompose: @escaping @MainActor () -> Void = {},
        onOpenRoutingQueue: @escaping @MainActor () -> Void = {},
        onOpenMailParty: @escaping @MainActor () -> Void = {},
        onOpenCommunity: @escaping @MainActor () -> Void = {},
        onOpenRecords: @escaping @MainActor () -> Void = {},
        onOpenMailTasks: @escaping @MainActor () -> Void = {},
        dataProvider: ((MailboxDrawer, MailboxTab) -> [MailboxSampleSection])? = nil,
        seededState: ListOfRowsState? = nil
    ) {
        self.init(
            api: .shared,
            initialDrawer: initialDrawer,
            initialTab: initialTab,
            onOpenMail: onOpenMail,
            onOpenSearch: onOpenSearch,
            onOpenMap: onOpenMap,
            onOpenMailDay: onOpenMailDay,
            onOpenEarn: onOpenEarn,
            onOpenVacationHold: onOpenVacationHold,
            onOpenStamps: onOpenStamps,
            onOpenUnboxing: onOpenUnboxing,
            onOpenCompose: onOpenCompose,
            onOpenRoutingQueue: onOpenRoutingQueue,
            onOpenMailParty: onOpenMailParty,
            onOpenCommunity: onOpenCommunity,
            onOpenRecords: onOpenRecords,
            onOpenMailTasks: onOpenMailTasks,
            dataProvider: dataProvider,
            seededState: seededState
        )
    }

    /// Designated initializer. `api` is injectable for tests; it is
    /// module-internal because `APIClient` is internal.
    init(
        api: APIClient,
        initialDrawer: MailboxDrawer = .me,
        initialTab: MailboxTab = .incoming,
        onOpenMail: @escaping (String) -> Void = { _ in },
        onOpenSearch: @escaping @MainActor () -> Void = {},
        onOpenMap: @escaping @MainActor () -> Void = {},
        onOpenMailDay: @escaping @MainActor () -> Void = {},
        onOpenEarn: @escaping @MainActor () -> Void = {},
        onOpenVacationHold: @escaping @MainActor () -> Void = {},
        onOpenStamps: @escaping @MainActor () -> Void = {},
        onOpenUnboxing: @escaping @MainActor () -> Void = {},
        onOpenCompose: @escaping @MainActor () -> Void = {},
        onOpenRoutingQueue: @escaping @MainActor () -> Void = {},
        onOpenMailParty: @escaping @MainActor () -> Void = {},
        onOpenCommunity: @escaping @MainActor () -> Void = {},
        onOpenRecords: @escaping @MainActor () -> Void = {},
        onOpenMailTasks: @escaping @MainActor () -> Void = {},
        dataProvider: ((MailboxDrawer, MailboxTab) -> [MailboxSampleSection])? = nil,
        seededState: ListOfRowsState? = nil
    ) {
        self.api = api
        selectedDrawer = initialDrawer
        selectedTab = initialTab.rawValue
        self.onOpenMail = onOpenMail
        self.onOpenSearch = onOpenSearch
        self.onOpenMap = onOpenMap
        self.onOpenMailDay = onOpenMailDay
        self.onOpenEarn = onOpenEarn
        onOpenVacationHoldHandler = onOpenVacationHold
        onOpenStampsHandler = onOpenStamps
        onOpenUnboxingHandler = onOpenUnboxing
        self.onOpenCompose = onOpenCompose
        onOpenRoutingQueueHandler = onOpenRoutingQueue
        onOpenMailPartyHandler = onOpenMailParty
        onOpenCommunityHandler = onOpenCommunity
        onOpenRecordsHandler = onOpenRecords
        onOpenMailTasksHandler = onOpenMailTasks
        sampleProvider = dataProvider
        self.seededState = seededState
    }

    /// A14.8 — invoked from `MailboxRootView`'s overflow menu when the
    /// user taps "Vacation hold". Exposed publicly so the SwiftUI Menu
    /// in the view layer can call it directly.
    public func openVacationHold() {
        onOpenVacationHoldHandler()
    }

    /// A17.11 — invoked from the Mailbox root top-bar gift button to open
    /// the Stamps (postage wallet) screen.
    public func openStamps() {
        onOpenStampsHandler()
    }

    /// A17.14 — invoked from `MailboxRootView`'s overflow menu when the user
    /// taps "Scan an item". Opens the Unboxing scan-capture flow.
    public func openUnboxing() {
        onOpenUnboxingHandler()
    }

    /// Invoked from `MailboxRootView`'s overflow menu "Find a mailbox"
    /// entry. The Mailbox map moved off the FAB when the compose FAB
    /// landed; it stays reachable here.
    public func openMap() {
        onOpenMap()
    }

    /// Invoked from the "N items need routing" banner in the header.
    public func openRoutingQueue() {
        onOpenRoutingQueueHandler()
    }

    /// Invoked from `MailboxRootView`'s overflow menu when the user taps
    /// "Mail party". Opens the household co-opening surface.
    public func openMailParty() {
        onOpenMailPartyHandler()
    }

    /// A17.4 — invoked from `MailboxRootView`'s overflow menu when the
    /// user taps "Community mail". Opens the neighborhood / civic feed.
    public func openCommunity() {
        onOpenCommunityHandler()
    }

    /// Invoked from `MailboxRootView`'s overflow menu when the user taps
    /// "Home records". Opens the linked-asset hub.
    public func openRecords() {
        onOpenRecordsHandler()
    }

    /// A17.12 — invoked from `MailboxRootView`'s overflow menu when the
    /// user taps "Mail tasks". Opens the mail-linked task list.
    public func openMailTasks() {
        onOpenMailTasksHandler()
    }

    // MARK: - Lifecycle

    public func load() async {
        if let seededState {
            state = seededState
            return
        }
        if sampleProvider != nil {
            rebuildFromSample()
            return
        }
        if case .loaded = state, !loadedMail.isEmpty { return }
        state = .loading
        await fetchDrawerBadges()
        await fetchPendingRouting()
        await reloadActiveCombo()
    }

    public func refresh() async {
        if seededState != nil { return }
        if sampleProvider != nil {
            rebuildFromSample()
            return
        }
        await fetchDrawerBadges()
        await fetchPendingRouting()
        await reloadActiveCombo()
    }

    public func loadMoreIfNeeded() async {
        guard sampleProvider == nil else { return } // a sample window is fixed.
        guard hasMore, !isLoadingPage else { return }
        await fetchPage(generation: loadGeneration)
    }

    public func selectDrawer(_ drawer: MailboxDrawer) {
        selectedDrawer = drawer
    }

    public func selectTab(_ tab: MailboxTab) {
        selectedTab = tab.rawValue
    }

    // MARK: - Selection routing

    /// Drawer / tab change. Sample mode re-projects synchronously (the
    /// fixture is already in memory); live mode shows the loading skeleton
    /// and refetches the active combo.
    private func handleSelectionChange() {
        guard seededState == nil else { return }
        if sampleProvider != nil {
            rebuildFromSample()
        } else {
            state = .loading
            Task { @MainActor in await reloadActiveCombo() }
        }
    }

    // MARK: - Live fetch

    private func reloadActiveCombo() async {
        loadGeneration &+= 1
        let generation = loadGeneration
        offset = 0
        loadedMail = []
        await fetchPage(generation: generation)
    }

    private func fetchPage(generation: Int) async {
        isLoadingPage = true
        let drawer = selectedDrawer
        let tab = currentTab
        do {
            let response: DrawerItemsResponse = try await api.request(
                MailboxV2Endpoints.drawer(
                    drawer.backendKey,
                    tab: tab.rawValue,
                    limit: pageSize,
                    offset: offset
                )
            )
            isLoadingPage = false
            // Drop late responses if the user has since switched combo.
            guard generation == loadGeneration else { return }
            loadedMail.append(contentsOf: response.mail)
            offset = loadedMail.count
            hasMore = response.mail.count >= pageSize
            applyLiveState(drawer: drawer, tab: tab)
        } catch {
            isLoadingPage = false
            guard generation == loadGeneration else { return }
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load mail.")
        }
    }

    private func fetchDrawerBadges() async {
        do {
            let response: DrawerListResponse = try await api.request(MailboxV2Endpoints.drawers())
            drawerUnread = response.drawers.reduce(into: [String: Int]()) { counts, drawer in
                counts[drawer.drawer] = drawer.unreadCount
            }
        } catch {
            // Badges are non-blocking chrome — leave them empty on failure
            // so the list still renders.
            drawerUnread = [:]
        }
    }

    /// Poll the disambiguation queue on appear / pull-to-refresh, exactly
    /// like RN (`src/app/mailbox/index.tsx:65-70`). The banner is
    /// non-blocking chrome — a failure just leaves the count at zero so
    /// the list still renders.
    private func fetchPendingRouting() async {
        do {
            let response: PendingRoutingResponse = try await api.request(
                MailboxRoutingEndpoints.pending()
            )
            pendingRoutingCount = response.pending.count
        } catch {
            pendingRoutingCount = 0
        }
    }

    private func applyLiveState(drawer: MailboxDrawer, tab: MailboxTab) {
        if loadedMail.isEmpty {
            state = .empty(emptyContent(drawer: drawer, tab: tab))
        } else {
            let rows = loadedMail.map { mail in
                MailboxListViewModel.makeRow(
                    for: mail.item,
                    trust: MailTrust.fromRaw(mail.senderTrust)
                ) { [weak self] mailId in
                    Task { @MainActor in self?.onOpenMail(mailId) }
                }
            }
            state = .loaded(sections: [RowSection(rows: rows)], hasMore: hasMore)
        }
    }

    // MARK: - Sample projection (preview/test seam)

    private func rebuildFromSample() {
        guard let sampleProvider else { return }
        let drawer = selectedDrawer
        let tab = currentTab
        let sections = sampleProvider(drawer, tab).filter { !$0.items.isEmpty }
        if sections.isEmpty {
            state = .empty(emptyContent(drawer: drawer, tab: tab))
        } else {
            state = .loaded(
                sections: sections.map { rowSection($0, drawer: drawer, tab: tab) },
                hasMore: false
            )
        }
    }

    private func rowSection(
        _ section: MailboxSampleSection,
        drawer: MailboxDrawer,
        tab: MailboxTab
    ) -> RowSection {
        RowSection(
            id: "\(drawer.rawValue).\(tab.rawValue).\(section.id)",
            header: section.header,
            rows: section.items.map { sample in
                MailboxListViewModel.makeRow(for: sample.item, trust: sample.trust) { [weak self] mailId in
                    Task { @MainActor in self?.onOpenMail(mailId) }
                }
            }
        )
    }

    private func emptyContent(
        drawer: MailboxDrawer,
        tab: MailboxTab
    ) -> ListOfRowsState.EmptyContent {
        switch (drawer, tab) {
        case (.earn, .incoming):
            ListOfRowsState.EmptyContent(
                icon: .wallet,
                headline: "No earn items yet",
                subcopy: "Complete gigs to see payouts, 1099s, and tax docs land here automatically.",
                ctaTitle: "Open Earn dashboard"
            ) { [weak self] in Task { @MainActor in self?.onOpenEarn() } }
        case (.earn, .counter):
            ListOfRowsState.EmptyContent(
                icon: .wallet,
                headline: "Nothing to action",
                subcopy: "Payout approvals and tax to-dos for your gigs show up here."
            )
        case (.earn, .vault):
            ListOfRowsState.EmptyContent(
                icon: .archive,
                headline: "No saved earn mail",
                subcopy: "Save payout statements and 1099s to find them fast."
            )
        default:
            ListOfRowsState.EmptyContent(
                icon: tab == .vault ? .archive : .mailbox,
                headline: "No mail in \(drawer.label) → \(tab.label) yet",
                subcopy: "When something lands here, it shows up in this view."
            )
        }
    }
}
