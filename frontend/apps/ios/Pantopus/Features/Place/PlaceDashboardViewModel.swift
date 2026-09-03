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
    let homeId: String
    /// `Home.move_in_date`, read alongside the intelligence; nil until the
    /// detail fetch lands or when the home has none. Drives `JustMovedCard`.
    private(set) var moveInDate: String?

    private let api: APIClient
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
        onOpenHubHome: @escaping () -> Void = {}
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
    }

    func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        // The move-in date rides on the home detail; it is a nicety, so a
        // failed detail read never blocks the dashboard.
        async let detail: HomeDetailResponse? = try? api.request(HomesEndpoints.detail(homeId: homeId))
        do {
            let intelligence: PlaceIntelligence = try await api.request(
                PlaceEndpoints.intelligence(homeId: homeId)
            )
            // Only a successful detail read may change the date; a failed one
            // keeps the last known value so the card does not blink out.
            if let detail = await detail { moveInDate = detail.home.base.moveInDate }
            state = .loaded(intelligence)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your place.")
        } catch {
            state = .error(message: "Couldn't load your place.")
        }
    }
}
