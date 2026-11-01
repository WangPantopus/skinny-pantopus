//
//  PlaceDashboardViewModel.swift
//  Pantopus
//
//  Drives the Place dashboard (C1 verified / C1a claimed). Fetches the
//  living section-envelope payload for a home, derives tier + the
//  Today's Pulse hero, and exposes the four render states. Mirrors the
//  `HomeDashboardViewModel` lifecycle and the Android
//  `PlaceDashboardViewModel`.
//

import SwiftUI

@Observable
@MainActor
final class PlaceDashboardViewModel {
    enum State {
        case loading
        case loaded(PlaceIntelligence)
        case error(message: String)
    }

    private(set) var state: State = .loading
    /// The error is the server refusing this account the place (403): a
    /// retry can't change it, so the view drops its Try again.
    private(set) var accessDenied = false
    /// Set when a refresh fails while the dashboard is on screen: it stays
    /// and this shows as a toast. The view clears it after display.
    var refreshFailureMessage: String?
    let homeId: String
    /// `Home.move_in_date`, carried by the intelligence; nil when the home
    /// has none or this account has no household access. Drives `JustMovedCard`.
    private(set) var moveInDate: String?
    /// A re-read of a loaded dashboard is in flight (pull to refresh or a
    /// section's "Try again").
    private(set) var isRefreshing = false
    /// Unread personal notifications, the Hub bell's count; the header
    /// bell shows a dot while it is above zero.
    private(set) var unreadCount = 0
    /// The household shortcuts under Home tools that the person's access at
    /// this Home allows (`refreshHomeShortcuts`).
    private(set) var homeShortcuts: [PlaceHomeShortcut] = []
    /// The person's claim in review on a Home they can't open yet: the server
    /// sends its public view, and its status leads the dashboard (`refreshClaim`).
    private(set) var claim: OwnershipClaimDTO?
    /// The household's tasks this viewer may read, for "Worth a look"'s overdue
    /// ones. Household roles only; a refusal leaves none and shows no error.
    private(set) var tasks: [HomeTaskDTO] = []
    private var taskAccess: HomeTaskAccess?
    /// What changed since the last visit, newest first, and how many in all.
    private(set) var changes: [PlaceChange] = []
    private(set) var changesTotal = 0
    /// This visit's `since` and when it began: changes are read once a visit
    /// (a pull to refresh reads them again from the same time).
    private var visitSince: String?
    private var visitStartedAt: Date?

    private let api: APIClient
    private var reloadPending = false
    private var copyRevision = 0
    let onOpenDetail: (PlaceDetailGroup) -> Void
    /// Open the full Today's Pulse stream (the hero taps here).
    let onOpenPulse: () -> Void
    /// Switch the dashboard to another of the user's homes.
    let onSelectHome: (String) -> Void
    /// Claim/verify another address (the homes sheet's "Add a home").
    let onAddPlace: () -> Void
    /// The full Home list (the homes sheet's "Manage homes" and pending rows).
    let onManageHomes: () -> Void
    /// The homes sheet made another Home the default.
    let onDefaultHomeChanged: () -> Void
    /// Begin verification with the chosen method + address (pushes B2).
    let onStartVerify: (PlaceVerifyMethod, String) -> Void
    /// The status of a residency document already in review (the Waiting Room).
    let onOpenVerificationStatus: () -> Void
    /// W7 — compose a verified-neighbor heads-up (carries the address for
    /// the composer header). Surfaced only for verified (T4) residents.
    let onComposeMessage: (String) -> Void
    /// W7 — open the verified-neighbor inbox.
    let onOpenInbox: () -> Void
    /// Wedge v2 §2 — the privacy mirror ("see what neighbors see").
    let onOpenPrivacyMirror: () -> Void
    /// Movers first (Wedge v2 D5): "Send back the previous resident's mail" opens Mail Day.
    let onOpenMailDay: () -> Void
    let onOpenHubHome: () -> Void
    /// A household shortcut under Home tools opens its screen.
    let onOpenHomeShortcut: (PlaceHomeShortcut) -> Void
    /// The header bell opens the notifications list.
    let onOpenNotifications: () -> Void

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenDetail: @escaping (PlaceDetailGroup) -> Void = { _ in },
        onOpenPulse: @escaping () -> Void = {},
        onSelectHome: @escaping (String) -> Void = { _ in },
        onAddPlace: @escaping () -> Void = {},
        onManageHomes: @escaping () -> Void = {},
        onDefaultHomeChanged: @escaping () -> Void = {},
        onStartVerify: @escaping (PlaceVerifyMethod, String) -> Void = { _, _ in },
        onOpenVerificationStatus: @escaping () -> Void = {},
        onComposeMessage: @escaping (String) -> Void = { _ in },
        onOpenInbox: @escaping () -> Void = {},
        onOpenPrivacyMirror: @escaping () -> Void = {},
        onOpenMailDay: @escaping () -> Void = {},
        onOpenHubHome: @escaping () -> Void = {},
        onOpenHomeShortcut: @escaping (PlaceHomeShortcut) -> Void = { _ in },
        onOpenNotifications: @escaping () -> Void = {}
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenDetail = onOpenDetail
        self.onOpenPulse = onOpenPulse
        self.onSelectHome = onSelectHome
        self.onAddPlace = onAddPlace
        self.onManageHomes = onManageHomes
        self.onDefaultHomeChanged = onDefaultHomeChanged
        self.onStartVerify = onStartVerify
        self.onOpenVerificationStatus = onOpenVerificationStatus
        self.onComposeMessage = onComposeMessage
        self.onOpenInbox = onOpenInbox
        self.onOpenPrivacyMirror = onOpenPrivacyMirror
        self.onOpenMailDay = onOpenMailDay
        self.onOpenHubHome = onOpenHubHome
        self.onOpenHomeShortcut = onOpenHomeShortcut
        self.onOpenNotifications = onOpenNotifications
    }

    /// Showing the dashboard: the store's copy at once (another screen may
    /// have loaded it), then a quiet refresh only when it is out of date.
    func load() async {
        if case .loaded = state {} else if let copy = PlaceStoreReads.peek(homeId: homeId) {
            apply(copy.value)
        }
        let force = reloadPending
        reloadPending = false
        async let claimRead: Void = refreshClaim()
        async let shortcuts: Void = refreshHomeShortcuts()
        await fetch(force: force)
        await claimRead
        await shortcuts
        await refreshTasks()
        await refreshChanges(again: false)
    }

    /// Home tools can change the privacy projection while this view is
    /// retained: the next showing re-reads it, keeping the dashboard on screen.
    func reloadOnReturn() {
        reloadPending = true
    }

    func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        async let unread: Void = refreshUnread()
        async let claimRead: Void = refreshClaim(force: true)
        async let shortcuts: Void = refreshHomeShortcuts()
        await fetch(force: true)
        await unread
        await claimRead
        await shortcuts
        await refreshTasks()
        await refreshChanges(again: true)
    }

    /// A visit is this dashboard showing loaded data, coming back within the
    /// hour included. The first visit only remembers its time; later ones ask
    /// what changed since the last, and remember the server's `until` once it
    /// answers. An error or an older server (404) shows nothing and keeps the
    /// last visit's time for the next one.
    private func refreshChanges(again: Bool) async {
        guard case let .loaded(intel) = state else { return }
        let fresh = visitStartedAt.map { Date().timeIntervalSince($0) < 3600 } ?? false
        if fresh, !again { return }
        if !fresh {
            visitStartedAt = Date()
            visitSince = PlaceLastVisit.read(homeId: homeId)
        }
        guard let since = visitSince else {
            changes = []
            changesTotal = 0
            if !fresh { PlaceLastVisit.write(intel.generatedAt, homeId: homeId) }
            return
        }
        do {
            let response: PlaceChangesResponse = try await api.request(PlaceEndpoints.changes(homeId: homeId, since: since))
            guard !Task.isCancelled else { return }
            changes = response.items
            changesTotal = max(response.total ?? 0, response.items.count)
            PlaceLastVisit.write(response.until ?? intel.generatedAt, homeId: homeId)
        } catch {
            if !again {
                changes = []
                changesTotal = 0
            }
        }
    }

    /// The tasks list, as Home tools reads it (`GET /api/homes/:id/tasks`).
    private func refreshTasks() async {
        guard case let .loaded(intel) = state, claim == nil,
              ["owner", "renter", "member"].contains(intel.viewer?.role ?? "owner") else {
            tasks = []
            return
        }
        if taskAccess?.isCurrent != true { taskAccess = HomeTaskAccess(homeId: homeId, api: api) }
        guard let taskAccess else { return }
        do {
            tasks = try await taskAccess.list().tasks
        } catch is CancellationError {
            return
        } catch {
            if case .forbidden = error as? APIError { tasks = [] }
        }
    }

    /// Open tasks due before today at the home, soonest first.
    func overdueTasks(calendar: Calendar, now: Date = Date()) -> [HomeTaskDTO] {
        let today = calendar.startOfDay(for: now)
        let due = { (task: HomeTaskDTO) in PlacePresentation.parseISO(task.dueAt) ?? RadonToday.date(task.dueAt) }
        return tasks
            .filter { ["open", "in_progress"].contains($0.status) && (due($0).map { $0 < today } ?? false) }
            .sorted { (due($0) ?? .distantPast) < (due($1) ?? .distantPast) }
    }

    /// Open tasks due today at the home, soonest first.
    func tasksDueToday(calendar: Calendar, now: Date = Date()) -> [HomeTaskDTO] {
        let today = calendar.startOfDay(for: now)
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: today) else { return [] }
        let due = { (task: HomeTaskDTO) in PlacePresentation.parseISO(task.dueAt) ?? RadonToday.date(task.dueAt) }
        return tasks
            .filter { ["open", "in_progress"].contains($0.status) && (due($0).map { $0 >= today && $0 < tomorrow } ?? false) }
            .sorted { (due($0) ?? .distantPast) < (due($1) ?? .distantPast) }
    }

    /// The claim in review on this Home while the person can't open it (My
    /// homes' claims, from the store). A Home they can open has none here; a
    /// failed read keeps what shows.
    private func refreshClaim(force: Bool = false) async {
        guard let homes = try? await HomesStoreReads.myHomes(force: force).value, !Task.isCancelled else { return }
        guard !PlaceRootResolver.isOpenable(homeId, in: homes) else {
            claim = nil
            return
        }
        guard let claims = try? await HomesStoreReads.myClaims(force: force).value, !Task.isCancelled else { return }
        claim = claims.claims.first { $0.homeId == homeId && $0.isInReview }
    }

    /// The shortcuts follow the person's access at this Home, read the way
    /// Home tools reads it (`GET /api/homes/:id/dashboard-access`) and gated
    /// on the same permissions. The access copy Home tools keeps for an owner
    /// or household member shows them at once. A refusal leaves none; a
    /// failed read keeps what shows.
    private func refreshHomeShortcuts() async {
        if homeShortcuts.isEmpty, let copy = ScreenStore.store(for: api).peek(
            HomeDashboardAccess.endpoint(homeId: homeId),
            as: HomeAccessDTO.self
        ) {
            homeShortcuts = PlaceHomeShortcut.allowed(by: copy.value)
        }
        guard let snapshot = try? await HomeDashboardAccess(homeId: homeId, api: api).read(),
              !Task.isCancelled else { return }
        homeShortcuts = PlaceHomeShortcut.allowed(by: snapshot.access)
    }

    /// Re-read the bell's count whenever the dashboard shows again (for
    /// example after the user read their notifications). A failed read
    /// keeps the last count.
    func refreshUnread() async {
        // The store's count (Notifications: 30 seconds; reading notifications marks it out of date).
        guard let unread = try? await ScreenStore.store(for: api).load(
            NotificationsEndpoints.unreadCount,
            as: NotificationUnreadCountResponse.self,
            kind: .notifications,
            topics: [ScreenTopic.notifications]
        ).value else { return }
        unreadCount = unread.personalBellCount
    }

    @discardableResult
    func discardTemporaryCopy() -> Bool {
        guard !PlaceStoreReads.allowsCopy(homeId: homeId) else { return false }
        copyRevision += 1
        state = .loading
        moveInDate = nil
        return true
    }

    private func fetch(force: Bool) async {
        discardTemporaryCopy()
        let revision = copyRevision
        do {
            let snapshot = try await PlaceStoreReads.load(homeId: homeId, kind: .place, force: force)
            guard revision == copyRevision, !Task.isCancelled else { return }
            apply(snapshot.value)
        } catch is CancellationError {
            return
        } catch {
            guard revision == copyRevision, !Task.isCancelled else { return }
            let apiError = error as? APIError
            let message = apiError?.errorDescription ?? "Couldn't load your place."
            switch apiError {
            case .forbidden, .notFound:
                // Access ended: the store dropped its copy; show the server's answer.
                if case .forbidden = apiError { accessDenied = true } else { accessDenied = false }
                state = .error(message: message)
            default:
                if case .loaded = state, PlaceStoreReads.allowsCopy(homeId: homeId) {
                    // Keep the dashboard on screen; a failed refresh only toasts.
                    if force { refreshFailureMessage = message }
                } else {
                    accessDenied = false
                    state = .error(message: message)
                }
            }
        }
    }

    private func apply(_ intelligence: PlaceIntelligence) {
        if case let .loaded(shown) = state, shown == intelligence { return }
        // The move-in date rides on the intelligence (it used to need the
        // whole Home detail, a 403 for a private setup). A failed refresh
        // keeps the last value, so the card does not blink out.
        moveInDate = intelligence.moveInDate
        accessDenied = false
        state = .loaded(intelligence)
    }
}
