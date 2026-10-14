//
//  RootTabView.swift
//  Pantopus
//
//  The bottom bar — Place · Today · Pulse · Plans · Messages — that sits
//  above every signed-in screen (Pulse S3, founder decision 2026-10-13: the
//  Nearby tab is gone; its Pulse, Connections and neighborhood meter live in
//  the Pulse tab). Place is selected at launch. Today is the daily briefing.
//  Plans shows only while the `plans` switch is on, so the bar has four
//  tabs or five and follows the switch while the app runs. The last tab is
//  Messages, with the unread badge, while Mailbox is off for launch
//  (`LaunchFeatures.mailbox`, founder decision 2026-10-09). With Mailbox on
//  it reads Mail and hosts the mailbox and the Messages inbox as two
//  segments; its id stays `mail` either way.
//

// swiftlint:disable file_length

import Logging
import SwiftUI

/// A tab in the primary bottom bar. Encoded as an enum so call sites never
/// reach for stringly-typed paths.
public enum RootTab: Hashable, CaseIterable {
    case place, today, pulse, plans, mail

    /// Human-readable label rendered under each tab icon. The last tab is
    /// "Messages" while Mailbox is off for launch; its id stays `mail`.
    public var label: String {
        switch self {
        case .place: "Place"
        case .today: "Today"
        case .pulse: "Pulse"
        case .plans: "Plans"
        case .mail: LaunchFeatures.mailbox ? "Mail" : "Messages"
        }
    }

    /// Stable accessibility / test identifier suffix (`tab.<id>`).
    public var id: String {
        switch self {
        case .place: "place"
        case .today: "today"
        case .pulse: "pulse"
        case .plans: "plans"
        case .mail: "mail"
        }
    }

    /// Design-system icon token for the tab.
    public var icon: PantopusIcon {
        switch self {
        case .place: .home
        case .today: .sun
        case .pulse: .activity
        case .plans: .calendar
        case .mail: LaunchFeatures.mailbox ? .mail : .messageCircle
        }
    }
}

/// The two segments of the Mail tab. Chat threads are just another kind
/// of mail, so the inbox lives beside the mailbox instead of on its own
/// tab (an empty Messages tab at zero density read as a dead app).
public enum MailSegment: String, CaseIterable, Hashable {
    case mailbox, messages

    public var label: String {
        switch self {
        case .mailbox: "Mailbox"
        case .messages: "Messages"
        }
    }
}

/// Cross-tab hand-off into a specific Mail segment (a `/app/chat` status
/// item, a `.conversation` deep link). The Mail tab root consumes it.
@Observable
@MainActor
public final class MailTabStore {
    public static let shared = MailTabStore()
    public var pendingSegment: MailSegment?
    /// Segment roots showing; the switch hides below a root (switching would discard it).
    public var mailboxAtRoot = true
    public var messagesAtRoot = true
    public init() {}
}

/// Observable state for the root tab view. Holds the selected tab and a
/// cached count for the Messages badge.
@Observable
@MainActor
public final class RootTabModel {
    /// Currently selected tab. Starts at `.place`.
    public var selected: RootTab = .place
    /// Unread Messages count rendered as the Messages (Mail) tab badge.
    public var messagesBadge: Int = 0
    /// The Place stack is on its root (kept current by `HubTabRoot`).
    public var placeAtRoot = false
    /// Changes each time the Place tab is tapped again while already on its
    /// root, so the root scrolls back to the top.
    public var placeReselectedAtRoot: UUID?
    public init() {}
}

/// Root tab container for signed-in users. Each tab hosts its own
/// NavigationStack so deep navigation within a tab survives tab switches.
public struct RootTabView: View {
    @State private var model = RootTabModel()
    private let chatBadgeStore = ChatBadgeStore.shared
    @State private var router = DeepLinkRouter.shared
    @State private var pendingInviteToken: InviteSheetToken?
    @State private var showProfile = false
    /// Set by the `monthly_receipt` push deep link so the profile opens with
    /// the Monthly Receipt card already expanded (RN parity —
    /// `/(tabs)/profile?tab=receipt`).
    @State private var expandMonthlyReceipt = false
    /// A notification link to a screen inside the profile cover (persona
    /// inboxes, "Your audience") opens the cover on that screen.
    @State private var profileInitialRoute: YouRoute?
    @State private var addHomeRequest: UUID?
    @Environment(AuthManager.self) private var auth
    @Environment(\.scenePhase) private var scenePhase
    /// Nearby Plans' two server flags, read at launch and on foreground.
    @State private var plansFlags = PlansFlags.shared
    /// The You cover's model, kept across openings (Instant Screens): the
    /// cover shows its last content at once and refreshes it quietly once
    /// stale. Replaced for another account.
    @State private var youModel = MeViewModel()
    @State private var youModelUserID: String?

    public init() {}

    public var body: some View {
        TabView(selection: tabBinding) {
            HubTabRoot(
                onOpenProfile: { showProfile = true },
                onOpenProfileScreen: { route in presentProfile(at: route) },
                addHomeRequest: $addHomeRequest
            )
            .tabItem { tabLabel(.place) }
            .tag(RootTab.place)

            TodayTabRoot(onAddHome: startAddingHome)
                .tabItem { tabLabel(.today) }
                .tag(RootTab.today)

            PulseTabRoot(onAddHome: startAddingHome)
                .tabItem { tabLabel(.pulse) }
                .tag(RootTab.pulse)

            // Only while the `plans` switch is on (`onChange` below moves a
            // reader off it when the switch turns off).
            if plansFlags.plans {
                PlansTabRoot()
                    .tabItem { tabLabel(.plans) }
                    .tag(RootTab.plans)
            }

            MailTabRoot(
                onOpenProfile: { showProfile = true },
                onOpenProfileScreen: { route in presentProfile(at: route) }
            )
            .tabItem { tabLabel(.mail) }
            .tag(RootTab.mail)
            .badge(model.messagesBadge)
        }
        // The app-wide tint also reaches the dialogs UIKit presents; primaryTint resolves for dark mode there.
        .tint(Theme.Color.primaryTint)
        .environment(model)
        .task {
            // Live updates (sync:changed, notification:new, reconnects) for every screen.
            ScreenStoreLive.start()
            await chatBadgeStore.start()
            model.messagesBadge = chatBadgeStore.unreadMessages
            await TabWarmer.warm()
        }
        .task(id: signedInUserID) {
            // Another account never sees the previous account's You screen.
            if youModelUserID != signedInUserID {
                if youModelUserID != nil { youModel = MeViewModel() }
                youModelUserID = signedInUserID
            }
            await plansFlags.refresh(account: signedInUserID)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            // Plans change while the app is away (a yes, a moved time, a removal,
            // a cancel) and their pushes don't reach the app in the background:
            // coming back re-checks every Plans screen on view.
            if plansFlags.plans { PlansStoreReads.changed() }
            Task { await plansFlags.refresh(account: signedInUserID) }
        }
        .onChange(of: plansFlags.plans) { _, isOn in
            // The Plans tab goes with the switch; a reader on it lands on Pulse.
            if !isOn, model.selected == .plans { model.selected = .pulse }
        }
        .onChange(of: chatBadgeStore.unreadMessages) { _, unread in
            model.messagesBadge = unread
        }
        .onChange(of: router.pending) { _, pending in
            consumeInviteDeepLinkIfNeeded(pending: pending)
        }
        .task {
            consumeInviteDeepLinkIfNeeded(pending: router.pending)
        }
        .fullScreenCover(
            isPresented: $showProfile,
            onDismiss: {
                expandMonthlyReceipt = false
                youModel.expandMonthlyReceipt = false
                profileInitialRoute = nil
            },
            content: {
                YouTabRoot(
                    expandMonthlyReceipt: expandMonthlyReceipt,
                    initialRoute: profileInitialRoute,
                    meViewModel: youModel
                ) {
                    showProfile = false
                }
                // A cover doesn't see the tab view's environment; the profile can switch tabs under it.
                .environment(model)
            }
        )
        .fullScreenCover(item: $pendingInviteToken) { item in
            TokenAcceptView(
                viewModel: TokenAcceptViewModel(
                    token: item.token,
                    leaseInvitation: item.leaseInvitation,
                    onAccepted: { _ in pendingInviteToken = nil },
                    onDeclined: { pendingInviteToken = nil }
                )
            )
            // A newer link while this one is open must load its own token, not keep the first link's state.
            .id(item.id)
        }
    }

    // A flat switch over every destination: one case per tab hand-off is
    // clearer than a lookup table for the reader chasing a mis-routed link.
    // swiftlint:disable:next cyclomatic_complexity
    private func consumeInviteDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard let pending, pending == router.pending else { return }
        // First-launch scope: a link (URL, push tap, in-app) into a feature
        // hidden for the first launch is dropped; the app stays where it is.
        guard pending.isAvailableAtLaunch else {
            _ = router.consume()
            return
        }
        // The profile cover sits above every tab: close it for a link that
        // lands in a tab (or presents its own cover), or the destination
        // opens hidden underneath.
        if showProfile, !Self.keepsProfileOpen(pending) { showProfile = false }
        // Root owns cross-tab dispatch. Concrete drill-down links stay
        // pending so the selected tab can push them into its own
        // NavigationStack.
        switch pending {
        case let .invite(token, leaseInvitation):
            pendingInviteToken = InviteSheetToken(token: token, leaseInvitation: leaseInvitation)
            _ = router.consume()
        case let .joinInvite(code):
            pendingInviteToken = InviteSheetToken(token: code)
            _ = router.consume()
        // The Pulse tab consumes feed, post and Pulse links itself (back to
        // its root, or the post pushed on it). Tasks and Marketplace present
        // as sheets from the Pulse tab, whose surface root consumes the
        // pending destination as before.
        case .feed, .post, .pulse:
            model.selected = .pulse
        case .gig:
            if LaunchFeatures.openGigs {
                model.selected = .pulse
                NeighborhoodDoorStore.shared.pendingSurface = .tasks
            } else {
                // Launch cut #4 (Open gigs): no Tasks surface, so the task's
                // detail opens in the Place stack (`HubTabRoot`).
                model.selected = .place
            }
        case .listing:
            model.selected = .pulse
            NeighborhoodDoorStore.shared.pendingSurface = .marketplace
        // Mailbox-cluster destinations resolve in the Mail tab's stack
        // (a mailbox-rooted HubTabRoot sharing the same destinations). While
        // Mailbox is off for launch, the Place stack shows its "not in the
        // app yet" placeholder for them instead.
        case .vacationHold, .mailDay,
             .stamps, .mailTask, .mailTranslation, .unboxing, .packageGig, .earn,
             .mailbox, .mailItem:
            model.selected = LaunchFeatures.mailbox ? .mail : .place
        case .supportTrain, .supportTrainManage, .user, .beaconProfile,
             .connections, .beacons, .discoverHub,
             .homeDetail, .homeDashboard, .homeTask, .homeMemberRequests, .homeResidency,
             .homeMembers, .homeOwners, .homeClaimReview,
             .homeOwnersTransfer,
             .verifyLandlord, .postcardVerification,
             .notifications, .createBusiness, .businessProfile, .businessPage,
             .editBusinessPage,
             .wallet, .paymentsSettings, .securityDevices,
             .businessOwner, .viewAs, .waitingRoom, .neighborMessage,
             .bookingDetail, .myBookings,
             .invoiceDetail:
            model.selected = .place
        // Morning/Evening Briefing push — the Today tab consumes it.
        case .hubToday, .todayTab:
            model.selected = .today
        // `pantopus://place` — the address dashboard is the Place tab's
        // landing surface; its stack consumes the concrete destination.
        case .place:
            model.selected = .place
        case .monthlyReceipt:
            // `monthly_receipt` push — open the profile cover with the
            // receipt card expanded.
            expandMonthlyReceipt = true
            youModel.expandMonthlyReceipt = true
            showProfile = true
            _ = router.consume()
        case .creatorInbox:
            openProfile(at: .creatorInbox)
        case let .fanInbox(personaId):
            openProfile(at: .fanInbox(personaId: personaId))
        case .creatorAudienceMembers:
            openProfile(at: .creatorAudienceMembers)
        case .conversation:
            // Chat lives in the Messages tab (the Mail tab's Messages segment
            // while Mailbox is on).
            if LaunchFeatures.mailbox { MailTabStore.shared.pendingSegment = .messages }
            model.selected = .mail
        case .home:
            model.selected = .place
            _ = router.consume()
        // The Plans tab: a plan, the requests or the composer open on its
        // stack. While the `plans` switch is off the link is dropped.
        case .plans:
            openPlansTab()
        case let .plan(id):
            openPlans(.plan(id: id, intent: .view))
        case let .planRequests(id):
            openPlans(.requests(planId: id))
        case .planNew:
            openPlans(nil)
        case .resetPassword, .verifyEmail, .unknown:
            _ = router.consume()
        }
    }

    /// Hands a Plans link to the Plans tab's stack (`route` nil: the composer).
    private func openPlans(_ route: PlansRoute?) {
        _ = router.consume()
        plansFlags.prime(account: signedInUserID)
        guard plansFlags.plans else { return }
        if let route {
            PlansNavigator.shared.pending = route
        } else {
            PlansNavigator.shared.pendingHost = PlansHostRequest(start: nil)
        }
        model.selected = .plans
    }

    /// `/plans`: the Plans tab itself, while the switch is on.
    private func openPlansTab() {
        _ = router.consume()
        plansFlags.prime(account: signedInUserID)
        guard plansFlags.plans else { return }
        model.selected = .plans
    }

    /// "Set up a home" from Today or Pulse: the Place tab starts adding one.
    private func startAddingHome() {
        model.selected = .place
        addHomeRequest = UUID()
    }

    /// Links that leave the profile cover in place: the monthly receipt
    /// opens inside it, and auth / unknown links navigate nowhere.
    private static func keepsProfileOpen(_ destination: DeepLinkRouter.Destination) -> Bool {
        switch destination {
        case .monthlyReceipt, .resetPassword, .verifyEmail, .unknown: true
        default: false
        }
    }

    private var signedInUserID: String? {
        if case let .signedIn(user) = auth.state { user.id } else { nil }
    }

    /// Persona screens live in the profile cover's own stack.
    private func openProfile(at route: YouRoute) {
        presentProfile(at: route)
        _ = router.consume()
    }

    /// Opens the profile cover on one of its own screens.
    private func presentProfile(at route: YouRoute) {
        profileInitialRoute = route
        showProfile = true
    }

    private var tabBinding: Binding<RootTab> {
        Binding(
            get: { model.selected },
            set: { tab in
                // Read before UIKit pops a deeper stack: only a tap on the root
                // itself scrolls it back to the top.
                if tab == .place, model.selected == .place, model.placeAtRoot {
                    model.placeReselectedAtRoot = UUID()
                }
                model.selected = tab
            }
        )
    }

    private func tabLabel(_ tab: RootTab) -> some View {
        Label {
            Text(tab.label)
        } icon: {
            Icon(tab.icon)
                .accessibilityHidden(true)
        }
        .accessibilityLabel(tab.label)
        .accessibilityIdentifier("tab.\(tab.id)")
    }
}

/// Today tab — the daily briefing as a first-class landing (Wedge v2 D2).
/// Hosts the same `TodayDetailView` the Hub card used to push; a
/// `.hubToday` push deep link re-seeds it with the stored delivery so the
/// user reads the briefing they were notified about.
public struct TodayTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var router = DeepLinkRouter.shared
    /// Bumped to remount the view with a new delivery id.
    @State private var generation = 0
    @State private var isShowingBriefing = false
    @State private var briefingDeliveryId: String?
    @State private var briefingKind: String?
    @State private var systemSheet: SystemSheetRequest?
    @State private var showsNotificationSettings = false
    private let onAddHome: () -> Void

    public init(onAddHome: @escaping () -> Void = {}) {
        self.onAddHome = onAddHome
    }

    public var body: some View {
        NavigationStack {
            Group {
                // A morning-push deep link opens that briefing; on its own the
                // tab is the address's day (weather, calendar, air).
                if isShowingBriefing {
                    TodayDetailView(
                        viewModel: TodayDetailViewModel(
                            briefingDeliveryId: briefingDeliveryId,
                            requestedKind: briefingKind
                        ),
                        // Back returns to the address's day; Share sends the briefing's text;
                        // Manage opens the briefing and alert settings, as on Android.
                        onBack: {
                            isShowingBriefing = false
                            briefingDeliveryId = nil
                            briefingKind = nil
                        },
                        onShare: { text in systemSheet = .share(items: [text]) },
                        onManage: { showsNotificationSettings = true }
                    )
                } else {
                    AddressTodayTabView(onAddHome: onAddHome)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .accessibilityIdentifier("todayTabRoot")
            .navigationDestination(isPresented: $showsNotificationSettings) {
                NotificationSettingsView { showsNotificationSettings = false }
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .id(generation)
        .sheet(item: $systemSheet) { request in request.makeView() }
        .onChange(of: router.pending) { _, pending in
            consumeDeepLinkIfNeeded(pending: pending)
        }
        .onChange(of: rootTabs.selected) { _, _ in
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .task {
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
    }

    private func consumeDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard let pending, rootTabs.selected == .today else { return }
        switch pending {
        case .todayTab:
            isShowingBriefing = false
            briefingDeliveryId = nil
            briefingKind = nil
            showsNotificationSettings = false
            systemSheet = nil
            generation += 1
            _ = router.consume()
        case let .hubToday(deliveryId, kind):
            isShowingBriefing = true
            briefingDeliveryId = deliveryId
            briefingKind = kind
            generation += 1
            _ = router.consume()
        default:
            break
        }
    }
}

/// The fourth tab. While Mailbox is off for launch it is Messages: the
/// conversation list itself, with no Mailbox/Messages switch. With Mailbox
/// on it is Mail — the mailbox and the Messages inbox as two segments under
/// one tab. Only the visible segment is mounted, so each root's own
/// deep-link consumption keeps working unchanged.
public struct MailTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var store = MailTabStore.shared
    @State private var segment: MailSegment = .mailbox
    private let onOpenProfile: @MainActor () -> Void
    private let onOpenProfileScreen: @MainActor (YouRoute) -> Void

    public init(
        onOpenProfile: @escaping @MainActor () -> Void = {},
        onOpenProfileScreen: @escaping @MainActor (YouRoute) -> Void = { _ in }
    ) {
        self.onOpenProfile = onOpenProfile
        self.onOpenProfileScreen = onOpenProfileScreen
    }

    public var body: some View {
        if LaunchFeatures.mailbox {
            segmentedMail
        } else {
            InboxTabRoot()
        }
    }

    private var segmentedMail: some View {
        VStack(spacing: 0) {
            if segment == .mailbox ? store.mailboxAtRoot : store.messagesAtRoot {
                Picker("Mail", selection: $segment) {
                    ForEach(MailSegment.allCases, id: \.self) { seg in
                        Text(seg.label)
                            .tag(seg)
                            .accessibilityIdentifier("mailSegment.\(seg.rawValue)")
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s2)
                .accessibilityIdentifier("mailSegments")
            }

            switch segment {
            case .mailbox:
                HubTabRoot(mode: .mailbox, onOpenProfile: onOpenProfile, onOpenProfileScreen: onOpenProfileScreen)
            case .messages:
                InboxTabRoot()
            }
        }
        .background(Theme.Color.appBg)
        .onChange(of: store.pendingSegment) { _, pending in
            consumePendingSegmentIfNeeded(pending)
        }
        .onChange(of: rootTabs.selected) { _, _ in
            consumePendingSegmentIfNeeded(store.pendingSegment)
        }
        .task {
            consumePendingSegmentIfNeeded(store.pendingSegment)
        }
    }

    private func consumePendingSegmentIfNeeded(_ pending: MailSegment?) {
        guard let pending, rootTabs.selected == .mail else { return }
        segment = pending
        store.pendingSegment = nil
    }
}

/// `Identifiable` wrapper so `fullScreenCover(item:)` can fire when
/// the token string is non-nil.
private struct InviteSheetToken: Identifiable, Equatable {
    let token: String
    var leaseInvitation = false
    var id: String {
        "\(leaseInvitation):\(token)"
    }
}

/// Root-level unread badge source for the Mail tab (Messages segment). It mirrors the
/// Expo mobile BadgeContext: seed from `/api/chat/stats`, then keep the
/// count warm with `badge:update` socket events and reconnect refreshes.
/// Muted conversation unread is excluded so the badge reflects "notify me"
/// conversations only.
@Observable
@MainActor
final class ChatBadgeStore {
    static let shared = ChatBadgeStore()

    private(set) var unreadMessages: Int = 0

    private let api: APIClient
    private let socket: SocketClient
    private let preferences: ChatConversationPreferences
    private let logger = Logger(label: "app.pantopus.ios.ChatBadge")
    private var badgeTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var serverTotalUnread: Int = 0
    private var cachedRows: [ConversationRowContent] = []

    init(
        api: APIClient = .shared,
        socket: SocketClient = .shared,
        preferences: ChatConversationPreferences = .shared
    ) {
        self.api = api
        self.socket = socket
        self.preferences = preferences
    }

    func start() async {
        await refresh()
        subscribeIfNeeded()
    }

    /// The Messages list's own reads, through the screen store: the badge at
    /// launch also warms the Messages tab (it opens on this copy) and its
    /// saved copy.
    func refresh() async {
        let store = ScreenStore.store(for: api)
        let statsTask = Task { [self] in
            await optional {
                try await store.load(ChatEndpoints.stats(), as: ChatStatsResponse.self, kind: .messagesList, topics: [ScreenTopic.chats])
                    .value
            }
        }
        let conversationsTask = Task { [self] in
            await optional {
                try await store.load(
                    ChatEndpoints.unifiedConversations(),
                    as: UnifiedConversationsResponse.self,
                    kind: .messagesList,
                    topics: [ScreenTopic.chats]
                ).value
            }
        }
        guard let stats = await statsTask.value else {
            logger.warning("Chat badge refresh failed: stats unavailable")
            return
        }
        serverTotalUnread = stats.stats.totalUnread
        if let conversations = await conversationsTask.value {
            let mutedKeys = preferences.mutedKeys()
            cachedRows = conversations.conversations.map {
                Self.snapshotRow(from: $0, mutedKeys: mutedKeys)
            }
        }
        applyAdjustedUnread()
    }

    /// Called by the chat list whenever rows or server totals change.
    func applyListSnapshot(totalUnread: Int, rows: [ConversationRowContent]) {
        serverTotalUnread = totalUnread
        cachedRows = rows
        applyAdjustedUnread()
    }

    func stop() {
        badgeTask?.cancel()
        reconnectTask?.cancel()
        badgeTask = nil
        reconnectTask = nil
    }

    /// Sign-out: stop listening and forget the last account's count and
    /// conversation rows; the next account's tabs start it again.
    func reset() {
        stop()
        serverTotalUnread = 0
        cachedRows = []
        unreadMessages = 0
    }

    private func applyAdjustedUnread() {
        unreadMessages = ChatUnreadBadgeMath.adjustedTotal(
            serverTotal: serverTotalUnread,
            rows: cachedRows,
            mutedKeys: preferences.mutedKeys()
        )
    }

    private func optional<T: Sendable>(_ operation: @Sendable () async throws -> T) async -> T? {
        do {
            return try await operation()
        } catch {
            logger.warning("Chat badge fetch failed: \(error)")
            return nil
        }
    }

    private static func snapshotRow(
        from dto: UnifiedConversation,
        mutedKeys: Set<String>
    ) -> ConversationRowContent {
        let storageKey =
            switch dto.kind {
            case .conversation: ChatConversationPreferences.personKey(dto.id)
            case .room: ChatConversationPreferences.roomKey(dto.id)
            }
        return ConversationRowContent(
            id: dto.id,
            variant: .dm,
            displayName: dto.name ?? dto.id,
            initials: "?",
            avatarURL: nil,
            identityChip: nil,
            verified: false,
            preview: "",
            timeLabel: "",
            unread: dto.totalUnread,
            pinned: false,
            topicKinds: [],
            storageKey: storageKey,
            isMuted: mutedKeys.contains(storageKey)
        )
    }

    private func subscribeIfNeeded() {
        if badgeTask == nil {
            badgeTask = Task { [weak self] in
                guard let self else { return }
                for await update in socket.events(named: "badge:update", as: ChatBadgeUpdate.self) {
                    serverTotalUnread = update.totalUnread
                    applyAdjustedUnread()
                }
            }
        }
        if reconnectTask == nil {
            reconnectTask = Task { [weak self] in
                guard let self else { return }
                for await state in socket.connectionStates() where state == .connected {
                    await refresh()
                }
            }
        }
    }
}

#Preview {
    RootTabView()
        .environment(AuthManager.previewSignedIn)
}
