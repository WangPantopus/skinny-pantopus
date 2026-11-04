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

/// NavigationStack wrapper for the Inbox tab.
public struct InboxTabRoot: View {
    @Environment(AuthManager.self) private var auth
    /// Regular width (the iPhone Duo open) puts the list and the open conversation side by side.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var path = RouteStack<InboxRoute>()
    /// A fold replaces the navigation presentation, not its conversations.
    @State private var conversationModels = InboxConversationModels()
    @State private var router = DeepLinkRouter.shared
    /// P6.6 — "Invite to Pantopus" opens the system share sheet with the
    /// store link prefilled.
    @State private var systemSheet: SystemSheetRequest?
    @State private var profileUnavailable = false

    public init() {}

    public var body: some View {
        Group {
            if isSideBySide {
                InboxSplitView(
                    path: $path,
                    list: { chatList(onEmptyChange: $0) },
                    destination: { destination(for: $0) }
                )
            } else {
                NavigationStack(path: navigationPathBinding) {
                    chatList()
                        .readableColumn()
                        .toolbar(.hidden, for: .navigationBar)
                        .swipesBackFromEdge()
                        .navigationDestination(for: InboxRoute.self) { route in
                            destination(for: route)
                                .readableColumn()
                                .toolbar(.hidden, for: .navigationBar)
                        }
                }
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
        .alert("Couldn't open profile. Please try again.", isPresented: $profileUnavailable) {}
        .onChange(of: path.routes) { _, routes in
            conversationModels.retain(routes: routes, userId: currentUserId)
        }
        .onChange(of: currentUserId) { _, userId in
            conversationModels.retain(routes: [], userId: userId)
        }
    }

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    private func completeConversationArrival(_ destination: InboxConversationDestination) {
        if let roomId = destination.arrivalRoomId {
            router.completeConversationArrival(id: roomId)
            return
        }
        guard case let .room(id) = destination.mode else { return }
        router.completeConversationArrival(id: id)
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
            _ = router.consume()
            let viewerId = currentUserId
            Task { @MainActor in
                let destination = await Self.linkedConversation(roomId: id, viewerId: viewerId)
                path.open(.conversation(destination), sideBySide: isSideBySide)
            }
        case let .assistant(nudgeId, conversationId, launch):
            _ = router.consume()
            let nudge = nudgeId.map { AIAssistantNudge(notificationId: $0, conversationId: conversationId) }
            // A link's fixed keys, or Siri's words handed over in memory.
            openAssistant(nudge: nudge, launch: launch ?? AIAssistantLaunchInbox.shared.take(userId: currentUserId))
        default:
            break
        }
    }

    /// A chat link (`/chat/:roomId`, what chat pushes carry) names only the
    /// room. A direct room with exactly one other person, who the viewer has
    /// not blocked, opens that person's thread as the Messages list does, so
    /// its details keep Report and Block. A room the list shows under its own
    /// name (a Support Train's, a group's) opens under that name. Anything
    /// else, or a failed read, opens the room exactly as before.
    private static func linkedConversation(roomId: String, viewerId: String) async -> InboxConversationDestination {
        let room = InboxConversationDestination(
            mode: .room(id: roomId),
            kind: .dm,
            displayName: "Conversation",
            initials: "C",
            identityKind: nil,
            verified: false
        )
        guard !viewerId.isEmpty,
              let detail = try? await APIClient.shared.request(
                  ChatEndpoints.room(roomId: roomId), as: ChatRoomDetailResponse.self
              )
        else { return room }
        guard detail.room.type == "direct" else {
            guard detail.room.type != "gig", let name = detail.room.name, !name.isEmpty else { return room }
            let initials = name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
            return InboxConversationDestination(
                mode: .room(id: roomId),
                kind: .dm,
                displayName: name,
                initials: initials.isEmpty ? "?" : initials,
                identityKind: nil,
                verified: false
            )
        }
        let others = (detail.room.participants ?? []).filter { $0.userId != viewerId }
        guard others.count == 1,
              let otherId = others.first?.userId, !otherId.isEmpty,
              let name = others.first?.user?.displayName, !name.isEmpty,
              let blocks = try? await APIClient.shared.request(BlocksEndpoints.blocked, as: UserBlocksResponse.self),
              !blocks.blocked.contains(where: { $0.userId == otherId })
        else { return room }
        let initials = name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
        return InboxConversationDestination(
            mode: .person(otherUserId: otherId),
            kind: .dm,
            displayName: name,
            initials: initials.isEmpty ? "?" : initials,
            identityKind: nil,
            verified: false,
            arrivalRoomId: roomId
        )
    }

    @ViewBuilder
    private func destination(for route: InboxRoute) -> some View {
        switch route {
        case let .conversation(dest):
            ChatConversationView(
                viewModel: conversationModel(for: dest),
                mode: dest.kind,
                onUseAIDraft: { draft in
                    path.append(draftRoute(for: draft))
                },
                onContentLoaded: { completeConversationArrival(dest) },
                onOpenProfile: { userId in
                    Task { @MainActor in
                        do {
                            guard let route = try await dest.profileRoute(userId: userId),
                                  path.last == .conversation(dest) else { return }
                            path.append(route)
                        } catch {
                            if path.last == .conversation(dest) { profileUnavailable = true }
                        }
                    }
                }
            ) { if !path.isEmpty { path.removeLast() } }
                .onDisappear { completeConversationArrival(dest) }
                // A thread is its route: when `openAssistant` swaps the thread on
                // top for another nudge's, SwiftUI would otherwise keep the old
                // view and its view model, and the new nudge would never load.
                .id(dest)
        case .compose:
            newMessage()
        case .search:
            ChatSearchView(
                viewModel: conversationModels.search(userId: currentUserId),
                onOpenResult: { result in
                    Task { @MainActor in path.open(.conversation(destination(from: result)), sideBySide: isSideBySide) }
                },
                onCancel: {
                    Task { @MainActor in path.closeSearch(sideBySide: isSideBySide) }
                }
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
            postComposer(intent: intent, draft: nil, route: route)
        case let .composePostDraft(draft):
            postComposer(intent: PulseIntent.from(postType: draft.postType).rawValue, draft: draft, route: route)
        case let .startSupportTrain(story):
            supportTrainStart(story: story, route: route)
        case let .publicProfile(userId):
            profileDestination(userId: userId)
        case let .businessProfile(businessId):
            businessProfileDestination(businessId: businessId)
        case let .post(postId):
            PostPageDestination(postId: postId, currentUserId: currentUserId, onBack: { if !path.isEmpty { path.removeLast() } }) {
                path.append(.publicProfile(userId: $0))
            } onEdit: { path.append(.editPost(postId: $0)) }
        case let .editPost(postId):
            PulseComposeFlowView(
                editingPostId: postId,
                session: conversationModels.composeSession(for: route, userId: currentUserId),
                onCancel: { if !path.isEmpty { path.removeLast() } }
            ) { _ in
                if !path.isEmpty { path.removeLast() }
            }
        }
    }

    private func profileDestination(userId: String) -> some View {
        PublicProfileView(
            userId: userId,
            onBack: { if !path.isEmpty { path.removeLast() } },
            onOpenMessages: { profile in
                Task { @MainActor in
                    var previousPath = path
                    previousPath.removeLast()
                    if let previous = previousPath.last,
                       case let .conversation(destination) = previous,
                       destination.mode == .person(otherUserId: profile.id),
                       destination.kind == .dm {
                        path = previousPath
                        return
                    }
                    path.append(.conversation(.directMessage(with: profile)))
                }
            },
            onOpenGig: { gigId in
                // The Inbox stack has no gig-detail route; the router opens it in Tasks.
                Task { @MainActor in DeepLinkRouter.shared.handle(path: "/gig/\(gigId)") }
            },
            onOpenProfile: { otherId in
                Task { @MainActor in path.append(.publicProfile(userId: otherId)) }
            },
            onOpenPost: { postId in path.append(.post(postId: postId)) }
        )
    }

    /// Where an assistant draft's "Use" goes. Posts and Support Trains carry
    /// their text, so the composer opens with the draft instead of empty.
    private func draftRoute(for draft: ChatAIDraftCard) -> InboxRoute {
        switch draft.type {
        case "gig":
            .composeGig(category: "all")
        case "listing":
            .composeListing
        case "post":
            if let prefill = draft.prefill {
                .composePostDraft(prefill.postDraft)
            } else {
                .composePost(intent: PulseIntent.ask.rawValue)
            }
        case "support_train":
            .startSupportTrain(story: draft.prefill?.body ?? "")
        default:
            .composePost(intent: PulseIntent.ask.rawValue)
        }
    }
}

// MARK: - Chat list

private extension InboxTabRoot {
    /// New message's picker, kept above both layouts with what was typed into its search.
    func newMessage() -> some View {
        NewMessageView(
            viewModel: conversationModels.newMessage(userId: currentUserId) {
                NewMessageViewModel(
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
                            identityKind: destination.identity == .business ? "business" : nil,
                            verified: destination.verified
                        )))
                    },
                    onCancel: { if !path.isEmpty { path.removeLast() } },
                    onInvite: { systemSheet = .share(items: InviteLinks.shareItems) }
                )
            }
        )
    }

    func businessProfileDestination(businessId: String) -> some View {
        BusinessProfileDestination(
            businessId: businessId,
            onBack: { if !path.isEmpty { path.removeLast() } },
            onOpenMessages: { destination in
                // Contact from the header returns to the existing thread and its draft.
                var previousPath = path
                previousPath.removeLast()
                if let previous = previousPath.last,
                   case let .conversation(conversation) = previous,
                   conversation.mode == .person(otherUserId: businessId) {
                    path = previousPath
                } else {
                    path.append(.conversation(destination))
                }
            },
            onShare: { systemSheet = .share(items: [$0]) },
            onEdit: { router.handle(path: "/businesses/\(businessId)/page-editor") }
        )
    }

    func conversationModel(for destination: InboxConversationDestination) -> ChatConversationViewModel {
        conversationModels.model(for: destination, userId: currentUserId) {
            ChatConversationViewModel(
                mode: destination.threadMode,
                counterparty: destination.counterparty,
                currentUserId: currentUserId,
                scrollToMessageId: destination.scrollToMessageId,
                initialTopic: destination.initialTopic,
                gigId: destination.gigId,
                asBusinessUserId: destination.asBusinessUserId,
                aiNudge: destination.assistantNudge,
                aiLaunch: destination.assistantLaunch
            )
        }
    }

    /// Upright, the open Duo keeps both columns too (the founder's pick on
    /// November 2). At the accessibility text sizes one column reads better.
    var isSideBySide: Bool {
        horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize
    }

    func chatList(onEmptyChange: @escaping @MainActor (Bool) -> Void = { _ in }) -> some View {
        ChatListView(
            onOpenConversation: { row in
                ChatPerformance.signposter.emitEvent("ThreadTap")
                path.open(.conversation(destination(from: row)), sideBySide: isSideBySide)
            },
            onCompose: { path.open(.compose, sideBySide: isSideBySide) },
            onOpenSearch: { path.openSearch(sideBySide: isSideBySide) },
            onEmptyChange: onEmptyChange
        )
    }
}

// MARK: - Pantopus AI draft destinations

private extension InboxTabRoot {
    /// `pantopus://assistant` (a brief's or nudge's push or row): the
    /// assistant thread, at the nudge when there is one. A thread already on
    /// top gives way, so the new one opens with its latest messages.
    func openAssistant(nudge: AIAssistantNudge?, launch: AIAssistantLaunch? = nil) {
        let destination = InboxConversationDestination(
            mode: .ai,
            kind: .aiAssistant,
            displayName: "Pantopus AI",
            initials: "AI",
            identityKind: nil,
            verified: false,
            assistantNudge: nudge,
            assistantLaunch: launch
        )
        guard !isSideBySide else {
            path.open(.conversation(destination), sideBySide: true)
            return
        }
        if case let .conversation(top)? = path.last, top.mode == .ai { path.removeLast() }
        path.append(.conversation(destination))
    }

    func postComposer(intent: String, draft: PulseComposeDraft?, route: InboxRoute) -> some View {
        PulseComposeFlowView(
            prefillFeedIntent: PulseIntent(rawValue: intent),
            prefillDraft: draft,
            session: conversationModels.composeSession(for: route, userId: currentUserId),
            onCancel: { if !path.isEmpty { path.removeLast() } },
            onPosted: { _ in if !path.isEmpty { path.removeLast() } }
        )
    }

    /// The start-a-Support-Train wizard, opened from a Pantopus AI card with its story.
    func supportTrainStart(story: String, route: InboxRoute) -> some View {
        StartSupportTrainWizardView(
            viewModel: conversationModels.supportTrainStart(for: route, userId: currentUserId) {
                StartSupportTrainWizardViewModel(prefillReason: story)
            },
            onDismiss: {
                Task { @MainActor in if !path.isEmpty { path.removeLast() } }
            },
            onOpenTrain: { trainId in
                // The train opens where Support Trains live (the Hub), as its link does.
                Task { @MainActor in
                    if !path.isEmpty { path.removeLast() }
                    if let url = URL(string: "pantopus://support-trains/\(trainId)") {
                        DeepLinkRouter.shared.handle(url: url)
                    }
                }
            }
        )
    }
}

#Preview {
    InboxTabRoot()
        .environment(AuthManager.previewSignedIn)
}
