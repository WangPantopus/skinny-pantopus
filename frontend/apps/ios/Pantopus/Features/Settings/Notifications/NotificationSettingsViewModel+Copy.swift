//
//  NotificationSettingsViewModel+Copy.swift
//  Pantopus
//
//  Notification preferences through the screen store (Instant Screens, You:
//  fresh 10 minutes): the screen opens on the preferences as last read or
//  saved. A save stores the server's reply as the copy, so reopening never
//  shows a toggle where it was before the save. The account-wide Push switch
//  lives on the profile route, read and saved here too.
//

import Foundation

extension NotificationSettingsViewModel {
    var preferencesScopeIsCurrent: Bool {
        sessionScope.isCurrent
    }

    private func requireCurrentPreferencesScope(generation: Int) throws {
        guard preferencesScopeIsCurrent, store.generation == generation else { throw CancellationError() }
        try Task.checkCancellation()
    }

    func storedPreferences() -> NotificationPreferencesDTO? {
        guard preferencesScopeIsCurrent else { return nil }
        return store.peek(NotificationPreferencesEndpoints.fetch(), as: NotificationPreferencesResponseDTO.self)?.value.preferences
    }

    func readPreferences(force: Bool) async throws -> NotificationPreferencesResponseDTO {
        let generation = store.generation
        try requireCurrentPreferencesScope(generation: generation)
        let response = try await store.load(
            NotificationPreferencesEndpoints.fetch(),
            as: NotificationPreferencesResponseDTO.self,
            kind: .you,
            topics: [ScreenTopic.profileMe],
            force: force
        ).value
        try requireCurrentPreferencesScope(generation: generation)
        return response
    }

    /// `PUT /api/hub/preferences` replies with the whole preferences, the same
    /// shape as the read: that reply becomes the store's copy.
    func savePreferences(_ patch: [String: JSONValue], generation: Int) async throws -> NotificationPreferencesResponseDTO {
        try requireCurrentPreferencesScope(generation: generation)
        let endpoint = NotificationPreferencesEndpoints.update(patch) { [self] in
            try requireCurrentPreferencesScope(generation: generation)
        }
        let reply = try await api.requestDataResponse(endpoint)
        // A successful response still belongs to the session/cache that sent it.
        // No suspension is allowed between this check, the cache write and return.
        try requireCurrentPreferencesScope(generation: generation)
        let response = try ScreenStore.decoder().decode(NotificationPreferencesResponseDTO.self, from: reply.data)
        store.put(
            NotificationPreferencesEndpoints.fetch(),
            data: reply.data,
            kind: .you,
            topics: [ScreenTopic.profileMe],
            showsBeforeRecheck: true
        )
        return response
    }

    // MARK: - The account-wide Push switch (the profile route, as on the web)

    func storedAccountPush() -> Bool? {
        guard preferencesScopeIsCurrent else { return nil }
        return store.peek(UsersEndpoints.profile(), as: ProfileResponse.self)?.value.user.pushNotifications
    }

    /// Always the server's answer: the web can change the switch while this
    /// phone hears nothing, and a fresh copy would keep showing the old value.
    func readAccountPush() async throws -> Bool? {
        let generation = store.generation
        try requireCurrentPreferencesScope(generation: generation)
        let response = try await store.load(
            UsersEndpoints.profile(),
            as: ProfileResponse.self,
            kind: .you,
            topics: [ScreenTopic.profileMe],
            force: true
        ).value
        try requireCurrentPreferencesScope(generation: generation)
        return response.user.pushNotifications
    }

    /// `PATCH /api/users/profile` with only the switch. The reply isn't the
    /// read's shape (no invite progress), so it doesn't replace the store's
    /// copy of your profile; that copy goes out of date instead.
    func saveAccountPush(_ isOn: Bool, generation: Int) async throws -> Bool {
        try requireCurrentPreferencesScope(generation: generation)
        let endpoint = UsersEndpoints.updateProfile(ProfileUpdateRequest(pushNotifications: isOn)) { [self] in
            try requireCurrentPreferencesScope(generation: generation)
        }
        let response: ProfileUpdateResponse = try await api.request(endpoint)
        try requireCurrentPreferencesScope(generation: generation)
        store.markStale(topics: [ScreenTopic.profileMe])
        return response.user.pushNotifications ?? isOn
    }
}
