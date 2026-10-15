import Foundation

extension PulsePostDetailViewModel {
    var canSharePost: Bool {
        if conversation != nil { return canShareConversation }
        guard case let .loaded(content) = state, !content.post.isRemovedByModerator,
              content.post.allowExternalShare != false,
              content.post.moderationState == nil || content.post.moderationState == "live" else { return false }
        if let scope = content.post.readScope { return scope == "public" }
        return content.post.visibility == "public" || content.post.audience == "public"
    }

    func authorizeShare() async -> Bool {
        guard canSharePost, !isPreparingShare, pendingConversationActions.isEmpty,
              case let .signedIn(user) = AuthManager.shared.state else { return false }
        let sessionId = AuthManager.shared.sessionId
        isPreparingShare = true
        defer { isPreparingShare = false }
        do {
            let response: PostShareResponse = try await client.request(PostsEndpoints.share(id: postId))
            guard response.shared == true, !Task.isCancelled, canSharePost,
                  sessionId == AuthManager.shared.sessionId,
                  case let .signedIn(currentUser) = AuthManager.shared.state,
                  user.id == currentUser.id else { return false }
            return true
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't share this post. Try again.")
            if conversation != nil { await reconcileAfterRefusal(error) }
            return false
        }
    }

    var canNarrowToTown: Bool {
        isOwner && conversation?.post.readScope == "public"
    }

    func narrowConversationToTown() async {
        guard canNarrowToTown, !isPreparingShare, beginConversationAction("readScope") else { return }
        defer { finishConversationAction("readScope") }
        do {
            _ = try await client.request(
                PulseEndpoints.narrowReadScope(postId: postId, readScope: "verified_town"),
                as: PostActionAckResponse.self
            )
            store.remove(conversationEndpoint)
            store.remove(PostsEndpoints.detail(id: postId))
            if var content = conversation {
                content.post.readScope = "verified_town"
                state = .conversation(content)
            }
            await refreshConversationAfterMutation()
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't change who can read this post. Try again.")
            await reconcileAfterRefusal(error)
        }
    }
}
