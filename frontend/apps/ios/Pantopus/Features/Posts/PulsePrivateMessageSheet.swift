import SwiftUI

struct PulsePrivateMessageDestination: Identifiable {
    let id: String
    let authorId: String
    let authorName: String
    let currentUserId: String
}

struct PulsePrivateMessageSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var chat: ChatConversationViewModel

    init(destination: PulsePrivateMessageDestination) {
        _chat = State(initialValue: ChatConversationViewModel(
            mode: .person(otherUserId: destination.authorId),
            counterparty: .person(
                name: destination.authorName,
                initials: String(destination.authorName.prefix(1)),
                locality: nil,
                verified: false,
                online: false
            ),
            currentUserId: destination.currentUserId,
            initialComposerText: "It's mine.\nhttps://www.pantopus.com/posts/\(destination.id)"
        ))
    }

    var body: some View {
        NavigationStack {
            ChatConversationView(viewModel: chat) { dismiss() }
                .toolbar(.hidden, for: .navigationBar)
        }
    }
}

extension PulsePostDetailViewModel {
    func prepareLostFoundMessage() async -> PulsePrivateMessageDestination? {
        guard let currentUserId, !currentUserId.isEmpty, !isOwner,
              conversation?.post.action?.kind == "its_mine",
              beginConversationAction("privateMessage") else { return nil }
        defer { finishConversationAction("privateMessage") }
        do {
            let response: PulseConversationResponse = try await client.request(conversationEndpoint)
            guard let post = response.post, post.id == postId, post.type == "lost_found", post.action?.kind == "its_mine",
                  post.moderation?.state == nil || post.moderation?.state == "live",
                  case let .signedIn(user) = AuthManager.shared.state, user.id == currentUserId,
                  let authorId = post.author?.id, !authorId.isEmpty, authorId != currentUserId else {
                showToast("This conversation is no longer available.")
                return nil
            }
            return PulsePrivateMessageDestination(
                id: post.id,
                authorId: authorId,
                authorName: post.author?.displayName ?? "A neighbor",
                currentUserId: currentUserId
            )
        } catch {
            _ = clearRefusedConversation(error)
            showToast(Self.refusal(in: error) ?? "Couldn't open a private message. Try again.")
            return nil
        }
    }
}
