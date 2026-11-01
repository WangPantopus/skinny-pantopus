//
//  PlaceDashboardView.swift
//  Pantopus
//
//  C1 / C1a — the assembled Place dashboard, the Place tab's root for a
//  Home the person can open. Ported from the design kit
//  `place-dashboard.jsx` + `place-dashboard-claimed.jsx`. A chip beside
//  the title says where the person stands (Verified, Claimed or Private
//  setup); before verification a verify banner and a "Locked until you
//  verify" group lead to it. While a claim on the Home is in review, it is
//  the Home's public view with the claim's status on top instead. The
//  address opens the person's homes.
//

import SwiftUI

// swiftlint:disable file_length type_body_length

struct PlaceDashboardView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: PlaceDashboardViewModel
    @State private var showSwitcher = false
    @State private var showVerify = false
    @State private var ballotGovernments: BallotGovernmentsSheet?
    /// The assistant, opened from the header about this home.
    @State private var askTopic: AIAskTopic?
    /// The glance groups open on this home, remembered on the device.
    @State private var openGroups: Set<PlaceGlanceGroup> = []

    private let isActive: Bool
    /// The Place tab's root has nothing to go back to: its loading and error
    /// states show the bell instead of Back.
    private let isRoot: Bool
    /// Changes when the Place tab is tapped again on this dashboard: back to the top.
    private let scrollToTop: UUID?
    /// "Open your ballot" brought the person here: scroll to the ballot card,
    /// then `onBallotShown` clears the request.
    private let showsBallot: Bool
    private let onBallotShown: () -> Void
    private let onOpenMenu: () -> Void

    init(
        viewModel: PlaceDashboardViewModel,
        isActive: Bool = true,
        isRoot: Bool = false,
        scrollToTop: UUID? = nil,
        showsBallot: Bool = false,
        onBallotShown: @escaping () -> Void = {},
        onOpenMenu: @escaping () -> Void = {}
    ) {
        self.isActive = isActive
        self.isRoot = isRoot
        self.scrollToTop = scrollToTop
        self.showsBallot = showsBallot
        self.onBallotShown = onBallotShown
        self.onOpenMenu = onOpenMenu
        _viewModel = State(initialValue: viewModel)
    }

    private var verifyAddress: String {
        if case let .loaded(intel) = viewModel.state { return intel.place.label }
        return ""
    }

    var body: some View {
        // Keep lifecycle observers attached when privacy clearing replaces the
        // loaded dashboard with its placeholder during a background transition.
        ZStack {
            switch viewModel.state {
            case .loading:
                PlaceDashboardSkeleton()
            case let .loaded(intel):
                loaded(intel)
            case let .error(message):
                if viewModel.accessDenied, let claim = viewModel.claim {
                    // The claimed Home's public view was refused (an older server, or a closed Home).
                    VStack(spacing: 0) {
                        claimBanner(claim)
                            .padding(.horizontal, 16)
                            .padding(.top, Spacing.s3)
                        PlaceDeniedState()
                    }
                } else if viewModel.accessDenied {
                    PlaceDeniedState()
                } else {
                    ErrorState(message: message) {
                        await viewModel.refresh()
                    }
                }
            }
        }
        .background(Theme.Color.appBg)
        // With the navigation bar hidden the scroll content slid under the
        // status bar; this zero-height inset paints the app background there.
        .safeAreaInset(edge: .top, spacing: 0) {
            if case .loaded = viewModel.state {
                Color.clear.frame(height: 0).background(Theme.Color.appBg.ignoresSafeArea(edges: .top))
            } else {
                HStack {
                    if isRoot {
                        Spacer()
                        PlaceBellButton(unreadCount: viewModel.unreadCount, action: viewModel.onOpenNotifications)
                    } else {
                        Button { dismiss() } label: { Label("Back", systemImage: "chevron.left") }
                            .frame(minHeight: 44).accessibilityIdentifier("place.back")
                        Spacer()
                    }
                    Button(action: onOpenMenu) { Label("Menu", systemImage: "line.3.horizontal") }
                        .frame(minHeight: 44).accessibilityIdentifier("place.menu")
                }
                .padding(.horizontal, Spacing.s4)
                .background(Theme.Color.appBg.ignoresSafeArea(edges: .top))
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task(id: isActive) {
            guard isActive else { viewModel.discardTemporaryCopy()
                return
            }
            // Today's "Open your ballot" opens the tab on another Home: SwiftUI
            // cancels this new dashboard's task as it starts and doesn't start
            // it again, which left Home tools without its shortcuts. The reads
            // finish outside the task.
            await Task {
                await viewModel.load()
                // Also on coming back from the notifications list, so a read bell loses its dot.
                await viewModel.refreshUnread()
            }.value
        }
        .refreshable { await viewModel.refresh() }
        .refreshesOnStoreChange(onBackground: viewModel.discardTemporaryCopy) { if isActive { await viewModel.load() } }
        .refreshFailureToast($viewModel.refreshFailureMessage)
        .askPantopus($askTopic)
        .sheet(isPresented: $showSwitcher) {
            PlaceSwitcherSheet(
                viewModel: PlaceSwitcherViewModel(
                    activeHomeId: viewModel.homeId,
                    onSelect: { homeId in
                        showSwitcher = false
                        if homeId != viewModel.homeId { viewModel.onSelectHome(homeId) }
                    },
                    onAddPlace: {
                        showSwitcher = false
                        viewModel.onAddPlace()
                    },
                    onManageHomes: {
                        showSwitcher = false
                        viewModel.onManageHomes()
                    },
                    onDefaultChanged: { _ in viewModel.onDefaultHomeChanged() },
                    onClose: { showSwitcher = false }
                )
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
        }
        .sheet(item: $ballotGovernments) { sheet in
            BallotGovernmentsView(
                governments: sheet.governments,
                address: verifyAddress.components(separatedBy: ",").first ?? verifyAddress
            ) { ballotGovernments = nil }
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showVerify) {
            PlaceVerifySheet(
                address: verifyAddress,
                homeId: viewModel.homeId,
                onStart: { method in
                    showVerify = false
                    viewModel.onStartVerify(method, verifyAddress)
                },
                onClose: { showVerify = false },
                onOpenDocumentStatus: {
                    showVerify = false
                    viewModel.onOpenVerificationStatus()
                }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
        }
    }

    // MARK: - Loaded

    private func loaded(_ intel: PlaceIntelligence) -> some View {
        let isVerified = intel.tier == .t4
        // Verifying is the next step for a claimed resident and for a private
        // setup (by mail). Guests and service providers can't verify, so they
        // get no verify prompts; older servers don't say, and claimed decides.
        let showsVerify = !isVerified && (intel.verifyAvailable ?? (intel.tier == .t3))
        // A claim in review: the public view, with no household tools or verify steps.
        let claim = viewModel.claim
        let canVerify = claim == nil && !(intel.tier == .t3 && intel.verifyAvailable == false)
        return ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    header(intel: intel)
                        .padding(.horizontal, 18)
                        .padding(.top, Spacing.s2)
                        .id(Self.topAnchor)

                    // One order on both apps: the next step (verify, or the claim's
                    // status), the home and its tools, what's worth a look, the home
                    // at a glance, then neighbors, privacy and Ask.
                    leadBanner(claim: claim)
                    PlaceHomeCard(
                        intel: intel,
                        claimInReview: claim != nil,
                        shortcuts: viewModel.homeShortcuts,
                        onUnlock: canVerify ? { showVerify = true } : nil,
                        showsVerify: showsVerify && claim == nil,
                        onOpenTools: {
                            viewModel.reloadOnReturn()
                            viewModel.onOpenHubHome()
                        },
                        onShortcut: { shortcut in
                            viewModel.reloadOnReturn()
                            viewModel.onOpenHomeShortcut(shortcut)
                        }
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                    VStack(alignment: .leading, spacing: 0) {
                        worthALook(intel)
                        glance(intel, claim: claim)
                        if isVerified {
                            messagesEntry(address: intel.place.label)
                        }
                        // The privacy mirror (Wedge v2 §2): one tap to see yourself as a neighbor does.
                        if claim == nil {
                            privacyMirrorRow
                                .padding(.top, 24)
                        }
                        AskPantopusBox(
                            title: "Ask Pantopus about your home",
                            subtitle: nil,
                            spokenLabel: "Ask Pantopus about your home",
                            identifier: "place.askPantopusEntry"
                        ) { askTopic = .place(homeId: viewModel.homeId) }
                            .padding(.top, 24)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, Spacing.s10)
                }
            }
            .onChange(of: scrollToTop) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(Self.topAnchor, anchor: .top) }
            }
            // Also when the dashboard first shows loaded, as it does after Today's "Open your ballot":
            // Civic opens and the ballot card comes into view.
            .onChange(of: showsBallot, initial: true) { _, shows in
                guard shows else { return }
                Task { @MainActor in
                    let hasBallot = Self.ballot(in: intel) != nil
                    if hasBallot { openGroups.insert(.civic) }
                    // Passes for Civic to open and the cards to lay out before the scroll.
                    await Task.yield()
                    await Task.yield()
                    if hasBallot {
                        withAnimation(.easeOut(duration: 0.3)) { proxy.scrollTo(Self.ballotAnchor, anchor: .top) }
                    }
                    onBallotShown()
                }
            }
            .task(id: viewModel.homeId) { loadOpenGroups() }
            .onChange(of: openGroups) { _, groups in saveOpenGroups(groups) }
        }
    }

    private static let topAnchor = "place.top"
    private static let ballotAnchor = "place.ballot"

    /// A claim in review has its status above the home (the verify step lives in the home card).
    @ViewBuilder
    private func leadBanner(claim: OwnershipClaimDTO?) -> some View {
        if let claim {
            claimBanner(claim)
                .padding(.horizontal, 16)
                .padding(.top, Spacing.s3)
        }
    }

    /// My homes' words for what the claim waits on; its Waiting Room has the steps.
    private func claimBanner(_ claim: OwnershipClaimDTO) -> some View {
        PlaceVerifyBanner(
            icon: .clock,
            message: "Your claim is in review. \(claim.waitingLabel).",
            action: "Check claim status",
            identifier: "place.claimBanner",
            onTap: viewModel.onOpenVerificationStatus
        )
    }

    // MARK: - Header

    /// "Your Place", where the person stands at this Home, the bell and the
    /// menu; under them the address, which opens their homes.
    private func header(intel: PlaceIntelligence) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 8) {
                Text("Your Place")
                    .font(.system(size: 28, weight: .bold))
                    .kerning(-0.56)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .layoutPriority(1)
                    .accessibilityAddTraits(.isHeader)
                if let status = viewModel.claim == nil ? Self.status(intel) : Self.claimStatus {
                    PlaceChip(model: status)
                        .accessibilityIdentifier("place.status")
                }
                Spacer(minLength: 0)
                // Bell + menu sit together; the dot shows anything unread.
                HStack(spacing: 0) {
                    PlaceBellButton(unreadCount: viewModel.unreadCount, action: viewModel.onOpenNotifications)
                    Button(action: onOpenMenu) {
                        Icon(.menu, size: 20, color: Theme.Color.appText)
                            .frame(width: Spacing.s12, height: Spacing.s12)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Menu")
                    .accessibilityIdentifier("place.menu")
                }
            }
            // Ask sits at the end of the address row, under the bell and menu,
            // so the title row keeps room for the status chip.
            HStack(spacing: Spacing.s2) {
                addressButton(intel.place)
                Spacer(minLength: 0)
                AskPantopusButton(accessibilityIdentifier: "place.askPantopus") {
                    askTopic = .place(homeId: viewModel.homeId)
                } label: {
                    AskPantopusGlyph()
                        .frame(width: Spacing.s12, height: 44)
                        .contentShape(Rectangle())
                }
            }
        }
    }

    /// A claim on the Home is in review.
    static let claimStatus = PlaceChipModel(tone: .warning, text: "In review", icon: .clock)

    /// Where the person stands at this Home. Guests and service providers
    /// aren't residents: no status.
    static func status(_ intel: PlaceIntelligence) -> PlaceChipModel? {
        guard intel.viewer?.role != "nonresident" else { return nil }
        return switch intel.tier {
        case .t4: PlaceChipModel(tone: .success, text: "Verified", icon: .shieldCheck)
        case .t3: PlaceChipModel(tone: .warning, text: "Claimed", icon: .home)
        default: PlaceChipModel(tone: .neutral, text: "Private setup", icon: .home)
        }
    }

    /// The address is the way to your homes: switch, add or manage them.
    private func addressButton(_ place: PlaceAddressRef) -> some View {
        let label = place.label
        return Button { showSwitcher = true } label: {
            HStack(spacing: 5) {
                Icon(.mapPin, size: 14, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                // The whole address when it fits; else the street alone, rather
                // than the address cut inside the city ("…Court, Ca…").
                ViewThatFits(in: .horizontal) {
                    addressText(label)
                    addressText(place.line1.isEmpty ? label : place.line1)
                }
                Icon(.chevronDown, size: 14, strokeWidth: 2.25, color: Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Your homes, \(label)")
        .accessibilityHint("Switch home or add a home")
        .accessibilityIdentifier("place.addressSwitcher")
    }

    private func addressText(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Theme.Color.appText)
            .lineLimit(1)
    }

    // MARK: - This season (Ballot P0)

    /// The civic_election envelope's Ballot P0 card, when the server sent one.
    static func ballot(in intel: PlaceIntelligence) -> (card: BallotSummary, asOf: String?)? {
        ballot(in: intel.groups.flatMap(\.sections))
    }

    /// The same card among a preview's sections (a saved or looked-up address).
    static func ballot(in sections: [PlaceSectionEnvelope]) -> (card: BallotSummary, asOf: String?)? {
        for section in sections where section.id == .civicElection {
            if section.status == .ready, let card = section.civicElection?.ballotCard {
                return (card, section.asOf)
            }
        }
        return nil
    }

    /// The server's groups, minus the election row the ballot card replaces.
    static func groups(_ intel: PlaceIntelligence) -> [PlaceGroupBlock] {
        guard ballot(in: intel) != nil else { return intel.groups }
        return intel.groups.compactMap { group in
            let sections = group.sections.filter { $0.id != .civicElection }
            return sections.isEmpty ? nil : PlaceGroupBlock(group: group.group, label: group.label, sections: sections)
        }
    }

    private func seasonBlock(_ card: BallotSummary, asOf: String?) -> some View {
        BallotSeasonBlock(
            card: card,
            asOf: asOf,
            onOpenGovernments: card.governments.map { governments in
                { ballotGovernments = BallotGovernmentsSheet(governments: governments) }
            }
        )
    }

    // MARK: - Worth a look

    /// Only real items, most consequential first (at most three), and the
    /// first-week card for a recent move-in. Hidden when there is nothing.
    @ViewBuilder
    private func worthALook(_ intel: PlaceIntelligence) -> some View {
        let items = Array(attentionItems(intel).prefix(3))
        let moveIn = JustMovedCard.shows(homeId: viewModel.homeId, moveInDate: viewModel.moveInDate)
        if !items.isEmpty || moveIn {
            PlaceSectionHeading(title: "Worth a look")
            if !items.isEmpty {
                PlaceWorthALook(items: items)
            }
            // Movers first (Wedge v2 D5): its ticks and dismissal are per Home, so another Home starts fresh.
            JustMovedCard(
                homeId: viewModel.homeId,
                moveInDate: viewModel.moveInDate,
                needsPickupDay: intel.groups.flatMap(\.sections).compactMap(\.addressCalendar).first?.needsPickupDay,
                onOpenDetail: viewModel.onOpenDetail,
                onOpenMailDay: viewModel.onOpenMailDay
            )
            .id(viewModel.homeId)
            .padding(.top, items.isEmpty ? 0 : 10)
        }
    }

    private func attentionItems(_ intel: PlaceIntelligence) -> [PlaceAttentionItem] {
        let sections = intel.groups.flatMap(\.sections)
        var items: [PlaceAttentionItem] = []
        if let systems = sections.first(where: { $0.id == .homeSystems }), systems.access != .locked,
           systems.status == .ready || systems.status == .stale, let data = systems.homeSystems,
           let item = PlaceAttentionItem.systems(data, open: { viewModel.onOpenDetail(.yourHome) }) {
            items.append(item)
        }
        let calendar = PlacePresentation.placeCalendar(intel.timeZone.flatMap(TimeZone.init(identifier:)))
        let openTasks = {
            viewModel.reloadOnReturn()
            viewModel.onOpenHomeShortcut(.tasks)
        }
        let homeId = viewModel.homeId
        items += PlaceAttentionItem.tasks(
            viewModel.overdueTasks(calendar: calendar),
            due: .overdue,
            homeId: homeId,
            calendar: calendar,
            openList: openTasks
        )
        items += PlaceAttentionItem.tasks(
            viewModel.tasksDueToday(calendar: calendar),
            due: .today,
            homeId: homeId,
            calendar: calendar,
            openList: openTasks
        )
        if let exemption = sections.first(where: { $0.id == .exemptionCheck }), exemption.status == .ready,
           exemption.exemptionCheck?.filingStatus == .noneOnFile {
            items.append(PlaceAttentionItem(
                id: "exemption",
                icon: .landmark,
                title: "No homestead exemption on file",
                detail: "The county record shows none. Worth checking whether this home qualifies."
            ) { viewModel.onOpenDetail(.money) })
        }
        if let bill = sections.first(where: { $0.id == .billBenchmark }), bill.status == .ready,
           let data = bill.billBenchmark, data.comparison == .higher {
            items.append(PlaceAttentionItem(id: "bill", icon: .zap, title: data.summary, detail: "Worth a look: see how it compares.") {
                viewModel.onOpenDetail(.money)
            })
        }
        return items
    }

    // MARK: - Your home at a glance

    private func groupBinding(_ group: PlaceGlanceGroup) -> Binding<Bool> {
        Binding(
            get: { openGroups.contains(group) },
            set: { open in
                if open { openGroups.insert(group) } else { openGroups.remove(group) }
            }
        )
    }

    private var openGroupsKey: String {
        let account: String = if case let .signedIn(user) = AuthManager.shared.state { user.id } else { "guest" }
        return "place.glance.open.\(account).\(viewModel.homeId)"
    }

    private func loadOpenGroups() {
        let stored = UserDefaults.standard.stringArray(forKey: openGroupsKey) ?? []
        openGroups = Set(stored.compactMap(PlaceGlanceGroup.init(rawValue:)))
    }

    private func saveOpenGroups(_ groups: Set<PlaceGlanceGroup>) {
        UserDefaults.standard.set(groups.map(\.rawValue).sorted(), forKey: openGroupsKey)
    }

    /// The sections that belong in each glance group, in the server's order.
    private static func glanceSections(_ intel: PlaceIntelligence) -> [PlaceGlanceGroup: [PlaceSectionEnvelope]] {
        Dictionary(grouping: groups(intel).flatMap(\.sections)) { PlaceGlanceGroup.of($0.group) }
    }

    /// Several sections the address has no data for yet: said once, above the groups.
    private static func sparse(_ intel: PlaceIntelligence) -> Bool {
        intel.groups.flatMap(\.sections).filter { $0.access != .locked && $0.status == .unavailable }.count >= 3
    }

    @ViewBuilder
    private func glance(_ intel: PlaceIntelligence, claim: OwnershipClaimDTO?) -> some View {
        let byGroup = Self.glanceSections(intel)
        let shown = PlaceGlanceGroup.allCases.filter { group in
            switch group {
            case .civic: !(byGroup[.civic] ?? []).isEmpty || Self.ballot(in: intel) != nil
            case .identity: claim == nil || !(byGroup[.identity] ?? []).isEmpty
            default: !(byGroup[group] ?? []).isEmpty
            }
        }
        PlaceSectionHeading(title: "Your home at a glance", detail: "\(shown.count) sections")
        if Self.sparse(intel) {
            Text("Some information isn't available for this address yet.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, 2)
                .padding(.bottom, 8)
                .accessibilityIdentifier("place.glance.sparse")
        }
        PlaceGroupSurface {
            ForEach(Array(shown.enumerated()), id: \.element) { index, group in
                if index > 0 { PlaceRowDivider() }
                let sections = byGroup[group] ?? []
                PlaceGlanceRow(group: group, summary: summary(group, sections: sections, intel: intel), isOpen: groupBinding(group)) {
                    groupContent(group, sections: sections, intel: intel, claim: claim)
                }
            }
        }
    }

    private func summary(_ group: PlaceGlanceGroup, sections: [PlaceSectionEnvelope], intel: PlaceIntelligence) -> String? {
        switch group {
        case .today: PlaceGlanceSummary.today(sections, timeZone: intel.timeZone.flatMap(TimeZone.init(identifier:)))
        case .home: PlaceGlanceSummary.home(sections)
        case .risk: PlaceGlanceSummary.risk(sections)
        case .civic: PlaceGlanceSummary.civic(intel.groups.flatMap(\.sections))
        case .identity: "Residency letters & passes · what neighbors see"
        case .block: PlaceGlanceSummary.block(sections)
        case .costs: PlaceGlanceSummary.plain(sections) ?? "Not available for this address yet"
        }
    }

    /// Before verification, for a resident who can take the step (as `loaded` decides).
    private func showsVerify(_ intel: PlaceIntelligence) -> Bool {
        intel.tier != .t4 && (intel.verifyAvailable ?? (intel.tier == .t3))
    }

    private func canVerify(_ intel: PlaceIntelligence, claim: OwnershipClaimDTO?) -> Bool {
        claim == nil && !(intel.tier == .t3 && intel.verifyAvailable == false)
    }

    @ViewBuilder
    private func groupContent(
        _ group: PlaceGlanceGroup,
        sections: [PlaceSectionEnvelope],
        intel: PlaceIntelligence,
        claim: OwnershipClaimDTO?
    ) -> some View {
        let unlocks = canVerify(intel, claim: claim)
        switch group {
        case .today:
            sectionRows(sections, intel: intel, canVerify: unlocks, page: .today)
            pulseBlock(intel, claim: claim)
        case .home:
            homeRows(sections, intel: intel, canVerify: unlocks)
        case .risk:
            ForEach(Array(sections.enumerated()), id: \.element.id) { index, env in
                if index > 0 { PlaceRowDivider() }
                PlaceEvidenceRow(
                    env: env,
                    verifiesFirst: intel.verifiesFirst,
                    onOpen: { viewModel.onOpenDetail(.risk) },
                    onUnlock: unlocks ? { showVerify = true } : nil
                )
            }
        case .civic:
            sectionRows(sections, intel: intel, canVerify: unlocks, page: .civic)
            // Ballot P0 (ballot_p0): "This season" and the "Your ballot" card; the election row leaves the list meanwhile.
            if let ballot = Self.ballot(in: intel) {
                seasonBlock(ballot.card, asOf: ballot.asOf)
                    .padding(.top, 10)
                    .id(Self.ballotAnchor)
            }
        case .identity:
            identityRows(sections, intel: intel, claim: claim)
        case .block, .costs:
            sectionRows(sections, intel: intel, canVerify: unlocks, page: group.page)
        }
        if group != .identity || claim == nil {
            PlaceInlineAction(title: "Open \(group.page.title)", identifier: "place.glance.\(group.rawValue).open") {
                viewModel.onOpenDetail(group.page)
            }
        }
    }

    /// The group's sections as lighter rows, each still opening its page.
    private func sectionRows(
        _ sections: [PlaceSectionEnvelope],
        intel: PlaceIntelligence,
        canVerify: Bool,
        page: PlaceDetailGroup
    ) -> some View {
        ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
            if index > 0 { PlaceRowDivider() }
            PlaceSectionView(
                env: section,
                onOpen: { viewModel.onOpenDetail(page) },
                onVerify: canVerify ? { showVerify = true } : nil,
                onClaim: canVerify ? { showVerify = true } : nil,
                onRetry: { Task { await viewModel.refresh() } },
                retrying: viewModel.isRefreshing,
                verifiesFirst: intel.verifiesFirst,
                timeZone: intel.timeZone.flatMap(TimeZone.init(identifier:)),
                chrome: false
            )
        }
    }

    /// Your home's row and the systems timeline (or the systems row's own state).
    @ViewBuilder
    private func homeRows(_ sections: [PlaceSectionEnvelope], intel: PlaceIntelligence, canVerify: Bool) -> some View {
        let others = sections.filter { $0.id != .homeSystems }
        sectionRows(others, intel: intel, canVerify: canVerify, page: .yourHome)
        if let systems = sections.first(where: { $0.id == .homeSystems }) {
            if !others.isEmpty { PlaceRowDivider() }
            if systems.access != .locked, systems.status == .ready || systems.status == .stale, let data = systems.homeSystems {
                Button { viewModel.onOpenDetail(.yourHome) } label: {
                    PlaceSystemsTimeline(data: data)
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens Your home, with each system's full timeline.")
            } else {
                sectionRows([systems], intel: intel, canVerify: canVerify, page: .yourHome)
            }
        }
    }

    /// Today's Pulse, inside Today at this address: the chip, the headline,
    /// the nudge and the way to the whole Pulse (a claim's opens Today).
    private func pulseBlock(_ intel: PlaceIntelligence, claim: OwnershipClaimDTO?) -> some View {
        let pulse = PlacePresentation.derivePulse(intel)
        let open = { claim == nil ? viewModel.onOpenPulse() : viewModel.onOpenDetail(.today) }
        return VStack(alignment: .leading, spacing: 6) {
            PlaceRowDivider()
            HStack {
                Text("TODAY'S PULSE")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.77)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                PlaceChip(model: pulse.chip)
            }
            .padding(.top, 8)
            Text(pulse.title)
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if let nudge = pulse.nudgeText, !nudge.isEmpty {
                Text(nudge)
                    .font(.system(size: 13))
                    .lineLimit(3)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            PlaceInlineAction(title: claim == nil ? "Open Pulse" : "Open Today", identifier: "place.hero", action: open)
        }
        .accessibilityElement(children: .contain)
    }

    /// The identity group, residency letters and passes, the steps still
    /// locked before verification, and what neighbors see.
    @ViewBuilder
    private func identityRows(_ sections: [PlaceSectionEnvelope], intel: PlaceIntelligence, claim: OwnershipClaimDTO?) -> some View {
        sectionRows(sections, intel: intel, canVerify: canVerify(intel, claim: claim), page: .identity)
        if claim == nil {
            if !sections.isEmpty { PlaceRowDivider() }
            Button { viewModel.onOpenDetail(.identity) } label: {
                PlaceActionRowLabel(icon: .idCard, title: "Residency letters & passes", subtitle: "Prove where you live, on your terms.")
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("place.identityEntry")
        }
        if showsVerify(intel) {
            Text("LOCKED UNTIL YOU VERIFY")
                .font(.system(size: 11, weight: .bold))
                .kerning(0.88)
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.top, 12)
                .accessibilityAddTraits(.isHeader)
            ForEach(PlacePresentation.verifyLockedItems) { item in
                PlaceLockedCard(icon: item.icon, title: item.title, reason: item.reason, cta: "Verify address", chrome: false) {
                    showVerify = true
                }
            }
        }
        if claim == nil {
            PlaceRowDivider()
            Button(action: viewModel.onOpenPrivacyMirror) {
                PlaceActionRowLabel(icon: .eye, title: "What neighbors see", subtitle: "Preview this address as a neighbor sees it.")
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("place.glance.privacyMirror")
        }
    }

    /// Wedge v2 §2 — "Private by default. See what neighbors see of this address."
    private var privacyMirrorRow: some View {
        Button(action: viewModel.onOpenPrivacyMirror) {
            HStack(spacing: 8) {
                Icon(.shieldCheck, size: 15, strokeWidth: 2.25, color: Theme.Color.home)
                Text("Private by default. See what neighbors see of this address.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 15, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("place.privacyMirror")
    }

    /// W7 — verified-neighbor messaging (verified residents only): one group, two rows.
    private func messagesEntry(address: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceSectionHeading(title: "Verified neighbors", detail: "Private messages")
            PlaceGroupSurface {
                Button { viewModel.onComposeMessage(address) } label: {
                    PlaceActionRowLabel(
                        icon: .messageSquarePlus,
                        title: "Message a neighbor",
                        subtitle: "Send a private heads-up to a home on your block."
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("place.messageNeighbor")
                PlaceRowDivider()
                Button { viewModel.onOpenInbox() } label: {
                    PlaceActionRowLabel(icon: .inbox, title: "Your inbox", subtitle: "Heads-ups from verified neighbors nearby.")
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("place.inbox")
            }
        }
    }
}

/// The governments view's payload, identified so `.sheet(item:)` keeps its
/// content on screen while the sheet slides away.
struct BallotGovernmentsSheet: Identifiable {
    let governments: BallotGovernments
    var id: BallotGovernments {
        governments
    }
}

// MARK: - Verify banner (sky-tinted nudge, before verification)

struct PlaceVerifyBanner: View {
    var icon: PantopusIcon = .shieldCheck
    var message = "Verify your address to message neighbors and get your badge."
    var action = "Verify address"
    var identifier = "place.verifyBanner"
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Theme.Color.primary100)
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .strokeBorder(Theme.Color.primary200, lineWidth: 1)
                    Icon(icon, size: 20, strokeWidth: 2, color: Theme.Color.primaryInk)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 4) {
                    Text(message)
                        .font(.system(size: 14.5, weight: .semibold))
                        .kerning(-0.14)
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.primary900)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 4) {
                        Text(action)
                            .font(.system(size: 13.5, weight: .semibold))
                        Icon(.arrowRight, size: 14, strokeWidth: 2.5, color: Theme.Color.primaryInk)
                    }
                    .foregroundStyle(Theme.Color.primaryInk)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 18, strokeWidth: 2.25, color: Theme.Color.primary300)
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
            .background(Theme.Color.infoBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.primary200, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Loading skeleton

struct PlaceDashboardSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    PlaceSkeleton(width: 150, height: 26)
                    PlaceSkeleton(width: 190, height: 14)
                }
                .padding(.horizontal, 18)
                .padding(.top, Spacing.s2)

                PlaceSkeleton(widthFraction: 1, height: 132, radius: 16)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                VStack(spacing: 24) {
                    ForEach(0..<3, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: 9) {
                            PlaceSkeleton(width: 90, height: 11)
                            VStack(spacing: 8) {
                                ForEach(0..<2, id: \.self) { _ in
                                    PlaceSkeleton(widthFraction: 1, height: 76, radius: 16)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
            }
        }
        .accessibilityLabel("Loading your place")
    }
}

#Preview("Place dashboard — loading") {
    PlaceDashboardSkeleton()
        .background(Theme.Color.appBg)
}

/// A place this account can't read (403): say so, without a retry, which
/// could only repeat the refusal. The same visual as `ErrorState` minus its
/// button; the web says the same (#896).
struct PlaceDeniedState: View {
    var body: some View {
        EmptyState(
            icon: .alertCircle,
            headline: "This place isn't available",
            subcopy: "You don't have permission to view this place."
        )
    }
}
