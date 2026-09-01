//
//  InboxTabRoot.swift
//  Pantopus
//
//  Chat list (Inbox tab). Hosts the navigation stack — the screen body
//  is `ChatListView` (T2.1), and a row tap pushes `ChatConversationView`
//  (T2.2).
//

import SwiftUI

// swiftlint:disable cyclomatic_complexity multiple_closures_with_trailing_closure

/// Typed routes within the Inbox tab's NavigationStack.
public enum InboxRoute: Hashable {
    case conversation(InboxConversationDestination)
    case compose
    case search
    case composeGig(category: String)
    case composeListing
    case composePost(intent: String)
}

/// Routing payload for a conversation push — captures the mode the
/// view-model needs (room id / other-user id / AI sentinel) plus
/// header presentation data derived from the chat-list row.
public struct InboxConversationDestination: Hashable, Sendable {
    public enum Mode: Hashable, Sendable {
        case room(id: String)
        case person(otherUserId: String)
        case ai
    }

    public let mode: Mode
    /// Presentation mode for the conversation chrome. `.aiAssistant` for
    /// the Ask Pantopus thread; `.dm` for human DMs/groups.
    public let kind: ChatConversationMode
    public let displayName: String
    public let initials: String
    public let identityKind: String?
    public let verified: Bool
    public let initialTopic: ChatInitialTopic?
    /// Message to scroll to on open (set when arriving from Chat Search
    /// with a body match). `nil` opens the conversation at the latest
    /// message.
    public let scrollToMessageId: String?
    /// For gig-room rows: the backing gig id (unified-conversations
    /// `gig_id`), so the thread can pin the gig context strip.
    public let gigId: String?

    public init(
        mode: Mode,
        kind: ChatConversationMode = .dm,
        displayName: String,
        initials: String,
        identityKind: String?,
        verified: Bool,
        scrollToMessageId: String? = nil,
        initialTopic: ChatInitialTopic? = nil,
        gigId: String? = nil
    ) {
        self.mode = mode
        self.kind = kind
        self.displayName = displayName
        self.initials = initials
        self.identityKind = identityKind
        self.verified = verified
        self.scrollToMessageId = scrollToMessageId
        self.initialTopic = initialTopic
        self.gigId = gigId
    }
}

/// NavigationStack wrapper for the Inbox tab.
public struct InboxTabRoot: View {
    @Environment(AuthManager.self) private var auth
    @State private var path = RouteStack<InboxRoute>()
    @State private var router = DeepLinkRouter.shared
    /// P6.6 — "Invite to Pantopus" opens the system share sheet with the
    /// store link prefilled.
    @State private var systemSheet: SystemSheetRequest?

    public init() {}

    public var body: some View {
        NavigationStack(path: navigationPathBinding) {
            ChatListView(
                onOpenConversation: { row in
                    path.append(.conversation(destination(from: row)))
                },
                onCompose: { path.append(.compose) },
                onOpenSearch: { path.append(.search) }
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: InboxRoute.self) { route in
                destination(for: route)
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .onChange(of: router.pending) { _, pending in
            consumeDeepLinkIfNeeded(pending: pending)
        }
        .onAppear {
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .task {
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .sheet(item: $systemSheet) { request in request.makeView() }
    }

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    private var currentUserId: String {
        if case let .signedIn(user) = auth.state { return user.id }
        return ""
    }

    private func destination(from row: ConversationRowContent) -> InboxConversationDestination {
        let mode: InboxConversationDestination.Mode = switch row.variant {
        case .aiAssistant: .ai
        case .group: .room(id: row.id)
        case .dm: .person(otherUserId: row.id)
        }
        let kind: ChatConversationMode = row.variant == .aiAssistant ? .aiAssistant : .dm
        return InboxConversationDestination(
            mode: mode,
            kind: kind,
            displayName: row.displayName,
            initials: row.initials,
            identityKind: row.identityChip.map { $0 == .business ? "business" : "home" },
            verified: row.verified,
            gigId: row.gigId
        )
    }

    private func destination(from result: ChatSearchResult) -> InboxConversationDestination {
        let mode: InboxConversationDestination.Mode = switch result.kind {
        case .group: .room(id: result.conversationId)
        case .dm: .person(otherUserId: result.conversationId)
        }
        return InboxConversationDestination(
            mode: mode,
            displayName: result.displayName,
            initials: result.initials,
            identityKind: result.identityChip.map { $0 == .business ? "business" : "home" },
            verified: result.verified,
            scrollToMessageId: result.matchedMessageId
        )
    }

    private func consumeDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard let pending else { return }
        switch pending {
        case let .conversation(id):
            path.append(.conversation(InboxConversationDestination(
                mode: .room(id: id),
                kind: .dm,
                displayName: "Conversation",
                initials: "C",
                identityKind: nil,
                verified: false
            )))
            _ = router.consume()
        default:
            break
        }
    }

    @ViewBuilder
    private func destination(for route: InboxRoute) -> some View {
        switch route {
        case let .conversation(dest):
            ChatConversationView(
                viewModel: ChatConversationViewModel(
                    mode: Self.viewModelMode(for: dest.mode),
                    counterparty: Self.counterparty(for: dest),
                    currentUserId: currentUserId,
                    scrollToMessageId: dest.scrollToMessageId,
                    initialTopic: dest.initialTopic,
                    gigId: dest.gigId
                ),
                mode: dest.kind,
                onUseAIDraft: { draft in
                    path.append(draftRoute(for: draft))
                }
            ) { if !path.isEmpty { path.removeLast() } }
        case .compose:
            NewMessageView(
                viewModel: NewMessageViewModel(
                    onSelect: { destination in
                        // Swap the picker for the chat conversation —
                        // pop the picker first so back-button on the
                        // conversation returns to the chat list, not
                        // the picker.
                        if !path.isEmpty { path.removeLast() }
                        path.append(.conversation(InboxConversationDestination(
                            mode: .person(otherUserId: destination.userId),
                            displayName: destination.displayName,
                            initials: destination.initials,
                            identityKind: nil,
                            verified: destination.verified
                        )))
                    },
                    onCancel: { if !path.isEmpty { path.removeLast() } },
                    onInvite: { systemSheet = .share(items: InviteLinks.shareItems) }
                )
            )
        case .search:
            ChatSearchView(
                viewModel: ChatSearchViewModel(
                    onOpenResult: { result in
                        Task { @MainActor in path.append(.conversation(destination(from: result))) }
                    },
                    onCancel: {
                        Task { @MainActor in if !path.isEmpty { path.removeLast() } }
                    }
                )
            )
        case let .composeGig(category):
            GigComposeWizardView(preselectedCategoryKey: category) { _ in
                if !path.isEmpty { path.removeLast() }
            }
        case .composeListing:
            ListingComposeWizardView { _ in
                if !path.isEmpty { path.removeLast() }
            }
        case let .composePost(intent):
            PulseComposeFlowView(
                prefillFeedIntent: PulseIntent(rawValue: intent),
                onCancel: { if !path.isEmpty { path.removeLast() } },
                onPosted: { _ in if !path.isEmpty { path.removeLast() } }
            )
        }
    }

    private func draftRoute(for draft: ChatAIDraftCard) -> InboxRoute {
        switch draft.type {
        case "gig":
            .composeGig(category: "all")
        case "listing":
            .composeListing
        case "post":
            .composePost(intent: PulseIntent.ask.rawValue)
        default:
            .composePost(intent: PulseIntent.ask.rawValue)
        }
    }

    private static func viewModelMode(for mode: InboxConversationDestination.Mode) -> ChatThreadMode {
        switch mode {
        case .ai: .ai
        case let .room(id): .room(id: id)
        case let .person(otherUserId): .person(otherUserId: otherUserId)
        }
    }

    private static func counterparty(for dest: InboxConversationDestination) -> ChatCounterparty {
        switch dest.mode {
        case .ai:
            .ai(name: dest.displayName)
        case .room:
            .group(name: dest.displayName, memberCount: nil)
        case .person:
            .person(
                name: dest.displayName,
                initials: dest.initials,
                locality: nil,
                verified: dest.verified,
                online: false
            )
        }
    }
}

#Preview {
    InboxTabRoot()
        .environment(AuthManager.previewSignedIn)
}
