import Foundation
import Observation

enum PulseFollowSettingsState: Equatable {
    case loading
    case loaded(PulseFollowDTO)
    case empty
    case error(message: String)
}

@Observable
@MainActor
final class PulseFollowSettingsViewModel {
    private(set) var state: PulseFollowSettingsState = .loading
    private(set) var isSaving = false
    private(set) var errorMessage: String?
    let postId: String
    let canFollowUntilEnd: Bool
    private let api: APIClient
    private var generation = 0

    init(postId: String, canFollowUntilEnd: Bool, api: APIClient = .shared) {
        self.postId = postId
        self.canFollowUntilEnd = canFollowUntilEnd
        self.api = api
    }

    func load() async {
        guard !isSaving else { return }
        generation += 1
        let request = generation
        state = .loading
        errorMessage = nil
        do {
            let response: PulseFollowsResponse = try await api.request(PulseEndpoints.follows())
            guard request == generation, !Task.isCancelled else { return }
            guard let follow = response.follows.first(where: { $0.targetType == "post" && $0.targetId == postId }) else {
                state = .empty
                return
            }
            apply(follow)
        } catch {
            guard request == generation, !Task.isCancelled else { return }
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load Following. Please try again.")
        }
    }

    func update(notify: String, ends: String) async -> Bool {
        guard !isSaving, ["off", "recap", "each"].contains(notify), ["on_resolve", "week", "keep"].contains(ends),
              canFollowUntilEnd || ends != "on_resolve" else { return false }
        isSaving = true
        generation += 1
        errorMessage = nil
        defer { isSaving = false }
        do {
            let response: PulseFollowResponse = try await api.request(
                PulseEndpoints.followPost(postId: postId, notify: notify, ends: ends)
            )
            guard let follow = response.follow, follow.targetType == "post", follow.targetId == postId,
                  follow.notify == notify, follow.ends == ends else {
                state = .error(message: "Couldn't confirm Following. Refresh to check.")
                return false
            }
            apply(follow)
            PulsePostsRefresh.notifyPostsDidChange()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't update Following. Try again."
            return false
        }
    }

    func stopFollowing() async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        generation += 1
        errorMessage = nil
        defer { isSaving = false }
        do {
            let response: PulseFollowDeleteResponse = try await api.request(PulseEndpoints.unfollowPost(postId: postId))
            guard response.ok == true else {
                state = .error(message: "Couldn't confirm Following. Refresh to check.")
                return false
            }
            state = .empty
            PulsePostsRefresh.notifyPostsDidChange()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't stop following. Try again."
            return false
        }
    }

    private func apply(_ follow: PulseFollowDTO) {
        guard !follow.id.isEmpty, ["off", "recap", "each"].contains(follow.notify ?? ""),
              ["on_resolve", "week", "keep"].contains(follow.ends ?? "") else {
            state = .error(message: "Couldn't read these follow settings. Refresh to check.")
            return
        }
        state = .loaded(follow)
    }
}
