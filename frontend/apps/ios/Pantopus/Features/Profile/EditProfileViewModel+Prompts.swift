//
//  EditProfileViewModel+Prompts.swift
//  Pantopus
//
//  The editor's "Prompts" (n of 3; the answers save with the form's Save,
//  inside `PATCH /api/users/profile`) and "Pinned posts" (n of 3; Unpin
//  works at once, like the ⋯ menus), PRF SRV-2 and SRV-3.
//

import Foundation

extension EditProfileViewModel {
    var isPromptsDirty: Bool {
        prompts != savedPrompts
    }

    /// Adds an answer, or changes the one for its prompt in place.
    func setPrompt(_ prompt: ProfilePrompt) {
        var list = prompts ?? []
        if let index = list.firstIndex(where: { $0.key == prompt.key }) {
            list[index] = prompt
        } else if list.count < ProfilePromptCatalog.maxPrompts {
            list.append(prompt)
        }
        prompts = list
    }

    func removePrompt(key: String) {
        prompts?.removeAll { $0.key == key }
    }

    /// Your pinned posts, newest pin first.
    func loadPinned() async {
        guard let accountId else { return }
        do {
            let response = try await api.request(PostsEndpoints.userPinnedPosts(userId: accountId), as: FeedResponse.self)
            pinnedPosts = Array(response.posts.prefix(ProfilePins.maxPins))
        } catch {
            if Task.isCancelled { return }
            pinnedPosts = nil
        }
    }

    /// Unpins at once; the row goes when the server agrees.
    func unpin(_ postId: String) async {
        let result = await ProfilePins.shared.set(postId, pinned: false, client: api)
        toast = result
        if result.kind == .success { pinnedPosts?.removeAll { $0.id == postId } }
    }
}
