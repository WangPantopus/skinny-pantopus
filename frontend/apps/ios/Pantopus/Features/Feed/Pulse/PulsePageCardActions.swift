//
//  PulsePageCardActions.swift
//  Pantopus
//
//  The Pulse page's card "…" entries (Pulse S6; build spec §3, "everything
//  else is in '…'"), agreed with PA: Save post / Remove bookmark, Mute this
//  topic, Hide post, Mute {name} and Report post on someone else's post;
//  Keep open 7 more days and Close on the asker's open Ask (Pulse S7), Edit
//  and Delete on your own. All on existing endpoints; each change shows at
//  once and comes back if the server refuses.
//

import Foundation

// MARK: - The card's "…"

public extension PulsePageViewModel {
    /// "Save post" / "Remove bookmark": `POST /api/posts/:id/save`.
    func toggleSave(cardId: String) async {
        guard let card = card(cardId), let saved = card.saved, beginMutation(cardId) else { return }
        savedOverrides[cardId] = !saved
        defer { finishMutation(cardId) }
        rebuild()
        do {
            let response: PostSaveResponse = try await api.request(PostsEndpoints.toggleSave(id: cardId, saved: !saved))
            savedOverrides[cardId] = response.saved
            rebuild()
            showToast(response.saved ? "Saved to your bookmarks." : "Removed from bookmarks.", kind: .success)
            // My posts → Saved reads again.
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            savedOverrides[cardId] = saved
            rebuild()
            toastMessage = "Couldn't update your bookmark."
        }
    }

    func hidePost(cardId: String) async {
        moderation.addHiddenPost(cardId)
        rebuild()
        do {
            _ = try await api.request(FeedActionsEndpoints.hidePost(id: cardId), as: PostActionAckResponse.self)
            showToast("Post hidden from your feed.", kind: .success)
        } catch {
            moderation.removeHiddenPost(cardId)
            rebuild()
            toastMessage = "Couldn't hide that post."
        }
    }

    /// "Mute {name}": their posts leave every feed (app-wide, as today).
    func muteAuthor(cardId: String) async {
        guard let card = card(cardId), let authorId = card.authorId else { return }
        moderation.addMute(entityType: .user, entityId: authorId)
        rebuild()
        do {
            _ = try await api.request(
                FeedActionsEndpoints.mute(entityType: .user, entityId: authorId),
                as: PostActionAckResponse.self
            )
            showToast("Muted \(card.authorName).", kind: .success)
        } catch {
            moderation.removeMute(entityType: .user, entityId: authorId)
            rebuild()
            toastMessage = "Couldn't mute \(card.authorName)."
        }
    }

    /// "Mute this topic", everywhere until S5 brings area ids (Pulse S4).
    func muteTopic(cardId: String) async {
        guard let card = card(cardId), let topic = card.topic else { return }
        moderation.addTopicMute(topic.rawValue)
        rebuild()
        do {
            _ = try await api.request(
                FeedActionsEndpoints.mutePulseTopic(topic.rawValue, areaId: nil),
                as: PostActionAckResponse.self
            )
            showToast("\(topic.label) muted.", kind: .success)
            // Saved pages still hold the topic's posts; they read again when next opened.
            store.markStale(topics: [ScreenTopic.posts])
        } catch {
            moderation.removeTopicMute(topic.rawValue)
            rebuild()
            toastMessage = "Couldn't mute \(topic.label)."
        }
    }

    /// `POST /api/posts/:id/report` with one of `reportPostSchema`'s reasons.
    func reportPost(cardId: String, reason: String) async {
        do {
            _ = try await api.request(PostsEndpoints.report(id: cardId, reason: reason), as: PostActionAckResponse.self)
            showToast("Report sent. We'll review it shortly.", kind: .success)
        } catch {
            toastMessage = "Couldn't send that report."
        }
    }

    /// "Keep open 7 more days" on the asker's own open Ask (Pulse S7): once.
    func keepAskOpen(cardId: String) async {
        do {
            _ = try await api.request(PulseEndpoints.keepAskOpen(postId: cardId), as: PulseAskActionResponse.self)
            keptOpen.insert(cardId)
            showToast("Kept open for 7 more days.", kind: .success)
        } catch {
            // Already kept open (another device, an earlier tap): the option goes away.
            if Self.serverCode(error) == "ALREADY_KEPT_OPEN" { keptOpen.insert(cardId) }
            toastMessage = (error as? APIError)?.errorDescription ?? "Couldn't keep it open."
        }
        rebuild()
    }

    /// "Close", after "Close this question?" (Pulse S7): it leaves Pulse;
    /// My posts can restore it.
    func closeAsk(cardId: String) async {
        do {
            _ = try await api.request(PulseEndpoints.closeAsk(postId: cardId), as: PulseAskActionResponse.self)
            removed.insert(cardId)
            rebuild()
            showToast("Question closed.", kind: .success)
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            toastMessage = (error as? APIError)?.errorDescription ?? "Couldn't close it."
        }
    }

    /// `DELETE /api/posts/:id`, author only; the card leaves at once and
    /// comes back if the server refuses.
    func deletePost(cardId: String) async {
        removed.insert(cardId)
        rebuild()
        do {
            _ = try await api.request(PostsEndpoints.deletePost(id: cardId), as: PostActionAckResponse.self)
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            removed.remove(cardId)
            rebuild()
            toastMessage = "Could not delete post."
        }
    }
}
