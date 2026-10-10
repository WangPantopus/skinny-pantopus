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

    private let api: APIClient
    private var reloadPending = false
    private var copyRevision = 0
    let onOpenDetail: (PlaceDetailGroup) -> Void
    /// Open the full Today's Pulse stream (the hero taps here).
    let onOpenPulse: () -> Void
    /// Switch the dashboard to another of the user's homes.
    let onSelectHome: (String) -> Void
    /// Claim/verify another address (the switcher's "Add a place").
    let onAddPlace: () -> Void
    /// Begin verification with the chosen method + address (pushes B2).
    let onStartVerify: (PlaceVerifyMethod, String) -> Void
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
    /// The header bell opens the notifications list.
    let onOpenNotifications: () -> Void

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenDetail: @escaping (PlaceDetailGroup) -> Void = { _ in },
        onOpenPulse: @escaping () -> Void = {},
        onSelectHome: @escaping (String) -> Void = { _ in },
        onAddPlace: @escaping () -> Void = {},
        onStartVerify: @escaping (PlaceVerifyMethod, String) -> Void = { _, _ in },
        onComposeMessage: @escaping (String) -> Void = { _ in },
        onOpenInbox: @escaping () -> Void = {},
        onOpenPrivacyMirror: @escaping () -> Void = {},
        onOpenMailDay: @escaping () -> Void = {},
        onOpenHubHome: @escaping () -> Void = {},
        onOpenNotifications: @escaping () -> Void = {}
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenDetail = onOpenDetail
        self.onOpenPulse = onOpenPulse
        self.onSelectHome = onSelectHome
        self.onAddPlace = onAddPlace
        self.onStartVerify = onStartVerify
        self.onComposeMessage = onComposeMessage
        self.onOpenInbox = onOpenInbox
        self.onOpenPrivacyMirror = onOpenPrivacyMirror
        self.onOpenMailDay = onOpenMailDay
        self.onOpenHubHome = onOpenHubHome
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
        await fetch(force: force)
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
        await fetch(force: true)
        await unread
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
