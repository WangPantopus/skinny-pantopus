//
//  EditProfileViewModel+Load.swift
//  Pantopus
//
//  Opening Edit Profile (Instant Screens item 9): the form fills from the
//  screen store's copy of your profile (the You screen's) in the first
//  frame instead of a spinner. The read still runs every time and replaces
//  the form only while nothing was changed, so typing during a slow read is
//  kept, as on the web.
//

import Foundation

extension EditProfileViewModel {
    /// Initial load; no-op when already loaded.
    func load() async {
        if case .loaded = state { return }
        if let copy = store.peek(UsersEndpoints.profile(), as: ProfileResponse.self) {
            fill(from: copy.value)
        } else {
            state = .loading
        }
        do {
            let response = try await store.load(
                UsersEndpoints.profile(),
                as: ProfileResponse.self,
                kind: .you,
                topics: [ScreenTopic.profileMe],
                force: true
            ).value
            guard !isDirty else { return }
            fill(from: response)
        } catch {
            // A form already filled from the copy stays; saving says if it fails.
            if case .loaded = state { return }
            state = .error((error as? APIError)?.errorDescription ?? "Couldn't load profile.")
        }
    }

    private func fill(from response: ProfileResponse) {
        hydrate(from: response.user)
        // Seeded here rather than in `hydrate(from:)`: the PATCH echo
        // carries no `skills` key (`backend/routes/users.js:2194`), so
        // hydrating skills there would blank the list after every save.
        skills = response.user.skills ?? []
        savedSkills = skills
        state = .loaded
    }
}
