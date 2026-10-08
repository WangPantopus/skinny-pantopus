//
//  AddressTodayTabView.swift
//  Pantopus
//
//  The Today tab as its own screen (Wedge v2 D2): weather now, what to do
//  with it, the address calendar, then air, alerts and sun, for the
//  person's primary place. The hub briefing (`TodayDetailView`) is still
//  reachable from a morning-push deep link; this is what the tab shows
//  on its own. Parity twin of Android's `TodayTabScreen`.
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
    @State private var resolveID = UUID()

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
        .accessibilityIdentifier("addressTodayTab")
    }

    private var resolveKey: String {
        let userID: String? = if case let .signedIn(user) = auth.state { user.id } else { nil }
        return "\(rootTabs.selected)|\(userID ?? "")"
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Today")
                    .font(.system(size: 22, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(Theme.Color.appText)
                // The date beside the title (the f1-today-tab design); it turns over at midnight.
                TimelineView(.everyMinute) { minute in
                    Text(minute.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
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
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
    }

    private var address: String? {
        if let detail, case let .loaded(intel) = detail.state { return placeDetailAddress(intel.place) }
        return nil
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
                onAddHome: onAddHome,
                onResolvePlace: resolveHome
            ) { openBallot() }
                .id(detail.savedPlaceId ?? detail.homeId)
        } else if loadFailed {
            couldNotLoad
        } else {
            noPlace
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
        resolved = false
        loadFailed = false
        detail = nil
        savedPlace = nil
        let requestID = UUID()
        resolveID = requestID
        let scope = HomeClaimSessionScope(api: .shared)
        do {
            try scope.requireCurrent()
            let response: MyHomesResponse = try await APIClient.shared.request(HomesEndpoints.myHomes())
            try Task.checkCancellation()
            try scope.requireCurrent()
            guard resolveID == requestID else { return }
            let privateHome = response.homes
                .filter { $0.hasValidListContext && $0.accessKind == "private_setup" }
                .max { ($0.home.createdAt ?? "", $0.id) < ($1.home.createdAt ?? "", $1.id) }
            let id = response.sharedHomes.first { $0.isPrimaryOwner == true }?.id
                ?? response.sharedHomes.first?.id ?? privateHome?.id
            if let id {
                detail = PlaceDetailViewModel(homeId: id, group: .today)
            } else {
                let saved: SavedPlacesListResponse = try await APIClient.shared.request(SavedPlacesEndpoints.list())
                try Task.checkCancellation()
                try scope.requireCurrent()
                guard resolveID == requestID else { return }
                if let place = saved.savedPlaces.first {
                    savedPlace = place
                    detail = PlaceDetailViewModel(homeId: "", group: .today, savedPlaceId: place.id)
                }
            }
        } catch is CancellationError {
            // The view went away mid-request; the next appearance asks again.
            return
        } catch {
            guard scope.isCurrent, resolveID == requestID else { return }
            loadFailed = true
        }
        resolved = true
    }

    /// The ballot card is on this home's Place dashboard. Selecting the
    /// Place tab alone can land on its hub or a detail page, so open the
    /// dashboard through the place link, as the tab's own stack does.
    private func openBallot() {
        // Master's Today also opens for a saved place with no home
        // (`calendarHomeId` is nil); there is no home dashboard to open then.
        guard let homeId = detail?.calendarHomeId else {
            rootTabs.selected = .place
            return
        }
        DeepLinkRouter.shared.handle(path: "/place/\(homeId)")
    }
}

/// The loaded Today content, driven by the same view model as the Place
/// detail page so the calendar's pickup-day picker keeps working.
private struct AddressTodayLoaded: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State var viewModel: PlaceDetailViewModel
    let savedPlace: SavedPlaceDTO?
    let onAddHome: () -> Void
    let onResolvePlace: () async -> Void
    let onOpenPlace: () -> Void
    @State private var scope = HomeClaimSessionScope(api: .shared)
    @State private var savedAnchorMatches = false
    @State private var showMorningCard = false
    @State private var preferenceBusy = false
    @State private var preferenceError: String?
    @State private var promptAttempted = false
    @State private var promptConfirmed = false
    @State private var scrollFrame = CGRect.zero
    @State private var cardFrame = CGRect.zero
    @State private var sessionChanged = false
    @State private var lifecycleVersion = 0

    var body: some View {
        Group {
            if sessionChanged {
                ErrorState(message: "Your session changed. Reopen Today to continue.") { await onResolvePlace() }
            } else {
                switch viewModel.state {
                case .loading:
                    PlaceDetailSkeleton()
                case let .loaded(intel):
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            if savedAnchorMatches {
                                StatusChip("Saved place · Only you", variant: .neutral)
                                    .padding(.bottom, 12)
                            }
                            PlaceTodayDetailContent(
                                intel: intel,
                                vm: viewModel,
                                showHomeRadon: savedPlace == nil,
                                onOpenBallot: onOpenPlace
                            )
                            if savedPlace != nil {
                                remindersRow.padding(.top, 12)
                            }
                            if showMorningCard, savedAnchorMatches {
                                morningCard.padding(.top, 12)
                                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { cardFrame = $0 }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, Spacing.s10)
                    }
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { scrollFrame = $0 }
                    .onChange(of: morningVisible) { _, visible in
                        if visible { Task { await markPromptDisplayed() } }
                    }
                    .refreshable {
                        guard scope.isCurrent else { sessionChanged = true
                            return
                        }
                        await viewModel.refresh()
                        guard scope.isCurrent else { sessionChanged = true
                            return
                        }
                        await loadSavedPrompt()
                    }
                case let .error(message):
                    if viewModel.accessDenied {
                        PlaceDeniedState()
                    } else {
                        ErrorState(message: message) { await viewModel.refresh() }
                    }
                }
            }
        }
        .task {
            guard scope.isCurrent else { sessionChanged = true
                return
            }
            await viewModel.load()
            guard scope.isCurrent else { sessionChanged = true
                return
            }
            await loadSavedPrompt()
        }
        .onAppear { lifecycleVersion += 1
            preferenceBusy = false
        }
        .onDisappear { lifecycleVersion += 1
            preferenceBusy = false
        }
        .onChange(of: rootTabs.selected) { _, _ in lifecycleVersion += 1
            preferenceBusy = false
        }
        .onChange(of: AppLockManager.shared.isLocked) { _, _ in lifecycleVersion += 1
            preferenceBusy = false
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.protectedDataDidBecomeAvailableNotification)) { _ in
            lifecycleVersion += 1
            preferenceBusy = false
        }
    }

    private var morningVisible: Bool {
        showMorningCard && savedAnchorMatches && rootTabs.selected == .today && !cardFrame.isEmpty && cardFrame.intersects(scrollFrame)
    }

    private var remindersRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Get reminders for this address")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Pickup and radon reminders need your home on Pantopus.")
                .font(.system(size: 14)).foregroundStyle(Theme.Color.appTextSecondary)
            GhostButton(title: "Add your home") { onAddHome() }
        }
        .padding(16)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("todaySavedPlaceReminders")
    }

    private var morningCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("A morning heads-up?")
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            Text("Weather, air and alerts for this address, only when something's worth knowing.")
                .font(.system(size: 14)).foregroundStyle(Theme.Color.appTextSecondary)
            if let preferenceError {
                Text(preferenceError).font(.system(size: 13)).foregroundStyle(Theme.Color.error)
            }
            HStack(spacing: 8) {
                GhostButton(title: "Turn on", isLoading: preferenceBusy) { await turnOnMorning() }
                GhostButton(title: "Not now", isEnabled: !preferenceBusy) { await hideMorningCard() }
            }
        }
        .padding(16)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("todayMorningOptIn")
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

    private func loadSavedPrompt() async {
        guard savedPlace != nil else { return }
        savedAnchorMatches = false
        do {
            savedAnchorMatches = try await checkSavedAnchor()
            guard savedAnchorMatches else { showMorningCard = false
                return
            }
            let response: NotificationPreferencesResponseDTO = try await APIClient.shared.request(NotificationPreferencesEndpoints.fetch())
            try Task.checkCancellation()
            try scope.requireCurrent()
            promptConfirmed = response.preferences.dailyBriefingPromptedAt?.isEmpty == false
            if !promptAttempted { showMorningCard = response.preferences.dailyBriefingPromptedAt == nil }
        } catch {
            savedAnchorMatches = false
            showMorningCard = false
            if !scope.isCurrent { sessionChanged = true }
        }
    }

    private func markPromptDisplayed() async {
        guard showMorningCard, savedAnchorMatches, !promptAttempted else { return }
        _ = await persistPromptDisplayed()
    }

    private func hideMorningCard() async {
        guard showMorningCard, !preferenceBusy else { return }
        // A failed display stamp must be retried before dismissal; otherwise
        // the next visit treats this already-answered prompt as first use.
        if promptConfirmed {
            showMorningCard = false
        } else if await persistPromptDisplayed() {
            showMorningCard = false
        }
    }

    private func persistPromptDisplayed() async -> Bool {
        let version = lifecycleVersion
        promptAttempted = true
        preferenceBusy = true
        preferenceError = nil
        defer {
            if lifecycleVersion == version, rootTabs.selected == .today, savedPlace?.id == viewModel.savedPlaceId,
               !AppLockManager.shared.isLocked, UIApplication.shared.isProtectedDataAvailable { preferenceBusy = false }
        }
        do {
            try requirePreferenceCurrent(version)
            let response: NotificationPreferencesResponseDTO = try await APIClient.shared.request(
                NotificationPreferencesEndpoints.update(
                    ["daily_briefing_prompted": .bool(true)]
                ) { try requirePreferenceCurrent(version) }
            )
            try requirePreferenceCurrent(version)
            guard response.preferences.dailyBriefingPromptedAt?.isEmpty == false else { throw APIError.invalidResponse }
            promptConfirmed = true
            return true
        } catch {
            guard lifecycleVersion == version, rootTabs.selected == .today, savedPlace?.id == viewModel.savedPlaceId,
                  !AppLockManager.shared.isLocked, UIApplication.shared.isProtectedDataAvailable else { return false }
            if scope.isCurrent {
                preferenceError = "Couldn't save your choice. Try again."
            } else {
                showMorningCard = false
                savedAnchorMatches = false
                sessionChanged = true
            }
            return false
        }
    }

    private func turnOnMorning() async {
        guard !preferenceBusy else { return }
        let version = lifecycleVersion
        preferenceBusy = true
        preferenceError = nil
        defer {
            if lifecycleVersion == version, rootTabs.selected == .today, savedPlace?.id == viewModel.savedPlaceId,
               !AppLockManager.shared.isLocked, UIApplication.shared.isProtectedDataAvailable { preferenceBusy = false }
        }
        do {
            let matches = try await checkSavedAnchor()
            try requirePreferenceCurrent(version)
            guard matches else { showMorningCard = false
                savedAnchorMatches = false
                return
            }
            let timezone = TimeZone.autoupdatingCurrent.identifier
            guard TimeZone.knownTimeZoneIdentifiers.contains(timezone) else {
                preferenceError = "Couldn't read your time zone. Try again."
                return
            }
            try requirePreferenceCurrent(version)
            let response: NotificationPreferencesResponseDTO = try await APIClient.shared.request(
                NotificationPreferencesEndpoints.update([
                    "daily_briefing_enabled": .bool(true), "daily_briefing_timezone": .string(timezone),
                    "daily_briefing_prompted": .bool(true)
                ]) { try requirePreferenceCurrent(version) }
            )
            try requirePreferenceCurrent(version)
            if response.preferences.dailyBriefingEnabled {
                showMorningCard = false
            } else {
                preferenceError = "Couldn't turn on your morning briefing. Try again."
            }
        } catch {
            guard lifecycleVersion == version, rootTabs.selected == .today, savedPlace?.id == viewModel.savedPlaceId,
                  !AppLockManager.shared.isLocked, UIApplication.shared.isProtectedDataAvailable else { return }
            if scope.isCurrent {
                preferenceError = "Couldn't turn on your morning briefing. Try again."
            } else {
                showMorningCard = false
                savedAnchorMatches = false
                sessionChanged = true
            }
        }
    }

    private func requirePreferenceCurrent(_ version: Int) throws {
        try scope.requireCurrent()
        try Task.checkCancellation()
        guard lifecycleVersion == version, rootTabs.selected == .today, savedPlace?.id == viewModel.savedPlaceId,
              !AppLockManager.shared.isLocked, UIApplication.shared.isProtectedDataAvailable else { throw CancellationError() }
    }
}
