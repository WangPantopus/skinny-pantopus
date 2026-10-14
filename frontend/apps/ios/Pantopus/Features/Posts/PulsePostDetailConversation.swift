//
//  PulsePostDetailConversation.swift
//  Pantopus
//
//  The Pulse contract in the existing post-detail view model. New replies
//  wait behind the pill; updates to a reply already shown stay in place.
//

import Foundation

extension PulsePostDetailViewModel {
    var conversation: PulseConversationContent? {
        guard case let .conversation(content) = state else { return nil }
        return content
    }

    var conversationEndpoint: Endpoint {
        PulseEndpoints.conversation(postId: postId)
    }

    var canShareConversation: Bool {
        guard let post = conversation?.post else { return false }
        return post.readScope == "public" && post.viewer?.canShare == true
            && (post.moderation?.state == nil || post.moderation?.state == "live")
    }

    func fetchConversation(force: Bool) async {
        guard pendingConversationActions.isEmpty, !isSendingComment else { return }
        conversationGeneration += 1
        let generation = conversationGeneration
        let revision = conversationMutationRevision
        let startedAt = Date()
        do {
            try await store.show(
                conversationEndpoint,
                as: PulseConversationResponse.self,
                kind: .post,
                topics: [ScreenTopic.post(postId), ScreenTopic.posts],
                force: force
            ) { snapshot in
                guard generation == conversationGeneration, revision == conversationMutationRevision else { return }
                applyConversation(snapshot, startedAt: startedAt)
            }
        } catch is CancellationError {
            return
        } catch {
            guard generation == conversationGeneration else { return }
            if clearRefusedConversation(error) { return }
            if conversation != nil {
                if let copy = store.peek(conversationEndpoint, as: PulseConversationResponse.self) {
                    conversationRefreshNotice = copy.refreshNotice(afterEveryFailure: true)
                }
                if force { showToast("Couldn't refresh the conversation.") }
            } else {
                state = .error(
                    message: (error as? APIError)?.errorDescription ?? "Couldn't load the conversation. Try again.",
                    retryable: true
                )
            }
        }
    }

    func applyConversation(_ snapshot: ScreenSnapshot<PulseConversationResponse>, startedAt: Date) {
        guard let post = snapshot.value.post, !post.id.isEmpty else {
            store.remove(conversationEndpoint)
            state = .error(message: "This conversation is no longer available.", retryable: false)
            return
        }
        if conversationReadAt != snapshot.fetchedAt {
            conversationWaitingReplies = []
            // Overlap the request, rather than starting after its completion,
            // so a reply arriving during that request is not skipped.
            conversationPollAfter = min(snapshot.fetchedAt, startedAt)
        }
        conversationReadAt = snapshot.fetchedAt
        conversationRefreshNotice = snapshot.refreshNotice(afterEveryFailure: true)
        isSaved = post.viewer?.saved ?? false
        state = .conversation(PulseConversationContent(post: post, replies: snapshot.value.replies))
    }

    /// Called by the visible screen's one-minute loop. Re-reading from the
    /// same lower bound is deliberate: IDs deduplicate delayed responses.
    func pollConversationReplies() async {
        guard conversation != nil, let after = conversationPollAfter,
              pendingConversationActions.isEmpty, !isSendingComment else { return }
        let generation = conversationGeneration
        let revision = conversationMutationRevision
        do {
            let response: PulseRepliesResponse = try await client.request(
                PulseEndpoints.conversationReplies(postId: postId, after: PulsePageViewModel.iso(after))
            )
            guard generation == conversationGeneration, revision == conversationMutationRevision,
                  !Task.isCancelled, var content = conversation else { return }
            let positions = Dictionary(uniqueKeysWithValues: content.replies.enumerated().map { ($0.element.id, $0.offset) })
            var waiting = Dictionary(uniqueKeysWithValues: conversationWaitingReplies.enumerated().map { ($0.element.id, $0.offset) })
            for reply in response.replies where !reply.id.isEmpty {
                if let index = positions[reply.id] {
                    content.replies[index] = reply
                } else if let index = waiting[reply.id] {
                    conversationWaitingReplies[index] = reply
                } else {
                    waiting[reply.id] = conversationWaitingReplies.count
                    conversationWaitingReplies.append(reply)
                }
            }
            // Existing removed rows replace their old text immediately.
            state = .conversation(content)
        } catch {
            guard generation == conversationGeneration, !Task.isCancelled else { return }
            _ = clearRefusedConversation(error)
        }
    }

    var waitingReplyCount: Int {
        conversationWaitingReplies.filter { !$0.removed }.count
    }

    /// Returns the first added reply's id so the view can scroll there.
    func revealWaitingReplies() -> String? {
        guard var content = conversation else { return nil }
        var ids = Set(content.replies.map(\.id))
        let added = conversationWaitingReplies.filter { ids.insert($0.id).inserted }
        content.replies += added
        conversationWaitingReplies = []
        for reply in added {
            if let branch = content.branches
                .first(where: { $0.root?.id == reply.id || $0.descendants.contains(where: { $0.id == reply.id }) }) {
                expandedConversationBranches.insert(branch.id)
            }
        }
        state = .conversation(content)
        return added.first { !$0.removed }?.id
    }

    func expandConversationBranch(_ id: String) {
        expandedConversationBranches.insert(id)
    }

    func beginReply(to reply: PulseReplyDTO) {
        guard !reply.removed else { return }
        let name = reply.author?.displayName ?? ""
        replyTarget = ReplyTarget(commentId: reply.id, authorName: name.isEmpty ? "a neighbor" : name)
    }

    @discardableResult
    func clearRefusedConversation(_ error: any Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        switch apiError {
        case .unauthorized, .forbidden, .notFound:
            store.remove(conversationEndpoint)
            conversationGeneration += 1
            conversationWaitingReplies = []
            conversationReadAt = nil
            conversationPollAfter = nil
            conversationRefreshNotice = nil
            state = .error(message: apiError.errorDescription ?? "This conversation is no longer available.", retryable: false)
            return true
        default:
            return false
        }
    }
}
