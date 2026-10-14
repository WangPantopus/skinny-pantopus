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
            if conversation != nil { _ = clearRefusedConversation(error) }
            showToast(Self.refusal(in: error) ?? "Couldn't share this post. Try again.")
            return false
        }
    }

    var canNarrowAudience: Bool {
        isOwner && ["public", "verified_town"].contains(conversation?.post.readScope ?? "")
    }

    func narrowConversation(readScope: String, areaId: String? = nil) async -> Bool {
        let current = conversation?.post.readScope
        let validTown = current == "public" && readScope == "verified_town" && areaId == nil
        let validArea = current == "verified_town" && readScope == "verified_area" && areaId.flatMap(UUID.init(uuidString:)) != nil
        guard canNarrowAudience, validTown || validArea, !isPreparingShare,
              beginConversationAction("readScope") else { return false }
        toastMessage = nil
        defer { finishConversationAction("readScope") }
        do {
            let response: PulseConversationResponse = try await client.request(
                PulseEndpoints.narrowReadScope(postId: postId, readScope: readScope, areaId: areaId)
            )
            store.remove(conversationEndpoint)
            store.remove(PostsEndpoints.detail(id: postId))
            guard let post = response.post, post.id == postId, post.readScope == readScope,
                  areaId == nil || post.about?.areaId == areaId else {
                state = .error(message: "Couldn't confirm who can read this post. Refresh to check.", retryable: true)
                PulsePostsRefresh.notifyPostsDidChange()
                return false
            }
            if var content = conversation {
                content.post = post
                state = .conversation(content)
            }
            await refreshConversationAfterMutation()
            PulsePostsRefresh.notifyPostsDidChange()
            return true
        } catch {
            _ = clearRefusedConversation(error)
            showToast(Self.refusal(in: error) ?? "Couldn't change who can read this post. Try again.")
            return false
        }
    }
}
