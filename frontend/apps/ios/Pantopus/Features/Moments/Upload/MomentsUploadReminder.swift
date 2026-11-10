//
//  MomentsUploadReminder.swift
//  Pantopus
//
//  A Moment's file goes up in the background and still finishes after the
//  system closes the app. Swiping the app away is different: iOS then stops
//  every app's transfers and doesn't start the app again, so nothing of ours
//  runs to say so. The reminder is set before that can happen: a local
//  notification, "Your Moment didn't finish posting. Open Pantopus to finish
//  it.", scheduled each time the file starts going up and taken back when it
//  is in. Opening the app (from the notification or any other way) carries
//  the upload on from its outbox folder. Only while notifications are already
//  allowed: this never asks.
//

import Foundation
import UserNotifications

@MainActor
enum MomentsUploadReminder {
    /// The notification's `type`, as pushes carry one.
    nonisolated static let type = "moment_upload"
    /// One try can't outlast the server's five minutes, and the app is woken when a try ends: a file still
    /// not in after seven was stopped.
    static let delay: TimeInterval = 420
    /// The app is being closed by hand with a file on its way: said right away.
    static let afterClosing: TimeInterval = 5

    /// Uploads with a reminder set (or being set), so one taken back while it was being set stays back.
    private static var live: Set<String> = []
    /// Notifications were allowed the last time that was read; closing the app has no time to ask again.
    private static var allowed = false

    /// The file for outbox folder `id` starts going up: the reminder is set (again) for `delay` from now.
    static func schedule(_ id: String, account: String?) {
        live.insert(id)
        Task {
            let center = UNUserNotificationCenter.current()
            let status = await center.notificationSettings().authorizationStatus
            allowed = status == .authorized || status == .provisional || status == .ephemeral
            guard allowed, live.contains(id) else { return }
            center.removeDeliveredNotifications(withIdentifiers: [identifier(id)])
            try? await center.add(request(id, account: account, after: delay))
            // Finished while it was being set: it goes.
            if !live.contains(id) { center.removePendingNotificationRequests(withIdentifiers: [identifier(id)]) }
        }
    }

    /// The file is in, or the Moment was discarded: no reminder, pending or shown.
    static func cancel(_ id: String) {
        live.remove(id)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier(id)])
        center.removeDeliveredNotifications(withIdentifiers: [identifier(id)])
    }

    /// Sign-out: nothing of the last account's is left to remind about.
    static func cancelAll() {
        let ids = live.map(identifier)
        live = []
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
        // One set by an earlier run of the app isn't in `live`: every reminder of ours goes, pending or shown.
        Task {
            let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: pending)
            let shown = await center.deliveredNotifications().map(\.request.identifier).filter { $0.hasPrefix(prefix) }
            center.removeDeliveredNotifications(withIdentifiers: shown)
        }
    }

    /// The app is being closed by hand (swiped away) with files still going up: iOS stops them now, so the
    /// reminders come in a few seconds instead of minutes.
    static func appWillTerminate(account: String?) {
        guard allowed else { return }
        let center = UNUserNotificationCenter.current()
        for id in live {
            center.add(request(id, account: account, after: afterClosing))
        }
    }

    private static func request(_ id: String, account: String?, after seconds: TimeInterval) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.body = "Your Moment didn't finish posting. Open Pantopus to finish it."
        content.sound = .default
        var info: [String: String] = ["type": type, "link": "/app/moments"]
        // As a push names who it is for: another account signed in on this phone doesn't get it.
        if let account { info["recipient_user_id"] = account }
        content.userInfo = info
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(seconds, 1), repeats: false)
        return UNNotificationRequest(identifier: identifier(id), content: content, trigger: trigger)
    }

    private static let prefix = "moments.upload."

    private static func identifier(_ id: String) -> String {
        prefix + id
    }
}
