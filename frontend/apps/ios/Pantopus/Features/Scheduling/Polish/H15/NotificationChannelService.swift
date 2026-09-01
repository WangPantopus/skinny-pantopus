//
//  NotificationChannelService.swift
//  Pantopus
//
//  H15 · Stream I18. The thin service behind the channel-connect prompt.
//
//  • Push is a REAL OS gate: read the current authorization status, request it,
//    and register for remote notifications on grant (mirrors AppDelegate).
//  • Denied push deep-links to the system Settings app.
//  • Email/SMS channel state round-trips through `GET/PUT
//    /notification-preferences` under `prefs.channels` — unknown prefs keys are
//    preserved so this never clobbers the A4 `notify_me` / `notify_attendees`
//    matrix (the prefs object is `object.unknown(true)` server-side).
//
//  Note (backend gap, flagged in the PR): the scheduling API has no OTP
//  send/verify route for reminder channels — the account email is already
//  verified at sign-up and SMS delivery is deferred ("coming soon"). The
//  verify frames therefore confirm the channel choice and persist it; they do
//  not call a (non-existent) code endpoint.
//

import UIKit
import UserNotifications

/// OS push permission + reminder-channel persistence for the H15 prompt.
@MainActor
struct NotificationChannelService {
    static let shared = NotificationChannelService(client: .shared)

    private let client: SchedulingClient

    init(client: SchedulingClient) {
        self.client = client
    }

    // MARK: - OS push

    /// The current OS push authorization, collapsed to the three states the
    /// prompt branches on.
    func pushStatus() async -> PushAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            return .notDetermined
        case .denied:
            return .denied
        case .authorized, .provisional, .ephemeral:
            return .authorized
        @unknown default:
            return .notDetermined
        }
    }

    /// Present the OS permission prompt. Registers for remote notifications on
    /// grant (so the APNs token round-trips exactly as at launch). Returns
    /// whether permission was granted.
    func requestPush() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
            return granted
        } catch {
            return false
        }
    }

    /// Deep-link to the app's page in the system Settings app (denied recovery).
    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    // MARK: - Channel preferences (prefs.channels)

    /// The channels currently marked connected in `notification-preferences`.
    /// Best-effort: a read failure yields an empty set rather than throwing.
    func connectedChannels() async -> Set<NotificationChannel> {
        guard let response: NotificationPreferencesResponse =
            try? await client.request(SchedulingEndpoints.getNotificationPreferences())
        else {
            return []
        }
        let channels = response.prefs.dictValue?["channels"]?.dictValue ?? [:]
        return Set(NotificationChannel.allCases.filter { channels[$0.rawValue]?.boolValue == true })
    }

    /// Persist a channel's connected state, preserving every other prefs key.
    func setChannel(_ channel: NotificationChannel, enabled: Bool) async throws {
        let current: NotificationPreferencesResponse =
            try await client.request(SchedulingEndpoints.getNotificationPreferences())
        var root = current.prefs.dictValue ?? [:]
        var channels = root["channels"]?.dictValue ?? [:]
        channels[channel.rawValue] = .bool(enabled)
        root["channels"] = .object(channels)
        let request = UpdateNotificationPreferencesRequest(prefs: .object(root))
        let _: NotificationPreferencesResponse =
            try await client.request(SchedulingEndpoints.updateNotificationPreferences(request))
    }
}
