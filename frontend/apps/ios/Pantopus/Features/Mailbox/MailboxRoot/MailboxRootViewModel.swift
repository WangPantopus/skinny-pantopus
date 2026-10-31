// swiftlint:disable file_length type_body_length

import Observation
import SwiftUI

public extension Notification.Name {
    /// Posted with a letter's id as `object` after a confirmed action moved it
    /// out of its Mailbox tab: Dismiss shreds it, File and Save to vault file it,
    /// Archive archives it.
    static let mailboxMailLeftList = Notification.Name("mailboxMailLeftList")
    /// Posted with a letter's id as `object` after opening it marked it read.
    static let mailboxMailViewed = Notification.Name("mailboxMailViewed")
    /// Posted with a sent card's id as `object` after it was taken back on its page.
    static let mailboxSentChanged = Notification.Name("mailboxSentChanged")
    /// Posted to show Sent in the Mailbox; with a sent card's id as `object`, that card's page too.
    static let mailboxOpenSent = Notification.Name("mailboxOpenSent")
    /// Posted when a link opens a sent card's page (a card notice): the Mailbox under it shows Sent.
    static let mailboxShowSent = Notification.Name("mailboxShowSent")
}

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
    public let title = "Mail"

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
    /// Set when a reload fails while mail is on screen: it stays and this
    /// shows as a toast. The view clears it after display.
    public var refreshFailureMessage: String?
    /// Set when a later page fails: the rows stay and the list end offers
    /// Try again for that same page.
    public private(set) var loadMoreError: String?

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
        // Launch cut #8 (Mail extras): writing letters is hidden for the first launch.
        guard LaunchFeatures.mailExtras else { return nil }
        return FABAction(
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

    /// Me and Home always. Biz for business owners, or anyone with Biz mail,
    /// so nothing is hidden. Launch cut #8 (Mail extras): Earn (offers and ad
    /// earnings that never reach the withdrawable wallet) is hidden.
    public var drawers: [MailboxDrawer] {
        MailboxDrawer.allCases.filter { drawer in
            switch drawer {
            case .me, .home: true
            case .business:
                sampleProvider != nil || ownsBusiness || (drawerUnread[drawer.backendKey] ?? 0) > 0
                    || selectedDrawer == .business
            case .earn: LaunchFeatures.mailExtras
            }
        }
    }

    // MARK: - The Mailbox as mail (Mail tab drawings)

    /// Your mailbox, your address and the morning round.
    private(set) var hero = MailboxHeroModel.make(delivery: nil, homes: [])
    /// The loaded mail drawn as pieces, by the day it came.
    private(set) var pieceSections: [MailPieceSection] = []
    /// The Homes this person lives at (whose mail is open, or waits for proof).
    private var homes: [DrawerListResponse.MailboxHome] = []
    /// Sent (`mailbox`): the chip after the drawers, its list in place of the
    /// tabs while it's chosen, and the hero's flag while a card waits for the
    /// 7 a.m. pickup. Sent isn't a drawer: no `GET /v2/drawer/:drawer`, no badge.
    private(set) var showsSent = false
    private(set) var sentSummary: DrawerListResponse.MailSent?
    let sent: MailSentViewModel
    /// A sent card's page.
    var onOpenSentCard: (@MainActor (String) -> Void)?
    /// This Mailbox opened the card flow, so its "See it in Sent" lands here.
    private var openedCardFlow = false
    /// Owns a business (`GET /api/businesses/my-businesses`): shows Biz.
    private var ownsBusiness = false
    private var didCheckBusinesses = false
    /// Set when a letter changed where it stands while the Mailbox was covered.
    private var listIsStale = false

    /// The vacation hold in effect or coming (the banner on the Mailbox).
    private(set) var vacationHold: DrawerListResponse.MailVacationHold?
    /// The Vault tab: the drawer's folders, the one open now, the archived
    /// mail, and what to say when they couldn't load.
    private(set) var vaultFolders: [VaultFolderDTO] = []
    /// The folders as cabinets: in Home, one per Home, titled with its name
    /// when there are several (an owner of two Homes has two "Utilities").
    var vaultCabinets: [MailVaultCabinet] {
        MailVaultCabinet.cabinets(of: vaultFolders, homeMail: selectedDrawer == .home, homes: homes)
    }

    private(set) var openFolder: VaultFolderDTO?
    private(set) var archivedPieces: [MailPieceModel] = []
    private(set) var vaultFailure: String?
    /// Search inside the Vault: filed and archived mail only.
    var vaultQuery = ""
    private(set) var vaultResults: [MailPieceModel]?
    private(set) var vaultSearching = false
    private(set) var vaultSearchFailure: String?
    private(set) var vaultHasMore = false
    private var vaultSearchOffset = 0
    private var vaultSubmittedQuery = ""
    private var vaultSearchRequest = UUID()

    /// Set by the Mail tab after it makes the model: Pay on the Counter, the
    /// closed Home drawer's Verify your home, and the first day's porch.
    var onOpenInvoice: (@MainActor (String) -> Void)?
    var onVerifyHome: (@MainActor (String) -> Void)?
    var onOpenWelcome: (@MainActor (DrawerItemsResponse.DrawerMail) -> Void)?
    /// "Send a Christmas card" (`holiday_cards`): the card flow, or today's card.
    var onOpenChristmasCards: (@MainActor () -> Void)?
    /// The Christmas cards answer while sending is open (`holiday_cards` and
    /// `mailbox` on): the row at the top of Me shows it. Nil hides the row.
    private(set) var christmasCards: HolidayCardsResponse?

    /// The Counter's pieces with their due tags, lines and buttons (board R9).
    var counterItems: [MailCounterItem] {
        guard currentTab == .counter else { return [] }
        let rows = Dictionary(loadedMail.map { ($0.id, $0) }) { first, _ in first }
        return pieceSections.flatMap(\.pieces).compactMap { piece in
            rows[piece.id].map { MailCounterItem.make(piece: piece, mail: $0, clock: .current) }
        }
    }

    /// The Counter's button for one piece: Pay opens the invoice, the rest the letter.
    func act(on item: MailCounterItem) {
        switch item.action {
        case let .pay(invoiceId):
            if let onOpenInvoice { onOpenInvoice(invoiceId) } else { openMail(item.id) }
        case .open:
            openMail(item.id)
        }
    }

    /// Live mail (not the sample seam that previews and tests drive).
    var isLive: Bool {
        sampleProvider == nil
    }

    /// Homes the person lives at whose mail waits for proof of the address.
    var homesWaitingForProof: [DrawerListResponse.MailboxHome] {
        homes.filter { !$0.isOpen }
    }

    /// The Home drawer is a closed box: every Home here waits for proof.
    var showsClosedHome: Bool {
        selectedDrawer == .home && !homes.isEmpty && homes.allSatisfy { !$0.isOpen }
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
        if sampleProvider == nil {
            // Live: Incoming counts the drawer's unopened pieces; the server
            // counts nothing per tab beyond that.
            guard tab == .incoming, let unread = drawerUnread[selectedDrawer.backendKey], unread > 0 else { return nil }
            return unread
        }
        guard tab != .vault else { return nil }
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
    /// Letters opened (and so read) since they loaded: their rows lose the
    /// unread highlight without a reload.
    private var viewedMailIds: Set<String> = []
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
        sent = MailSentViewModel(api: api)
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
        // A card taken back from Sent: the flag and today's card follow.
        sent.onChange = { [weak self] in
            Task { @MainActor in await self?.sentChanged() }
        }
    }

    /// A14.8 — invoked from `MailboxRootView`'s overflow menu when the
    /// user taps "Hold my mail". Exposed publicly so the SwiftUI Menu
    /// in the view layer can call it directly.
    public func openVacationHold() {
        onOpenVacationHoldHandler()
    }

    /// A piece tapped in the list.
    public func openMail(_ mailId: String) {
        onOpenMail(mailId)
    }

    /// The header's search: every piece this person can read, on the server.
    public func openSearch() {
        onOpenSearch()
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
        if case .loaded = state, !loadedMail.isEmpty {
            // Back on the Mailbox: the round and the badges may have moved,
            // and a letter may have changed where it stands.
            await fetchDrawerBadges()
            if listIsStale {
                listIsStale = false
                await reloadActiveCombo(keepingRows: true)
            }
            // A card may have gone out, or come back, since.
            await fetchChristmasCards()
            if showsSent { await sent.refresh() }
            return
        }
        state = .loading
        await fetchDrawerBadges()
        await fetchPendingRouting()
        await reloadActiveCombo()
        // After the mail: Biz shows for owners once this answers.
        await fetchBusinessOwnership()
        await fetchChristmasCards()
    }

    public func refresh() async {
        if seededState != nil { return }
        if sampleProvider != nil {
            rebuildFromSample()
            return
        }
        await fetchDrawerBadges()
        await fetchPendingRouting()
        if showsSent {
            await sent.refresh()
        } else {
            await reloadActiveCombo(keepingRows: true)
        }
        await fetchChristmasCards()
    }

    public func loadMoreIfNeeded() async {
        guard sampleProvider == nil else { return } // a sample window is fixed.
        // After a failed page only Try again (`retryLoadMore`) asks again.
        guard hasMore, !isLoadingPage, loadMoreError == nil else { return }
        await fetchPage(generation: loadGeneration)
    }

    /// Try again on a failed page: the same offset, the rows kept.
    public func retryLoadMore() async {
        guard loadMoreError != nil, !isLoadingPage else { return }
        loadMoreError = nil
        await fetchPage(generation: loadGeneration)
    }

    /// A letter dismissed, filed or archived from its detail left this tab:
    /// drop its row now instead of listing it until the next reload.
    /// A letter moved (on the counter, back in Incoming, restored): read the
    /// list again when the Mailbox is next shown.
    public func markListStale() {
        guard sampleProvider == nil else { return }
        listIsStale = true
    }

    public func dropLoadedMail(_ mailId: String) {
        guard sampleProvider == nil, loadedMail.contains(where: { $0.id == mailId }) else { return }
        loadedMail.removeAll { $0.id == mailId }
        offset = loadedMail.count
        if loadedMail.isEmpty, hasMore {
            // Everything loaded is gone but more exists: load the tab again.
            state = .loading
            Task { @MainActor in await refresh() }
        } else {
            applyLiveState(drawer: selectedDrawer, tab: currentTab)
            // The letter no longer counts toward its drawer's unread badge.
            Task { @MainActor in await fetchDrawerBadges() }
        }
    }

    /// Opening a letter marked it read: clear its row's unread highlight and
    /// refresh the drawer badges it counted toward.
    public func markLoadedMailViewed(_ mailId: String) {
        guard sampleProvider == nil else { return }
        viewedMailIds.insert(mailId)
        if loadedMail.contains(where: { $0.id == mailId }) {
            applyLiveState(drawer: selectedDrawer, tab: currentTab)
        }
        Task { @MainActor in await fetchDrawerBadges() }
    }

    public func selectDrawer(_ drawer: MailboxDrawer) {
        showsSent = false
        selectedDrawer = drawer
    }

    // MARK: - Sent

    /// The Sent chip shows with `mailbox` once something's been sent, or
    /// while cards can be sent.
    var showsSentChip: Bool {
        isLive && LaunchFeatures.mailbox && (sentSummary?.any == true || LaunchFeatures.holidayCards || showsSent)
    }

    /// Cards to a person still waiting for the 7 a.m. pickup: the flag is up.
    /// A card part, so only while cards are on too.
    var waitingCards: Int {
        LaunchFeatures.mailbox && LaunchFeatures.holidayCards ? sentSummary?.waiting ?? 0 : 0
    }

    /// Sent in place of the drawer's tabs and mail.
    func selectSent() {
        showsSent = true
        Task { @MainActor in await sent.load() }
    }

    func openSentCard(_ id: String) {
        onOpenSentCard?(id)
    }

    /// Set when a card notice opens a card's page over a Mailbox that may not
    /// be open yet, so Back lands on Sent.
    static var pendingShowSent = false

    /// Sent, once, for a card notice: this Mailbox was open or opens now.
    func showSentIfPending() {
        guard Self.pendingShowSent else { return }
        Self.pendingShowSent = false
        if LaunchFeatures.mailbox { selectSent() }
    }

    /// "See it in Sent" from the card flow this Mailbox opened: Sent, then the card.
    func showSentAfterSending(_ id: String?) {
        guard openedCardFlow else { return }
        openedCardFlow = false
        selectSent()
        if let id { openSentCard(id) }
    }

    /// A card was sent or taken back: Sent, the flag and today's card follow.
    func sentChanged() async {
        if showsSent { await sent.refresh() }
        await fetchDrawerBadges()
        await fetchChristmasCards()
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
        // Another drawer or tab: the Vault starts from all its folders again.
        openFolder = nil
        vaultFolders = []
        archivedPieces = []
        vaultFailure = nil
        clearVaultSearch()
        if sampleProvider != nil {
            rebuildFromSample()
        } else {
            state = .loading
            Task { @MainActor in await reloadActiveCombo() }
        }
    }

    // MARK: - Live fetch

    /// Reload the first page. A pull-to-refresh keeps the current rows until
    /// the new page arrives, so a failed refresh doesn't empty the list.
    private func reloadActiveCombo(keepingRows: Bool = false) async {
        loadGeneration &+= 1
        let generation = loadGeneration
        loadMoreError = nil
        if !keepingRows {
            offset = 0
            loadedMail = []
        }
        await fetchPage(generation: generation, replacing: true)
        if currentTab == .vault, sampleProvider == nil { await loadVaultExtras() }
    }

    private func fetchPage(generation: Int, replacing: Bool = false) async {
        isLoadingPage = true
        let drawer = selectedDrawer
        let tab = currentTab
        do {
            let response: DrawerItemsResponse = try await api.request(
                MailboxV2Endpoints.drawer(
                    drawer.backendKey,
                    tab: tab.rawValue,
                    limit: pageSize,
                    offset: replacing ? 0 : offset,
                    folderId: tab == .vault ? openFolder?.id : nil
                )
            )
            // Drop late responses if the user has since switched combo. A late
            // page must not clear the loading guard of the current request.
            guard generation == loadGeneration else { return }
            isLoadingPage = false
            if replacing { loadedMail = [] }
            loadedMail.append(contentsOf: response.mail)
            offset = loadedMail.count
            hasMore = response.mail.count >= pageSize
            applyLiveState(drawer: drawer, tab: tab)
            if replacing { presentWelcomeIfNeeded() }
        } catch {
            guard generation == loadGeneration else { return }
            isLoadingPage = false
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load mail."
            if loadedMail.isEmpty {
                state = .error(message: message)
            } else if replacing {
                // Keep the mail on screen; a failed reload only toasts.
                refreshFailureMessage = message
            } else {
                // A later page failed: keep the rows; Try again asks for it again.
                loadMoreError = "Couldn't load more mail. \(message)"
            }
        }
    }

    private func fetchDrawerBadges() async {
        do {
            let response: DrawerListResponse = try await api.request(MailboxV2Endpoints.drawers())
            drawerUnread = response.drawers.reduce(into: [String: Int]()) { counts, drawer in
                counts[drawer.drawer] = drawer.unreadCount
            }
            // The Mail tab's badge reads the same counts.
            if api === APIClient.shared { MailBadgeStore.shared.apply(response) }
            homes = response.homes
            vacationHold = response.vacationHold
            sentSummary = response.sent
            hero = MailboxHeroModel.make(delivery: response.delivery, homes: response.homes, waitingCards: waitingCards)
            if !loadedMail.isEmpty { applyLiveState(drawer: selectedDrawer, tab: currentTab) }
        } catch {
            // Badges are non-blocking chrome — leave them empty on failure
            // so the list still renders.
            drawerUnread = [:]
        }
    }

    /// Biz shows for business owners. Once per Mailbox; a failure leaves it
    /// to the Biz mail count.
    private func fetchBusinessOwnership() async {
        guard !didCheckBusinesses else { return }
        do {
            let response: BusinessRolesResponse = try await api.request(BusinessesEndpoints.myBusinesses())
            ownsBusiness = response.businesses.contains { $0.roleBase == "owner" }
            didCheckBusinesses = true
        } catch {
            ownsBusiness = false
        }
    }

    /// Christmas cards (`holiday_cards` + `mailbox`): whether sending is open
    /// and today's card, for the row at the top of Me. Off, closed, or not
    /// answering: no row.
    private func fetchChristmasCards() async {
        guard LaunchFeatures.holidayCards, LaunchFeatures.mailbox, onOpenChristmasCards != nil else {
            christmasCards = nil
            return
        }
        let response: HolidayCardsResponse? = try? await api.request(HolidayCardEndpoints.cards())
        christmasCards = response?.open == true ? response : nil
    }

    /// The row's tap: the card flow, or today's card.
    func openChristmasCards() {
        openedCardFlow = true
        onOpenChristmasCards?()
    }

    /// The row shows on Me's Incoming while sending is open.
    var showsChristmasCardRow: Bool {
        isLive && !showsSent && selectedDrawer == .me && currentTab == .incoming && christmasCards != nil
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
        // The server lists a bundle once in Incoming; its pieces open from it.
        let shown = loadedMail
        pieceSections = Self.sections(
            of: shown.map { mail in
                MailPieceModel(
                    mail: mail,
                    recipient: recipient(of: mail, drawer: drawer),
                    opened: mail.item.viewed || viewedMailIds.contains(mail.id),
                    clock: .current
                )
            },
            mail: shown,
            tab: tab
        )
        if loadedMail.isEmpty {
            state = .empty(emptyContent(drawer: drawer, tab: tab))
        } else {
            let rows = loadedMail.map { mail in
                MailboxListViewModel.makeRow(
                    for: mail.item,
                    trust: MailTrust.fromRaw(mail.senderTrust),
                    viewed: viewedMailIds.contains(mail.id),
                    sender: mail.senderDisplay,
                    // Counter lists open mail with a due date, so its rows say when.
                    dueDate: tab == .counter ? mail.dueDate : nil
                ) { [weak self] mailId in
                    Task { @MainActor in self?.onOpenMail(mailId) }
                }
            }
            state = .loaded(sections: [RowSection(rows: rows)], hasMore: hasMore)
        }
    }

    /// Incoming and Archived by the day each piece came; the Counter keeps
    /// the server's order (soonest due first) and the Vault its filing order.
    private static func sections(
        of pieces: [MailPieceModel],
        mail: [DrawerItemsResponse.DrawerMail],
        tab: MailboxTab
    ) -> [MailPieceSection] {
        guard !pieces.isEmpty else { return [] }
        guard tab == .incoming else {
            return [MailPieceSection(id: tab.rawValue, title: tab == .counter ? "Waiting on you" : "Filed", pieces: pieces)]
        }
        let now = Date()
        var sections: [MailPieceSection] = []
        for (piece, row) in zip(pieces, mail) {
            let delivered = MailDates.parse(row.item.deliveredAt) ?? MailDates.parse(row.item.createdAt) ?? now
            let (id, title) = MailDates.sectionTitle(for: delivered, now: now, calendar: .current)
            if let last = sections.last, last.id == id {
                sections[sections.count - 1] = MailPieceSection(id: id, title: title, pieces: last.pieces + [piece])
            } else {
                sections.append(MailPieceSection(id: id, title: title, pieces: [piece]))
            }
        }
        return sections
    }

    /// Who a piece came to: Home mail to the Home at its address, the rest
    /// to the person at their home's address.
    private func recipient(of mail: DrawerItemsResponse.DrawerMail, drawer: MailboxDrawer) -> MailPieceRecipient {
        MailPieceRecipient.of(mail, homeMail: drawer == .home, homes: homes, personName: MailPieceRecipient.personName)
    }

    // MARK: - The Vault tab

    /// The drawer's folders (for Home, the cabinets of the Homes whose mail is
    /// open) and its archived mail, beside the filed list.
    private func loadVaultExtras() async {
        let drawer = selectedDrawer
        do {
            let response: VaultFoldersResponse = try await api.request(
                MailboxVaultEndpoints.folders(drawer: drawer.backendKey)
            )
            guard drawer == selectedDrawer, currentTab == .vault else { return }
            vaultFolders = response.folders.filter { folder in
                drawer == .home ? folder.homeId != nil : folder.homeId == nil && folder.drawer == drawer.backendKey
            }
            vaultFailure = nil
        } catch {
            guard drawer == selectedDrawer else { return }
            vaultFailure = Self.vaultMessage(error, what: "your folders")
        }
        do {
            let archived: DrawerItemsResponse = try await api.request(
                MailboxV2Endpoints.drawer(drawer.backendKey, tab: "archived", limit: 20)
            )
            guard drawer == selectedDrawer, currentTab == .vault else { return }
            archivedPieces = archived.mail.map { piece(for: $0, drawer: drawer) }
        } catch {
            // Archived is a side shelf: the filed list and folders still show.
            archivedPieces = []
        }
    }

    /// Opens one folder's mail, or all filed mail again with nil.
    func openVaultFolder(_ folder: VaultFolderDTO?) {
        guard openFolder?.id != folder?.id else { return }
        openFolder = folder
        state = .loading
        Task { @MainActor in await reloadActiveCombo() }
    }

    /// Search inside the Vault: the server's search, kept to filed and
    /// archived mail (the server refuses more than 100 characters).
    func searchVault(loadMore: Bool = false) async {
        let text = vaultQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            clearVaultSearch()
            return
        }
        if loadMore {
            guard !vaultSearching, vaultHasMore, text == vaultSubmittedQuery else { return }
        } else {
            vaultSearchOffset = 0
            vaultResults = []
            vaultHasMore = false
            vaultSubmittedQuery = text
        }
        let request = UUID()
        vaultSearchRequest = request
        vaultSearching = true
        vaultSearchFailure = nil
        defer { if vaultSearchRequest == request { vaultSearching = false } }
        do {
            let response: MailSearchResponse = try await api.request(
                MailboxV2Endpoints.search(query: String(text.prefix(100)), limit: 50, offset: vaultSearchOffset, vaultOnly: true)
            )
            guard vaultSearchRequest == request, text == vaultQuery.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
            let drawer = selectedDrawer
            let rows = response.mail
                .filter { MailLetter.isFiled($0.item) }
                .map { piece(for: $0, drawer: drawer) }
            let existing = loadMore ? (vaultResults ?? []) : []
            let seen = Set(existing.map(\.id))
            vaultResults = existing + rows.filter { !seen.contains($0.id) }
            vaultSearchOffset = response.nextOffset ?? (vaultSearchOffset + response.mail.count)
            vaultHasMore = response
                .hasMore ?? (!response.mail.isEmpty && (response.total.map { vaultSearchOffset < $0 } ?? (response.mail.count == 50)))
        } catch {
            guard vaultSearchRequest == request, text == vaultQuery.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
            vaultSearchFailure = Self.vaultMessage(error, what: "search results")
        }
    }

    func clearVaultSearch() {
        vaultSearchRequest = UUID()
        vaultQuery = ""
        vaultResults = nil
        vaultSearchFailure = nil
        vaultSearching = false
        vaultHasMore = false
        vaultSearchOffset = 0
        vaultSubmittedQuery = ""
    }

    private func piece(for mail: DrawerItemsResponse.DrawerMail, drawer: MailboxDrawer) -> MailPieceModel {
        MailPieceModel(
            mail: mail,
            recipient: recipient(of: mail, drawer: drawer),
            opened: mail.item.viewed || viewedMailIds.contains(mail.id),
            clock: .current
        )
    }

    private static func vaultMessage(_ error: Error, what: String) -> String {
        if case .transport = error as? APIError {
            return "You're offline, so \(what) couldn't load. Check your connection and try again."
        }
        return "\(what.prefix(1).uppercased())\(what.dropFirst()) couldn't load just now. Try again in a moment."
    }

    // MARK: - The first day

    /// The sealed welcome letter from Pantopus opens on the porch once per
    /// account; after that it's an ordinary letter in Me. The porch draws it
    /// from this list, so closing the porch leaves it sealed.
    private func presentWelcomeIfNeeded() {
        guard sampleProvider == nil, selectedDrawer == .me, currentTab == .incoming, let onOpenWelcome,
              case let .signedIn(user) = AuthManager.shared.state else { return }
        guard let welcome = loadedMail.first(where: { mail in
            Self.isWelcomeLetter(mail.item) && !mail.item.viewed && !viewedMailIds.contains(mail.id)
        }) else { return }
        let key = "mail.welcome.porch.\(user.id)"
        guard UserDefaults.standard.string(forKey: key) == nil else { return }
        UserDefaults.standard.set(welcome.id, forKey: key)
        onOpenWelcome(welcome)
    }

    /// Pantopus's welcome letter (made on the first open of Mail, SRV-6).
    static func isWelcomeLetter(_ item: MailItem) -> Bool {
        guard item.fromPantopus, MailPieceKind.of(item) == .letter else { return false }
        return (item.displayTitle ?? item.subject ?? "").lowercased().hasPrefix("welcome to your mailbox")
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
                subcopy: "Task earnings go to your wallet in Payments.",
                ctaTitle: "Open Earn dashboard"
            ) { [weak self] in Task { @MainActor in self?.onOpenEarn() } }
        case (.earn, .counter):
            ListOfRowsState.EmptyContent(
                icon: .wallet,
                headline: "Nothing to action",
                subcopy: "Earn mail that needs you shows up here."
            )
        case (.earn, .vault):
            ListOfRowsState.EmptyContent(
                icon: .archive,
                headline: "No saved earn mail",
                subcopy: "Earn mail you save shows up here."
            )
        // Copy follows each tab's server filter (mailboxV2 drawer route).
        case (_, .counter):
            ListOfRowsState.EmptyContent(
                icon: .mailbox,
                headline: "Nothing waiting on you.",
                subcopy: "Bills and letters that need you wait here until they're done."
            )
        case (_, .vault):
            ListOfRowsState.EmptyContent(
                icon: .archive,
                headline: "Nothing filed yet",
                subcopy: "Mail you file or save to your vault shows up here."
            )
        default:
            ListOfRowsState.EmptyContent(
                icon: .mailbox,
                headline: "No mail yet",
                subcopy: "When letters, bills or notices arrive, they show up here."
            )
        }
    }
}

/// One cabinet of Vault folders (board R10): the drawer's own, or one Home's,
/// shared by everyone who reads that Home's mail.
struct MailVaultCabinet: Identifiable, Equatable {
    let id: String
    /// The Home's name, shown when the Home drawer holds several Homes.
    let title: String?
    let folders: [VaultFolderDTO]

    /// Me and Biz keep one cabinet. Home has one per Home in the order the
    /// server lists them, titled only when there are several, as on the web
    /// and Android; folders sort by their order, then name.
    static func cabinets(
        of folders: [VaultFolderDTO],
        homeMail: Bool,
        homes: [DrawerListResponse.MailboxHome]
    ) -> [MailVaultCabinet] {
        let sorted = folders.sorted { ($0.sortOrder ?? .max, $0.label) < ($1.sortOrder ?? .max, $1.label) }
        guard homeMail else {
            return sorted.isEmpty ? [] : [MailVaultCabinet(id: "own", title: nil, folders: sorted)]
        }
        var homeIds: [String] = []
        for folder in folders where !homeIds.contains(folder.homeId ?? "") {
            homeIds.append(folder.homeId ?? "")
        }
        return homeIds.map { homeId in
            let home = homes.first { $0.homeId == homeId }
            let title = homeIds.count > 1 ? MailPieceModel.firstText(home?.name, home?.addressLine) ?? "Your home" : nil
            return MailVaultCabinet(id: homeId, title: title, folders: sorted.filter { ($0.homeId ?? "") == homeId })
        }
    }
}

/// `GET /api/businesses/my-businesses`, only the roles: the Mailbox needs to
/// know whether this person owns a business (Biz drawer).
private struct BusinessRolesResponse: Decodable {
    let businesses: [Seat]

    struct Seat: Decodable {
        let roleBase: String?

        private enum CodingKeys: String, CodingKey {
            case roleBase = "role_base"
        }
    }
}
