//
//  NotificationSettingsViewModel+Copy.swift
//  Pantopus
//
//  Notification preferences through the screen store (Instant Screens, You:
//  fresh 10 minutes): the screen opens on the preferences as last read or
//  saved. A save stores the server's reply as the copy, so reopening never
//  shows a toggle where it was before the save.
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
}
