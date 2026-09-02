//
//  RootTabView.swift
//  Pantopus
//
//  The 4-tab bottom bar — Place · Today · Nearby · Mail — that sits above
//  every signed-in screen (wedge Phase 1.5 IA: every tab alive at zero
//  density). Place is selected at launch. Today is the daily briefing;
//  Nearby is the density-gated door (Pulse / Tasks / Marketplace present
//  as sheets from it); Mail hosts the mailbox AND the Messages inbox as
//  two segments, with the unread badge on the tab.
//

import Logging
import SwiftUI

/// A tab in the primary bottom bar. Encoded as an enum so call sites never
/// reach for stringly-typed paths.
public enum RootTab: Hashable, CaseIterable {
    case place, today, nearby, mail

    /// Human-readable label rendered under each tab icon.
    public var label: String {
        switch self {
        case .place: "Place"
        case .today: "Today"
        case .nearby: "Nearby"
        case .mail: "Mail"
        }
    }

    /// Stable accessibility / test identifier suffix (`tab.<id>`).
    public var id: String {
        switch self {
        case .place: "place"
        case .today: "today"
        case .nearby: "nearby"
        case .mail: "mail"
        }
    }

    /// Design-system icon token for the tab.
    public var icon: PantopusIcon {
        switch self {
        case .place: .home
        case .today: .sun
        case .nearby: .compass
        case .mail: .mail
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
    public init() {}
}

/// Observable state for the root tab view. Holds the selected tab and a
/// cached count for the Messages badge.
@Observable
@MainActor
public final class RootTabModel {
    /// Currently selected tab. Starts at `.place`.
    public var selected: RootTab = .place
    /// Unread Messages count rendered as the Mail tab badge.
    public var messagesBadge: Int = 0
    public init() {}
}

/// Root tab container for signed-in users. Each tab hosts its own
/// NavigationStack so deep navigation within a tab survives tab switches.
public struct RootTabView: View {
    @State private var model = RootTabModel()
    private let chatBadgeStore = ChatBadgeStore.shared
    @State private var router = DeepLinkRouter.shared
    @State private var pendingInviteToken: String?
    @State private var showProfile = false
    /// Set by the `monthly_receipt` push deep link so the profile opens with
    /// the Monthly Receipt card already expanded (RN parity —
    /// `/(tabs)/profile?tab=receipt`).
    @State private var expandMonthlyReceipt = false

    public init() {}

    public var body: some View {
        TabView(selection: tabBinding) {
            HubTabRoot { showProfile = true }
                .tabItem { tabLabel(.place) }
                .tag(RootTab.place)

            TodayTabRoot()
                .tabItem { tabLabel(.today) }
                .tag(RootTab.today)

            NeighborhoodTabRoot()
                .tabItem { tabLabel(.nearby) }
                .tag(RootTab.nearby)

            MailTabRoot { showProfile = true }
                .tabItem { tabLabel(.mail) }
                .tag(RootTab.mail)
                .badge(model.messagesBadge)
        }
        .tint(Theme.Color.primary600)
        .environment(model)
        .task {
            await chatBadgeStore.start()
            model.messagesBadge = chatBadgeStore.unreadMessages
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
        .fullScreenCover(isPresented: $showProfile) {
            YouTabRoot(expandMonthlyReceipt: expandMonthlyReceipt)
        }
        .fullScreenCover(
            item: Binding<InviteSheetToken?>(
                get: { pendingInviteToken.map(InviteSheetToken.init(token:)) },
                set: { pendingInviteToken = $0?.token }
            )
        ) { item in
            TokenAcceptView(
                viewModel: TokenAcceptViewModel(
                    token: item.token,
                    onAccepted: { _ in pendingInviteToken = nil },
                    onDeclined: { pendingInviteToken = nil }
                )
            )
        }
    }

    // A flat switch over every destination: one case per tab hand-off is
    // clearer than a lookup table for the reader chasing a mis-routed link.
    // swiftlint:disable:next cyclomatic_complexity
    private func consumeInviteDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard let pending else { return }
        // Root owns cross-tab dispatch. Concrete drill-down links stay
        // pending so the selected tab can push them into its own
        // NavigationStack.
        switch pending {
        case let .invite(token):
            pendingInviteToken = token
            _ = router.consume()
        case let .joinInvite(code):
            pendingInviteToken = code
            _ = router.consume()
        // Pulse / Tasks / Marketplace present as sheets from the
        // Neighborhood door; the door mounts the surface's tab root,
        // which consumes the pending destination as before.
        case .feed, .post:
            model.selected = .nearby
            NeighborhoodDoorStore.shared.pendingSurface = .pulse
        case .gig:
            model.selected = .nearby
            NeighborhoodDoorStore.shared.pendingSurface = .tasks
        case .listing:
            model.selected = .nearby
            NeighborhoodDoorStore.shared.pendingSurface = .marketplace
        // Mailbox-cluster destinations resolve in the Mail tab's stack
        // (a mailbox-rooted HubTabRoot sharing the same destinations).
        case .vacationHold, .mailDay,
             .stamps, .mailTask, .mailTranslation, .unboxing, .packageGig, .earn:
            model.selected = .mail
        case .supportTrain, .supportTrainManage, .user, .beaconProfile,
             .connections, .beacons, .discoverHub,
             .homeDetail, .homeDashboard, .homeMemberRequests,
             .homeOwnersTransfer,
             .verifyLandlord, .postcardVerification,
             .notifications, .createBusiness, .businessProfile, .businessPage,
             .editBusinessPage,
             .wallet, .paymentsSettings,
             .businessOwner, .viewAs, .waitingRoom:
            model.selected = .place
        // Morning/Evening Briefing push — the Today tab consumes it.
        case .hubToday:
            model.selected = .today
        // `pantopus://place` — the address dashboard is the Place tab's
        // landing surface; its stack consumes the concrete destination.
        case .place:
            model.selected = .place
        case .monthlyReceipt:
            // `monthly_receipt` push — open the profile cover with the
            // receipt card expanded.
            expandMonthlyReceipt = true
            showProfile = true
            _ = router.consume()
        case .conversation:
            // Chat lives in the Mail tab's Messages segment.
            MailTabStore.shared.pendingSegment = .messages
            model.selected = .mail
        case .home:
            model.selected = .place
            _ = router.consume()
        case .resetPassword, .verifyEmail, .unknown:
            _ = router.consume()
        }
    }

    private var tabBinding: Binding<RootTab> {
        Binding(
            get: { model.selected },
            set: { model.selected = $0 }
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
    @State private var briefingDeliveryId: String?
    @State private var briefingKind: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            Group {
                // A morning-push deep link opens that briefing; on its own the
                // tab is the address's day (weather, calendar, air).
                if briefingDeliveryId != nil {
                    TodayDetailView(
                        viewModel: TodayDetailViewModel(
                            briefingDeliveryId: briefingDeliveryId,
                            requestedKind: briefingKind
                        )
                    )
                } else {
                    AddressTodayTabView()
                }
            }
            .id(generation)
            .toolbar(.hidden, for: .navigationBar)
            .accessibilityIdentifier("todayTabRoot")
        }
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
        if case let .hubToday(deliveryId, kind) = pending {
            briefingDeliveryId = deliveryId
            briefingKind = kind
            generation += 1
            _ = router.consume()
        }
    }
}

/// Mail tab — the mailbox and the Messages inbox as two segments under
/// one tab. Only the visible segment is mounted, so each root's own
/// deep-link consumption keeps working unchanged.
public struct MailTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var store = MailTabStore.shared
    @State private var segment: MailSegment = .mailbox
    private let onOpenProfile: @MainActor () -> Void

    public init(onOpenProfile: @escaping @MainActor () -> Void = {}) {
        self.onOpenProfile = onOpenProfile
    }

    public var body: some View {
        VStack(spacing: 0) {
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

            switch segment {
            case .mailbox:
                HubTabRoot(mode: .mailbox, onOpenProfile: onOpenProfile)
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
    var id: String {
        token
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

    func refresh() async {
        async let statsTask: ChatStatsResponse? = optional {
            try await self.api.request(ChatEndpoints.stats())
        }
        async let conversationsTask: UnifiedConversationsResponse? = optional {
            try await self.api.request(ChatEndpoints.unifiedConversations())
        }
        guard let stats = await statsTask else {
            logger.warning("Chat badge refresh failed: stats unavailable")
            return
        }
        serverTotalUnread = stats.stats.totalUnread
        if let conversations = await conversationsTask {
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
