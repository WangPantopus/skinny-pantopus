//
//  PlanScreen.swift
//  Pantopus
//
//  One plan (boards J1 to J9 for a guest, H9 for its host): the map on
//  top, the plan in a panel that overlaps it, and one main action in the
//  sticky footer. J8 ("Didn't work out") and J9 (a playdate for someone
//  without a verified address) are plain screens with a top bar.
//

import SwiftUI

struct PlanScreen: View {
    @State private var viewModel: PlanScreenViewModel
    let intent: PlanOpenIntent
    @Binding var path: [PlansRoute]
    let onHost: (PlansHostStart?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var showsAsk = false
    @State private var askIsChange = false
    @State private var confirmation: PlanConfirmation?
    @State private var showsCancel = false
    @State private var showsReport = false
    @State private var chatRoute: PlanChatRoute?
    @State private var toast: String?
    @State private var askedOnOpen = false

    init(planId: String, intent: PlanOpenIntent, path: Binding<[PlansRoute]>, onHost: @escaping (PlansHostStart?) -> Void) {
        _viewModel = State(initialValue: PlanScreenViewModel(planId: planId))
        self.intent = intent
        _path = path
        self.onHost = onHost
    }

    var body: some View {
        Group {
            switch viewModel.phase {
            case .loading:
                loading
            case .loaded:
                if let card = viewModel.card { loaded(card) } else { loading }
            case let .needsVerification(city):
                PlanVerifyScreen(city: city, onClose: close)
            case .unavailable:
                unavailable
            case let .error(message):
                errorState(message)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(Theme.Color.appBg)
        .task {
            await viewModel.load()
            if let notice = PlansNavigator.shared.notice {
                PlansNavigator.shared.notice = nil
                viewModel.actionError = notice
            }
            guard !askedOnOpen else { return }
            askedOnOpen = true
            if intent == .ask, let viewer = viewModel.card?.viewer, viewer.canAsk || viewer.cannotAskReason == .fullUseWaitlist {
                showsAsk = true
            }
            if intent == .chat { openChat() }
        }
        .refreshesOnStoreChange(affects: PlansStoreReads.affects) { await viewModel.load() }
        .sheet(isPresented: $showsAsk) {
            if let card = viewModel.card {
                PlanAskSheet(card: card, previous: askIsChange ? viewModel.askPrefill : nil) { body in
                    await viewModel.ask(body)
                }
            }
        }
        .sheet(isPresented: $showsCancel) {
            PlanCancelSheet(viewModel: viewModel) { showsCancel = false }
        }
        .confirmationDialog("Report this plan", isPresented: $showsReport, titleVisibility: .visible) {
            ForEach(PlanReportReason.all, id: \.token) { reason in
                Button(reason.label) {
                    Task { if await viewModel.report(reason: reason.token) { toast = "Thanks. We'll look into it." } }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert(
            confirmation?.title ?? "",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            presenting: confirmation
        ) { item in
            Button(item.confirmLabel, role: .destructive) {
                Task { if let done = await item.perform(viewModel) { toast = done } }
            }
            Button("Not now", role: .cancel) {}
        } message: { item in
            Text(item.message)
        }
        .navigationDestination(item: $chatRoute) { route in
            PlanChatScreen(route: route)
        }
        .overlay(alignment: .bottom) { toastView }
        .accessibilityIdentifier("planScreen")
    }

    // MARK: - Loaded

    @ViewBuilder
    private func loaded(_ card: PlanCardDTO) -> some View {
        switch viewModel.mode {
        case let .notThisTime(status):
            PlanNotThisTimeScreen(
                card: card,
                status: status,
                otherPlans: viewModel.otherPlans,
                onBack: close,
                onOpen: openOther,
                onSeeAll: close
            ) { onHost(PlansHostStart(kind: card.kind)) }
        default:
            mapLayout(card)
        }
    }

    private func mapLayout(_ card: PlanCardDTO) -> some View {
        // The map runs under the status bar; the buttons over it stay below it.
        ZStack(alignment: .top) {
            planScroll(card)
            topButtons(card)
        }
    }

    private func planScroll(_ card: PlanCardDTO) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    PlanHeaderMap(
                        card: card,
                        place: viewModel.plan?.place,
                        isHosting: viewModel.mode == .hosting,
                        revealToken: viewModel.revealToken
                    )
                    if viewModel.plan?.place == nil, viewModel.mode != .hosting {
                        PlanScopeChip(text: card.kind == .playdate
                            ? "Exact place and time shared when you're in"
                            : "Exact place shared when you're in")
                            .padding(.leading, Spacing.s4)
                            .padding(.bottom, 34)
                    }
                }
                PlanScreenSections(
                    viewModel: viewModel,
                    onOpenHost: { path.append(.profile(userId: $0)) },
                    onOpenRequests: { path.append(.requests(planId: viewModel.planId)) },
                    onOpenChat: openChat,
                    onChange: { path.append(.change(planId: viewModel.planId)) },
                    onCancel: { showsCancel = true },
                    onConfirm: { confirmation = $0 }
                )
                .padding(.horizontal, Spacing.s4)
                .padding(.top, 18)
                .padding(.bottom, Spacing.s6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22, style: .continuous)
                        .fill(Theme.Color.appBg)
                )
                .padding(.top, -22)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            PlanFooter(
                viewModel: viewModel,
                onAsk: { change in
                    askIsChange = change
                    showsAsk = true
                },
                onConfirm: { confirmation = $0 }
            )
        }
        .refreshable { await viewModel.load() }
    }

    private func topButtons(_ card: PlanCardDTO) -> some View {
        HStack(spacing: Spacing.s2) {
            PlanGlassButton(icon: .chevronLeft, label: "Back", action: close)
                .accessibilityIdentifier("planBack")
            Spacer()
            if let url = card.shareUrl.flatMap(URL.init(string:)) {
                ShareLink(item: url, message: Text(card.title)) {
                    PlanGlassIcon(icon: .share)
                }
                .accessibilityLabel("Share")
                .accessibilityIdentifier("planShare")
            }
            if viewModel.mode != .hosting {
                Menu {
                    Button("Report this plan", role: .destructive) { showsReport = true }
                    Button("Block \(PlanCardLines.firstName(card.host.displayName))", role: .destructive) {
                        confirmation = .blockHost(name: card.host.displayName)
                    }
                } label: {
                    PlanGlassIcon(icon: .moreHorizontal)
                }
                .accessibilityLabel("More: report or block")
                .accessibilityIdentifier("planMore")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s1)
    }

    private func openChat() {
        guard let room = viewModel.plan?.chatRoomId, let card = viewModel.card else { return }
        let calendar = PlanFormat.calendar(for: card.timezone)
        let when = PlanFormat.rowWhen(state: card.state, start: card.startsAtDate, end: card.endsAtDate, calendar: calendar)
            ?? PlanFormat.dayPart(card.dayPart)
        let host = PlanCardLines.firstName(card.host.displayName)
        let place = viewModel.plan?.place?.name ?? (card.placeKind == .home ? "\(host)'s place" : card.area.label)
        chatRoute = PlanChatRoute(
            roomId: room,
            planId: card.id,
            title: card.details?.game.map { "\($0.label) game" } ?? card.title,
            kind: card.kind,
            when: when,
            place: place,
            closedNote: viewModel.plan.flatMap { PlanChatRules.closedNote($0) },
            peopleCount: viewModel.plan?.people.map { people in people.reduce(0) { $0 + max($1.partySize, 1) } }
        )
    }

    private func openOther(_ card: PlanCardDTO) {
        path.append(.plan(id: card.id, intent: .view))
    }

    private func close() {
        if path.isEmpty { dismiss() } else { path.removeLast() }
    }

    // MARK: - Other phases

    private var loading: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Shimmer(width: nil, height: PlanHeaderMap.height, cornerRadius: 0)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 120, height: 30, cornerRadius: Radii.pill)
                Shimmer(width: 280, height: 28, cornerRadius: Radii.xs)
                Shimmer(width: 220, height: 16, cornerRadius: Radii.xs)
                Shimmer(width: nil, height: 72, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            Spacer()
        }
        .ignoresSafeArea(edges: .top)
        .overlay(alignment: .topLeading) {
            PlanGlassButton(icon: .chevronLeft, label: "Back", action: close).padding(.horizontal, Spacing.s3)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Loading the plan")
    }

    private var unavailable: some View {
        PlanMessageScreen(
            title: "This plan isn't available",
            message: "It may have ended, been cancelled, or be just for neighbors closer by.",
            onBack: close
        )
    }

    private func errorState(_ message: String) -> some View {
        PlanMessageScreen(title: "Couldn't load this plan", message: message, onBack: close) {
            Button("Try again") { Task { await viewModel.load() } }
                .planButton(.secondary, size: .small)
                .frame(maxWidth: 220)
        }
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            ToastView(message: ToastMessage(text: toast))
                .padding(.bottom, 96)
                .task(id: toast) {
                    try? await Task.sleep(for: .seconds(2.5))
                    self.toast = nil
                }
        }
    }
}

// MARK: - Small shared pieces

/// A 44 pt round glass button over a map.
struct PlanGlassButton: View {
    let icon: PantopusIcon
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) { PlanGlassIcon(icon: icon) }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
    }
}

struct PlanGlassIcon: View {
    let icon: PantopusIcon

    var body: some View {
        Icon(icon, size: 20, color: Theme.Color.appText)
            .frame(width: 44, height: 44)
            .background(Circle().fill(.regularMaterial))
            .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
            .contentShape(Circle())
    }
}

/// A plain screen with a back button, a title and a sentence.
struct PlanMessageScreen<Extra: View>: View {
    let title: String
    let message: String
    let onBack: () -> Void
    @ViewBuilder var extra: () -> Extra

    init(title: String, message: String, onBack: @escaping () -> Void, @ViewBuilder extra: @escaping () -> Extra = { EmptyView() }) {
        self.title = title
        self.message = message
        self.onBack = onBack
        self.extra = extra
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            PlanNavBar(title: "", leading: .back, onLeading: onBack)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(title).planFont(.h2).foregroundStyle(Theme.Color.appText)
                Text(message)
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Spacing.s4)
            extra().padding(.horizontal, Spacing.s4)
            Spacer()
        }
    }
}

/// Board-style top bar: a 44 pt round button, a centered title, a trailing slot.
struct PlanNavBar: View {
    enum Leading { case back, close, none }

    let title: String
    var leading: Leading = .back
    var trailing: String?
    var onLeading: () -> Void = {}

    var body: some View {
        HStack(spacing: Spacing.s2) {
            switch leading {
            case .back:
                navButton(.chevronLeft, label: "Back")
            case .close:
                navButton(.x, label: "Close")
            case .none:
                Color.clear.frame(width: 44, height: 44)
            }
            Text(title)
                .planFont(.h4)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            Text(trailing ?? "")
                .planFont(.label)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(minWidth: 44, alignment: .trailing)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .frame(minHeight: 52)
    }

    private func navButton(_ icon: PantopusIcon, label: String) -> some View {
        Button(action: onLeading) {
            Icon(icon, size: 20, color: Theme.Color.appText)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.Color.appSurfaceSunken))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("planNav.\(label.lowercased())")
    }
}

/// The post report reasons (`reportPostSchema`, backend/routes/posts.js:339).
enum PlanReportReason {
    static let all: [(token: String, label: String)] = [
        ("safety", "Something unsafe"),
        ("harassment", "Harassment"),
        ("inappropriate", "Inappropriate"),
        ("spam", "Spam or a scam"),
        ("misinformation", "Not a real plan"),
        ("other", "Something else")
    ]
}
