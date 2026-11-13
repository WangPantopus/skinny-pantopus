//
//  MomentsViewer+Profile.swift
//  Pantopus
//
//  From a Moment to the person: the face and the name at the top of the
//  viewer open their profile (a business's page for a business) in a sheet
//  over the Moment, which waits and plays on when the profile is closed.
//  Seen by's rows open the watcher's profile the same way.
//

import SwiftUI

/// Whose profile the viewer opens: a person's, or a business's page.
struct MomentsViewerProfile: Identifiable, Hashable {
    let id: String
    let isBusiness: Bool

    /// The profile a face opens; none for the Pantopus account.
    init?(_ author: MomentAuthorDTO) {
        guard author.kind != .pantopus, !author.id.isEmpty else { return nil }
        id = author.id
        isBusiness = author.kind == .business
    }
}

extension MomentsViewer {
    /// The header's face and name open the author's profile; your own Moment's header opens nothing.
    var authorAction: (() -> Void)? {
        guard !model.isMine, let author = model.ring?.author, let profile = MomentsViewerProfile(author) else { return nil }
        return { session.profile = profile }
    }
}

extension View {
    /// The profile a Moment's viewer opens: a sheet over it, as Seen by is, in the phone's own light or dark (the
    /// viewer is always dark). A sheet leaves the viewer on screen under it, so the Moment only waits.
    func momentsProfileSheet(_ profile: Binding<MomentsViewerProfile?>, systemScheme: ColorScheme) -> some View {
        sheet(item: profile) { shown in
            MomentsProfilePage(profile: shown) { profile.wrappedValue = nil }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.Color.appBg)
                .environment(\.colorScheme, systemScheme)
                .preferredColorScheme(systemScheme)
        }
    }

    func momentsViewerProfile(session: MomentsWatchSession, systemScheme: ColorScheme) -> some View {
        momentsProfileSheet(Binding(get: { session.profile }, set: { session.profile = $0 }), systemScheme: systemScheme)
    }
}

/// A profile opened over a Moment, with what its buttons lead to: a message to them, another person's profile.
struct MomentsProfilePage: View {
    let profile: MomentsViewerProfile
    let onClose: @MainActor () -> Void

    @State private var path: [Step] = []
    @State private var shared: SharedLink?

    enum Step: Hashable {
        case person(String)
        case business(String)
        case chat(InboxConversationDestination)
    }

    struct SharedLink: Identifiable {
        let id = UUID()
        let link: String
    }

    var body: some View {
        NavigationStack(path: $path) {
            page(profile.isBusiness ? .business(profile.id) : .person(profile.id))
                .navigationDestination(for: Step.self) { page($0) }
        }
        // A ring tapped here would open a second viewer over the first: the Moment under this page is one close away.
        .environment(\.momentsRingsPlay, false)
        .sheet(item: $shared) { SystemShareSheet(items: [$0.link]) }
        .accessibilityIdentifier("moments.viewer.profile")
    }

    private func back() {
        if path.isEmpty { onClose() } else { path.removeLast() }
    }

    private var viewerId: String {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return ""
    }

    @ViewBuilder
    private func page(_ step: Step) -> some View {
        switch step {
        case let .person(userId):
            PublicProfileView(
                userId: userId,
                onBack: back,
                onOpenMessages: { path.append(.chat(.directMessage(with: $0))) },
                onOpenProfile: { path.append(.person($0)) }
            )
            .toolbar(.hidden, for: .navigationBar)
        case let .business(businessId):
            BusinessProfileDestination(
                businessId: businessId,
                onBack: back,
                onOpenMessages: { path.append(.chat($0)) },
                onShare: { shared = SharedLink(link: $0) },
                onEdit: { _ in }
            )
            .toolbar(.hidden, for: .navigationBar)
        case let .chat(destination):
            ChatConversationView(
                viewModel: ChatConversationViewModel(
                    mode: destination.threadMode,
                    counterparty: destination.counterparty,
                    counterpartyAvatarURL: destination.avatarURL.flatMap(URL.init(string:)),
                    currentUserId: viewerId,
                    initialTopic: destination.initialTopic
                ),
                mode: destination.kind,
                onOpenProfile: { path.append(.person($0)) },
                onBack: back
            )
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}
