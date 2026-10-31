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
//  Messages, the conversation list with the unread badge.
//
//  While the Pulse redesign is off (launch cut #11, `LaunchFeatures.pulseRedesign`,
//  founder decision 2026-10-15) the bar is the October 13 one: Place · Today ·
//  Nearby · Messages, with Pulse and Connections opened from Nearby. Plans
//  is its own tab there too (founder decision 2026-10-17): Place · Today ·
//  Nearby · Plans · Messages while the `plans` switch is on.
//
//  Founder decision 2026-10-20: Nearby is two segments, Pulse (the October 13
//  feed, where the tab opens) and Neighborhood (the density map and meter),
//  with no door page between; Connections lives in the side menu. The side
//  menu (the navigation drawer) is hosted here, above every tab, and the top
//  screen of every tab has its menu button (`NavigationMenuButton`).
//
//  With the Mailbox on (launch cut #10, `LaunchFeatures.mailbox`; Mail tab,
//  founder decisions 2026-10-26/27) Mail is a tab of its own before Messages:
//  Place · Today · Nearby · Plans · Mail · Messages. Mail opens on the
//  Mailbox and its red badge counts unopened mail. SwiftUI's TabView moves a
//  sixth tab under "More", so these tabs live in `RootTabContainer` under a
//  drawn bar (`RootTabBar`). With the Mailbox off the system bar stays as it
//  was.
//
//  The drawn bar looks like the system's (founder, 2026-10-30): on iOS 26
//  and later the floating Liquid Glass capsule. It slides away while a page
//  scrolls down, for more room to read, and comes back on a scroll up
//  (`RootTabBarScrollWatcher`).
//

// swiftlint:disable file_length

import Logging
import SwiftUI

/// A tab in the primary bottom bar. Encoded as an enum so call sites never
/// reach for stringly-typed paths.
public enum RootTab: Hashable, CaseIterable {
    case place, today, nearby, pulse, plans, mail, messages

    /// Human-readable label rendered under each tab icon.
    public var label: String {
        switch self {
        case .place: "Place"
        case .today: "Today"
        case .nearby: "Nearby"
        case .pulse: "Pulse"
        case .plans: "Plans"
        case .mail: "Mail"
        case .messages: "Messages"
        }
    }

    /// Stable accessibility / test identifier suffix (`tab.<id>`).
    public var id: String {
        switch self {
        case .place: "place"
        case .today: "today"
        case .nearby: "nearby"
        case .pulse: "pulse"
        case .plans: "plans"
        case .mail: "mail"
        case .messages: "messages"
        }
    }

    /// Design-system icon token for the tab.
    public var icon: PantopusIcon {
        switch self {
        case .place: .home
        case .today: .sun
        case .nearby: .compass
        case .pulse: .activity
        case .plans: .calendar
        case .mail: .mail
        case .messages: .messageCircle
        }
    }

    /// Where Pulse opens: its own tab, or Nearby's door while the Pulse
    /// redesign is off (launch cut #11), as on October 13.
    static var pulseHome: RootTab {
        LaunchFeatures.pulseRedesign ? .pulse : .nearby
    }

    /// The bar's tabs in order: Plans while its switch is on, Mail while the
    /// Mailbox is on (launch cut #10), Messages last.
    static func barTabs(plans: Bool) -> [RootTab] {
        var tabs: [RootTab] = [.place, .today, pulseHome]
        if plans { tabs.append(.plans) }
        if LaunchFeatures.mailbox { tabs.append(.mail) }
        tabs.append(.messages)
        return tabs
    }
}

/// What the Mail tab's stack (`HubTabRoot` in its mailbox mode) is asked to
/// show from another tab: the side menu's Mailbox row and the You screen's
/// mail tile open its top, a Place card a screen on it.
enum MailTabRequest: Equatable {
    case top
    case route(HubRoute)
}

/// Observable state for the root tab view. Holds the selected tab and a
/// cached count for the Messages badge.
@Observable
@MainActor
public final class RootTabModel {
    /// Currently selected tab. Starts at `.place`.
    public var selected: RootTab = .place
    /// Unread Messages count rendered as the Messages tab badge.
    public var messagesBadge: Int = 0
    /// The Place stack is on its root (kept current by `HubTabRoot`).
    public var placeAtRoot = false
    /// Changes each time the Place tab is tapped again while already on its
    /// root, so the root scrolls back to the top.
    public var placeReselectedAtRoot: UUID?
    /// The side menu is open (each tab's menu button sets it; the drawer,
    /// hosted by `RootTabView`, clears it when it closes).
    public var showsNavigationMenu = false
    /// A side-menu choice waiting for the Place tab's stack (`HubTabRoot`),
    /// where the menu's screens open.
    var pendingMenuAction: NavigationMenuAction?
    /// A screen for the Mail tab's stack, taken when the Mail tab shows.
    var pendingMailRequest: MailTabRequest?
    /// Screens showing that hide the drawn bar (`hidesTabBar()`).
    var barHiders: Set<UUID> = []
    /// The drawn bar has slid away while a page scrolls down
    /// (`RootTabBarScrollWatcher`); only `RootTabBar` reads it.
    var barScrolledAway = false
    /// The selected tab tapped again, for the drawn bar's container.
    var reselection: RootTabReselection?
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
    /// The side menu's model, made once (a view model made in `body` can
    /// write observed state while the bar draws: the Xcode 16.4 render loop).
    @State private var drawerModel = NavigationDrawerViewModel(context: .personal(name: ""))
    private let mailBadgeStore = MailBadgeStore.shared

    public init() {}

    public var body: some View {
        tabs
            // The app-wide tint also reaches the dialogs UIKit presents; primaryTint resolves for dark mode there.
            .tint(Theme.Color.primaryTint)
            .environment(model)
            // The side menu, above every tab and the bar (founder, 2026-10-20).
            .overlay { navigationMenu }
            .background {
                if signedInUserID != nil, !AppLockManager.shared.isLocked,
                   !showProfile, pendingInviteToken == nil {
                    BriefingNoticeView().id(signedInUserID)
                }
            }
            .task {
                // Live updates (sync:changed, notification:new, reconnects) for every screen.
                ScreenStoreLive.start()
                if LaunchFeatures.mailbox { mailBadgeStore.start() }
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
                // Every invite shares the person's own link; read it before anyone taps one.
                await PersonalInviteLink.shared.load(account: signedInUserID)
            }
            .onChange(of: signedInUserName, initial: true) { _, name in
                drawerModel.updateContext(.personal(name: name))
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                // Plans change while the app is away (a yes, a moved time, a removal,
                // a cancel) and their pushes don't reach the app in the background:
                // coming back re-checks every Plans screen on view.
                if plansFlags.plans { PlansStoreReads.changed() }
                Task { await plansFlags.refresh(account: signedInUserID) }
                // Mail may have come while the app was away.
                mailBadgeStore.refresh()
            }
            .onChange(of: plansFlags.plans) { _, isOn in
                // The Plans tab goes with the switch; a reader on it lands on Pulse
                // (Nearby while the Pulse redesign is off).
                if !isOn, model.selected == .plans { model.selected = RootTab.pulseHome }
            }
            .onChange(of: model.selected) { _, selected in
                // A tab that isn't on the bar (Plans switched off, Mail without
                // the Mailbox) lands on the nearest one that is.
                let onBar = RootTab.barTabs(plans: plansFlags.plans)
                if !onBar.contains(selected) { model.selected = Self.nearestTab(to: selected, on: onBar) }
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
        case .joinInvite:
            // A friend's invite link (pantopus.com/join/…) is for someone new to
            // Pantopus. Signed in, there is nothing to accept: the link just opens
            // the app. It is never a Home invitation, so no invitation sheet.
            _ = router.consume()
        // The Pulse tab consumes feed, post and Pulse links itself (back to
        // its root, or the post pushed on it). Tasks and Marketplace present
        // as sheets from the Pulse tab, whose surface root consumes the
        // pending destination as before.
        case .feed, .post, .pulse:
            if LaunchFeatures.pulseRedesign {
                model.selected = .pulse
            } else {
                openNearby(pending)
            }
        case .gig:
            if LaunchFeatures.openGigs {
                model.selected = RootTab.pulseHome
                NeighborhoodDoorStore.shared.pendingSurface = .tasks
            } else {
                // Launch cut #4 (Open gigs): no Tasks surface, so the task's
                // detail opens in the Place stack (`HubTabRoot`).
                model.selected = .place
            }
        case .listing:
            model.selected = RootTab.pulseHome
            NeighborhoodDoorStore.shared.pendingSurface = .marketplace
        // Mailbox-cluster destinations resolve in the Mail tab's stack
        // (a mailbox-rooted HubTabRoot sharing the same destinations), from
        // any tab. While Mailbox is off for launch, the Place stack shows its
        // "not in the app yet" placeholder for them instead.
        case .vacationHold, .mailDay,
             .stamps, .mailTask, .mailTranslation, .unboxing, .packageGig, .earn,
             .mailbox, .mailItem, .mailSentCard:
            model.selected = LaunchFeatures.mailbox ? .mail : .place
        case .supportTrain, .supportTrainManage, .user, .beaconProfile,
             .connections, .beacons, .discoverHub,
             .homeDetail, .homeDashboard, .homeTask, .homeMemberRequests, .homeResidency,
             .homeMembers, .homeOwners, .homeClaimReview,
             .homeOwnersTransfer,
             .verifyLandlord, .postcardVerification,
             .notifications, .createBusiness, .businessProfile, .businessPage,
             .editBusinessPage,
             .wallet, .paymentsSettings, .securityDevices, .notificationSettings,
             .businessOwner, .businessConversation, .viewAs, .waitingRoom, .neighborMessage,
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
        case .conversation, .assistant:
            // Chat, and the Pantopus AI thread with it, lives in the Messages tab.
            model.selected = .messages
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
    /// Right after a first sign-in the switch isn't known yet: wait for it rather
    /// than dropping the plan someone was sent.
    private func openPlans(_ route: PlansRoute?) {
        _ = router.consume()
        Task { @MainActor in
            await plansFlags.ready(account: signedInUserID)
            guard plansFlags.plans else { return }
            if let route {
                PlansNavigator.shared.pending = route
            } else {
                PlansNavigator.shared.pendingHost = PlansHostRequest(start: nil)
            }
            model.selected = .plans
        }
    }

    /// `/plans`: the Plans tab itself, while the switch is on.
    private func openPlansTab() {
        _ = router.consume()
        Task { @MainActor in
            await plansFlags.ready(account: signedInUserID)
            guard plansFlags.plans else { return }
            model.selected = .plans
        }
    }

    /// With the Pulse redesign off (launch cut #11): the Nearby tab (founder
    /// decision 2026-10-20). `/nearby` (the neighborhood milestone push among
    /// them) opens its Neighborhood segment; a feed or post link opens the
    /// Pulse segment, whose stack then consumes it.
    private func openNearby(_ destination: DeepLinkRouter.Destination) {
        model.selected = .nearby
        if destination == .pulse {
            NeighborhoodDoorStore.shared.pendingSegment = .neighborhood
            _ = router.consume()
        } else {
            NeighborhoodDoorStore.shared.pendingSegment = .pulse
        }
    }

    /// "Set up a home" from Today, Pulse or Nearby: the Place tab starts adding one.
    private func startAddingHome() {
        model.selected = .place
        addHomeRequest = UUID()
    }

    /// The side menu over every tab (founder decision 2026-10-20). It is the
    /// personal context, as it was on Place: the pill's name opens the profile
    /// cover, and rows open their screens in the Place tab's stack.
    private var navigationMenu: some View {
        NavigationDrawerView(
            viewModel: drawerModel,
            isPresented: Binding(
                get: { model.showsNavigationMenu },
                set: { model.showsNavigationMenu = $0 }
            ),
            onSelect: { destination in openFromMenu(.open(destination)) },
            // Launch cut #2 (Personas): the drawer hides its identity Switch.
            onOpenIdentityCenter: {
                if LaunchFeatures.personas { openFromMenu(.identityCenter) }
            },
            onBackToHub: { openFromMenu(.backToPlace) },
            onOpenProfile: { showProfile = true }
        )
    }

    /// The menu's screens live in the Place stack, as the account links
    /// (`/connections`, `/wallet` …) do: from any tab, Place shows them. The
    /// Mailbox rows open the Mail tab, on its top.
    private func openFromMenu(_ action: NavigationMenuAction) {
        model.showsNavigationMenu = false
        if LaunchFeatures.mailbox, case let .open(destination) = action,
           destination == .mailbox || destination == .homeMailbox {
            model.pendingMailRequest = .top
            model.selected = .mail
            return
        }
        model.pendingMenuAction = action
        model.selected = .place
    }

    private var signedInUserName: String {
        if case let .signedIn(user) = auth.state { user.displayName ?? "" } else { "" }
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

// MARK: - The tabs

extension RootTabView {
    /// The tabs: the system tab bar while the Mailbox is off, as it was; with
    /// it on, the container and the drawn bar, which fit six.
    @ViewBuilder
    private var tabs: some View {
        if LaunchFeatures.mailbox {
            drawnTabs
        } else {
            systemTabs
        }
    }

    private var systemTabs: some View {
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

            if LaunchFeatures.pulseRedesign {
                PulseTabRoot(onAddHome: startAddingHome)
                    .tabItem { tabLabel(.pulse) }
                    .tag(RootTab.pulse)
            } else {
                // Launch cut #11 (the Pulse redesign) is off: the Nearby tab,
                // Pulse and Neighborhood as two segments (founder, 2026-10-20).
                NeighborhoodTabRoot(onAddHome: startAddingHome)
                    .tabItem { tabLabel(.nearby) }
                    .tag(RootTab.nearby)
            }

            // Only while the `plans` switch is on (`onChange` below moves a
            // reader off it when the switch turns off).
            if plansFlags.plans {
                PlansTabRoot()
                    .tabItem { tabLabel(.plans) }
                    .tag(RootTab.plans)
            }

            InboxTabRoot()
                .tabItem { tabLabel(.messages) }
                .tag(RootTab.messages)
                .badge(model.messagesBadge)
        }
    }

    /// Six tabs: each tab's root is made once, when the tab first opens, and
    /// kept by the container; the bar is drawn above it.
    private var drawnTabs: some View {
        let onBar = RootTab.barTabs(plans: plansFlags.plans)
        let showsBar = model.barHiders.isEmpty
        return ZStack(alignment: .bottom) {
            RootTabContainer(
                tabs: onBar,
                selected: model.selected,
                barSpace: showsBar ? RootTabBar.space : .none,
                environment: RootTabEnvironment(auth: auth, tabs: model, scenePhase: scenePhase),
                reselection: model.reselection,
                makeRoot: tabRoot(for:)
            )
            .ignoresSafeArea()
            if showsBar {
                RootTabBar(
                    tabs: onBar,
                    selected: model.selected,
                    badges: [.mail: mailBadgeStore.unopened, .messages: model.messagesBadge],
                    onSelect: select
                )
            }
        }
        // The keyboard covers the bar, as it covers the system one; each
        // tab's screens make room for it in their own hosting controller.
        .ignoresSafeArea(.keyboard)
        // Another tab, or the bar back after a screen that hid it, starts
        // with the bar in view.
        .onChange(of: model.selected) { _, _ in model.barScrolledAway = false }
        .onChange(of: showsBar) { _, _ in model.barScrolledAway = false }
    }

    /// A tab's root for the container, made the first time the tab opens.
    private func tabRoot(for tab: RootTab) -> AnyView {
        switch tab {
        case .place:
            AnyView(HubTabRoot(
                onOpenProfile: { showProfile = true },
                onOpenProfileScreen: { route in presentProfile(at: route) },
                addHomeRequest: $addHomeRequest
            ))
        case .today:
            AnyView(TodayTabRoot(onAddHome: startAddingHome))
        case .nearby:
            AnyView(NeighborhoodTabRoot(onAddHome: startAddingHome))
        case .pulse:
            AnyView(PulseTabRoot(onAddHome: startAddingHome))
        case .plans:
            AnyView(PlansTabRoot())
        case .mail:
            // The Mailbox at the root of its own stack, with the mailbox
            // cluster's destinations.
            AnyView(HubTabRoot(
                mode: .mailbox,
                onOpenProfile: { showProfile = true },
                onOpenProfileScreen: { route in presentProfile(at: route) }
            ))
        case .messages:
            AnyView(InboxTabRoot())
        }
    }

    /// A tap on the drawn bar. Tapping the tab you're on takes its stack back
    /// to its root; on Place's root it scrolls to the top.
    private func select(_ tab: RootTab) {
        guard tab == model.selected else {
            model.selected = tab
            return
        }
        if tab == .place, model.placeAtRoot { model.placeReselectedAtRoot = UUID() }
        model.reselection = RootTabReselection(tab: tab)
    }

    /// Where a selection that isn't on the bar lands.
    private static func nearestTab(to tab: RootTab, on onBar: [RootTab]) -> RootTab {
        let nearest: RootTab = switch tab {
        case .mail: .messages
        case .plans, .pulse, .nearby: RootTab.pulseHome
        default: .place
        }
        return onBar.contains(nearest) ? nearest : .place
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
            .swipesBackFromEdge()
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

/// `Identifiable` wrapper so `fullScreenCover(item:)` can fire when
/// the token string is non-nil.
private struct InviteSheetToken: Identifiable, Equatable {
    let token: String
    var leaseInvitation = false
    var id: String {
        "\(leaseInvitation):\(token)"
    }
}

/// Root-level unread badge source for the Messages tab. It mirrors the
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
    private var serverTotalUnmutedUnread: Int?
    private var countGeneration = 0
    private var refreshRequestId: UUID?
    private var hasAuthoritativeCount = false
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
        subscribeIfNeeded()
        if api === APIClient.shared, !hasAuthoritativeCount,
           case let .signedIn(user) = AuthManager.shared.state {
            let generation = countGeneration
            let scope = ChatLocalStore.scope(server: api.apiBaseURL.absoluteString, account: user.id)
            let cached = await ChatLocalStore.shared.inbox(scope: scope)
            if generation == countGeneration, !Task.isCancelled, let cached {
                let rows = cached.response.conversations.map {
                    Self.snapshotRow(from: $0, mutedKeys: preferences.mutedKeys())
                }
                applyListSnapshot(
                    totalUnread: cached.stats?.totalUnread ?? cached.response.totalUnread ?? 0,
                    totalUnmutedUnread: cached.stats?.totalUnmutedUnread ?? cached.response.totalUnmutedUnread,
                    rows: rows
                )
            }
        }
        await refresh()
    }

    /// Warm the list through its screen store, but read counts directly from
    /// the server so an offline fallback cannot become badge authority.
    func refresh() async {
        guard refreshRequestId == nil else { return }
        let requestId = UUID()
        refreshRequestId = requestId
        defer { if refreshRequestId == requestId { refreshRequestId = nil } }
        let generation = countGeneration
        await preferences.migrateLegacyMutes(api: api)
        guard generation == countGeneration, !Task.isCancelled else { return }
        let store = ScreenStore.store(for: api)
        let statsTask = Task { [self] in
            await optional {
                try await api.request(ChatEndpoints.stats(), as: ChatStatsResponse.self)
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
        let conversations = await conversationsTask.value
        // A newer socket count (or account reset) wins over an older HTTP read.
        guard generation == countGeneration, !Task.isCancelled else { return }
        hasAuthoritativeCount = true
        serverTotalUnread = stats.stats.totalUnread
        serverTotalUnmutedUnread = stats.stats.totalUnmutedUnread
        if let conversations {
            preferences.applyServer(conversations.conversations)
            let mutedKeys = preferences.mutedKeys()
            cachedRows = conversations.conversations.map {
                Self.snapshotRow(from: $0, mutedKeys: mutedKeys)
            }
        }
        applyAdjustedUnread()
    }

    /// Cached list counts can seed an offline launch, but cannot overwrite a
    /// newer server count while a covered list is still finishing its refresh.
    func applyListSnapshot(totalUnread: Int, totalUnmutedUnread: Int? = nil, rows: [ConversationRowContent]) {
        if !hasAuthoritativeCount {
            serverTotalUnread = totalUnread
            serverTotalUnmutedUnread = totalUnmutedUnread
        }
        cachedRows = rows
        applyAdjustedUnread()
    }

    func stop() {
        countGeneration += 1
        refreshRequestId = nil
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
        serverTotalUnmutedUnread = nil
        hasAuthoritativeCount = false
        cachedRows = []
        unreadMessages = 0
    }

    private func applyAdjustedUnread() {
        unreadMessages = serverTotalUnmutedUnread ?? ChatUnreadBadgeMath.adjustedTotal(
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
                    countGeneration += 1
                    hasAuthoritativeCount = true
                    serverTotalUnread = update.totalUnread
                    serverTotalUnmutedUnread = update.totalUnmutedUnread
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
