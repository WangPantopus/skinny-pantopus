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
//  drawn bar (`RootTabBar`).
//
//  Founder decision 2026-11-08 (Moments): Messages leaves the bar. ☰ sits at
//  the top left of every tab's first screen and a chat button
//  (`MessagesButton`) at the top right of every one but Mail's, carrying the
//  unread count. Messages stays a tab of the container, off the bar: the
//  chat button opens it over the tab you were on, which stays lit on the bar,
//  and its Back returns there. The drawn bar is the only bar, with the
//  Mailbox on or off, because the system bar can't host a tab it doesn't show.
//
//  Moments (founder, 2026-11-08) takes the tab Messages left, between Pulse
//  and Plans, while the `moments` switch is on: Place · Today · Pulse ·
//  Moments · Plans · Mail.
//
//  Founder decision 2026-11-13: Mail is third. With the Mailbox on the bar is
//  Place · Today · Mail · Pulse · Moments · Plans (yours first, then what's
//  around you), Moments and Plans while their switches are on; with it off,
//  Place · Today · Pulse · Moments · Plans. Only Mail moved: the chat button,
//  the side menu, the badges, the tab the app opens on (Place) and every
//  tab's id stay. From November 1 to Christmas, while cards are open, Mail's
//  icon is a red envelope with a gold seal (`HolidayCardDoors`).
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
    case place, today, nearby, pulse, moments, plans, mail, messages

    /// Human-readable label rendered under each tab icon. `.nearby` is the
    /// bar's Pulse tab while the Pulse redesign is off (named Nearby until the
    /// founder's November 7 decision; its id stays `nearby`).
    public var label: String {
        switch self {
        case .place: "Place"
        case .today: "Today"
        case .nearby: "Pulse"
        case .pulse: "Pulse"
        case .moments: "Moments"
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
        case .moments: "moments"
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
        case .nearby: .activity
        case .pulse: .activity
        case .moments: .circleDashed
        case .plans: .calendar
        case .mail: .mail
        case .messages: .messageCircle
        }
    }

    /// The Moments tab's badge is a dot with no number: something new near you.
    var badgeIsDot: Bool {
        self == .moments
    }

    /// Where Pulse opens: its own tab, or Nearby's door while the Pulse
    /// redesign is off (launch cut #11), as on October 13.
    static var pulseHome: RootTab {
        LaunchFeatures.pulseRedesign ? .pulse : .nearby
    }

    /// The bar's tabs in order: Mail third while the Mailbox is on (launch
    /// cut #10; founder decision 2026-11-13), then Pulse, and Moments and
    /// Plans while their switches are on. Messages isn't on the bar: the chat
    /// button opens it (founder, 2026-11-08).
    static func barTabs(plans: Bool, moments: Bool = false) -> [RootTab] {
        var tabs: [RootTab] = [.place, .today]
        if LaunchFeatures.mailbox { tabs.append(.mail) }
        tabs.append(pulseHome)
        if moments { tabs.append(.moments) }
        if plans { tabs.append(.plans) }
        return tabs
    }

    /// The tabs the container keeps: the bar's and Messages.
    static func hostedTabs(plans: Bool, moments: Bool = false) -> [RootTab] {
        barTabs(plans: plans, moments: moments) + [.messages]
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
/// cached count for the chat button's badge.
@Observable
@MainActor
public final class RootTabModel {
    /// Currently selected tab. Starts at `.place`.
    public var selected: RootTab = .place {
        didSet {
            // Messages opens over the tab it was opened from (the chat
            // button, a link, a "Message" button): Back returns there.
            if selected == .messages, oldValue != .messages { messagesReturnTab = oldValue }
        }
    }

    /// The tab Messages was opened from: it stays lit on the bar while
    /// Messages shows, and Messages' Back returns to it.
    public private(set) var messagesReturnTab: RootTab = .place
    /// Unread Messages count rendered as the chat button's badge.
    public var messagesBadge: Int = 0
    /// The Place stack is on its root (kept current by `HubTabRoot`).
    public var placeAtRoot = false
    /// Changes each time the Place tab is tapped again while already on its
    /// root, so the root scrolls back to the top.
    public var placeReselectedAtRoot: UUID?
    /// Changes each time the Today tab is tapped again: its page scrolls back to the top.
    public var todayReselected: UUID?
    /// Changes each time the tab with the feed (Nearby, or Pulse) is tapped again.
    public var pulseHomeReselected: UUID?
    /// "Open your ballot" (Today, or Place's Today page): this Home's Your
    /// Place scrolls to its ballot card once, then clears it (as on Android).
    public var placeBallotHomeId: String?
    /// "Add radon test information" (Place's risk list): Today opens its
    /// home setup on this Home's radon question once, then clears it (as on Android).
    public var todayRadonHomeId: String?
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
    /// The screen whose header has slid away while its page scrolls down,
    /// until the page is back near its top (`RootTabBarScrollWatcher`, founder
    /// request 2026-11-07); nil while every header shows. A screen opening
    /// over it, or a sheet, keeps its own header. Read through
    /// `navigationBarScrollsAway()` and `scrollAwayHeader(_:)`.
    var headerAwayScreen: ObjectIdentifier?
    /// The selected tab tapped again, for the drawn bar's container.
    var reselection: RootTabReselection?
    /// A screen from your own profile's "Your account" list, asked for where
    /// the profile was pushed in another tab: the profile cover opens on it.
    var profileCoverDestination: ProfileOwnerDestination?
    public init() {}

    /// The chat button: Messages over the tab you're on.
    func openMessages() {
        selected = .messages
    }

    /// The send flow of a Christmas card, in the Mail tab, as Mail's own row
    /// opens it; with `toUserId`, that person already chosen (as "Send one
    /// back" does). Today's countdown, a person's page, a chat's details and
    /// the side menu open it (TABCARD).
    func openChristmasCard(toUserId: String? = nil, toName: String? = nil) {
        guard LaunchFeatures.mailbox, LaunchFeatures.holidayCards else { return }
        pendingMailRequest = .route(.christmasCards(toUserId: toUserId, toName: toName))
        selected = .mail
    }

    /// Messages' Back: the tab Messages was opened from.
    func closeMessages() {
        selected = messagesReturnTab == .messages ? .place : messagesReturnTab
    }

    /// The tab the bar lights: while Messages shows, the one it was opened from.
    var barSelection: RootTab {
        selected == .messages ? messagesReturnTab : selected
    }
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
    @Environment(\.layoutDirection) private var layoutDirection
    /// Nearby Plans' two server flags, read at launch and on foreground.
    @State private var plansFlags = PlansFlags.shared
    /// The Moments switch, read the same way.
    @State private var momentsFlags = MomentsFlags.shared
    /// The dot on the Moments tab: someone near you added one since the tab was last open.
    @State private var momentsDot = MomentsTabDot.shared
    /// Christmas cards open or closed: Mail's red envelope and the other ways into a card.
    @State private var cardDoors = HolidayCardDoors.shared
    /// The side menu's model, made once (a view model made in `body` can
    /// write observed state while the bar draws: the Xcode 16.4 render loop).
    @State private var drawerModel = NavigationDrawerViewModel(context: .personal(name: ""))
    private let mailBadgeStore = MailBadgeStore.shared

    public init() {}

    public var body: some View {
        tabs
            // A profile picture's Moments ring plays from here, above every tab's pages (`MomentsProfileRing`).
            .momentsRingStage()
            // The app-wide tint also reaches the dialogs UIKit presents; primaryTint resolves for dark mode there.
            .tint(Theme.Color.primaryTint)
            .environment(model)
            // The side menu, above every tab and the bar (founder, 2026-10-20).
            .overlay { navigationMenu }
            .background {
                if signedInUserID != nil, !AppLockManager.shared.isLocked,
                   !showProfile, pendingInviteToken == nil {
                    BriefingNoticeView(mayShow: briefingNoticeMayShow).id(signedInUserID)
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
                await plansFlags.refresh(account: signedInUserID)
                await momentsFlags.refresh(account: signedInUserID)
                await cardDoors.refresh(account: signedInUserID)
                // A Moment the app was closed in the middle of posting carries on.
                if momentsFlags.moments { MomentsUploader.shared.resume(account: signedInUserID) }
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
                Task { await momentsFlags.refresh(account: signedInUserID) }
                Task { await cardDoors.refresh(account: signedInUserID) }
                // Mail may have come while the app was away.
                mailBadgeStore.refresh()
            }
            .onChange(of: plansFlags.plans) { _, isOn in
                // The Plans tab goes with the switch; a reader on it lands on Pulse
                // (Nearby while the Pulse redesign is off).
                if !isOn, model.selected == .plans { model.selected = RootTab.pulseHome }
            }
            .onChange(of: momentsFlags.moments) { _, isOn in
                // The Moments tab goes with its switch; a reader on it lands on Pulse.
                if !isOn, model.selected == .moments { model.selected = RootTab.pulseHome }
            }
            .modifier(MomentsDotUpdates(account: signedInUserID, isOn: momentsFlags.moments, onTab: model.selected == .moments))
            // A new account's first look: the Christmas card it joined for, once.
            .modifier(WaitingCardLanding(account: signedInUserID, tabs: model) {
                router.pending.map(WaitingCardLanding.opens) == true || pendingInviteToken != nil
            })
            .onChange(of: model.selected) { _, selected in
                // A tab that isn't kept (Plans or Moments switched off, Mail
                // without the Mailbox) lands on the nearest one that is.
                // Messages is always kept, off the bar.
                let hosted = RootTab.hostedTabs(plans: plansFlags.plans, moments: momentsFlags.moments)
                if !hosted.contains(selected) { model.selected = Self.nearestTab(to: selected, on: hosted) }
            }
            .onChange(of: chatBadgeStore.unreadMessages) { _, unread in
                model.messagesBadge = unread
            }
            .onChange(of: router.pending) { _, pending in
                consumeInviteDeepLinkIfNeeded(pending: pending)
            }
            .onChange(of: model.profileCoverDestination) { _, destination in
                guard let destination else { return }
                model.profileCoverDestination = nil
                presentProfile(at: YouTabRoot.route(for: destination))
            }
            .task {
                consumeInviteDeepLinkIfNeeded(pending: router.pending)
            }
            .fullScreenCover(
                isPresented: $showProfile,
                onDismiss: {
                    expandMonthlyReceipt = false
                    profileInitialRoute = nil
                },
                content: {
                    // Your own profile (the 11-01 redesign); it reads through the
                    // screen store, so it shows its last content at once.
                    YouTabRoot(
                        expandMonthlyReceipt: expandMonthlyReceipt,
                        initialRoute: profileInitialRoute
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
                .readableColumn()
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
             .mailbox, .mailItem, .mailSentCard, .mailCards:
            model.selected = LaunchFeatures.mailbox ? .mail : .place
        case .supportTrain, .supportTrainManage, .user, .beaconProfile,
             .connections, .beacons, .discoverHub,
             .homeDetail, .homeDashboard, .homeTask, .homeMemberRequests, .homeResidency,
             .homeMembers, .homeOwners, .homeClaimReview,
             .homeOwnersTransfer,
             .verifyLandlord, .postcardVerification,
             .notifications, .createBusiness, .businessProfile, .businessPage,
             .editBusinessPage,
             .wallet, .paymentsSettings, .securityDevices, .notificationSettings, .assistantMemory, .assistantRules,
             .businessOwner, .businessOwnerSection, .businessConversation, .viewAs, .waitingRoom, .neighborMessage,
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
        case let .plan(id, invite):
            openPlans(.plan(id: id, intent: invite.map { .invite(token: $0) } ?? .view))
        case let .planRequests(id):
            openPlans(.requests(planId: id))
        case .planNew:
            openPlans(nil)
        // The Moments tab, and one Moment in the viewer over it (the "added a
        // Moment" push). While the `moments` switch is off the link is dropped.
        case .moments:
            openMoments(nil)
        case let .moment(id):
            openMoments(id)
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

    /// Opens the Moments tab, and the viewer on one Moment when the link names it. The switch is read
    /// first (a tap on a push can be the app's first moment after a cold start).
    private func openMoments(_ id: String?) {
        _ = router.consume()
        Task { @MainActor in
            await momentsFlags.refresh(account: signedInUserID)
            guard momentsFlags.moments else { return }
            if let id { MomentsNavigator.shared.pending = id }
            model.selected = .moments
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

    /// With the Pulse redesign off (launch cut #11): a feed or post link opens
    /// the bar's Pulse tab, whose stack then consumes it. `/nearby` (the
    /// neighborhood milestone push among them) opens "Verified homes nearby"
    /// in the Place stack, which consumes it (founder decision 2026-11-07).
    private func openNearby(_ destination: DeepLinkRouter.Destination) {
        model.selected = destination == .pulse ? .place : .nearby
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
        // "Send a Christmas card" above Manage while cards are open (TABCARD).
        let sendCard: (@MainActor () -> Void)? = cardDoors.isOpen ? sendChristmasCardFromMenu : nil
        return NavigationDrawerView(
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
            onOpenProfile: { showProfile = true },
            onSendChristmasCard: sendCard
        )
    }

    /// The side menu's "Send a Christmas card": the send flow, in the Mail tab.
    private func sendChristmasCardFromMenu() {
        model.showsNavigationMenu = false
        model.openChristmasCard()
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

    /// The briefings notice waits until nothing else is asking: the Place tab
    /// on its own root (not under "Keep this address handy", nor a plan or post
    /// opened by a link), or Today.
    private var briefingNoticeMayShow: Bool {
        switch model.selected {
        case .place: model.placeAtRoot
        case .today: true
        default: false
        }
    }
}

// MARK: - The tabs

extension RootTabView {
    /// The tabs: the container and the drawn bar, with the Mailbox on or off.
    /// Messages lives in the container off the bar (founder, 2026-11-08), which
    /// SwiftUI's TabView can't do: it shows every tab it hosts.
    private var tabs: some View {
        drawnTabs
    }

    /// Each tab's root is made once, when the tab first opens, and kept by the
    /// container; the bar is drawn above it. Messages is kept but not drawn on
    /// the bar, which lights the tab it was opened from.
    private var drawnTabs: some View {
        let onBar = RootTab.barTabs(plans: plansFlags.plans, moments: momentsFlags.moments)
        let hosted = RootTab.hostedTabs(plans: plansFlags.plans, moments: momentsFlags.moments)
        let showsBar = model.barHiders.isEmpty
        return RootTabBarPlacementReader { verticalEdge in
            ZStack(alignment: verticalEdge.map { $0 == .leading ? .leading : .trailing } ?? .bottom) {
                RootTabContainer(
                    tabs: hosted,
                    selected: model.selected,
                    barSpace: showsBar ? RootTabBar.space(verticalEdge: verticalEdge, layoutDirection: layoutDirection) : .none,
                    environment: RootTabEnvironment(auth: auth, tabs: model, scenePhase: scenePhase),
                    reselection: model.reselection,
                    makeRoot: tabRoot(for:)
                )
                .ignoresSafeArea()
                if showsBar {
                    RootTabBar(
                        tabs: onBar,
                        selected: model.barSelection,
                        badges: [.mail: mailBadgeStore.unopened, .moments: momentsDot.hasNew ? 1 : 0],
                        verticalEdge: verticalEdge,
                        christmasMail: cardDoors.isOpen && isChristmasMailSeason(ChristmasClock.now),
                        onSelect: select
                    )
                }
            }
            .onChange(of: verticalEdge) { _, _ in showChrome() }
        }
        // The keyboard covers the bar, as it covers the system one; each
        // tab's screens make room for it in their own hosting controller.
        .ignoresSafeArea(.keyboard)
        // Another tab, or the bar back after a screen that hid it, starts
        // with the bar and the header in view.
        .onChange(of: model.selected) { _, _ in showChrome() }
        .onChange(of: showsBar) { _, _ in showChrome() }
    }

    /// The bar and the screen's header back in view.
    private func showChrome() {
        model.barScrolledAway = false
        model.headerAwayScreen = nil
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
        case .moments:
            AnyView(MomentsTabRoot())
        case .plans:
            AnyView(PlansTabRoot())
        case .mail:
            // The Mailbox at the root of its own stack, with the mailbox
            // cluster's destinations. Everything on the tab asks who's holding
            // the phone first (founder, 2026-11-06): on a cancel the tab stays
            // on its cover, and the bar still goes elsewhere.
            AnyView(SensitiveScreenGuard(reason: HubRoute.mailGuardReason) {
                HubTabRoot(
                    mode: .mailbox,
                    onOpenProfile: { showProfile = true },
                    onOpenProfileScreen: { route in presentProfile(at: route) }
                )
            })
        case .messages:
            AnyView(InboxTabRoot())
        }
    }

    /// A tap on the drawn bar. Tapping the tab you're on takes its stack back
    /// to its root; on Place's root, or the feed, it scrolls to the top.
    private func select(_ tab: RootTab) {
        guard tab == model.selected else {
            model.selected = tab
            return
        }
        if tab == .place, model.placeAtRoot { model.placeReselectedAtRoot = UUID() }
        if tab == .today { model.todayReselected = UUID() }
        if tab == RootTab.pulseHome { model.pulseHomeReselected = UUID() }
        model.reselection = RootTabReselection(tab: tab)
    }

    /// Where a selection that isn't on the bar lands. Mail (without the
    /// Mailbox) sits between Today and Pulse: it lands on Today.
    private static func nearestTab(to tab: RootTab, on onBar: [RootTab]) -> RootTab {
        let nearest: RootTab = switch tab {
        case .mail: .today
        case .plans, .moments, .pulse, .nearby: RootTab.pulseHome
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
            .readableColumn()
            .toolbar(.hidden, for: .navigationBar)
            .swipesBackFromEdge()
            .accessibilityIdentifier("todayTabRoot")
            .navigationDestination(isPresented: $showsNotificationSettings) {
                NotificationSettingsView { showsNotificationSettings = false }
                    .readableColumn()
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

/// Keeps the Moments tab's dot current: read at launch and when Moments turn on, when the app comes to the
/// front, and every five minutes while it's open; gone while the tab is on screen. (A "moment_new" push and
/// the viewer closing ask for a read themselves.)
private struct MomentsDotUpdates: ViewModifier {
    let account: String?
    let isOn: Bool
    let onTab: Bool
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content
            .task(id: "\(account ?? "")|\(isOn)") {
                while !Task.isCancelled {
                    await MomentsTabDot.shared.refresh(account: account, isOn: isOn, force: true)
                    try? await Task.sleep(for: .seconds(MomentsTabDot.rereadAfter))
                }
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                Task { await MomentsTabDot.shared.refresh(account: account, isOn: isOn, force: true) }
            }
            .onChange(of: onTab, initial: true) { _, open in
                if open { MomentsTabDot.shared.tabOpened(account: account) } else { MomentsTabDot.shared.tabLeft() }
            }
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
    /// When the server last answered the count.
    private var countReadAt: Date?
    private static let justReadWindow: TimeInterval = 5

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

    /// The server's count, never a kept copy, so an offline fallback cannot
    /// become badge authority. The read goes through the screen store only to
    /// share one request with the list opening beside it. A server without
    /// the unmuted total also needs the rows, to take the muted ones off.
    func refresh() async {
        guard refreshRequestId == nil else { return }
        let requestId = UUID()
        refreshRequestId = requestId
        defer { if refreshRequestId == requestId { refreshRequestId = nil } }
        let generation = countGeneration
        await preferences.migrateLegacyMutes(api: api)
        guard generation == countGeneration, !Task.isCancelled else { return }
        let store = ScreenStore.store(for: api)
        let stats = await optional {
            try await store.load(
                ChatEndpoints.stats(),
                as: ChatStatsResponse.self,
                kind: .messagesList,
                topics: [ScreenTopic.chats],
                force: true
            ).value
        }
        guard let stats else {
            logger.warning("Chat badge refresh failed: stats unavailable")
            return
        }
        countReadAt = Date()
        var conversations: UnifiedConversationsResponse?
        if stats.stats.totalUnmutedUnread == nil {
            conversations = await optional {
                try await store.load(
                    ChatEndpoints.unifiedConversations(),
                    as: UnifiedConversationsResponse.self,
                    kind: .messagesList,
                    topics: [ScreenTopic.chats]
                ).value
            }
        }
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
        countReadAt = nil
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
                    // Just read (the launch's own read, a moment before the socket
                    // connects): the server also sends the count on connect.
                    if let countReadAt, Date().timeIntervalSince(countReadAt) < Self.justReadWindow { continue }
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
