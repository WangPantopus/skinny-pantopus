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
    func storedPreferences() -> NotificationPreferencesDTO? {
        store.peek(NotificationPreferencesEndpoints.fetch(), as: NotificationPreferencesResponseDTO.self)?.value.preferences
    }

    func readPreferences(force: Bool) async throws -> NotificationPreferencesResponseDTO {
        try await store.load(
            NotificationPreferencesEndpoints.fetch(),
            as: NotificationPreferencesResponseDTO.self,
            kind: .you,
            topics: [ScreenTopic.profileMe],
            force: force
        ).value
    }

    /// `PUT /api/hub/preferences` replies with the whole preferences, the same
    /// shape as the read: that reply becomes the store's copy.
    func savePreferences(_ patch: [String: JSONValue]) async throws -> NotificationPreferencesResponseDTO {
        let reply = try await api.requestDataResponse(NotificationPreferencesEndpoints.update(patch))
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
