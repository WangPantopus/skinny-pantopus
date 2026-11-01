//
//  AddressTodayTabView.swift
//  Pantopus
//
//  The Today tab as its own screen (Wedge v2 D2; the November 2026
//  redesign's order is in `PlaceTodayDetailContent`): any advisory, the sky
//  and the hours ahead, what's coming up at home, air and daylight, then
//  setup and the full conditions, for the person's primary place. The hub
//  briefing (`TodayDetailView`) is still
//  reachable from a morning-push deep link; this is what the tab shows
//  on its own. With no place but a claim in review, it is the claimed
//  address's public Today under the claim's status. Parity twin of
//  Android's `TodayTabScreen`.
//

import SwiftUI

struct AddressTodayTabView: View {
    let onAddHome: () -> Void
    @Environment(AuthManager.self) private var auth
    @Environment(RootTabModel.self) private var rootTabs
    @State private var resolved = false
    @State private var loadFailed = false
    @State private var detail: PlaceDetailViewModel?
    @State private var savedPlace: SavedPlaceDTO?
    /// No place yet, but a claim in review: Today shows the claimed address under its status.
    @State private var claimInReview: OwnershipClaimDTO?
    @State private var resolveID = UUID()
    /// The account the shown place was resolved for. Another account starts blank.
    @State private var resolvedUserID: String?

    init(onAddHome: @escaping () -> Void) {
        self.onAddHome = onAddHome
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            content
        }
        .background(Theme.Color.appBg)
        .task(id: resolveKey) {
            if rootTabs.selected == .today { await resolveHome() }
        }
        .refreshesOnStoreChange(onBackground: discardTemporaryPlace) { if rootTabs.selected == .today { await resolveHome() } }
        .onChange(of: rootTabs.selected) { _, tab in
            if tab != .today { discardTemporaryPlace() }
        }
        .accessibilityIdentifier("addressTodayTab")
    }

    private var resolveKey: String {
        "\(rootTabs.selected)|\(currentUserID ?? "")"
    }

    private var currentUserID: String? {
        if case let .signedIn(user) = auth.state { user.id } else { nil }
    }

    @discardableResult
    private func discardTemporaryPlace() -> Bool {
        if let detail, PlaceStoreReads.allowsCopy(homeId: detail.homeId, savedPlaceId: detail.savedPlaceId) { return false }
        detail?.discardTemporaryCopy()
        resolveID = UUID()
        detail = nil
        resolved = false
        WidgetSnapshotStore.shared.clearToday()
        return true
    }

    /// The title, date and address, with the side menu at the end (every tab
    /// has it, founder decision 2026-10-20).
    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            titleBlock
            NavigationMenuButton(accessibilityIdentifier: "today.menu")
                .padding(.top, -Spacing.s2)
        }
        .padding(.leading, 18)
        .padding(.trailing, Spacing.s2)
        .padding(.vertical, 10)
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Today")
                    .font(.system(size: 22, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(Theme.Color.appText)
                // The date beside the title (the f1-today-tab design); it turns over at midnight.
                TimelineView(.everyClockMinute) { minute in
                    Text(minute.date.formatted(
                        Date.FormatStyle(timeZone: placeTimeZone)
                            .weekday(.abbreviated)
                            .month(.abbreviated)
                            .day()
                    ))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            if let address {
                Text(address)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var address: String? {
        if let detail, case let .loaded(intel) = detail.state { return placeDetailAddress(intel.place) }
        return nil
    }

    private var placeTimeZone: TimeZone {
        if let detail, case let .loaded(intel) = detail.state,
           let name = intel.timeZone, let zone = TimeZone(identifier: name) { return zone }
        return .autoupdatingCurrent
    }

    @ViewBuilder
    private var content: some View {
        if !resolved {
            PlaceDetailSkeleton()
        } else if let detail {
            // The Ballot P0 card's "Open your ballot" lands on the Place tab.
            AddressTodayLoaded(
                viewModel: detail,
                savedPlace: savedPlace,
                claim: claimInReview,
                onAddHome: onAddHome,
                onResolvePlace: resolveHome
            ) { openBallot() }
                .id(detail.savedPlaceId ?? detail.homeId)
        } else if loadFailed {
            VStack(spacing: 0) {
                if PlansFlags.shared.plans { PlansTodayCards().padding(.horizontal, Spacing.s4) }
                couldNotLoad
            }
        } else {
            VStack(spacing: 0) {
                if PlansFlags.shared.plans { PlansTodayCards().padding(.horizontal, Spacing.s4) }
                noPlace
            }
        }
    }

    /// No claimed place yet: Today starts at an address, so send them to claim one.
    private var noPlace: some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.Color.homeBg)
                Icon(.cloudSun, size: 28, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 56, height: 56)
            Text("Today starts at your address")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(
                // swiftlint:disable:next line_length
                "Weather, air, alerts, and the dates that matter at your address — pickup day, tax deadlines, council meetings. Claim your address to start."
            )
            .font(.system(size: 14))
            .lineSpacing(3)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.Color.appTextSecondary)
            PrimaryButton(title: "Claim your address") { onAddHome() }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 16)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("addressTodayNoPlace")
    }

    /// Could not ask which home is primary (offline, a dead spot, a 5xx).
    /// This is not "no home": say so and offer a retry rather than sending
    /// a verified resident off to claim an address they already own.
    private var couldNotLoad: some View {
        VStack(spacing: 10) {
            Text("Couldn't load your place")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Check your connection and try again.")
                .font(.system(size: 14))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
            PrimaryButton(title: "Try again") { Task { await resolveHome() } }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 16)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("addressTodayLoadFailed")
    }

    private func resolveHome() async {
        // Resolve on every appearance so saving/removing a private address
        // after visiting Today cannot leave the previous no-place result latched.
        // Coming back keeps what's on screen (Instant Screens): the primary
        // place is re-checked quietly and the screen switches only when it
        // changed. The first visit, a retry after a failure and another
        // account start blank.
        let userID = currentUserID
        let canKeep = detail.map { PlaceStoreReads.allowsCopy(homeId: $0.homeId, savedPlaceId: $0.savedPlaceId) } ?? false
        let quiet = resolved && !loadFailed && resolvedUserID == userID && canKeep
        if !quiet {
            resolved = false
            loadFailed = false
            detail = nil
            savedPlace = nil
            claimInReview = nil
            WidgetSnapshotStore.shared.clearToday()
        }
        resolvedUserID = userID
        let requestID = UUID()
        resolveID = requestID
        let scope = HomeClaimSessionScope(api: .shared)
        do {
            try scope.requireCurrent()
            // The store answers at once while its copy is fresh and asks the
            // server only when it is out of date.
            let response = try await HomesStoreReads.myHomes().value
            try Task.checkCancellation()
            try scope.requireCurrent()
            guard resolveID == requestID else { return }
            // The default Home, as Place lands on it (`MyHomesResponse.defaultHomeId`).
            if let id = response.defaultHomeId {
                if detail?.homeId != id || detail?.savedPlaceId != nil || detail?.claimInReview == true {
                    detail = PlaceDetailViewModel(homeId: id, group: .today)
                }
                savedPlace = nil
                claimInReview = nil
            } else {
                let saved = try await HomesStoreReads.savedPlaces().value
                try Task.checkCancellation()
                try scope.requireCurrent()
                guard resolveID == requestID else { return }
                if let place = saved.savedPlaces.first {
                    savedPlace = place
                    claimInReview = nil
                    if detail?.savedPlaceId != place.id {
                        detail = PlaceDetailViewModel(homeId: "", group: .today, savedPlaceId: place.id)
                    }
                } else {
                    let claims = try await HomesStoreReads.myClaims().value
                    try Task.checkCancellation()
                    try scope.requireCurrent()
                    guard resolveID == requestID else { return }
                    showClaim(in: claims)
                }
            }
        } catch is CancellationError {
            // The view went away mid-request; the next appearance asks again.
            return
        } catch {
            guard scope.isCurrent, resolveID == requestID else { return }
            // A failed quiet re-check keeps the place on screen.
            if !quiet { loadFailed = true }
        }
        resolved = true
    }

    /// No place yet. A claim makes its Home theirs only once it's approved;
    /// until then Today is the claimed address's public view (the server's
    /// T1) under the claim's status.
    private func showClaim(in claims: MyOwnershipClaimsResponse) {
        savedPlace = nil
        claimInReview = claims.claims.first(where: \.isInReview)
        guard let claim = claimInReview else {
            detail = nil
            return
        }
        if detail?.homeId != claim.homeId || detail?.claimInReview != true {
            detail = PlaceDetailViewModel(homeId: claim.homeId, group: .today, claimInReview: true)
        }
    }

    /// The ballot card is on this home's Place dashboard. Selecting the
    /// Place tab alone can land on its hub or a detail page, so open the
    /// dashboard through the place link, as the tab's own stack does.
    private func openBallot() {
        // Master's Today also opens for a saved place with no home, and for a
        // claim in review (`calendarHomeId` is nil); the Place tab shows that address.
        guard let homeId = detail?.calendarHomeId else {
            rootTabs.selected = .place
            return
        }
        rootTabs.placeBallotHomeId = homeId
        DeepLinkRouter.shared.handle(path: "/place/\(homeId)")
    }
}

/// The claim's Waiting Room: its checklist, documents and withdraw.
@MainActor
private func openClaimStatus(_ claim: OwnershipClaimDTO) {
    DeepLinkRouter.shared.handle(path: "/homes/\(claim.homeId)/waiting-room")
}

/// A claim in review whose Home's public view can't be read (an older server,
/// or a closed Home): the address claimed and when Today fills in, with the
/// claim's status. Words match web's Place pages and Android.
private struct TodayClaimInReviewCard: View {
    let claim: OwnershipClaimDTO

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.Color.homeBg)
                Icon(.clock, size: 28, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 56, height: 56)
            Text("Your claim is in review")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(Self.claimPendingMessage(claim))
                .font(.system(size: 14))
                .lineSpacing(3)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
            PrimaryButton(title: "Check status") { openClaimStatus(claim) }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 16)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("addressTodayClaimInReview")
    }

    /// "You claimed 901 C Street, Vancouver, WA. Today fills in here once a
    /// Pantopus reviewer approves your claim."
    static func claimPendingMessage(_ claim: OwnershipClaimDTO) -> String {
        let claimed = claim.home?.street.map { street in
            "You claimed \([street, claim.home?.locality].compactMap { $0 }.joined(separator: ", ")). "
        } ?? ""
        return claimed + "Today fills in here once a Pantopus reviewer approves your claim."
    }
}

/// The loaded Today content, driven by the same view model as the Place
/// detail page so the calendar's pickup-day picker keeps working.
private struct AddressTodayLoaded: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State var viewModel: PlaceDetailViewModel
    let savedPlace: SavedPlaceDTO?
    /// A claim in review: this is the claimed address's public view, its status on top.
    let claim: OwnershipClaimDTO?
    let onAddHome: () -> Void
    let onResolvePlace: () async -> Void
    let onOpenPlace: () -> Void
    @State private var scope = HomeClaimSessionScope(api: .shared)
    @State private var savedAnchorMatches = false
    @State private var sessionChanged = false
    /// The assistant, opened from the box at the end about this day.
    @State private var askTopic: AIAskTopic?

    var body: some View {
        Group {
            if sessionChanged {
                ErrorState(message: "Your session changed. Reopen Today to continue.") { await onResolvePlace() }
            } else {
                switch viewModel.state {
                case .loading:
                    PlaceDetailSkeleton()
                case let .loaded(intel):
                    ScrollViewReader { proxy in
                        loadedScroll(intel)
                            // Tapping Today again on its page goes back to the top.
                            .onChange(of: rootTabs.todayReselected) { _, _ in
                                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(Self.topAnchor, anchor: .top) }
                            }
                    }
                case let .error(message):
                    if viewModel.accessDenied, let claim {
                        TodayClaimInReviewCard(claim: claim)
                    } else if viewModel.accessDenied {
                        PlaceDeniedState()
                    } else {
                        ErrorState(message: message) { await viewModel.refresh() }
                    }
                }
            }
        }
        .refreshFailureToast($viewModel.refreshFailureMessage)
        .askPantopus($askTopic)
        .task {
            guard scope.isCurrent else { sessionChanged = true
                return
            }
            // Coming back shows the last copy; the store fetches it again
            // quietly once out of date (Today: 10 minutes, and at midnight).
            await viewModel.refreshIfStale()
            guard scope.isCurrent else { sessionChanged = true
                return
            }
            await loadSavedAnchor()
        }
    }

    private static let topAnchor = "today.top"

    private func loadedScroll(_ intel: PlaceIntelligence) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Color.clear.frame(height: 0).id(Self.topAnchor)
                if let claim {
                    // My homes' words for what the claim waits on; its Waiting Room has the steps.
                    PlaceVerifyBanner(
                        icon: .clock,
                        message: "Your claim is in review. \(claim.waitingLabel).",
                        action: "Check claim status",
                        identifier: "today.claimBanner"
                    ) { openClaimStatus(claim) }
                        .padding(.bottom, 12)
                }
                if savedAnchorMatches {
                    StatusChip("Saved place · Only you", variant: .neutral)
                        .padding(.bottom, 4)
                }
                // Plans cards (with `plans` on), the saved place's reminders row and Ask
                // Pantopus come with the tab; the assistant reads a claimed Home's public view.
                PlaceTodayDetailContent(
                    intel: intel,
                    vm: viewModel,
                    showHomeRadon: savedPlace == nil && claim == nil,
                    onOpenBallot: onOpenPlace,
                    tab: TodayTabExtras(savedPlace: savedPlace != nil, onAddHome: onAddHome) {
                        askTopic = .today(homeId: viewModel.savedPlaceId == nil ? viewModel.homeId : nil)
                    }
                )
            }
            .padding(.horizontal, 16)
            .padding(.bottom, Spacing.s10)
        }
        // The home-screen widget shows what Today just showed for this place.
        .task(id: WidgetSource(intel: intel, fallback: viewModel.fallbackCalendar)) {
            guard scope.isCurrent,
                  PlaceStoreReads.allowsCopy(homeId: viewModel.homeId, savedPlaceId: viewModel.savedPlaceId) else {
                WidgetSnapshotStore.shared.clearToday()
                return
            }
            WidgetSnapshotStore.shared.writeToday(TodayWidgetSnapshot(intel: intel, viewModel: viewModel))
        }
        .refreshable {
            guard scope.isCurrent else { sessionChanged = true
                return
            }
            await viewModel.refresh()
            guard scope.isCurrent else { sessionChanged = true
                return
            }
            await loadSavedAnchor()
        }
    }

    private func checkSavedAnchor() async throws -> Bool {
        guard let savedPlace else { return false }
        try scope.requireCurrent()
        let today: HubTodayPayload = try await APIClient.shared.request(HubEndpoints.today())
        try Task.checkCancellation()
        try scope.requireCurrent()
        guard today.isRenderable, let location = today.location,
              location.source == "saved_place", let latitude = location.latitude, let longitude = location.longitude else { return false }
        return abs(latitude - savedPlace.latitude) < 0.000001 && abs(longitude - savedPlace.longitude) < 0.000001
    }

    private func loadSavedAnchor() async {
        guard savedPlace != nil else { return }
        savedAnchorMatches = false
        do {
            savedAnchorMatches = try await checkSavedAnchor()
        } catch {
            if !scope.isCurrent { sessionChanged = true }
        }
    }
}

/// What the Today widget's snapshot is built from; a change rewrites it.
private struct WidgetSource: Equatable {
    let intel: PlaceIntelligence
    let fallback: PlaceAddressCalendarData?
}
