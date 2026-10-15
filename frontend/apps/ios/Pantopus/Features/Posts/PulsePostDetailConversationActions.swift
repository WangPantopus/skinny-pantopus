//
//  PulsePostDetailConversationActions.swift
//  Pantopus
//
//  Conversation mutations share the existing post-detail draft, save and
//  lifecycle handling. A successful action never inserts somebody else's
//  new reply ahead of the reader.
//

import Foundation

extension PulsePostDetailViewModel {
    func markConversationReplyHelpful(_ reply: PulseReplyDTO) async {
        guard let content = conversation, content.post.type == "ask_local",
              content.post.viewer?.canMarkHelpful == true, !reply.removed,
              beginConversationAction(reply.id) else { return }
        defer { finishConversationAction(reply.id) }
        do {
            let result: PulseHelpfulResponse = try await client.request(
                PulseEndpoints.markHelpful(postId: postId, replyId: reply.id, helpful: !reply.helpful)
            )
            guard var current = conversation else { return }
            if let updated = result.reply, updated.id == reply.id,
               let index = current.replies.firstIndex(where: { $0.id == reply.id }) {
                current.replies[index] = updated
            }
            if let status = result.postStatus { current.post.status = status }
            state = .conversation(current)
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't update Helpful. Try again.")
        }
    }

    func thankConversationReply(_ reply: PulseReplyDTO) async {
        guard !reply.removed, reply.canThank, !reply.thankedByViewer,
              reply.author?.id != currentUserId, beginConversationAction(reply.id) else { return }
        defer { finishConversationAction(reply.id) }
        do {
            let result: PulseThankResponse = try await client.request(
                PulseEndpoints.thankReply(postId: postId, replyId: reply.id)
            )
            guard result.thanked, var content = conversation,
                  let index = content.replies.firstIndex(where: { $0.id == reply.id }) else { return }
            content.replies[index].thankedByViewer = true
            state = .conversation(content)
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't send your thanks. Try again.")
        }
    }

    func reportConversationReply(_ reply: PulseReplyDTO, reason: String) async {
        guard !reply.removed, beginConversationAction(reply.id) else { return }
        defer { finishConversationAction(reply.id) }
        do {
            _ = try await client.request(
                PulseEndpoints.reportReply(postId: postId, replyId: reply.id, reason: reason),
                as: PostActionAckResponse.self
            )
            showToast("Report submitted. Thanks for flagging.", kind: .success)
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't submit the report. Try again.")
        }
    }

    func toggleConversationFollow() async {
        guard let content = conversation, beginConversationAction("follow") else { return }
        defer { finishConversationAction("follow") }
        let following = content.post.viewer?.following == true
        do {
            _ = try await client.request(
                following ? PulseEndpoints.unfollowPost(postId: postId) : PulseEndpoints.followPost(postId: postId),
                as: PostActionAckResponse.self
            )
            if await refreshConversationAfterMutation(), !following {
                showToast("Saved to Following. Notifications are off.", kind: .success)
            }
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't update Following. Try again.")
        }
    }

    func sendConversationReply() async {
        let body = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, conversation != nil, !isSendingComment, pendingConversationActions.isEmpty else { return }
        let revision = composerRevision
        let parentId = replyTarget?.commentId
        isSendingComment = true
        conversationMutationRevision += 1
        conversationGeneration += 1
        defer {
            isSendingComment = false
            conversationMutationRevision += 1
            store.markStale(topics: [ScreenTopic.post(postId), ScreenTopic.posts])
        }
        if pendingComment?.comment != body || pendingComment?.parentCommentId != parentId {
            pendingComment = PostCommentRequest(comment: body, parentCommentId: parentId, clientRequestId: UUID().uuidString)
        }
        guard let request = pendingComment else { return }
        do {
            // The existing response keeps its legacy fields; its id tells
            // the reconciliation read which new row the reader just sent.
            let result: PostCommentCreateResponse = try await client.request(
                PostsEndpoints.createComment(id: postId, body: request)
            )
            pendingComment = nil
            if revision == composerRevision {
                composerText = ""
                replyTarget = nil
            }
            await refreshConversationAfterMutation(ownReplyId: result.comment.id)
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't post your reply. Your draft is still here.")
        }
    }

    /// Full responses reconcile access and existing rows, while only a
    /// reply just submitted by this reader may appear without the pill.
    @discardableResult
    func refreshConversationAfterMutation(ownReplyId: String? = nil, reportFailure: Bool = true) async -> Bool {
        let generation = conversationGeneration
        do {
            let result: PulseConversationResponse = try await client.request(conversationEndpoint)
            guard generation == conversationGeneration, let previous = conversation else { return false }
            guard let post = result.post, !post.id.isEmpty else {
                store.remove(conversationEndpoint)
                state = .error(message: "This conversation is no longer available.", retryable: false)
                return false
            }
            let existing = Set(previous.replies.map(\.id))
            var ids = Set<String>()
            let rows = result.replies.filter { !$0.id.isEmpty && ids.insert($0.id).inserted }
            let shown = rows.filter { existing.contains($0.id) || $0.id == ownReplyId }
            conversationWaitingReplies = rows.filter { !existing.contains($0.id) && $0.id != ownReplyId }
            if let own = shown.first(where: { $0.id == ownReplyId }), let branch = own.branchId {
                expandedConversationBranches.insert(branch)
            }
            isSaved = post.viewer?.saved ?? false
            state = .conversation(PulseConversationContent(post: post, replies: shown))
            return true
        } catch {
            guard generation == conversationGeneration else { return false }
            if !clearRefusedConversation(error), reportFailure {
                showToast("Saved, but couldn't refresh the conversation. Try again.")
            }
            return false
        }
    }

    /// A refused action alone doesn't mean the conversation is gone:
    /// `NEEDS_VERIFIED_ADDRESS`, `NOT_POST_AUTHOR`, `SHARE_NOT_ALLOWED`,
    /// `OFFER_GONE` or a route an older server lacks all answer 4xx while the
    /// reader can still read it. A fresh read decides, and clears the page
    /// only when access really is gone.
    func reconcileAfterRefusal(_ error: any Error) async {
        switch error as? APIError {
        case .unauthorized, .forbidden, .notFound, .clientError:
            await refreshConversationAfterMutation(reportFailure: false)
        default:
            return
        }
    }

    func beginConversationAction(_ id: String) -> Bool {
        guard conversation != nil, pendingConversationActions.isEmpty, !isSendingComment else { return false }
        pendingConversationActions.insert(id)
        conversationGeneration += 1
        conversationMutationRevision += 1
        return true
    }

    func finishConversationAction(_ id: String) {
        pendingConversationActions.remove(id)
        conversationMutationRevision += 1
        store.markStale(topics: [ScreenTopic.post(postId), ScreenTopic.posts])
    }

    func toggleConversationPrimaryAction() async {
        guard let card = conversation?.post.pageCard(), ["going", "seen_it"].contains(card.actionKind ?? ""),
              beginConversationAction("primary") else { return }
        defer { finishConversationAction("primary") }
        do {
            _ = try await client.request(PostsEndpoints.toggleLike(id: postId, liked: !card.actionDone), as: PostLikeResponse.self)
            await refreshConversationAfterMutation()
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't update your response. Try again.")
        }
    }

    func muteConversationAuthor(_ id: String) async {
        guard id != currentUserId, beginConversationAction("mute") else { return }
        defer { finishConversationAction("mute") }
        do {
            _ = try await client.request(FeedActionsEndpoints.mute(entityType: .user, entityId: id), as: PostActionAckResponse.self)
            FeedModerationStore.shared.addMute(entityType: .user, entityId: id)
            await refreshConversationAfterMutation()
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            showToast(Self.refusal(in: error) ?? "Couldn't mute this person. Try again.")
        }
    }
}
