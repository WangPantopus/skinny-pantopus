//
//  PulsePageView.swift
//  Pantopus
//
//  The Pulse page (Pulse S6; build spec §3, wireframes 1 and 4 of
//  `docs/product/pulse-screens/`): "Pulse" and its area, the Nearby and
//  Following views, the topic chips, the quiet-state card, the groups under
//  their headers, "↑ N new conversations", and the end ("You're caught up",
//  "Show earlier"). Nothing loads by itself. The header scrolls with the
//  posts, so large text never leaves them a sliver of the screen. Every
//  text uses the Pulse scalable type. Same page as Android
//  (`PulsePageScreen.kt`).
//

import SwiftUI

public struct PulsePageView: View {
    @State private var viewModel: PulsePageViewModel
    @State private var menuCardId: String?
    @State private var reportingCardId: String?
    @State private var deletingCardId: String?
    @State private var mutingCardId: String?
    @State private var showsPreferences = false
    private let onOpenPost: @MainActor (String) -> Void
    private let onCompose: @MainActor () -> Void
    private let onEdit: @MainActor (String) -> Void
    private let topMenu: FeedTopMenu?
    private let quietCard: AnyView?
    private let onRefresh: (@MainActor () async -> Void)?

    private static let topID = "pulsePageTop"

    public init(
        onOpenPost: @escaping @MainActor (String) -> Void,
        onCompose: @escaping @MainActor () -> Void,
        onEdit: @escaping @MainActor (String) -> Void,
        topMenu: FeedTopMenu? = nil,
        quietCard: AnyView? = nil,
        onRefresh: (@MainActor () async -> Void)? = nil
    ) {
        _viewModel = State(initialValue: PulsePageViewModel())
        self.onOpenPost = onOpenPost
        self.onCompose = onCompose
        self.onEdit = onEdit
        self.topMenu = topMenu
        self.quietCard = quietCard
        self.onRefresh = onRefresh
    }

    public var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.s3) {
                    PulsePageHeader(areaName: viewModel.areaName, topMenu: topMenu) {
                        showsPreferences = true
                    }
                    .id(Self.topID)
                    PulsePageModePicker(selected: viewModel.mode) { mode in
                        Task { await viewModel.selectMode(mode) }
                    }
                    PulseTopicChipRow(activeTopic: viewModel.activeTopic) { topic in
                        Task { await viewModel.selectTopic(topic) }
                    }
                    stateBody
                }
                // The end of the page scrolls clear of the compose button.
                .padding(.bottom, Spacing.s16 + Spacing.s5)
            }
            .background(Theme.Color.appBg)
            .refreshable {
                await viewModel.refresh()
                await onRefresh?()
            }
            .overlay(alignment: .top) {
                if viewModel.newCount > 0 {
                    NewItemsPill(
                        text: Self.newConversationsText(viewModel.newCount),
                        direction: .up,
                        identifier: "pulseNewConversations"
                    ) {
                        withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(Self.topID, anchor: .top) }
                        Task { await viewModel.refresh() }
                    }
                    .padding(.top, Spacing.s2)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            FeedComposeFAB(action: onCompose)
                .padding(Spacing.s4)
        }
        .overlay(alignment: .bottom) { toast }
        .animation(.easeOut(duration: 0.2), value: viewModel.newCount > 0)
        .accessibilityIdentifier("pulsePage")
        .task { await viewModel.load() }
        .task { await pollNewConversations() }
        .confirmationDialog("Post options", isPresented: presenting($menuCardId), titleVisibility: .hidden) {
            cardMenu
        }
        .confirmationDialog("Report this post?", isPresented: presenting($reportingCardId), titleVisibility: .visible) {
            ForEach(pulseReportReasons, id: \.key) { reason in
                Button(reason.label) {
                    guard let id = reportingCardId else { return }
                    reportingCardId = nil
                    Task { await viewModel.reportPost(cardId: id, reason: reason.key) }
                }
                .accessibilityIdentifier("pulsePageReportReason_\(reason.key)")
            }
            Button("Cancel", role: .cancel) { reportingCardId = nil }
        } message: {
            Text("Reports are reviewed by the Pantopus team. The author isn't told who reported.")
        }
        .confirmationDialog("Delete post?", isPresented: presenting($deletingCardId), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                guard let id = deletingCardId else { return }
                deletingCardId = nil
                Task { await viewModel.deletePost(cardId: id) }
            }
            .accessibilityIdentifier("pulsePageDeleteConfirm")
            Button("Cancel", role: .cancel) { deletingCardId = nil }
        } message: {
            Text("This will permanently remove your post.")
        }
        .confirmationDialog(muteTitle, isPresented: presenting($mutingCardId), titleVisibility: .visible) {
            Button("Mute", role: .destructive) {
                guard let id = mutingCardId else { return }
                mutingCardId = nil
                Task { await viewModel.muteAuthor(cardId: id) }
            }
            .accessibilityIdentifier("pulsePageMuteConfirm")
            Button("Cancel", role: .cancel) { mutingCardId = nil }
        } message: {
            Text("You won't see their posts in any feed. You can undo this from their profile.")
        }
        .alert("Close this question?", isPresented: closingAsk) {
            Button("Close", role: .destructive) {
                guard let id = viewModel.closingAskCardId else { return }
                viewModel.closingAskCardId = nil
                Task { await viewModel.closeAsk(cardId: id) }
            }
            .accessibilityIdentifier("pulseAskCloseConfirm")
            Button("Cancel", role: .cancel) { viewModel.closingAskCardId = nil }
        } message: {
            Text("It leaves Pulse. You can restore it from My posts.")
        }
        .sheet(isPresented: $showsPreferences) {
            FeedPreferencesSheet(
                onClose: { showsPreferences = false },
                onPrefsChanged: { Task { await viewModel.refresh() } }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - States

    @ViewBuilder private var stateBody: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: Spacing.s3) {
                ForEach(0..<3, id: \.self) { _ in FeedSkeletonCard() }
            }
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("pulsePageLoading")
        case let .error(message):
            PulsePageErrorCard(message: message) {
                Task { await viewModel.refresh() }
            }
        case let .loaded(content):
            if content.quietCard != nil, let quietCard {
                quietCard.padding(.horizontal, Spacing.s4)
            }
            if content.isEmpty {
                PulsePageQuietDay(
                    areaName: content.areaName,
                    following: viewModel.mode == .following,
                    onCompose: onCompose
                )
            }
            ForEach(content.groups) { group in
                groupSection(group)
            }
            PulsePageEndCard(
                content: content,
                showsEarlierButton: viewModel.earlierPhase == .idle && content.end.canShowEarlier,
                onShowEarlier: { Task { await viewModel.showEarlier() } },
                onShown: { Task { await viewModel.endShown() } }
            )
            if let earlier = viewModel.earlierGroup {
                groupSection(earlier)
            }
            PulsePageEarlierFooter(phase: viewModel.earlierPhase) {
                Task { await viewModel.showEarlier() }
            }
        }
    }

    private func groupSection(_ group: PulsePageGroup) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if !group.title.isEmpty {
                Text(group.title)
                    .pulseFont(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.appSurfaceSunken)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("pulseGroup_\(group.key)")
            }
            ForEach(group.cards) { card in
                PulsePageCardView(
                    card: card,
                    onOpen: { onOpenPost(card.id) },
                    onAction: {
                        Task {
                            // Going and Seen it toggle here; the others live in the conversation.
                            let handled = await viewModel.tapAction(cardId: card.id)
                            if !handled { onOpenPost(card.id) }
                        }
                    },
                    onMenu: { menuCardId = card.id }
                )
                .padding(.horizontal, Spacing.s4)
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder private var toast: some View {
        if let text = viewModel.toastMessage {
            ToastView(message: ToastMessage(text: text, kind: viewModel.toastKind))
                .padding(.bottom, Spacing.s16 + Spacing.s5)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: text) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toastMessage = nil
                }
        }
    }

    /// About once a minute while the page is on screen (`.task` ends when it
    /// leaves): how many conversations arrived since it was read.
    private func pollNewConversations() async {
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 60_000_000_000)
            guard !Task.isCancelled else { return }
            await viewModel.pollNewCount()
        }
    }

    private func presenting(_ id: Binding<String?>) -> Binding<Bool> {
        Binding(get: { id.wrappedValue != nil }, set: { if !$0 { id.wrappedValue = nil } })
    }

    private var closingAsk: Binding<Bool> {
        Binding(
            get: { viewModel.closingAskCardId != nil },
            set: { if !$0 { viewModel.closingAskCardId = nil } }
        )
    }

    /// "1 new conversation", "3 new conversations".
    static func newConversationsText(_ count: Int) -> String {
        count == 1 ? "1 new conversation" : "\(count) new conversations"
    }
}

// MARK: - The card's "…"

private extension PulsePageView {
    @ViewBuilder var cardMenu: some View {
        if let id = menuCardId, let card = viewModel.card(id) {
            if let saved = card.saved {
                Button(saved ? "Remove bookmark" : "Save post") {
                    menuCardId = nil
                    Task { await viewModel.toggleSave(cardId: id) }
                }
                .accessibilityIdentifier("pulsePageMenuSave")
            }
            if card.isAuthor {
                if card.canKeepOpen {
                    Button("Keep open 7 more days") {
                        menuCardId = nil
                        Task { await viewModel.keepAskOpen(cardId: id) }
                    }
                    .accessibilityIdentifier("pulseAskKeepOpen")
                }
                if card.isOpenAsk {
                    Button("Close") {
                        menuCardId = nil
                        viewModel.closingAskCardId = id
                    }
                    .accessibilityIdentifier("pulseAskClose")
                }
                Button("Edit post") {
                    menuCardId = nil
                    onEdit(id)
                }
                .accessibilityIdentifier("pulsePageMenuEdit")
                Button("Delete post", role: .destructive) {
                    menuCardId = nil
                    deletingCardId = id
                }
                .accessibilityIdentifier("pulsePageMenuDelete")
            } else {
                if card.topic != nil {
                    Button("Mute this topic") {
                        menuCardId = nil
                        Task { await viewModel.muteTopic(cardId: id) }
                    }
                    .accessibilityIdentifier("pulsePageMenuMuteTopic")
                }
                Button("Hide post") {
                    menuCardId = nil
                    Task { await viewModel.hidePost(cardId: id) }
                }
                .accessibilityIdentifier("pulsePageMenuHide")
                if card.authorId != nil {
                    Button("Mute \(card.authorName)") {
                        menuCardId = nil
                        mutingCardId = id
                    }
                    .accessibilityIdentifier("pulsePageMenuMuteAuthor")
                }
                Button("Report post", role: .destructive) {
                    menuCardId = nil
                    reportingCardId = id
                }
                .accessibilityIdentifier("pulsePageMenuReport")
            }
            Button("Cancel", role: .cancel) { menuCardId = nil }
        }
    }

    var muteTitle: String {
        let name = mutingCardId.flatMap { viewModel.card($0)?.authorName } ?? "this author"
        return "Mute \(name)?"
    }
}
