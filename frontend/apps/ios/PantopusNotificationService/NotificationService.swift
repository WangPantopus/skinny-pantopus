//
//  NotificationService.swift
//  PantopusNotificationService
//
//  Notifications show their real content (founder, November 5). Signing out
//  deletes the phone's push tokens, but a push already on its way can still
//  arrive afterwards. iOS runs this extension before showing a push the backend
//  marked `mutable-content` (`apnsClient.buildPayload`). A push for anyone other
//  than the account signed in here keeps none of its content.
//
//  The extension can't hide a push: iOS shows the original when it gets empty
//  content, unless Apple has granted the notification filtering entitlement.
//  So it shows the same two lines as Android's lock-screen version.
//

import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        contentHandler(Self.content(for: request.content, account: PushAccountMarker.read()))
    }

    static func content(for content: UNNotificationContent, account: PushAccountMarker.State) -> UNNotificationContent {
        guard let recipient = content.userInfo["recipient_user_id"] as? String,
              !belongs(to: recipient, account: account) else { return content }
        let type = content.userInfo["type"] as? String
        let isChat = type == "chat_message" || type == "business_message"
        let plain = UNMutableNotificationContent()
        plain.body = isChat ? "New message" : "New notification"
        plain.sound = content.sound
        plain.categoryIdentifier = isChat ? "CHAT_MESSAGE" : ""
        // All the app reads to refuse a tap on it (`AppDelegate.permitsNotification`).
        plain.userInfo = ["recipient_user_id": recipient, "type": type ?? ""]
        return plain
    }

    /// When the phone can't say who is signed in, the push stays as it came:
    /// that's what someone who updated the app and hasn't opened it yet needs.
    private static func belongs(to recipient: String, account: PushAccountMarker.State) -> Bool {
        switch account {
        case .unknown: true
        case .signedOut: false
        case let .signedIn(userId): userId.caseInsensitiveCompare(recipient) == .orderedSame
        }
    }
}
